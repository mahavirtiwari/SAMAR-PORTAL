<?php

namespace App\Services\Payment;

use App\Contracts\PaymentGatewayInterface;
use App\Exceptions\ErrorReporter;
use App\Models\Application;
use App\Models\ErrorLog;
use App\Models\Payment;
use App\Services\BusinessCentral\BcSyncService;
use App\Services\Email\EmailNotificationService;
use App\Services\StateMachine\ApplicationStateMachine;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Applies a gateway verdict to a payment, wherever that verdict came from.
 *
 * A payment can be settled from four directions — the browser return-URL
 * callback, the gateway's push notification, the scheduled re-verification
 * sweep, and a manual reconciliation script — and every one of them owes the
 * same side effects: the payment row, the amount-mismatch check, the
 * application rollup and state transition, the ERP documents, and the
 * applicant's receipt email. Those paths each carried their own copy until
 * this service existed, and had already drifted apart.
 *
 * Settling is idempotent by design. The payment row is locked and its status
 * re-read inside the transaction, and anything already settled is left alone,
 * so a late webhook racing the sweep cannot double-count a payment, re-raise an
 * ERP invoice, or send a second receipt.
 */
class PaymentSettlementService
{
    /**
     * Statuses a payment can still be settled from. Anything else is terminal.
     */
    public const UNSETTLED_STATUSES = ['initiated', 'pending', 'processing'];

    /**
     * Statuses a gateway-confirmed success may settle. A failed row is included:
     * once the gateway has proved money moved, an earlier failure verdict (a
     * declined first attempt, or a failure that raced the success) must not
     * strand a payment the customer has made.
     */
    public const SUCCESS_SETTLEABLE_STATUSES = ['initiated', 'pending', 'processing', 'failed'];

    public function __construct(
        private BcSyncService $bcSync,
        private EmailNotificationService $emailNotifications,
        private ErrorReporter $errorReporter,
    ) {}

    /**
     * Mark a payment successful and run every downstream effect of that.
     *
     * @param  array  $details  Normalised gateway values. Recognised keys:
     *                          gateway_payment_id, payment_method, gateway_fee,
     *                          tax_amount, collected_amount, payload.
     * @param  string  $source  Where the verdict came from, e.g. 'callback',
     *                          'push_notification', 'verification_sweep'. Used
     *                          as the webhook_payload key and in logs.
     * @return bool True when this call settled the payment, false when it was
     *              already settled and nothing was applied.
     */
    public function settleSuccess(Payment $payment, array $details, string $source): bool
    {
        $settled = DB::transaction(function () use ($payment, $details, $source) {
            $locked = Payment::where('id', $payment->id)->lockForUpdate()->first();

            if (! $locked || ! in_array($locked->status, self::SUCCESS_SETTLEABLE_STATUSES, true)) {
                $this->recordPayload($locked ?? $payment, $details, $source.'_after_settlement');

                return false;
            }

            if ($locked->status === 'failed') {
                Log::warning('Gateway-confirmed success overrides an earlier failure verdict', [
                    'payment_id' => $locked->id,
                    'error_code' => $locked->error_code,
                    'source' => $source,
                ]);
            }

            $locked->update(array_filter([
                'gateway_payment_id' => $details['gateway_payment_id'] ?? null,
                'payment_method' => $details['payment_method'] ?? null,
                'gateway_fee' => $details['gateway_fee'] ?? null,
                'tax_amount' => $details['tax_amount'] ?? null,
            ], fn ($value) => $value !== null && $value !== '') + [
                'status' => 'success',
                'completed_at' => $locked->completed_at ?: now(),
                'error_code' => null,
                'failure_reason' => null,
                'webhook_payload' => array_merge($locked->webhook_payload ?? [], [
                    $source => $details['payload'] ?? $details,
                ]),
            ]);

            $this->flagAmountMismatch($locked, $details['collected_amount'] ?? null, $source);
            $this->rollUpApplication($locked);

            $payment->setRawAttributes($locked->getAttributes(), true);

            return true;
        });

        if (! $settled) {
            Log::info('Payment settlement skipped, already settled', [
                'payment_id' => $payment->id,
                'status' => $payment->fresh()?->status,
                'source' => $source,
            ]);

            return false;
        }

        Log::info('Payment settled as successful', [
            'payment_id' => $payment->id,
            'application_id' => $payment->application_id,
            'gateway_payment_id' => $payment->gateway_payment_id,
            'source' => $source,
        ]);

        // Both run after the commit: a Business Central outage or a mail failure
        // must never roll back money we have already accepted.
        $this->raiseErpDocuments($payment);
        $this->sendSuccessEmail($payment);

        return true;
    }

