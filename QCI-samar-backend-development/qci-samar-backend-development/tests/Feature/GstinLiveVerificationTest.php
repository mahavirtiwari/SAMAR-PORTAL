<?php

namespace Tests\Feature;

use App\Contracts\GstinVerifierInterface;
use App\Models\GstinVerification;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Live GSTIN verification via the Protean adapter — response mapping, the
 * rejection-vs-technical-error classification, caching, and the enabled gate.
 * All calls are Http::fake'd; nothing reaches Protean.
 */
class GstinLiveVerificationTest extends TestCase
{
    use RefreshDatabase;

    private const STATE = 'Haryana';        // GST code 06

    private const PAN = 'AAAAA0000A';

    private const VALID_GSTIN = '06AAAAA0000A1Z5';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        config([
            'services.gstin.enabled' => true,
            'services.gstin.provider' => 'protean',
            'services.gstin.cache_ttl_days' => 30,
            'services.gstin.protean.base_url' => 'https://gstlite.proteantech.in/STP/GetGstn',
            'services.gstin.protean.user_id' => 'test-user',
            'services.gstin.protean.password' => 'test-pass',
            'services.gstin.protean.timeout' => 30,
        ]);
        $this->app->forgetInstance(GstinVerifierInterface::class);
    }

    private function verifier(): GstinVerifierInterface
    {
        return $this->app->make(GstinVerifierInterface::class);
    }

    public function test_successful_verification_is_mapped_and_recorded(): void
    {
        Http::fake(['gstlite.proteantech.in/*' => Http::response([
            'GSTINID' => self::VALID_GSTIN,
            'NameOfCompany' => 'Sample Company Ltd',
            'TradeName' => 'XYZ',
            'TypeOfCompany' => 'Public Limited Company',
            'StatusOfCompany' => 'Active',
            'TaxpayerType' => 'Regular',
            'RegistrationDate' => '01/07/2017',
            'Status' => 'S',
            'Reason' => '',
            'Error_Cd' => '',
        ], 200)]);

        $result = $this->verifier()->verify(self::VALID_GSTIN);

        $this->assertTrue($result->verified);
        $this->assertSame('verified', $result->status);
        $this->assertSame('Sample Company Ltd', $result->legalName);
        $this->assertSame('Active', $result->gstinStatus);

        $record = GstinVerification::where('gstin', self::VALID_GSTIN)->first();
        $this->assertNotNull($record);
        $this->assertSame('verified', $record->status);
        $this->assertNotNull($record->verified_at);
    }

    public function test_definitive_rejection_is_classified_rejected(): void
    {
        Http::fake(['gstlite.proteantech.in/*' => Http::response([
            'GSTINID' => self::VALID_GSTIN,
            'Status' => 'R',
            'Error_Cd' => 'FO8007',
            'Reason' => 'The GSTIN passed in the request is invalid.',
        ], 200)]);

        $result = $this->verifier()->verify(self::VALID_GSTIN);

        $this->assertFalse($result->verified);
        $this->assertSame('rejected', $result->status);
        $this->assertSame('FO8007', $result->errorCode);
        $this->assertStringContainsString('could not be verified', $result->customerMessage());
    }

    public function test_live_nested_principal_address_is_parsed(): void
    {
        // The real Protean shape nests the principal address under
        // PrincipalAddress.Address with its own key names (note the "BuilingName"
        // typo, BuildingNo, FloorNo, Location, StateCode).
        Http::fake(['gstlite.proteantech.in/*' => Http::response([
            'GSTINID' => self::VALID_GSTIN,
            'NameOfCompany' => 'Sample Company Ltd',
            'StatusOfCompany' => 'Active',
            'Status' => 'S',
            'PrincipalAddress' => ['Address' => [
                'BuilingName' => 'VIPUL TRADE CENTRE',
                'BuildingNo' => '629',
                'FloorNo' => 'SIXTH FLOOR',
                'Street' => 'SECTOR-48, SOHNA ROAD',
                'Location' => 'GURUGRAM',
                'District' => 'Gurugram',
                'StateCode' => 'Haryana',
                'PinCode' => '122018',
            ]],
        ], 200)]);

        $result = $this->verifier()->verify(self::VALID_GSTIN);

        $this->assertTrue($result->verified);
        $this->assertSame('VIPUL TRADE CENTRE', $result->principalAddress['building_name']);
        $this->assertSame('629', $result->principalAddress['door_num']);
        $this->assertSame('SIXTH FLOOR', $result->principalAddress['floor_name']);
        $this->assertSame('Haryana', $result->principalAddress['state']);
        $this->assertSame('122018', $result->principalAddress['pincode']);
    }

    public function test_gstin_required_error_is_classified_error_not_rejected(): void
    {
        // ERR_10029 ("Gstin is Required") is a caller-side failure, not a
        // rejection of a supplied GSTIN — it must map to a technical error.
        Http::fake(['gstlite.proteantech.in/*' => Http::response([
            'Status' => 'R',
            'Error_Cd' => 'ERR_10029',
            'Reason' => 'Gstin is Required',
        ], 200)]);

        $result = $this->verifier()->verify(self::VALID_GSTIN);

        $this->assertFalse($result->verified);
        $this->assertSame('error', $result->status);
        $this->assertStringContainsString('temporarily unavailable', $result->customerMessage());
    }

    public function test_status_s_with_blank_registry_is_rejected(): void
    {
        // The live shape Protean returns for a GSTIN it has no record of: the
        // request is processed (Status=S) but every registry field is blank and
        // Reason carries "Invalid GSTIN / UID". This must NOT verify — Status=S
        // is transport success, not GSTIN validity.
        Http::fake(['gstlite.proteantech.in/*' => Http::response([
            'GSTINID' => self::VALID_GSTIN,
            'Status' => 'S',
            'Reason' => 'Invalid GSTIN / UID',
            'NameOfCompany' => '',
            'TradeName' => '',
            'StatusOfCompany' => '',
        ], 200)]);

        $result = $this->verifier()->verify(self::VALID_GSTIN);

        $this->assertFalse($result->verified);
        $this->assertSame('rejected', $result->status);
        $this->assertStringContainsString('could not be verified', $result->customerMessage());

        // A rejection is never cached — it must be cheap to re-check.
        $record = GstinVerification::where('gstin', self::VALID_GSTIN)->first();
        $this->assertSame('rejected', $record->status);
        $this->assertNull($record->verified_at);
    }

    public function test_ip_or_auth_failure_is_classified_error(): void
    {
        Http::fake(['gstlite.proteantech.in/*' => Http::response([
            'Status' => 'R',
            'Error_Cd' => 'ERR_10010',
            'Reason' => 'Invalid Request. Incorrect Ip Address',
        ], 200)]);

        $result = $this->verifier()->verify(self::VALID_GSTIN);

        $this->assertFalse($result->verified);
        $this->assertSame('error', $result->status);
        // A technical failure never leaks internals to the applicant.
        $this->assertStringContainsString('temporarily unavailable', $result->customerMessage());
    }

    public function test_successful_result_is_cached_and_not_recalled(): void
    {
        Http::fake(['gstlite.proteantech.in/*' => Http::response([
            'GSTINID' => self::VALID_GSTIN,
            'NameOfCompany' => 'Sample Company Ltd',
            'StatusOfCompany' => 'Active',
            'Status' => 'S',
        ], 200)]);

        $verifier = $this->verifier();
        $verifier->verify(self::VALID_GSTIN);
        $verifier->verify(self::VALID_GSTIN);

        // Second call served from the gstin_verifications record — Protean hit once.
        Http::assertSentCount(1);
    }

    public function test_force_refresh_bypasses_the_cache(): void
    {
        Http::fake(['gstlite.proteantech.in/*' => Http::response([
            'GSTINID' => self::VALID_GSTIN,
            'StatusOfCompany' => 'Active',
            'Status' => 'S',
        ], 200)]);

        $verifier = $this->verifier();
        $verifier->verify(self::VALID_GSTIN);
        $verifier->verify(self::VALID_GSTIN, forceRefresh: true);

        Http::assertSentCount(2);
    }

    public function test_disabled_without_credentials(): void
    {
        config(['services.gstin.protean.user_id' => '', 'services.gstin.protean.password' => '']);
        $this->app->forgetInstance(GstinVerifierInterface::class);

        $this->assertFalse($this->verifier()->isEnabled());
    }

    public function test_validate_endpoint_surfaces_live_rejection(): void
    {
        Http::fake(['gstlite.proteantech.in/*' => Http::response([
            'GSTINID' => self::VALID_GSTIN,
            'Status' => 'R',
            'Error_Cd' => 'FO8007',
            'Reason' => 'The GSTIN passed in the request is invalid.',
        ], 200)]);

        $org = Organization::factory()->create(['pan' => self::PAN, 'registered_state' => self::STATE]);
        $user = User::factory()->create(['organization_id' => $org->id, 'status' => 'active']);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $org->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);
        $token = JWTAuth::fromUser($user);

        $response = $this->withToken($token)
            ->postJson('/api/v1/applications/validate-gstin', ['gstNumber' => self::VALID_GSTIN]);

        // Consistency passes (state+PAN match), so the live check runs and rejects.
        $response->assertOk();
        $response->assertJsonPath('data.valid', false);
        $response->assertJsonPath('data.errorCode', 'FO8007');
    }
}
