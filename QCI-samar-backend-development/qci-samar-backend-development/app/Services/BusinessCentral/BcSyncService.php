<?php

namespace App\Services\BusinessCentral;

use App\Jobs\PushCustomerToBc;
use App\Jobs\PushInvoiceToBc;
use App\Jobs\PushReceiptToBc;
use App\Models\Application;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Receipt;
use App\Models\Role;
use App\Models\User;
use App\Services\Payment\FeeCalculator;
use Illuminate\Support\Carbon;

/**
 * Orchestrates the outbound ERP sync: creates the Customer/Invoice/Receipt
 * projections and dispatches their push jobs.
 *
 * Staging order does not matter to BC (rows sit until QCI's accounts user
 * processes them, customers first), but a customer projection must exist
 * locally before invoices/receipts reference it.
 */
class BcSyncService
{
    public function __construct(private InvoiceReferenceGenerator $referenceGenerator) {}

    /**
     * Find or create the ERP customer projection for an organization and queue
     * its push. reference_no is the enterprise admin's SAMAR ID (QCI-confirmed
     * customer key).
     */
    public function ensureCustomerForOrganization(Organization $organization): Customer
    {
        $existing = Customer::where('organization_id', $organization->id)->first();
        if ($existing) {
            return $existing;
        }

        $admin = User::where('organization_id', $organization->id)
            ->whereHas('activeRoles', fn ($q) => $q->where('slug', Role::ENTERPRISE_ADMIN))
            ->orderBy('id')
            ->first();

        if (! $admin) {
            throw new \RuntimeException("Organization {$organization->id} has no enterprise admin; cannot derive the ERP customer reference.");
        }

        $customer = Customer::create([
            'organization_id' => $organization->id,
            'user_id' => $admin->id,
            'reference_no' => $admin->samar_id,
        ]);

        PushCustomerToBc::dispatch($customer->id);

        return $customer;
    }

    /**
     * Raise a portal invoice (allocating its SAMAR/FY/NNNNN reference) and
     * queue its push.
     */
    public function raiseInvoice(
        Application $application,
        string $invoiceType,
        float $baseAmount,
        string $lineComments,
        ?Carbon $postingDate = null
    ): Invoice {
        $postingDate ??= now();

        $this->ensureCustomerForOrganization($application->organization);

        $invoice = Invoice::create([
            'application_id' => $application->id,
            'organization_id' => $application->organization_id,
            'invoice_reference' => $this->referenceGenerator->generate($postingDate),
            'invoice_type' => $invoiceType,
            'posting_date' => $postingDate->toDateString(),
            'voucher_date' => $postingDate->toDateString(),
            'line_comments' => $lineComments,
            'base_amount' => $baseAmount,
        ]);

        PushInvoiceToBc::dispatch($invoice->id);

        return $invoice;
    }

