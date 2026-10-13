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
 * The services-draft endpoint surfaces the GSTIN ↔ registered-state ↔ PAN
 * consistency result as a NON-BLOCKING `gstWarning` (the draft always persists),
 * so the customer portal can flag the problem on the GST step instead of only at
 * submit. The hard 422 gate stays on submit (GstinSubmissionValidationTest).
 */
class GstinDraftWarningTest extends TestCase
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

    private function applicantFor(Organization $org): string
    {
        $user = User::factory()->create(['organization_id' => $org->id, 'status' => 'active']);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $org->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return JWTAuth::fromUser($user);
    }

    private function saveDraft(Organization $org, array $overrides = []): TestResponse
    {
        return $this->withToken($this->applicantFor($org))->postJson('/api/v1/applications/services/draft', array_merge([
            'unitName' => 'GST Draft Unit',
            'unitAddress' => 'Plot 9, Industrial Area',
            'unitState' => self::STATE,
            'unitDistrict' => 'Gurugram',
            'unitPincode' => '122016',
        ], $overrides));
    }

    public function test_draft_with_inconsistent_gstin_saves_and_returns_warning(): void
    {
        $org = Organization::factory()->create(['pan' => self::PAN, 'registered_state' => self::STATE]);

        $response = $this->saveDraft($org, ['gstNumber' => '06BBBBB1111B1Z5']); // state ok, embedded PAN differs

        $response->assertCreated();
        $response->assertJsonPath('gstWarning.errorCode', 'pan_mismatch');
        $response->assertJsonPath('gstWarning.message', fn ($m) => str_contains($m, 'PAN embedded in this GSTIN does not match'));
        // Draft still persisted — the warning is non-blocking.
        $this->assertDatabaseHas('applications', ['status' => 'draft', 'gst_number' => '06BBBBB1111B1Z5']);
    }

    public function test_draft_with_missing_org_pan_returns_pan_required_warning(): void
    {
        $org = Organization::factory()->create(['pan' => null, 'registered_state' => self::STATE]);

        $response = $this->saveDraft($org, ['gstNumber' => self::VALID_GSTIN]);

        $response->assertCreated();
        $response->assertJsonPath('gstWarning.errorCode', 'pan_required');
        $response->assertJsonPath('gstWarning.message', fn ($m) => str_contains($m, 'Organisation profile'));
        $this->assertDatabaseHas('applications', ['status' => 'draft']);
    }

    public function test_draft_with_consistent_gstin_returns_no_warning(): void
    {
        $org = Organization::factory()->create(['pan' => self::PAN, 'registered_state' => self::STATE]);

        $response = $this->saveDraft($org, ['gstNumber' => self::VALID_GSTIN]);

        $response->assertCreated();
        $this->assertArrayNotHasKey('gstWarning', $response->json());
    }

    public function test_draft_without_gstin_returns_no_warning(): void
    {
        $org = Organization::factory()->create(['pan' => self::PAN, 'registered_state' => self::STATE]);

        $response = $this->saveDraft($org);

        $response->assertCreated();
        $this->assertArrayNotHasKey('gstWarning', $response->json());
    }
}
