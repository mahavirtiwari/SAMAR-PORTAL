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
 * Guards against the same action running twice when two requests race (double
 * click, two tabs, retries): workflow transitions, payment initiation and
 * application numbering.
 */
class ConcurrencyGuardsTest extends TestCase
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
        $this->user->roles()->attach(Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail()->id, [
            'organization_id' => $this->organization->id,
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

    private function makeApplication(string $status = 'payment_pending'): Application
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
            'enterprise_classification' => 'micro',
            'status' => $status,
        ]);
    }

    private function makePayment(Application $application, string $status, array $metadata = []): Payment
    {
        $number = 'TXN'.uniqid();

        return Payment::forceCreate([
            'application_id' => $application->id,
            'organization_id' => $application->organization_id,
            'user_id' => $this->user->id,
            'payment_id' => $number,
            'order_id' => $number,
            'payment_type' => 'application_fee',
            'amount' => 43660,
            'net_amount' => 43660,
            'currency' => 'INR',
            'status' => $status,
            'gateway' => 'icici_eazypay',
            'metadata' => $metadata,
        ]);
    }

    private function initiate(Application $application)
    {
        return $this->withHeader('Authorization', 'Bearer '.JWTAuth::fromUser($this->user))
            ->postJson('/api/v1/payments/initiate', [
                'applicationId' => $application->id,
                'paymentType' => 'application_fee',
            ]);
    }

    public function test_a_transition_on_a_stale_copy_is_refused(): void
    {
        $application = $this->makeApplication('drdo_approval_pending');
        $drdo = User::factory()->create();
        $drdo->roles()->attach(Role::where('slug', Role::DRDO_ADMIN)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);
        $first = Application::find($application->id);
        $second = Application::find($application->id);

        $first->stateMachine($drdo)->transition('drdo_approve');

        $this->expectExceptionMessage('already moved');
        $second->stateMachine($drdo)->transition('drdo_reject');
    }

    public function test_a_fee_that_is_already_paid_cannot_be_initiated_again(): void
    {
        $application = $this->makeApplication();
        $this->makePayment($application, 'success');

        $this->initiate($application)->assertStatus(409);
        $this->assertSame(1, Payment::where('application_id', $application->id)->count());
    }

    public function test_a_repeated_initiation_returns_the_order_just_created(): void
    {
        $application = $this->makeApplication();
        $pending = $this->makePayment($application, 'pending', ['gateway_response' => ['payment_url' => 'https://pay.example/1']]);

        $this->initiate($application)
            ->assertStatus(201)
            ->assertJsonPath('data.gatewayData.paymentUrl', 'https://pay.example/1');

        $this->assertSame([$pending->id], Payment::where('application_id', $application->id)->pluck('id')->all());
    }

    public function test_application_numbers_are_never_reissued(): void
    {
        $first = Application::generateApplicationNumber();
        $second = Application::generateApplicationNumber();

        $this->assertNotSame($first, $second);
        $this->assertMatchesRegularExpression('/^SAMAR-\d+-\d{4}$/', $second);
    }
}