    /**
     * Record the ERP receipt for a successful payment and queue its push.
     * Idempotent per payment.
     */
    public function recordReceiptForPayment(Payment $payment, ?Invoice $invoice = null): Receipt
    {
        $existing = Receipt::where('payment_id', $payment->id)->first();
        if ($existing) {
            return $existing;
        }

        $customer = $this->ensureCustomerForOrganization($payment->organization);

        // Applied_to_invoice must carry the portal invoice reference (the same
        // value sent as TADA_Invoice_No). When the caller does not supply the
        // invoice, resolve it from the payment's application, then organization.
        $invoice ??= Invoice::where('application_id', $payment->application_id)
            ->orderByDesc('id')
            ->first()
            ?? Invoice::where('organization_id', $payment->organization_id)
                ->orderByDesc('id')
                ->first();

        $breakdown = $payment->breakdown ?? [];
        $paidOn = $payment->completed_at ?? $payment->initiated_at ?? now();

        // Amounts derive from the same pre-GST taxable base and rates as
        // FeeCalculator (the single source of truth), rounded the same way — GST
        // and TDS each rounded to 2dp on the base, then combined — so the ERP
        // figures reconcile to the paise with what SAMAR charged.
        //   base   = amountPayable (base_certification_fee + food) = Invoice Other_Amount
        //   GST    = round(base * gst%,  2)
        //   TDS    = round(base * tds%,  2)
        //   Invoice_1_Amount = base + GST
        //   Amount_Received  = Invoice_1 - TDS   (== payment->amount for fee payments)
        // Worked example (base 57240, GST 18%, TDS 10%):
        //   GST 10303.20, TDS 5724.00, Invoice_1 67543.20, Received 61819.20.
        $base = (float) ($invoice?->base_amount
            ?? $breakdown['amountPayable']
            ?? $breakdown['baseCertificationFee']
            ?? $payment->amount);
        $gstPercentage = (float) ($breakdown['gstPercentage'] ?? config('services.business_central.gst_rate', 18));
        $tdsPercentage = (float) ($breakdown['tdsPercentage'] ?? 0);

        $gstAmount = round($base * $gstPercentage / 100, 2);
        $tdsAmount = round($base * $tdsPercentage / 100, 2);
        $invoiceGross = round($base + $gstAmount, 2);
        $amountReceived = round($invoiceGross - $tdsAmount, 2);

        $receipt = Receipt::create([
            'payment_id' => $payment->id,
            'invoice_id' => $invoice?->id,
            'customer_id' => $customer->id,
            'posting_date' => $paidOn->toDateString(),
            'payment_date' => $paidOn->toDateString(),
            'amount_received' => $amountReceived,
            'invoice_amount' => $invoiceGross,
            'tds_deducted' => $tdsPercentage > 0,
            'tds_amount' => $tdsAmount,
            'tan' => $payment->tan,
            'payment_mode' => $payment->gateway === 'icici_eazypay' ? 'ICICI Gateway' : (string) ($payment->payment_method ?? 'other'),
            // UTR_No must be the payment gateway's transaction reference only —
            // never our order_id (QCI: the field should hold the gateway txn id).
            // Receipt de-duplication keys on Order_ID instead, so a blank/short
            // UTR here can no longer merge distinct receipts in BC.
            'utr_no' => mb_substr(
                (string) ($payment->reconciliation?->utr_number
                    ?: $payment->transaction_id
                    ?: $payment->gateway_payment_id),
                0,
                20
            ),
        ]);

        PushReceiptToBc::dispatch($receipt->id);

        return $receipt;
    }

    /**
     * Raise the invoice and receipt for a payment that has just settled.
     *
     * Shared by the two gateway settlement paths and the manual completion script
     * so a manually completed payment is indistinguishable from a real one.
     *
     * Call this only after the payment transaction has committed: it swallows its
     * own failures because a Business Central projection error must never roll back
     * or block a payment the customer has already made.
     */
    public function raiseDocumentsForSettledPayment(Payment $payment): void
    {
        try {
            $application = Application::find($payment->application_id);

            if (! $application) {
                return;
            }

            $invoiceType = $payment->payment_type ?: 'application_fee';

            // Both the return callback and the push notification can settle the same
            // payment. BC does not de-duplicate on resubmission and the invoice
            // reference is a monotonic sequence, so a second raise would duplicate a
            // ledger entry and burn a number.
            $invoice = Invoice::where('application_id', $application->id)
                ->where('invoice_type', $invoiceType)
                ->first();

            if (! $invoice) {
                $baseAmount = $this->amountExcludingGst($payment, $application);

                if ($baseAmount === null) {
                    \Log::error('MANUAL INTERVENTION REQUIRED: cannot raise ERP invoice without a pre-GST amount', [
                        'payment_id' => $payment->id,
                        'application_id' => $application->id,
                    ]);

                    return;
                }

                $invoice = $this->raiseInvoice(
                    $application,
                    $invoiceType,
                    $baseAmount,
                    'SAMAR '.str_replace('_', ' ', $invoiceType).' for application '.$application->application_number,
                    $payment->completed_at
                );
            }

            $this->recordReceiptForPayment($payment, $invoice);
        } catch (\Throwable $e) {
            \Log::error('MANUAL INTERVENTION REQUIRED: ERP invoice/receipt creation failed after payment', [
                'payment_id' => $payment->id,
                'application_id' => $payment->application_id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * The invoice carries the taxable value, so GST is excluded. TDS is not — it is
     * a deduction from what the customer remits, not from what we billed.
     */
    private function amountExcludingGst(Payment $payment, Application $application): ?float
    {
        $breakdown = $payment->breakdown ?? [];

        if (isset($breakdown['amountPayable']) && $breakdown['amountPayable'] !== null) {
            return round((float) $breakdown['amountPayable'], 2);
        }

        // Payments predating the stored breakdown fall back to the configured fee
        // rather than inferring a taxable value from the gross.
        try {
            $fee = app(FeeCalculator::class)->forApplication($application)['metadata'];

            return round($fee['base_fee'] + $fee['food_accommodation'], 2);
        } catch (\Throwable) {
            return null;
        }
    }
}
