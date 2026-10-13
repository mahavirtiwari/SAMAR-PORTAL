<?php

namespace App\Console\Commands;

use App\Models\ErrorLog;
use Illuminate\Console\Command;

class CleanupErrorLogs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'error-logs:cleanup
                            {--archive : Archive resolved errors older than configured days}
                            {--delete : Delete archived errors older than configured days}
                            {--days= : Override configured retention days}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up old error logs by archiving resolved errors and deleting archived errors';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $archiveFlag = $this->option('archive');
        $deleteFlag = $this->option('delete');

        if (! $archiveFlag && ! $deleteFlag) {
            $this->error('Please specify either --archive or --delete flag');

            return Command::FAILURE;
        }

        if ($archiveFlag) {
            $this->archiveResolvedErrors();
        }

        if ($deleteFlag) {
            $this->deleteArchivedErrors();
        }

        return Command::SUCCESS;
    }

    /**
     * Archive resolved errors older than configured days.
     */
    protected function archiveResolvedErrors(): void
    {
        $days = $this->option('days') ?? config('error_logging.retention.archive_resolved_after_days', 90);
        $cutoffDate = now()->subDays($days);

        $this->info("Archiving resolved errors older than {$days} days (before {$cutoffDate->toDateString()})...");

        $count = ErrorLog::where('status', ErrorLog::STATUS_RESOLVED)
            ->where('resolved_at', '<=', $cutoffDate)
            ->update(['status' => ErrorLog::STATUS_ARCHIVED]);

        $this->info("Successfully archived {$count} resolved error log(s)");
    }

    /**
     * Delete archived errors older than configured days.
     */
    protected function deleteArchivedErrors(): void
    {
        $days = $this->option('days') ?? config('error_logging.retention.delete_archived_after_days', 365);
        $cutoffDate = now()->subDays($days);

        $this->info("Deleting archived errors older than {$days} days (before {$cutoffDate->toDateString()})...");

        // Count first
        $count = ErrorLog::where('status', ErrorLog::STATUS_ARCHIVED)
            ->where('created_at', '<=', $cutoffDate)
            ->count();

        if ($count === 0) {
            $this->info('No archived errors found to delete');

            return;
        }

        // Ask for confirmation
        if ($this->confirm("This will permanently delete {$count} archived error log(s). Continue?")) {
            // Delete in chunks to avoid memory issues
            $deleted = 0;
            $chunkSize = 1000;

            do {
                $chunkDeleted = ErrorLog::where('status', ErrorLog::STATUS_ARCHIVED)
                    ->where('created_at', '<=', $cutoffDate)
                    ->limit($chunkSize)
                    ->delete();

                $deleted += $chunkDeleted;

                if ($chunkDeleted > 0) {
                    $this->info("Deleted {$deleted} of {$count} error logs...");
                }
            } while ($chunkDeleted > 0);

            $this->info("Successfully deleted {$deleted} archived error log(s)");
        } else {
            $this->info('Deletion cancelled');
        }
    }
}
