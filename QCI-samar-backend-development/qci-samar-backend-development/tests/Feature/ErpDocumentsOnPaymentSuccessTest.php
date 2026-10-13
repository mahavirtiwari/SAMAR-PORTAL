<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\FeeConfiguration;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use App\Services\BusinessCentral\BcSyncService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Business Central does not de-duplicate on resubmission and the invoice reference
 * is a monotonic SAMAR/FY/NNNNN sequence, so raising twice for one payment would
 * both duplicate a ledger entry and burn a number. Both gateway paths (return
 * callback and push notification) can settle the same payment.
 */
class ErpDocumentsOnPaymentSuccessTest extends TestCase
{
    use RefreshDatabase;

    private Organization $organization;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->seed(RoleSeeder::class);

        $this->organization = Organization::factory()->create();

        // ensureCustomerForOrganization() derives the ERP customer key from the
        // organization's enterprise admin.
        $admin = User::factory()->create(['organization_id' => $this->organization->id]);
        $admin->roles()->attach(Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail()->id, [
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
            'tds_enabled' => false,
        ]);
    }

    private function makePayment(?array $metadata = null): Payment
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

        $application = Application::create([
            'organization_id' => $this->organization->id,
            'organization_name' => 'Acme Defense',
            'unit_id' => $unit->id,
            'application_number' => 'SAMAR-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_classification' => 'micro',
            'status' => 'payment_completed',
        ]);

        return Payment::create([
            'application_id' => $application->id,
            'organization_id' => $this->organization->id,
            'payment_id' => 'TXN'.uniqid(),
            'order_id' => 'TXN'.uniqid(),
            'payment_type' => 'application_fee',
            'amount' => 43660,
            'net_amount' => 43660,
            'currency' => 'INR',
            'status' => 'success',
            'gateway' => 'icici_eazypay',
            'completed_at' => now(),
            'metadata' => $metadata,
        ]);
    }

    private function raise(Payment $payment): void
    {
        app(BcSyncService::class)->raiseDocumentsForSettledPayment($payment);
    }

    public function test_invoice_carries_the_amount_excluding_gst(): void
    {
        $payment = $this->makePayment([
            'base_fee' => 35000,
            'food_accommodation' => 2000,
            'gst_amount' => 6660,
            'tds_amount' => 0,
        ]);

        $this->raise($payment);

        $invoice = Invoice::where('application_id', $payment->application_id)->firstOrFail();
        // Other_Amount is the taxable value; BC applies GST itself.
        $this->assertEquals(37000, $invoice->base_amount);
        $this->assertSame('application_fee', $invoice->invoice_type);
        $this->assertStringStartsWith('SAMAR/', $invoice->invoice_reference);
    }

    public function test_receipt_carries_the_gross_actually_received(): void
    {
        $payment = $this->makePayment([
            'base_fee' => 35000,
            'food_accommodation' => 2000,
            'gst_amount' => 6660,
            'tds_amount' => 0,
        ]);

        $this->raise($payment);

        $receipt = Receipt::where('payment_id', $payment->id)->firstOrFail();
        $this->assertEquals(43660, $receipt->amount_received);
        $this->assertEquals(0, $receipt->tds_amount);
    }

    public function test_settling_the_same_payment_twice_does_not_duplicate_the_invoice(): void
    {
        $payment = $this->makePayment([
            'base_fee' => 35000,
            'food_accommodation' => 2000,
            'gst_amount' => 6660,
            'tds_amount' => 0,
        ]);

        $this->raise($payment);
        $this->raise($payment);

        $this->assertSame(1, Invoice::where('application_id', $payment->application_id)->count());
        $this->assertSame(1, Receipt::where('payment_id', $payment->id)->count());
    }

    public function test_falls_back_to_the_configured_fee_when_no_breakdown_was_stored(): void
    {
        $payment = $this->makePayment(null);

        $this->raise($payment);

        $this->assertEquals(37000, Invoice::where('application_id', $payment->application_id)->firstOrFail()->base_amount);
    }

    public function test_erp_failure_never_propagates_to_the_caller(): void
    {
        $payment = $this->makePayment();
        // No enterprise admin on this organization, so the customer projection cannot
        // be derived and BcSyncService throws.
        $orphan = Organization::factory()->create();
        $payment->update(['organization_id' => $orphan->id]);
        $payment->application->update(['organization_id' => $orphan->id]);

        $this->raise($payment->fresh());

        $this->assertSame(0, Receipt::where('payment_id', $payment->id)->count());
    }
}
