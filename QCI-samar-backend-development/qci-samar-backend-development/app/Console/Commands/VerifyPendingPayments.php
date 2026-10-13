<?php

namespace App\Console\Commands;

use App\Exceptions\ErrorReporter;
use App\Models\ErrorLog;
use App\Models\Payment;
use App\Services\Payment\PaymentGatewayFactory;
use App\Services\Payment\PaymentSettlementService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Re-check payments the gateway never gave us a verdict on.
 *
 * A payment reaches the gateway and then depends on either the browser return
 * callback or the push notification to come back. When both are missed — the
 * applicant closed the tab mid-redirect, the push failed — the row stays
 * unsettled forever while the bank has already taken the money. This sweep asks
 * the gateway directly and settles the row through the same service the
 * callback and the webhook use, so the application transition, the ERP
 * documents and the receipt email all still happen.
 */
class VerifyPendingPayments extends Command
{
    /**
     * @var string
     */
    protected $signature = 'payments:verify-pending
                            {--max= : Attempt ceiling per payment (defaults to services.icici_eazypay.verify_max_attempts)}
                            {--minutes= : Only sweep payments older than this (defaults to services.icici_eazypay.verify_after_minutes)}
                            {--id= : Restrict the sweep to a single payment id, ignoring the age threshold}';

    /**
     * @var string
     */
    protected $description = 'Re-verify unsettled payments against the gateway and settle the ones the bank has already decided';

    public function handle(PaymentSettlementService $settlement, ErrorReporter $errorReporter): int
    {
        $maxAttempts = (int) ($this->option('max') ?: config('services.icici_eazypay.verify_max_attempts', 48));
        $thresholdMinutes = (int) ($this->option('minutes') ?: config('services.icici_eazypay.verify_after_minutes', 30));

        $query = Payment::query()
            ->where('gateway', 'icici_eazypay')
            ->whereIn('status', PaymentSettlementService::UNSETTLED_STATUSES)
            ->where('verification_attempts', '<', $maxAttempts);

        if ($this->option('id')) {
            $query->where('id', (int) $this->option('id'));
        } else {
            // initiated_at is stamped when the row is created, so a payment is
            // only swept once the customer has had time to finish at the bank.
            $query->where('initiated_at', '<', now()->subMinutes($thresholdMinutes));
        }

        $gateway = PaymentGatewayFactory::create('icici_eazypay');

        $checked = 0;
        $succeeded = 0;
        $failed = 0;
        $unresolved = 0;
        $exhausted = 0;

        $query->chunkById(200, function ($payments) use (
            $gateway, $settlement, $errorReporter, $maxAttempts,
            &$checked, &$succeeded, &$failed, &$unresolved, &$exhausted
        ) {
            foreach ($payments as $payment) {
                $checked++;

                // Counted before the call, so a gateway that keeps erroring can
                // never hold a row in the sweep indefinitely.
                $payment->increment('verification_attempts', 1, ['last_verified_at' => now()]);

                try {
                    $result = $gateway->verifyPayment($payment->gateway_order_id, [
                        'reference_no' => $payment->gateway_order_id,
                        'amount' => $payment->amount,
                        'eazypay_tran_id' => $payment->gateway_payment_id ?? '',
                        'payment_mode' => $payment->payment_method ?? '',
                    ]);
                } catch (\Exception $e) {
                    Log::warning('Payment verification sweep could not reach the gateway', [
                        'payment_id' => $payment->id,
                        'error' => $e->getMessage(),
                    ]);
                    $unresolved++;

                    continue;
                }

                // A failed call carries no status at all — treating its absence as
                // a verdict would mark a live payment failed on a network blip.
                if (! ($result['success'] ?? false)) {
                    Log::warning('Payment verification sweep got no verdict from the gateway', [
                        'payment_id' => $payment->id,
                        'message' => $result['message'] ?? null,
                    ]);
                    $unresolved++;

                    continue;
                }

                $status = $result['status'] ?? 'pending';

                if ($status === 'success') {
                    $settlement->settleSuccess($payment, [
                        'gateway_payment_id' => $result['eazypay_tran_id'] ?? null,
                        'payment_method' => $result['payment_mode'] ?? null,
                        'gateway_fee' => $result['processing_fee'] ?? null,
                        'tax_amount' => $result['tax'] ?? null,
                        'collected_amount' => $result['amount'] ?? null,
                        'payload' => $result,
                    ], 'verification_sweep');
                    $succeeded++;

                    continue;
                }

                if ($status === 'failed') {
                    $settlement->settleFailure($payment, [
                        'error_code' => $result['raw_status'] ?? null,
                        'failure_reason' => $result['message'] ?? 'Payment failed at the gateway',
                        'payload' => $result,
                    ], 'verification_sweep');
                    $failed++;

                    continue;
                }

                // Still in flight at the bank. An offline challan legitimately sits
                // here for days, so this is a normal outcome until the cap.
                $unresolved++;

                if ($payment->verification_attempts >= $maxAttempts) {
                    $exhausted++;
                    $this->flagForManualReconciliation($payment, $errorReporter, $result);
                }
            }
        });

        $this->info("Payment verification sweep complete. Checked: {$checked}, settled successful: {$succeeded}, settled failed: {$failed}, still unresolved: {$unresolved}, handed to manual reconciliation: {$exhausted}.");

        return self::SUCCESS;
    }

    /**
     * Hand a payment that never reached a verdict to a human.
     *
     * The status is deliberately left untouched: RIP and SIP mean the money may
     * already have moved, so forcing the row to failed here would hide a real
     * payment rather than resolve it.
     *
     * Only a payment the gateway actually acknowledged is escalated. A row with no
     * gateway transaction id was abandoned before the bank ever issued one — the
     * applicant opened the payment page and walked away — which is ordinary and
     * needs nobody. Dev alone holds 115 of those going back months, so escalating
     * them would bury the handful that matter.
     */
    private function flagForManualReconciliation(Payment $payment, ErrorReporter $errorReporter, array $result): void
    {
        if (! $payment->gateway_payment_id) {
            Log::info('Payment abandoned before the gateway issued a transaction, no longer re-checked', [
                'payment_id' => $payment->id,
                'application_id' => $payment->application_id,
                'attempts' => $payment->verification_attempts,
            ]);

            return;
        }

        Log::error('MANUAL INTERVENTION REQUIRED: payment never reached a final status at the gateway', [
            'payment_id' => $payment->id,
            'application_id' => $payment->application_id,
            'gateway_order_id' => $payment->gateway_order_id,
            'attempts' => $payment->verification_attempts,
            'last_gateway_status' => $result['raw_status'] ?? null,
        ]);

        $errorReporter->captureException(
            new \RuntimeException('Payment unresolved after the verification retry window'),
            'payment',
            [
                'payment_id' => $payment->id,
                'application_id' => $payment->application_id,
                'gateway_order_id' => $payment->gateway_order_id,
                'attempts' => $payment->verification_attempts,
                'last_gateway_status' => $result['raw_status'] ?? null,
            ],
            ErrorLog::SEVERITY_CRITICAL,
        );
    }
}
