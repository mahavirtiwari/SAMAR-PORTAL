<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\V1\ApplicationController;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

class SyncUnitAdminContactDetailsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function callSync(int $unitId, int $orgId, array $contactData): ?int
    {
        $controller = app(ApplicationController::class);
        $method = new ReflectionMethod($controller, 'syncUnitAdminContactDetails');
        $method->setAccessible(true);

        return $method->invoke($controller, $unitId, $orgId, $contactData);
    }

    private function makeUnitWithAdmin(): array
    {
        $org = Organization::factory()->create();
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Unit',
            'address' => 'Addr',
            'state' => 'State',
            'district' => 'District',
            'pincode' => '110011',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        $admin = User::factory()->create([
            'organization_id' => $org->id,
            'email' => 'old.spoke@example.com',
            'first_name' => 'Old',
            'last_name' => 'Spoke',
        ]);
        $role = Role::where('slug', Role::UNIT_ADMIN)->firstOrFail();
        $admin->roles()->attach($role->id, [
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return [$org, $unit, $admin];
    }

    public function test_sync_reassigns_the_same_account_to_a_new_contact_email(): void
    {
        [$org, $unit, $admin] = $this->makeUnitWithAdmin();
        $originalId = $admin->id;
        $originalSamarId = $admin->samar_id;
        $originalPassword = $admin->password;

        $result = $this->callSync($unit->id, $org->id, [
            'name' => 'New Spoke',
            'email' => 'new.spoke@example.com',
            'mobile' => '9999999999',
        ]);

        // Same User row and SAMAR id are kept — the email is overwritten, not a new account.
        $this->assertSame($originalId, $result);

        $fresh = $admin->fresh();
        $this->assertSame('new.spoke@example.com', $fresh->email);
        $this->assertSame('New Spoke', $fresh->full_name);
        $this->assertSame($originalSamarId, $fresh->samar_id);
        // Email change re-issues login credentials, so the password is reset.
        $this->assertNotSame($originalPassword, $fresh->password);
    }

    public function test_sync_updates_details_without_resetting_password_when_email_unchanged(): void
    {
        [$org, $unit, $admin] = $this->makeUnitWithAdmin();
        $originalPassword = $admin->password;

        $result = $this->callSync($unit->id, $org->id, [
            'name' => 'Old SpokeUpdated',
            'email' => 'OLD.SPOKE@example.com', // same email, different case
            'designation' => 'Quality Head',
        ]);

        $this->assertSame($admin->id, $result);

        $fresh = $admin->fresh();
        $this->assertSame('old.spoke@example.com', $fresh->email);
        $this->assertSame('Old SpokeUpdated', $fresh->full_name);
        $this->assertSame('Quality Head', $fresh->designation);
        // No email change → no credential re-issue → password untouched.
        $this->assertSame($originalPassword, $fresh->password);
    }
}