    /**
     * Mark a payment failed.
     *
     * An already-successful payment is never downgraded — once the gateway has
     * told us money moved, a later negative verdict is recorded on the row for
     * reconciliation rather than applied to it.
     *
     * @param  array  $details  Recognised keys: error_code, failure_reason, payload.
     * @return bool True when this call settled the payment.
     */
    public function settleFailure(Payment $payment, array $details, string $source): bool
    {
        $settled = DB::transaction(function () use ($payment, $details, $source) {
            $locked = Payment::where('id', $payment->id)->lockForUpdate()->first();

            if (! $locked || ! in_array($locked->status, self::UNSETTLED_STATUSES, true)) {
                $this->recordPayload($locked ?? $payment, $details, $source.'_after_settlement');

                return false;
            }

            $locked->update([
                'status' => 'failed',
                'failed_at' => now(),
                'error_code' => $details['error_code'] ?? null,
                'failure_reason' => $details['failure_reason'] ?? 'Payment failed',
                'webhook_payload' => array_merge($locked->webhook_payload ?? [], [
                    $source => $details['payload'] ?? $details,
                ]),
            ]);

            $payment->setRawAttributes($locked->getAttributes(), true);

            return true;
        });

        if ($settled) {
            Log::info('Payment settled as failed', [
                'payment_id' => $payment->id,
                'error_code' => $details['error_code'] ?? null,
                'source' => $source,
            ]);
        }

        return $settled;
    }

    /**
     * Ask the gateway for the payment's status and settle on its verdict.
     *
     * This is the authoritative path for every verdict we cannot prove came from
     * the gateway: the scheduled sweep, push notifications, and return-URL
     * callbacks whose signature does not verify. The status query is a
     * server-to-server call, so a forged notification can at worst trigger a
     * harmless re-check, never settle or fail a payment on its own.
     *
     * @return array{verdict: string|null, result: array} verdict is 'success',
     *                                                    'failed', 'pending', or null when the gateway gave
     *                                                    no answer (unreachable / error)
     */
    public function verifyAndSettle(Payment $payment, PaymentGatewayInterface $gateway, string $source): array
    {
        $result = $gateway->verifyPayment($payment->gateway_order_id, [
            'reference_no' => $payment->gateway_order_id,
            'amount' => $payment->amount,
            'eazypay_tran_id' => $payment->gateway_payment_id ?? '',
            'payment_mode' => $payment->payment_method ?? '',
        ]);

        // A failed call carries no status at all — treating its absence as a
        // verdict would mark a live payment failed on a network blip.
        if (! ($result['success'] ?? false)) {
            return ['verdict' => null, 'result' => $result];
        }

        $status = $result['status'] ?? 'pending';

        if ($status === 'success') {
            $this->settleSuccess($payment, [
                'gateway_payment_id' => $result['eazypay_tran_id'] ?? null,
                'payment_method' => $result['payment_mode'] ?? null,
                'gateway_fee' => $result['processing_fee'] ?? null,
                'tax_amount' => $result['tax'] ?? null,
                'collected_amount' => $result['amount'] ?? null,
                'payload' => $result,
            ], $source);

            return ['verdict' => 'success', 'result' => $result];
        }

        if ($status === 'failed') {
            $this->settleFailure($payment, [
                'error_code' => $result['raw_status'] ?? null,
                'failure_reason' => $result['message'] ?? 'Payment failed at the gateway',
                'payload' => $result,
            ], $source);

            return ['verdict' => 'failed', 'result' => $result];
        }

        return ['verdict' => 'pending', 'result' => $result];
    }

    /**
     * Record a payload on a payment without changing its status.
     *
     * Used for the notifications that carry no verdict we act on — an offline
     * challan being generated, or a message that arrives after settlement.
     */
    public function recordPayload(Payment $payment, array $details, string $source): void
    {
        $payment->update(array_filter([
            'gateway_payment_id' => $details['gateway_payment_id'] ?? null,
        ], fn ($value) => $value !== null && $value !== '') + [
            'webhook_payload' => array_merge($payment->webhook_payload ?? [], [
                $source => $details['payload'] ?? $details,
            ]),
        ]);
    }

    /**
     * Compare what the gateway says it collected against what we billed.
     *
     * The amount is covered by the gateway's own signature, so a mismatch means
     * our billing and their collection genuinely diverged rather than someone
     * tampering. The customer's money has already moved, so the payment stays
     * successful and is flagged for reconciliation instead — refusing it would
     * strand a real payment.
     */
    private function flagAmountMismatch(Payment $payment, mixed $collected, string $source): void
    {
        if ($collected === null || $collected === '') {
            return;
        }

        $collectedAmount = round((float) $collected, 2);
        $billedAmount = round((float) $payment->amount, 2);

        // Compare in whole paise: a float subtraction here lands either side of a
        // 0.01 threshold depending on representation error.
        if (abs((int) round($collectedAmount * 100) - (int) round($billedAmount * 100)) <= 1) {
            return;
        }

        Log::error('MANUAL INTERVENTION REQUIRED: gateway collected an amount we did not bill', [
            'payment_id' => $payment->id,
            'application_id' => $payment->application_id,
            'billed_amount' => $billedAmount,
            'collected_amount' => $collectedAmount,
            'source' => $source,
        ]);

        $this->errorReporter->captureException(
            new \RuntimeException('Payment amount mismatch: gateway collected an amount we did not bill'),
            'payment',
            [
                'payment_id' => $payment->id,
                'application_id' => $payment->application_id,
                'billed_amount' => $billedAmount,
                'collected_amount' => $collectedAmount,
                'origin' => $source,
            ],
            ErrorLog::SEVERITY_CRITICAL,
        );

        $payment->update([
            'webhook_payload' => array_merge($payment->webhook_payload ?? [], [
                'amount_mismatch' => [
                    'billed_amount' => $billedAmount,
                    'collected_amount' => $collectedAmount,
                    'source' => $source,
                    'detected_at' => now()->toIso8601String(),
                ],
            ]),
        ]);
    }

