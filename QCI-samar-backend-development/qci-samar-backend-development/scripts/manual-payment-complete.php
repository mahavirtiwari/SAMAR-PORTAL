<?php

/**
 * Manual payment completion for an application when the payment gateway (ICICI EazyPay)
 * is unavailable. Mirrors PaymentWebhookController::iciciEazyPayCallback() success path:
 * marks the latest pending payment as success, updates the application, runs the
 * ApplicationStateMachine transition (which creates the Assessment + copies parameters),
 * and supersedes any other pending payment attempts for the same application.
 *
 * Where the applicant never reached the gateway there is no attempt to promote, so one
 * is created first at the fee they would have been charged (from fee_configurations,
 * via the same FeeCalculator the API uses).
 *
 * Usage (environment is picked up by the layered env loader from APP_ENV):
 *   APP_ENV=development php scripts/manual-payment-complete.php SAMAR-20-0526
 *   APP_ENV=development php scripts/manual-payment-complete.php SAMAR-20-0526 --operator="Navneet Singh <navneet@webority.com>"
 *   APP_ENV=development php scripts/manual-payment-complete.php SAMAR-20-0526 --amount=43660
 *   APP_ENV=development php scripts/manual-payment-complete.php SAMAR-20-0526 --dry-run
 *
 * Defaults:
 *   - amount             = the latest pending payment row, or the configured fee when none exists
 *   - older attempts     = marked failed with reason "Superseded by manual completion (ICICI gateway outage)"
 *   - operator           = $USER from environment if --operator not supplied
 *   - reason             = "ICICI gateway outage" (override with --reason="...")
 *
 * Safety:
 *   - refuses to run against production
 *   - aborts if application already in payment_completed (or downstream) status
 *   - wraps everything in a DB transaction; rolls back on any failure
 *   - --dry-run prints what it would do without writing
 */

use App\Exceptions\FeeConfigurationMissingException;
use App\Models\Application;
use App\Models\Assessment;
use App\Models\Payment;
use App\Models\User;
use App\Services\BusinessCentral\BcSyncService;
use App\Services\Payment\FeeCalculator;
use App\Services\StateMachine\ApplicationStateMachine;
use App\Support\AuditContext;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

$basePath = dirname(__DIR__);
require $basePath.'/vendor/autoload.php';
$app = require $basePath.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$args = array_slice($argv, 1);
$applicationNumber = null;
$operator = null;
$reason = 'ICICI gateway outage';
$amountOverride = null;
$dryRun = false;

foreach ($args as $arg) {
    if ($arg === '--dry-run') {
        $dryRun = true;
    } elseif (str_starts_with($arg, '--operator=')) {
        $operator = substr($arg, strlen('--operator='));
    } elseif (str_starts_with($arg, '--reason=')) {
        $reason = substr($arg, strlen('--reason='));
    } elseif (str_starts_with($arg, '--amount=')) {
        $amountOverride = (float) substr($arg, strlen('--amount='));
    } elseif (! str_starts_with($arg, '--') && $applicationNumber === null) {
        $applicationNumber = $arg;
    }
}

if (! $applicationNumber) {
    fwrite(STDERR, "Usage: APP_ENV=<env> php scripts/manual-payment-complete.php <APPLICATION_NUMBER> [--operator=\"Name <email>\"] [--reason=\"...\"] [--amount=<total>] [--dry-run]\n");
    exit(2);
}

$operator = $operator ?: (getenv('USER') ?: 'unknown');

// Everything below writes through audited models; without this the resulting
// audit entries carry no actor at all.
AuditContext::system('scripts/manual-payment-complete.php', $operator);

$env = config('app.env');
$dbHost = config('database.connections.mysql.host');
$dbName = config('database.connections.mysql.database');

if ($env === 'production') {
    fwrite(STDERR, "ERROR: refusing to complete payments manually on production\n");
    exit(1);
}

