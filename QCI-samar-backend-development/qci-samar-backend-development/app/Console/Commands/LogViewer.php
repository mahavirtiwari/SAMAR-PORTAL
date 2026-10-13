<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * Artisan command to view and analyze application logs.
 *
 * Usage:
 *   php artisan log:view                    # View today's errors
 *   php artisan log:view --date=2026-01-10  # View specific date
 *   php artisan log:view --level=error      # Filter by level
 *   php artisan log:view --tail=50          # Last 50 entries
 *   php artisan log:view --search="Payment" # Search in logs
 *   php artisan log:view --summary          # Show error summary
 */
class LogViewer extends Command
{
    protected $signature = 'log:view
                            {--date= : Date to view (YYYY-MM-DD, default: today)}
                            {--level= : Filter by level (emergency|alert|critical|error|warning|notice|info|debug)}
                            {--tail=20 : Number of entries to show}
                            {--search= : Search term in log messages}
                            {--summary : Show summary of errors by type}
                            {--list : List available log files}';

    protected $description = 'View and analyze application logs';

    protected array $levelColors = [
        'emergency' => 'red',
        'alert' => 'red',
        'critical' => 'red',
        'error' => 'red',
        'warning' => 'yellow',
        'notice' => 'cyan',
        'info' => 'green',
        'debug' => 'gray',
    ];

    public function handle(): int
    {
        $logPath = storage_path('logs');

        if ($this->option('list')) {
            return $this->listLogFiles($logPath);
        }

        $date = $this->option('date') ?: date('Y-m-d');
        $logFile = "{$logPath}/laravel-{$date}.log";

        // Fallback to single log file if daily doesn't exist
        if (! File::exists($logFile)) {
            $logFile = "{$logPath}/laravel.log";
        }

        if (! File::exists($logFile)) {
            $this->error("No log file found for date: {$date}");
            $this->info('Use --list to see available log files');

            return 1;
        }

        $this->info("Reading: {$logFile}");
        $this->newLine();

        if ($this->option('summary')) {
            return $this->showSummary($logFile);
        }

        return $this->showLogs($logFile);
    }

    protected function listLogFiles(string $logPath): int
    {
        $files = File::glob("{$logPath}/laravel*.log");

        if (empty($files)) {
            $this->warn("No log files found in {$logPath}");

            return 1;
        }

        $this->info('Available log files:');
        $this->newLine();

        foreach ($files as $file) {
            $size = $this->formatBytes(File::size($file));
            $modified = date('Y-m-d H:i:s', File::lastModified($file));
            $this->line('  '.basename($file)." ({$size}, modified: {$modified})");
        }

        return 0;
    }

    protected function showLogs(string $logFile): int
    {
        $content = File::get($logFile);
        $entries = $this->parseLogEntries($content);

        // Apply filters
        $level = $this->option('level');
        if ($level) {
            $entries = array_filter($entries, fn ($e) => strtolower($e['level']) === strtolower($level));
        }

        $search = $this->option('search');
        if ($search) {
            $entries = array_filter($entries, fn ($e) => Str::contains(strtolower($e['message']), strtolower($search))
            );
        }

        // Get last N entries
        $tail = (int) $this->option('tail');
        $entries = array_slice($entries, -$tail);

        if (empty($entries)) {
            $this->warn('No log entries found matching your criteria');

            return 0;
        }

        $this->info('Showing '.count($entries).' entries:');
        $this->newLine();

        foreach ($entries as $entry) {
            $this->displayEntry($entry);
        }

        return 0;
    }

    protected function showSummary(string $logFile): int
    {
        $content = File::get($logFile);
        $entries = $this->parseLogEntries($content);

        // Count by level
        $byLevel = [];
        $byException = [];

        foreach ($entries as $entry) {
            $level = strtolower($entry['level']);
            $byLevel[$level] = ($byLevel[$level] ?? 0) + 1;

            // Extract exception type if present
            if (preg_match('/\[exception\]\s*=>\s*([^\s\]]+)/', $entry['context'], $matches)) {
                $exception = class_basename($matches[1]);
                $byException[$exception] = ($byException[$exception] ?? 0) + 1;
            }
        }

        $this->info('=== Log Summary ===');
        $this->newLine();

        $this->info('By Level:');
        arsort($byLevel);
        foreach ($byLevel as $level => $count) {
            $color = $this->levelColors[$level] ?? 'white';
            $this->line("  <fg={$color}>{$level}</>: {$count}");
        }

        if (! empty($byException)) {
            $this->newLine();
            $this->info('By Exception Type:');
            arsort($byException);
            foreach (array_slice($byException, 0, 10) as $exception => $count) {
                $this->line("  {$exception}: {$count}");
            }
        }

        $this->newLine();
        $this->info('Total entries: '.count($entries));

        return 0;
    }

    protected function parseLogEntries(string $content): array
    {
        $entries = [];
        $pattern = '/\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*)\]\s+(\w+)\.(\w+):\s+(.*?)(?=\[\d{4}-\d{2}-\d{2}|\z)/s';

        if (preg_match_all($pattern, $content, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $entries[] = [
                    'timestamp' => $match[1],
                    'channel' => $match[2],
                    'level' => $match[3],
                    'message' => trim(explode("\n", $match[4])[0]),
                    'context' => $match[4],
                ];
            }
        }

        return $entries;
    }

    protected function displayEntry(array $entry): void
    {
        $level = strtolower($entry['level']);
        $color = $this->levelColors[$level] ?? 'white';

        $this->line("<fg=gray>[{$entry['timestamp']}]</> <fg={$color}>{$entry['level']}</>: {$entry['message']}");

        // Show error_id if present
        if (preg_match('/\[error_id\]\s*=>\s*([^\s\]]+)/', $entry['context'], $matches)) {
            $this->line("  <fg=cyan>Error ID: {$matches[1]}</>");
        }

        // Show URL if present
        if (preg_match('/\[url\]\s*=>\s*([^\s\]]+)/', $entry['context'], $matches)) {
            $this->line("  <fg=gray>URL: {$matches[1]}</>");
        }

        $this->newLine();
    }

    protected function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2).' '.$units[$i];
    }
}
