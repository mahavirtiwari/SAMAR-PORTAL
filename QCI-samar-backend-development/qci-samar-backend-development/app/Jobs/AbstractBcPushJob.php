<?php

namespace App\Jobs;

use App\Contracts\BusinessCentralClientInterface;
use App\Exceptions\ErrorReporter;
use App\Models\ErrorLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Base for the Business Central push jobs.
 *
 * Delivery is at-most-once by construction: BC does not de-duplicate inserts
 * (verified against the sandbox), so queue-level retries stay off ($tries = 1),
 * re-dispatching is owned solely by bc:retry-failed, and every push first looks
 * up the staging row by its portal-side key — patching it when present instead
 * of inserting again.
 */
abstract class AbstractBcPushJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public int $recordId) {}

    public function handle(BusinessCentralClientInterface $bc): void
    {
        $record = $this->record();
        if (! $record) {
            return;
        }

        if (! in_array($record->bc_sync_status, ['pending', 'failed'], true)) {
            return;
        }

        if (! $bc->isEnabled()) {
            Log::warning($this->label().' push skipped: Business Central integration disabled', [
                'id' => $record->id,
            ]);

            return;
        }

        $record->bc_sync_status = 'sending';
        $record->bc_attempts = $record->bc_attempts + 1;
        $record->save();

        try {
            $result = $this->push($bc, $record);

            $record->bc_entry_no = $result['Entry_No'] ?? $record->bc_entry_no;
            $record->bc_error_text = null;
            $record->bc_sync_status = 'sent';
            $record->bc_sent_at = now();
            $record->save();

            Log::info($this->label().' pushed to Business Central', [
                'id' => $record->id,
                'entry_no' => $record->bc_entry_no,
            ]);
        } catch (\Throwable $e) {
            $record->bc_sync_status = 'failed';
            $record->bc_error_text = mb_substr($e->getMessage(), 0, 250);
            $record->save();

            Log::error($this->label().' push to Business Central failed', [
                'id' => $record->id,
                'error' => $e->getMessage(),
            ]);

            // Swallowed here (at-most-once, re-dispatch owned by bc:retry-failed),
            // so it never reaches the queue-failed hook — capture it explicitly.
            // A record that has just reached the attempt ceiling is terminal (the
            // sweep will not re-dispatch it), so it is raised CRITICAL once, here
            // at the transition, carrying the real BC error; earlier attempts stay
            // at the default severity. This replaces the old per-sweep re-alert,
            // which re-logged a CRITICAL for the same stuck row every 30 minutes.
            $exhausted = $record->bc_attempts >= (int) config('services.business_central.max_attempts', 5);

            app(ErrorReporter::class)->captureException($e, 'business_central', [
                'entity' => $this->label(),
                'record_id' => $record->id,
                'attempts' => $record->bc_attempts,
                'exhausted' => $exhausted,
            ], $exhausted ? ErrorLog::SEVERITY_CRITICAL : null);
        }
    }

    /**
     * The sync record (a model carrying the bc_* columns), or null when gone.
     */
    abstract protected function record(): ?object;

    /**
     * Deliver the payload: adopt/patch the existing staging row when the
     * portal-side key already exists in BC, insert otherwise. Returns the
     * BC entity (with Entry_No).
     */
    abstract protected function push(BusinessCentralClientInterface $bc, object $record): array;

    abstract protected function label(): string;
}