    /**
     * Roll the settled payment up onto its application.
     *
     * Must run inside the caller's transaction: the application row is locked so
     * a push notification and a callback landing together cannot both transition it.
     */
    private function rollUpApplication(Payment $payment): void
    {
        if (! $payment->application_id) {
            return;
        }

        $application = Application::where('id', $payment->application_id)
            ->lockForUpdate()
            ->first();

        if (! $application) {
            return;
        }

        $totalPaid = Payment::where('application_id', $payment->application_id)
            ->where('status', 'success')
            ->sum('amount');

        $application->update([
            'payment_amount' => $totalPaid,
            'payment_status' => 'success',
            'payment_completed_at' => $application->payment_completed_at ?: now(),
        ]);

        $application->refresh();

        if ($application->status === 'payment_pending' && $totalPaid > 0) {
            $stateMachine = new ApplicationStateMachine($application);

            if ($stateMachine->canTransition('payment_success')) {
                $stateMachine->transition('payment_success');

                Log::info('Application transitioned to payment_completed', [
                    'application_id' => $application->id,
                    'total_paid' => $totalPaid,
                    'new_status' => $application->fresh()->status,
                ]);
            } else {
                Log::warning('Cannot transition application - payment_success not allowed', [
                    'application_id' => $application->id,
                    'current_status' => $application->status,
                ]);
            }
        }
    }

    /**
     * Raise the ERP invoice and receipt for a settled payment.
     *
     * The service swallows its own failures so a Business Central error cannot
     * affect a payment that is already settled.
     */
    private function raiseErpDocuments(Payment $payment): void
    {
        $this->bcSync->raiseDocumentsForSettledPayment($payment);
    }

    /**
     * Send the applicant their payment receipt.
     *
     * Deferred past the response when settling inside a web request, so the
     * user's redirect is never held up by the mail transport. The scheduled
     * sweep has no response to defer past, so it sends inline.
     */
    private function sendSuccessEmail(Payment $payment): void
    {
        if (app()->runningInConsole()) {
            $this->dispatchSuccessEmail($payment);

            return;
        }

        dispatch(function () use ($payment) {
            $this->dispatchSuccessEmail($payment);
        })->afterResponse();
    }

    private function dispatchSuccessEmail(Payment $payment): void
    {
        try {
            $application = Application::find($payment->application_id);

            if (! $application) {
                return;
            }

            $totalPaid = Payment::where('application_id', $payment->application_id)
                ->where('status', 'success')
                ->sum('amount');

            $breakdown = $payment->breakdown;

            $tdsAmount = (float) ($breakdown['tdsAmount'] ?? 0);
            $tdsDeductible = (bool) ($breakdown['tdsDeductible'] ?? false);
            $tdsApplied = $tdsDeductible && $tdsAmount > 0;

            $this->emailNotifications->sendEmailForEvent('payment.success', [
                'application' => $application,
                'application_number' => $application->application_number,
                'payment_transaction_id' => $payment->gateway_payment_id ?? $payment->id,
                'payment_date' => $payment->completed_at ? $payment->completed_at->format('F d, Y') : now()->format('F d, Y'),
                'user_name' => $application->creator->full_name ?? 'Applicant',
                'applicant_name' => $application->creator->full_name ?? 'Applicant',
                'base_certification_fee' => number_format($breakdown['baseCertificationFee'] ?? 0, 2),
                'food_accommodation_fee' => number_format($breakdown['foodAccommodation'] ?? 0, 2),
                'total_before_tax' => number_format($breakdown['amountPayable'] ?? 0, 2),
                'gst_percentage' => $breakdown['gstPercentage'] ?? 18,
                'gst_amount' => number_format($breakdown['gstAmount'] ?? 0, 2),
                // Only surface TDS when it was actually applied — never invent a 2% label.
                'tds_applied' => $tdsApplied,
                'tds_percentage' => $tdsApplied ? ($breakdown['tdsPercentage'] ?? null) : null,
                'tds_amount' => $tdsApplied ? number_format($tdsAmount, 2) : null,
                'net_payable_amount' => number_format($payment->net_amount ?? $totalPaid, 2),
            ]);

            Log::info('Payment success email sent', [
                'application_id' => $application->id,
                'payment_id' => $payment->id,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send payment success email', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
