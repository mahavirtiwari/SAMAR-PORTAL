<?php

namespace App\Console\Commands;

use App\Models\EmailNotificationEvent;
use App\Models\Session;
use Illuminate\Console\Command;

/**
 * Deletes rows that only ever grow and are never read again: ended or expired
 * login sessions (every token refresh adds two) and old email delivery records
 * (each one holds the full rendered email). Deletes in batches so a large
 * backlog does not lock the tables.
 */
class PruneStaleRecords extends Command
{
    protected $signature = 'records:prune-stale
                            {--session-days= : Keep ended/expired sessions this many days (default from config)}
                            {--email-days= : Keep email delivery records this many days (default from config)}';

    protected $description = 'Delete ended login sessions and old email delivery records';

    private const BATCH = 5000;

    public function handle(): int
    {
        $sessionDays = max(1, (int) ($this->option('session-days') ?? config('auth.session.prune_after_days', 7)));
        $emailDays = max(1, (int) ($this->option('email-days') ?? config('mail.notification_events_retention_days', 180)));

        $sessions = $this->deleteInBatches(
            fn () => Session::query()
                ->where(fn ($q) => $q->where('is_active', false)->orWhere('expires_at', '<', now()))
                ->where('updated_at', '<', now()->subDays($sessionDays))
        );

        $emails = $this->deleteInBatches(
            fn () => EmailNotificationEvent::query()->where('created_at', '<', now()->subDays($emailDays))
        );

        $this->info("Deleted {$sessions} ended session(s) older than {$sessionDays} days and {$emails} email record(s) older than {$emailDays} days.");

        return Command::SUCCESS;
    }

    private function deleteInBatches(callable $query): int
    {
        $total = 0;
        do {
            $ids = $query()->limit(self::BATCH)->pluck('id');
            if ($ids->isEmpty()) {
                break;
            }
            $total += $query()->whereIn('id', $ids)->delete();
        } while ($ids->count() === self::BATCH);

        return $total;
    }
}
