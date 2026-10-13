<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * POST /applications/validate-gstin — the live GSTIN ↔ registered-state ↔ PAN
 * consistency check the customer portal calls on GST-field blur. Always 200;
 * the body's data.valid / data.errorCode / data.message carry the outcome.
 */
class GstinValidateEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const STATE = 'Haryana';        // GST code 06

    private const PAN = 'AAAAA0000A';

    private const VALID_GSTIN = '06AAAAA0000A1Z5';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function tokenFor(Organization $org, string $roleSlug = Role::ENTERPRISE_ADMIN): string
    {
        $user = User::factory()->create(['organization_id' => $org->id, 'status' => 'active']);
        $role = Role::where('slug', $roleSlug)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $org->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return JWTAuth::fromUser($user);
    }

    private function check(Organization $org, ?string $gstNumber): TestResponse
    {
        return $this->withToken($this->tokenFor($org))
            ->postJson('/api/v1/applications/validate-gstin', ['gstNumber' => $gstNumber]);
    }

    public function test_consistent_gstin_is_valid(): void
    {
        $org = Organization::factory()->create(['pan' => self::PAN, 'registered_state' => self::STATE]);

        $response = $this->check($org, self::VALID_GSTIN);

        $response->assertOk();
        $response->assertJsonPath('data.valid', true);
        $response->assertJsonPath('data.errorCode', null);
    }

    public function test_pan_mismatch_is_reported_but_still_200(): void
    {
        $org = Organization::factory()->create(['pan' => self::PAN, 'registered_state' => self::STATE]);

        $response = $this->check($org, '06BBBBB1111B1Z5'); // state ok, embedded PAN differs

        $response->assertOk();
        $response->assertJsonPath('data.valid', false);
        $response->assertJsonPath('data.errorCode', 'pan_mismatch');
        $response->assertJsonPath('data.message', fn ($m) => str_contains((string) $m, 'PAN embedded in this GSTIN does not match'));
    }

    public function test_empty_gstin_is_valid(): void
    {
        $org = Organization::factory()->create(['pan' => self::PAN, 'registered_state' => self::STATE]);

        $response = $this->check($org, '');

        $response->assertOk();
        $response->assertJsonPath('data.valid', true);
    }

    public function test_missing_org_pan_reports_pan_required(): void
    {
        $org = Organization::factory()->create(['pan' => null, 'registered_state' => self::STATE]);

        $response = $this->check($org, self::VALID_GSTIN);

        $response->assertOk();
        $response->assertJsonPath('data.valid', false);
        $response->assertJsonPath('data.errorCode', 'pan_required');
    }

    public function test_endpoint_is_role_gated(): void
    {
        $org = Organization::factory()->create(['pan' => self::PAN, 'registered_state' => self::STATE]);

        $response = $this->withToken($this->tokenFor($org, Role::ASSESSOR))
            ->postJson('/api/v1/applications/validate-gstin', ['gstNumber' => self::VALID_GSTIN]);

        $response->assertForbidden();
    }
}