echo "Environment:      {$env}".PHP_EOL;
echo "Database:         {$dbName} @ {$dbHost}".PHP_EOL;
echo "Application:      {$applicationNumber}".PHP_EOL;
echo "Operator:         {$operator}".PHP_EOL;
echo "Reason:           {$reason}".PHP_EOL;
echo 'Mode:             '.($dryRun ? 'DRY-RUN (no writes)' : 'EXECUTE').PHP_EOL;
echo str_repeat('-', 60).PHP_EOL;

$application = Application::where('application_number', $applicationNumber)->first();
if (! $application) {
    fwrite(STDERR, "ERROR: application '{$applicationNumber}' not found on {$env}\n");
    exit(1);
}

if (in_array($application->status, ['payment_completed', 'in_progress', 'certified'], true)) {
    fwrite(STDERR, "ERROR: application already in status '{$application->status}' — nothing to do\n");
    exit(1);
}

if ($application->status !== 'payment_pending') {
    fwrite(STDERR, "ERROR: application in status '{$application->status}' — not 'payment_pending'. Refusing to force payment (would skip earlier state transitions)\n");
    exit(1);
}

$pendingPayments = Payment::where('application_id', $application->id)
    ->where('status', 'pending')
    ->orderBy('id', 'desc')
    ->get();

$primary = $pendingPayments->first();
$superseded = $pendingPayments->slice(1);

echo "Application ID:   {$application->id}".PHP_EOL;
echo "App status:       {$application->status}".PHP_EOL;

// The applicant never reached the gateway, so there is no attempt to promote.
$mustCreatePayment = $primary === null;
$amountToCreate = null;
$breakdown = [];

if ($mustCreatePayment) {
    if ($amountOverride !== null) {
        $amountToCreate = round($amountOverride, 2);
    } else {
        try {
            $fee = app(FeeCalculator::class)->forApplication($application);
            $amountToCreate = $fee['total'];
            $breakdown = $fee['metadata'];
        } catch (FeeConfigurationMissingException $e) {
            fwrite(STDERR, 'ERROR: '.$e->getMessage()." Pass --amount=<total> to override.\n");
            exit(1);
        }
    }

    echo 'Primary payment:  (none exist — will create one for ₹'.number_format($amountToCreate, 2).')'.PHP_EOL;
} else {
    echo "Primary payment:  #{$primary->id} (₹".number_format($primary->amount, 2).", gateway_order_id={$primary->gateway_order_id})".PHP_EOL;
}

echo 'Superseding:      '.($superseded->isEmpty() ? '(none)' : $superseded->pluck('id')->implode(', ')).PHP_EOL;
echo str_repeat('-', 60).PHP_EOL;

if ($dryRun) {
    echo 'DRY-RUN — exiting without writing.'.PHP_EOL;
    exit(0);
}

// gateway_payment_id is unique, and a seconds-resolution stamp collides when the
// script is run for several applications in a row.
$manualTxnId = 'MANUAL-'.strtoupper($env).'-'.now()->format('YmdHis').'-'.strtoupper(bin2hex(random_bytes(2)));
$auditMeta = [
    'manual_override' => [
        'reason' => $reason,
        'performed_by' => $operator,
        'performed_at' => now()->toIso8601String(),
        'environment' => $env,
        'gateway_payment_id' => $manualTxnId,
        'script' => 'scripts/manual-payment-complete.php',
    ],
];

