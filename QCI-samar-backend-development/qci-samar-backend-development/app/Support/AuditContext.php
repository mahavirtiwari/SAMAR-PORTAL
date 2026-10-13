<?php

namespace App\Support;

/**
 * Actor of last resort for audit entries written outside an authenticated
 * request. CLI entrypoints declare themselves once via system(); HasAuditLog
 * falls back here when Auth::user() is null, so server-side writes are
 * attributed to a named system actor instead of nobody.
 */
class AuditContext
{
    private static ?string $script = null;

    private static ?string $operator = null;

    /**
     * Declare the running script as the audit actor.
     *
     * @param  string  $script  Repo-relative path, e.g. 'scripts/manual-payment-complete.php'
     * @param  string|null  $operator  The human who ran it, when the script collects one
     */
    public static function system(string $script, ?string $operator = null): void
    {
        self::$script = $script;
        self::$operator = $operator;
    }

    public static function clear(): void
    {
        self::$script = null;
        self::$operator = null;
    }

    /**
     * The name recorded in the audit log's user column.
     *
     * Null inside an unauthenticated HTTP request: a missing actor there is a
     * real anomaly and must not be papered over as a system action.
     */
    public static function label(): ?string
    {
        if (self::$script !== null) {
            return 'System (CLI)';
        }

        return app()->runningInConsole() ? 'System (Console)' : null;
    }

    /**
     * Provenance stored alongside the label, so an auditor can tell which
     * script ran and who ran it. Null whenever label() is.
     */
    public static function details(): ?array
    {
        if (self::label() === null) {
            return null;
        }

        return array_filter([
            'channel' => self::$script !== null ? 'cli' : 'console',
            'script' => self::$script,
            'command' => self::$script === null ? self::consoleCommand() : null,
            'operator' => self::$operator,
            'host' => gethostname() ?: null,
        ], fn ($value) => $value !== null);
    }

    private static function consoleCommand(): ?string
    {
        $argv = $_SERVER['argv'] ?? [];

        return isset($argv[1]) ? (string) $argv[1] : null;
    }
}
