<?php

namespace Tests\Feature;

use App\Mail\NotificationMail;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\NotificationTemplateSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class SpokeManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(NotificationTemplateSeeder::class);
    }

    private function tokenFor(User $user): string
    {
        // The protected API group requires a real access-token Bearer header
        // (validate.token.type:access), which actingAs() does not provide.
        return JWTAuth::fromUser($user);
    }

    private function assignRole(User $user, string $slug, ?int $orgId, ?int $unitId): void
    {
        $role = Role::where('slug', $slug)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $orgId,
            'unit_id' => $unitId,
            'is_active' => true,
            'assigned_at' => now(),
        ]);
    }

    private function makeUnit(Organization $org): Unit
    {
        return Unit::create([
            'organization_id' => $org->id,
            'name' => 'Test Unit',
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Haryana',
            'district' => 'Gurugram',
            'pincode' => '122016',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
    }

    public function test_unit_admin_cannot_create_another_user(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);
        $unitAdmin = User::factory()->create(['organization_id' => $org->id]);
        $this->assignRole($unitAdmin, Role::UNIT_ADMIN, $org->id, $unit->id);

        // API expects camelCase keys (ConvertRequestToSnakeCase middleware).
        $response = $this->withToken($this->tokenFor($unitAdmin))->postJson('/api/v1/users', [
            'firstName' => 'New',
            'lastName' => 'Admin',
            'email' => 'new.admin@example.com',
            'mobileNumber' => '9876543210',
            'organizationId' => $org->id,
            'roles' => [
                ['slug' => Role::UNIT_ADMIN, 'organizationId' => $org->id, 'unitId' => $unit->id],
            ],
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseMissing('users', ['email' => 'new.admin@example.com']);
    }

    public function test_change_spoke_preserves_samar_id_and_emails_new_spoke(): void
    {
        Mail::fake();

        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);

        $ea = User::factory()->create(['organization_id' => $org->id]);
        $this->assignRole($ea, Role::ENTERPRISE_ADMIN, $org->id, null);

        $oldSpoke = User::factory()->create([
            'organization_id' => $org->id,
            'email' => 'old.spoke@example.com',
            'first_name' => 'Old',
            'last_name' => 'Spoke',
        ]);
        $this->assignRole($oldSpoke, Role::UNIT_ADMIN, $org->id, $unit->id);
        $originalSamarId = $oldSpoke->fresh()->samar_id;

        $response = $this->withToken($this->tokenFor($ea))->postJson("/api/v1/units/{$unit->id}/change-spoke", [
            'email' => 'new.spoke@example.com',
            'name' => 'New Spoke',
        ]);

        $response->assertStatus(200);

        $updated = $oldSpoke->fresh();
        $this->assertSame('new.spoke@example.com', $updated->email);
        $this->assertSame($originalSamarId, $updated->samar_id, 'SAMAR ID must not change');
        $this->assertSame('New Spoke', $updated->full_name);
        $this->assertSame($oldSpoke->id, $updated->id, 'Same account must be reused (no new admin row)');

        Mail::assertSent(NotificationMail::class);
    }

    public function test_change_spoke_rejected_for_unit_in_another_organization(): void
    {
        $orgA = Organization::factory()->create();
        $orgB = Organization::factory()->create();
        $unitB = $this->makeUnit($orgB);

        $eaA = User::factory()->create(['organization_id' => $orgA->id]);
        $this->assignRole($eaA, Role::ENTERPRISE_ADMIN, $orgA->id, null);

        $spokeB = User::factory()->create(['organization_id' => $orgB->id]);
        $this->assignRole($spokeB, Role::UNIT_ADMIN, $orgB->id, $unitB->id);

        $response = $this->withToken($this->tokenFor($eaA))->postJson("/api/v1/units/{$unitB->id}/change-spoke", [
            'email' => 'intruder@example.com',
        ]);

        $response->assertStatus(403);
        $this->assertSame($spokeB->email, $spokeB->fresh()->email);
    }

    public function test_change_spoke_fails_when_unit_has_no_active_unit_admin(): void
    {
        $org = Organization::factory()->create();
        $unit = $this->makeUnit($org);

        $ea = User::factory()->create(['organization_id' => $org->id]);
        $this->assignRole($ea, Role::ENTERPRISE_ADMIN, $org->id, null);

        $response = $this->withToken($this->tokenFor($ea))->postJson("/api/v1/units/{$unit->id}/change-spoke", [
            'email' => 'new.spoke@example.com',
        ]);

        $response->assertStatus(422);
    }
}