DB::beginTransaction();
try {
    if ($mustCreatePayment) {
        // Mirrors PaymentController::initiate() minus the gateway round-trip.
        // Must stay exactly 20 characters like the gateway's TXN... format:
        // BcSyncService truncates order_id to 20 for the receipt's UTR_No, which
        // is the key Business Central de-duplicates on. A longer prefix would
        // cut off the random suffix and let two receipts collide.
        $paymentNumber = 'MAN'.((int) (microtime(true) * 1000)).strtoupper(bin2hex(random_bytes(2)));
        $createdBy = User::find($application->created_by);

        $primary = Payment::create([
            'application_id' => $application->id,
            'organization_id' => $application->organization_id,
            'user_id' => $application->created_by,
            'payment_id' => $paymentNumber,
            'order_id' => $paymentNumber,
            'payment_type' => 'application_fee',
            'amount' => $amountToCreate,
            'net_amount' => $amountToCreate,
            'currency' => 'INR',
            'status' => 'pending',
            'gateway' => 'icici_eazypay',
            'customer_name' => $createdBy?->full_name,
            'customer_email' => $createdBy?->email,
            'customer_phone' => $createdBy?->mobile_number,
            'gstin' => $application->gst_number,
            'description' => 'SAMAR Certification Fee for Application '.$application->application_number,
            'metadata' => $breakdown,
        ]);

        echo "Created payment:  #{$primary->id} ({$paymentNumber})".PHP_EOL;
    }

    $primary->update([
        'gateway_payment_id' => $manualTxnId,
        'status' => 'success',
        'completed_at' => now(),
        'payment_method' => 'other',
        'payment_method_details' => 'MANUAL (DB-level completion via scripts/manual-payment-complete.php)',
        'webhook_payload' => array_merge($primary->webhook_payload ?? [], $auditMeta),
    ]);

    $locked = Application::where('id', $primary->application_id)->lockForUpdate()->first();
    $totalPaid = Payment::where('application_id', $primary->application_id)
        ->where('status', 'success')
        ->sum('amount');

    $locked->update([
        'payment_amount' => $totalPaid,
        'payment_status' => 'success',
        'payment_completed_at' => now(),
    ]);
    $locked->refresh();

    if ($locked->status === 'payment_pending' && $totalPaid > 0) {
        $sm = new ApplicationStateMachine($locked);
        if (! $sm->canTransition('payment_success')) {
            throw new RuntimeException("State machine refused payment_success transition from '{$locked->status}'");
        }
        $sm->transition('payment_success');
    }

    foreach ($superseded as $sp) {
        $sp->update([
            'status' => 'failed',
            'failure_reason' => 'Superseded by manual completion ('.$reason.')',
            'webhook_payload' => array_merge($sp->webhook_payload ?? [], [
                'manual_override' => [
                    'reason' => 'Cancelled because payment #'.$primary->id.' was manually completed',
                    'performed_by' => $operator,
                    'performed_at' => now()->toIso8601String(),
                    'environment' => $env,
                    'script' => 'scripts/manual-payment-complete.php',
                ],
            ]),
        ]);
    }

    DB::commit();
} catch (Throwable $e) {
    DB::rollBack();
    fwrite(STDERR, 'ROLLED BACK: '.$e->getMessage().PHP_EOL);
    exit(1);
}

// Same ERP documents a gateway payment would produce, so a manually completed
// payment is indistinguishable downstream. Swallows its own failures.
app(BcSyncService::class)->raiseDocumentsForSettledPayment($primary->fresh());

$application->refresh();
$assessment = Assessment::where('application_id', $application->id)->first();

echo 'COMMIT OK'.PHP_EOL;
echo str_repeat('-', 60).PHP_EOL;
echo "App status:       {$application->status}".PHP_EOL;
echo "Payment status:   {$application->payment_status}".PHP_EOL;
echo 'Payment amount:   ₹'.number_format($application->payment_amount, 2).PHP_EOL;
echo "Completed at:     {$application->payment_completed_at}".PHP_EOL;
echo "Manual txn id:    {$manualTxnId}".PHP_EOL;
echo 'Assessment:       '.($assessment ? "#{$assessment->id} ({$assessment->status})" : 'NOT CREATED — investigate logs').PHP_EOL;
echo 'Superseded:       '.($superseded->isEmpty() ? '(none)' : $superseded->pluck('id')->implode(', ')).PHP_EOL;
