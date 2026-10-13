<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ErrorLog;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * A payment whose return callback and push notification were both missed sits
 * unsettled while the bank has already taken the money. The scheduled sweep asks
 * the gateway directly and settles the row through the same path the callback
 * uses. [TASK-08213]
 */
class PendingPaymentVerificationTest extends TestCase
{
    use RefreshDatabase;

    private Application $application;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->seed(RoleSeeder::class);

        $organization = Organization::factory()->create();

        $admin = User::factory()->create(['organization_id' => $organization->id]);
        $admin->roles()->attach(Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail()->id, [
            'organization_id' => $organization->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        $unit = Unit::create([
            'organization_id' => $organization->id,
            'name' => 'Pune Plant',
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Maharashtra',
            'district' => 'Pune',
            'pincode' => '411001',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        $this->application = Application::create([
            'organization_id' => $organization->id,
            'organization_name' => $organization->name,
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'unit_state' => 'Maharashtra',
            'application_number' => 'SAMAR-APP-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_classification' => 'micro',
            'enterprise_name' => 'Acme Defence',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'status' => 'payment_pending',
            'payment_status' => 'pending',
        ]);
    }

    private function makePendingPayment(string $status = 'pending', int $minutesOld = 90): Payment
    {
        $payment = Payment::create([
            'payment_type' => 'application_fee',
            'application_id' => $this->application->id,
            'organization_id' => $this->application->organization_id,
            'payment_id' => 'PAY-'.uniqid(),
            'order_id' => 'ORD-'.uniqid(),
            'gateway_order_id' => 'REF-'.uniqid(),
            'gateway' => 'icici_eazypay',
            'amount' => 25000,
            'net_amount' => 25000,
            'currency' => 'INR',
            'status' => $status,
        ]);

        $payment->forceFill(['initiated_at' => now()->subMinutes($minutesOld)])->save();

        return $payment;
    }

    private function fakeGatewayStatus(string $body): void
    {
        Http::fake(['*EazyPGVerify*' => Http::response($body, 200)]);
    }

    public function test_a_stuck_payment_the_bank_took_money_for_is_settled_as_successful(): void
    {
        $payment = $this->makePendingPayment();
        $this->fakeGatewayStatus('status=Success&ezpaytranid=TRN9001&amount=25000.00&PF=10&TAX=2&PaymentMode=NB');

        $this->artisan('payments:verify-pending')->assertSuccessful();

        $payment->refresh();
        $this->assertSame('success', $payment->status);
        $this->assertSame('TRN9001', $payment->gateway_payment_id);
        $this->assertNotNull($payment->completed_at);
    }

    public function test_settling_from_the_sweep_moves_the_application_forward(): void
    {
        $this->makePendingPayment();
        $this->fakeGatewayStatus('status=Success&ezpaytranid=TRN9002&amount=25000.00&PaymentMode=NB');

        $this->artisan('payments:verify-pending')->assertSuccessful();

        $this->application->refresh();
        $this->assertSame('success', $this->application->payment_status);
        $this->assertEquals(25000, (float) $this->application->payment_amount);
        $this->assertNotSame('payment_pending', $this->application->status);
    }

    public function test_a_payment_the_bank_rejected_is_settled_as_failed(): void
    {
        $payment = $this->makePendingPayment();
        $this->fakeGatewayStatus('status=Failed&pgreferenceno=REF1');

        $this->artisan('payments:verify-pending')->assertSuccessful();

        $payment->refresh();
        $this->assertSame('failed', $payment->status);
        $this->assertNotNull($payment->failed_at);
    }

    public function test_a_payment_still_in_flight_is_left_alone_for_the_next_sweep(): void
    {
        $payment = $this->makePendingPayment();
        $this->fakeGatewayStatus('status=Challan Generated');

        $this->artisan('payments:verify-pending')->assertSuccessful();

        $payment->refresh();
        $this->assertSame('pending', $payment->status);
        $this->assertSame(1, $payment->verification_attempts);
        $this->assertNotNull($payment->last_verified_at);
    }

    public function test_a_gateway_that_cannot_be_reached_never_marks_a_live_payment_failed(): void
    {
        $payment = $this->makePendingPayment();
        Http::fake(['*EazyPGVerify*' => Http::response('gateway down', 503)]);

        $this->artisan('payments:verify-pending')->assertSuccessful();

        $payment->refresh();
        $this->assertSame('pending', $payment->status, 'An unreachable gateway is not a verdict.');
        $this->assertSame(1, $payment->verification_attempts);
    }

    public function test_a_payment_newer_than_the_threshold_is_not_swept_yet(): void
    {
        $payment = $this->makePendingPayment('pending', 5);
        $this->fakeGatewayStatus('status=Success&ezpaytranid=TRN9003&amount=25000.00');

        $this->artisan('payments:verify-pending')->assertSuccessful();

        $payment->refresh();
        $this->assertSame('pending', $payment->status);
        $this->assertSame(0, $payment->verification_attempts);
    }

    public function test_a_payment_past_the_attempt_ceiling_is_handed_to_manual_reconciliation(): void
    {
        $payment = $this->makePendingPayment();
        // Only a payment the bank acknowledged is escalated.
        $payment->forceFill(['verification_attempts' => 1, 'gateway_payment_id' => 'TRN8000'])->save();
        $this->fakeGatewayStatus('status=Challan Generated');

        $this->artisan('payments:verify-pending --max=2')->assertSuccessful();

        $payment->refresh();
        $this->assertSame('pending', $payment->status, 'Money may already have moved, so the row is never force-failed.');
        $this->assertSame(2, $payment->verification_attempts);
        $this->assertDatabaseHas('error_logs', [
            'severity' => ErrorLog::SEVERITY_CRITICAL,
            'exception_message' => 'Payment unresolved after the verification retry window',
        ]);

        // Past the ceiling it drops out of the sweep entirely.
        $this->artisan('payments:verify-pending --max=2')->assertSuccessful();
        $this->assertSame(2, $payment->refresh()->verification_attempts);
    }

    public function test_a_payment_abandoned_before_the_bank_saw_it_raises_no_alert(): void
    {
        $payment = $this->makePendingPayment();
        $payment->forceFill(['verification_attempts' => 1])->save();
        $this->fakeGatewayStatus('status=Challan Generated');

        $this->artisan('payments:verify-pending --max=2')->assertSuccessful();

        $this->assertSame(2, $payment->refresh()->verification_attempts);
        $this->assertDatabaseMissing('error_logs', ['severity' => ErrorLog::SEVERITY_CRITICAL]);
    }

    public function test_a_payment_already_settled_is_never_settled_twice(): void
    {
        $payment = $this->makePendingPayment();
        $this->fakeGatewayStatus('status=Success&ezpaytranid=TRN9004&amount=25000.00');

        $this->artisan('payments:verify-pending')->assertSuccessful();
        $completedAt = $payment->refresh()->completed_at;

        $this->artisan('payments:verify-pending --id='.$payment->id)->assertSuccessful();

        $payment->refresh();
        $this->assertSame('success', $payment->status);
        $this->assertEquals($completedAt, $payment->completed_at, 'A second settlement must not restamp the row.');
    }
}
