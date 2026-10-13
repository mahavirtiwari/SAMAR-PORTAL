<?php

namespace Tests\Unit\Payment;

use App\Models\Application;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Unit;
use App\Services\Payment\PaymentSettlementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

/**
 * A gateway-reported amount that differs from what we billed must never refuse the
 * payment - the customer's money has already moved. It is recorded and flagged.
 */
class AmountMismatchFlagTest extends TestCase
{
    use RefreshDatabase;

    private function makePayment(float $amount = 43660): Payment
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

        $application = Application::create([
            'organization_id' => $org->id,
            'organization_name' => 'Acme Defense',
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_classification' => 'micro',
            'status' => 'payment_pending',
        ]);

        return Payment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'payment_id' => 'TXN'.uniqid(),
            'order_id' => 'TXN'.uniqid(),
            'payment_type' => 'application_fee',
            'amount' => $amount,
            'net_amount' => $amount,
            'currency' => 'INR',
            'status' => 'success',
            'gateway' => 'icici_eazypay',
        ]);
    }

    private function flag(Payment $payment, mixed $collected, string $source = 'callback'): void
    {
        $method = new ReflectionMethod(PaymentSettlementService::class, 'flagAmountMismatch');
        $method->invoke(app(PaymentSettlementService::class), $payment, $collected, $source);
    }

    public function test_matching_amount_is_not_flagged(): void
    {
        $payment = $this->makePayment();

        $this->flag($payment, '43660.00');

        $this->assertArrayNotHasKey('amount_mismatch', $payment->fresh()->webhook_payload ?? []);
    }

    public function test_amount_within_a_paisa_is_not_flagged(): void
    {
        $payment = $this->makePayment();

        $this->flag($payment, '43660.01');

        $this->assertArrayNotHasKey('amount_mismatch', $payment->fresh()->webhook_payload ?? []);
    }

    public function test_underpayment_is_flagged_but_payment_stays_successful(): void
    {
        $payment = $this->makePayment();

        $this->flag($payment, '1.00');

        $fresh = $payment->fresh();
        $this->assertSame('success', $fresh->status);
        $this->assertEquals(43660, $fresh->webhook_payload['amount_mismatch']['billed_amount']);
        $this->assertEquals(1, $fresh->webhook_payload['amount_mismatch']['collected_amount']);
        $this->assertSame('callback', $fresh->webhook_payload['amount_mismatch']['source']);
    }

    public function test_overpayment_is_flagged(): void
    {
        $payment = $this->makePayment();

        $this->flag($payment, '99999.00', 'push_notification');

        $mismatch = $payment->fresh()->webhook_payload['amount_mismatch'];
        $this->assertEquals(99999, $mismatch['collected_amount']);
        $this->assertSame('push_notification', $mismatch['source']);
    }

    public function test_absent_amount_is_ignored(): void
    {
        $payment = $this->makePayment();

        $this->flag($payment, null);
        $this->flag($payment, '');

        $this->assertArrayNotHasKey('amount_mismatch', $payment->fresh()->webhook_payload ?? []);
    }
}
