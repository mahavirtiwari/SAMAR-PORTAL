<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

class CleanupAuditLogs extends Command
{
    protected $signature = 'audit-logs:cleanup
                            {--days= : Override configured retention days}
                            {--force : Skip the confirmation prompt}';

    protected $description = 'Delete audit log entries older than the configured retention window';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?? config('audit.retention_days', 730));

        if ($days < 1) {
            $this->error('Retention days must be at least 1.');

            return Command::FAILURE;
        }

        $cutoff = now()->subDays($days);

        $count = AuditLog::where('created_at', '<=', $cutoff)->count();

        if ($count === 0) {
            $this->info("No audit logs older than {$days} days to delete.");

            return Command::SUCCESS;
        }

        if (! $this->option('force') && $this->input->isInteractive()
            && ! $this->confirm("This will permanently delete {$count} audit log(s) older than {$days} days. Continue?")) {
            $this->info('Deletion cancelled.');

            return Command::SUCCESS;
        }

        $this->info("Deleting {$count} audit log(s) older than {$days} days (before {$cutoff->toDateString()})...");

        $deleted = 0;
        do {
            $chunk = AuditLog::where('created_at', '<=', $cutoff)->limit(1000)->delete();
            $deleted += $chunk;
        } while ($chunk > 0);

        $this->info("Successfully deleted {$deleted} audit log(s).");

        return Command::SUCCESS;
    }
}
