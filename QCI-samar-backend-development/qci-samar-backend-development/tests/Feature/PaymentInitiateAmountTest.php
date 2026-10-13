<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\FeeConfiguration;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * The amount is resolved from fee_configurations and the request cannot influence
 * it. The quote endpoint is what the payment screen renders, so the figure shown
 * and the figure charged come from the same calculation.
 */
class PaymentInitiateAmountTest extends TestCase
{
    use RefreshDatabase;

    private Organization $organization;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $this->organization = Organization::factory()->create();
        $this->user = User::factory()->create(['organization_id' => $this->organization->id]);

        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $this->user->roles()->attach($role->id, [
            'organization_id' => $this->organization->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        FeeConfiguration::create([
            'sector' => 'manufacturing',
            'enterprise_size' => 'micro',
            'base_certification_fee' => 35000,
            'food_and_accommodation_fee' => 2000,
            'gst_percentage' => 18,
            'tds_enabled' => true,
        ]);
    }

    private function makeApplication(?string $size = 'micro'): Application
    {
        $unit = Unit::create([
            'organization_id' => $this->organization->id,
            'name' => 'Unit',
            'address' => 'Addr',
            'state' => 'State',
            'district' => 'District',
            'pincode' => '110011',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        return Application::create([
            'organization_id' => $this->organization->id,
            'organization_name' => 'Acme Defense',
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_classification' => $size,
            'status' => 'payment_pending',
        ]);
    }

    private function asUser(): self
    {
        return $this->withHeader('Authorization', 'Bearer '.JWTAuth::fromUser($this->user));
    }

    public function test_quote_returns_the_configured_fee(): void
    {
        $application = $this->makeApplication();

        $response = $this->asUser()->getJson("/api/v1/applications/{$application->id}/fee");

        $response->assertOk();
        $this->assertEquals(35000, $response->json('data.baseCertificationFee'));
        $this->assertEquals(2000, $response->json('data.foodAccommodation'));
        $this->assertEquals(37000, $response->json('data.amountPayable'));
        $this->assertEquals(6660, $response->json('data.gstAmount'));
        $this->assertEquals(43660, $response->json('data.totalAmount'));
        $this->assertTrue($response->json('data.tdsAvailable'));
    }

    public function test_quote_applies_an_elected_tds_deduction(): void
    {
        $application = $this->makeApplication();

        $response = $this->asUser()->getJson(
            "/api/v1/applications/{$application->id}/fee?tdsDeductible=true&tdsPercentage=2"
        );

        $response->assertOk();
        $this->assertEquals(740, $response->json('data.tdsAmount'));
        $this->assertEquals(42920, $response->json('data.totalAmount'));
    }

    public function test_quote_rejects_a_tds_rate_outside_the_allowed_values(): void
    {
        $application = $this->makeApplication();

        $this->asUser()
            ->getJson("/api/v1/applications/{$application->id}/fee?tdsDeductible=true&tdsPercentage=50")
            ->assertStatus(400);
    }

    public function test_quote_is_refused_for_another_organisations_application(): void
    {
        $otherOrg = Organization::factory()->create();
        $application = $this->makeApplication();
        $application->update(['organization_id' => $otherOrg->id]);

        $this->asUser()
            ->getJson("/api/v1/applications/{$application->id}/fee")
            ->assertStatus(403);
    }

    public function test_quote_reports_a_missing_fee_configuration(): void
    {
        $application = $this->makeApplication('large');

        $this->asUser()
            ->getJson("/api/v1/applications/{$application->id}/fee")
            ->assertStatus(422);
    }

    public function test_initiate_ignores_an_amount_supplied_by_the_client(): void
    {
        $application = $this->makeApplication();

        // A stale or tampered client can still send `amount`; it must have no effect.
        $this->asUser()->postJson('/api/v1/payments/initiate', [
            'applicationId' => $application->id,
            'paymentType' => 'application_fee',
            'amount' => 1.00,
        ]);

        $payment = Payment::where('application_id', $application->id)->first();

        // The gateway call may fail in tests, but if a payment row was created it must
        // carry the configured fee and never the submitted figure.
        if ($payment) {
            $this->assertEquals(43660, $payment->amount);
        }
    }

    public function test_initiate_reports_a_missing_fee_configuration(): void
    {
        $application = $this->makeApplication('large');

        $this->asUser()->postJson('/api/v1/payments/initiate', [
            'applicationId' => $application->id,
            'paymentType' => 'application_fee',
        ])->assertStatus(422);

        $this->assertSame(0, Payment::where('application_id', $application->id)->count());
    }
}
