<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Backfill occurred_at on legacy hollow Business Central error_logs rows (BUG-06529).
 *
 * The current code routes BC push/retry failures through ErrorReporter::captureException()
 * -> ErrorLoggerService::logException(), which always sets occurred_at and exception_message
 * (fixed under TASK-05773). Rows written before that fix landed carry a missing/zero
 * occurred_at and render "N/A" on the Integration Failures monitor. This gives those rows a
 * usable timestamp by falling back to created_at.
 *
 * Idempotent and a no-op on databases with no such legacy rows. exception_message for those
 * old rows was never captured and cannot be recovered, so it stays blank.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('error_logs')
            ->where('source', 'business_central')
            ->whereNotNull('created_at')
            ->where(function ($query) {
                $query->whereNull('occurred_at')
                    ->orWhere('occurred_at', '0000-00-00 00:00:00');
            })
            ->update(['occurred_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        // Irreversible: the original (missing) occurred_at cannot be restored.
    }
};
