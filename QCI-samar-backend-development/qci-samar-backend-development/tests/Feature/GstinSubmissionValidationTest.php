<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Covers the GSTIN ↔ registered-state ↔ PAN consistency gate on
 * POST /api/v1/applications/{id}/submit (TASK-05710).
 */
class GstinSubmissionValidationTest extends TestCase
{
    use RefreshDatabase;

    private const STATE = 'Haryana';        // GST code 06

    private const PAN = 'AAAAA0000A';

    private const VALID_GSTIN = '06AAAAA0000A1Z5';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        // Isolate from the email notification listener; the transition's own
        // DB updates run directly, not through this event.
        Event::fake(['application.status.changed']);
    }

    private function tokenFor(User $user): string
    {
        return JWTAuth::fromUser($user);
    }

    private function makeOrg(array $overrides = []): Organization
    {
        return Organization::factory()->create(array_merge([
            'pan' => self::PAN,
            'registered_address' => 'Plot 1, Industrial Area',
            'registered_state' => self::STATE,
            'registered_district' => 'Gurugram',
            'registered_pincode' => '122016',
            'owner_name' => 'Jane Doe',
            'owner_designation' => 'Director',
            'owner_email' => 'owner@example.com',
            'owner_mobile_number' => '9999999999',
        ], $overrides));
    }

    private function makeEnterpriseAdmin(Organization $org): User
    {
        $user = User::factory()->create(['organization_id' => $org->id]);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $org->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return $user;
    }

    private function makeDraftApplication(Organization $org, ?string $gstNumber): Application
    {
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Test Unit',
            'address' => 'Plot 1, Industrial Area',
            'state' => self::STATE,
            'district' => 'Gurugram',
            'pincode' => '122016',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        return Application::create([
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'application_number' => 'SAMAR-SRC-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_name' => 'Acme Defense',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_number' => $gstNumber,
            'mfg_products' => [['product_name' => 'Widget']],
            'customers' => [['customer_name' => 'DRDO']],
            'status' => 'draft',
        ]);
    }

    private function submit(?string $gstNumber, array $orgOverrides = []): TestResponse
    {
        $org = $this->makeOrg($orgOverrides);
        $user = $this->makeEnterpriseAdmin($org);
        $application = $this->makeDraftApplication($org, $gstNumber);

        return $this->withToken($this->tokenFor($user))
            ->postJson("/api/v1/applications/{$application->id}/submit");
    }

    public function test_consistent_gstin_submits_successfully(): void
    {
        $response = $this->submit(self::VALID_GSTIN);

        $response->assertStatus(200);
        $this->assertDatabaseHas('applications', [
            'gst_number' => self::VALID_GSTIN,
            'status' => 'drdo_approval_pending',
        ]);
    }

    public function test_empty_gstin_submits_successfully(): void
    {
        $response = $this->submit(null);

        $response->assertStatus(200);
        $this->assertDatabaseHas('applications', [
            'status' => 'drdo_approval_pending',
        ]);
    }

    public function test_gstin_with_wrong_state_code_is_blocked(): void
    {
        $response = $this->submit('07AAAAA0000A1Z5'); // 07 = Delhi, org is Haryana (06)

        $response->assertStatus(422);
        $response->assertJsonPath('errors.gstNumber.0', fn ($m) => str_contains($m, 'does not match your registered office state'));
        $response->assertJsonPath('errorCode', 'state_mismatch');
        $this->assertDatabaseHas('applications', ['status' => 'draft']);
    }

    public function test_gstin_with_wrong_pan_is_blocked(): void
    {
        $response = $this->submit('06BBBBB1111B1Z5'); // state 06 ok, embedded PAN differs

        $response->assertStatus(422);
        $response->assertJsonPath('errors.gstNumber.0', fn ($m) => str_contains($m, 'PAN embedded in this GSTIN does not match'));
        $response->assertJsonPath('errorCode', 'pan_mismatch');
        $this->assertDatabaseHas('applications', ['status' => 'draft']);
    }

    public function test_gstin_with_wrong_length_is_blocked(): void
    {
        $response = $this->submit('06AAAAA0000A1Z'); // 14 chars

        $response->assertStatus(422);
        $response->assertJsonPath('errors.gstNumber.0', 'GSTIN must be exactly 15 characters.');
        $response->assertJsonPath('errorCode', 'length');
        $this->assertDatabaseHas('applications', ['status' => 'draft']);
    }

    public function test_gstin_without_pan_is_blocked(): void
    {
        $response = $this->submit(self::VALID_GSTIN, ['pan' => null]);

        $response->assertStatus(422);
        $response->assertJsonPath('errors.gstNumber.0', fn ($m) => str_contains($m, 'PAN is required'));
        $response->assertJsonPath('errorCode', 'pan_required');
        $this->assertDatabaseHas('applications', ['status' => 'draft']);
    }
}
