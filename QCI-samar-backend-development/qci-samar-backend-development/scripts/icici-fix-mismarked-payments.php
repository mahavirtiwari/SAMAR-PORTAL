<?php

/**
 * Re-evaluate payments that were marked failed with error_code=INVALID_SIGNATURE.
 *
 * Background: prior to the fix in app/Services/Payment/ICICIEazyPayAdapter.php
 * (coercion of literal string "null" to "" in the signature input), every UPI
 * E000 callback failed our local signature recompute and got force-failed in
 * PaymentWebhookController. ICICI considers those transactions settled.
 *
 * This script:
 *   1. Loads each affected payment row.
 *   2. Replays the stored callback through the (now-fixed) parseReturnResponse.
 *   3. If valid + success, promotes status to 'success', back-fills
 *      gateway_payment_id, completed_at, payment_method, fees/tax,
 *      then runs the same application-status rollup the webhook does.
 *   4. Anything that does NOT re-verify is left untouched and reported.
 *
 * Usage:
 *   APP_ENV=staging php scripts/icici-fix-mismarked-payments.php           # dry-run
 *   APP_ENV=staging php scripts/icici-fix-mismarked-payments.php --apply   # write
 *   APP_ENV=staging php scripts/icici-fix-mismarked-payments.php --apply --id=41,43,47,48
 */

use App\Models\Payment;
use App\Services\Payment\ICICIEazyPayAdapter;
use App\Services\Payment\PaymentSettlementService;
use App\Support\AuditContext;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

AuditContext::system('scripts/icici-fix-mismarked-payments.php', getenv('USER') ?: null);

$apply = in_array('--apply', $argv, true);
$idArg = null;
foreach ($argv as $a) {
    if (str_starts_with($a, '--id=')) {
        $idArg = substr($a, 5);
    }
}

$query = Payment::query()
    ->where('gateway', 'icici_eazypay')
    ->where('status', 'failed')
    ->where('error_code', 'INVALID_SIGNATURE');

if ($idArg) {
    $ids = array_filter(array_map('intval', explode(',', $idArg)));
    $query->whereIn('id', $ids);
}

$payments = $query->orderBy('id')->get();

echo 'Mode: '.($apply ? 'APPLY' : 'DRY-RUN')."\n";
echo 'Candidates: '.$payments->count()."\n\n";

$gateway = new ICICIEazyPayAdapter;

$promoted = 0;
$skipped = 0;

foreach ($payments as $payment) {
    $callback = $payment->webhook_payload['callback'] ?? null;

    if (! is_array($callback)) {
        echo "id={$payment->id}  SKIP  no stored callback payload\n";
        $skipped++;

        continue;
    }

    $parsed = $gateway->parseReturnResponse($callback);

    $valid = (bool) ($parsed['valid'] ?? false);
    $success = (bool) ($parsed['success'] ?? false);
    $rc = $parsed['response_code'] ?? null;
    $tranId = $parsed['eazypay_tran_id'] ?? null;

    if (! $valid || ! $success) {
        echo "id={$payment->id}  SKIP  rc={$rc} valid=".($valid ? '1' : '0').' success='.($success ? '1' : '0')."\n";
        $skipped++;

        continue;
    }

    echo "id={$payment->id}  PROMOTE  rc={$rc} tran_id={$tranId} amount={$payment->amount}\n";

    if (! $apply) {
        continue;
    }

    // The rows this script targets were force-failed, so they sit outside the
    // settlement service's unsettled set. Return them to it first, then settle
    // through the same path the callback and the sweep use.
    $payment->update(['status' => 'pending']);

    app(PaymentSettlementService::class)->settleSuccess($payment, [
        'gateway_payment_id' => $parsed['eazypay_tran_id'],
        'payment_method' => $parsed['payment_mode'] ?? null,
        'gateway_fee' => $parsed['processing_fee'] ?? null,
        'tax_amount' => $parsed['service_tax'] ?? null,
        'collected_amount' => $parsed['transaction_amount'] ?? null,
        'payload' => [
            'reconciled_callback' => $callback,
            'reconciled_parsed' => $parsed,
            'reconciled_at' => now()->toIso8601String(),
            'reconciled_by' => 'icici-fix-mismarked-payments.php',
        ],
    ], 'reconciliation');

    $promoted++;
}

echo "\n";
echo "Promoted: $promoted\n";
echo "Skipped:  $skipped\n";
echo $apply ? "Changes committed.\n" : "Dry-run only. Re-run with --apply to commit.\n";
