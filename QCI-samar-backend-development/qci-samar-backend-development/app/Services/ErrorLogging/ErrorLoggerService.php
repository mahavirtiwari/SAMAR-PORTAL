<?php

namespace App\Services\ErrorLogging;

use App\Models\ErrorGroup;
use App\Models\ErrorLog;
use App\Models\ErrorLogContextSnapshot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class ErrorLoggerService
{
    public const SOURCE_HTTP = 'http';

    public const SOURCE_DATABASE = 'database';

    /**
     * Log an HTTP-request error to the database (the exception-handler path).
     * Returns null when the severity is below the configured threshold.
     */
    public function logError(
        Throwable $exception,
        Request $request,
        string $errorId,
        int $httpStatusCode,
        bool $captureDetailedContext = true
    ): ?ErrorLog {
        try {
            $severity = $this->determineHttpSeverity($exception, $httpStatusCode);

            if (! $this->meetsThreshold($severity)) {
                return null;
            }

            $endpoint = ErrorLog::extractEndpoint($request->fullUrl());
            $source = $exception instanceof \PDOException ? self::SOURCE_DATABASE : self::SOURCE_HTTP;
            $fingerprint = ErrorLog::generateFingerprint(
                get_class($exception),
                $exception->getFile(),
                $exception->getLine(),
                $endpoint
            );

            $errorGroup = $this->findOrCreateErrorGroup($exception, $fingerprint, $severity, $source, $endpoint);

            // Decide affected-user novelty before inserting this log row, so the
            // row being written now doesn't count itself as pre-existing.
            $userId = $request->user()?->id;
            $newAffectedUser = $userId !== null
                && ! $errorGroup->errorLogs()->where('user_id', $userId)->exists();

            $errorLog = ErrorLog::create([
                'error_id' => $errorId,
                'error_group_id' => $errorGroup->id,
                'exception_class' => get_class($exception),
                'exception_message' => $exception->getMessage(),
                'exception_code' => $exception->getCode() ?: null,
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'severity' => $severity,
                'source' => $source,
                'http_status_code' => $httpStatusCode,
                'request_method' => $request->method(),
                'request_url' => $request->fullUrl(),
                'request_endpoint' => $endpoint,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'request_id' => $request->header('X-Request-ID'),
                'user_id' => $request->user()?->id,
                'user_email' => $request->user()?->email,
                'user_roles' => $request->user()?->roles->pluck('slug')->toArray(),
                'stack_trace' => $this->formatStackTrace($exception),
                'request_headers' => $this->sanitizeHeaders($request->headers->all()),
                'request_body' => $this->sanitizeData($request->all()),
                'request_query' => $request->query(),
                'context' => $this->captureContext($exception),
                'environment' => config('app.env'),
                'server_hostname' => gethostname(),
                'app_version' => config('app.api_version'),
                'fingerprint' => $fingerprint,
                'status' => ErrorLog::STATUS_NEW,
                'tags' => $this->generateTags($exception, $request),
                'occurred_at' => now(),
            ]);

            $errorGroup->recordOccurrence($newAffectedUser);

            if ($captureDetailedContext) {
                $this->captureContextSnapshot($errorLog, $request, $exception);
            }

            return $errorLog;
        } catch (\Exception $e) {
            Log::error('Failed to log error to database', [
                'error' => $e->getMessage(),
                'original_error_id' => $errorId,
                'original_exception' => get_class($exception),
            ]);

            throw $e;
        }
    }

    /**
     * Log a non-HTTP failure (queue job, scheduled command, integration/gateway
     * call, storage/PDF operation) to the database. There is no request context,
     * so those columns stay null and the failure is tagged by its $source.
     * Returns null when the severity is below the configured threshold.
     */
    public function logException(
        Throwable $exception,
        string $source,
        array $context = [],
        ?string $level = null,
        ?string $correlationId = null
    ): ?ErrorLog {
        $severity = $level ?? $this->defaultSeverity($exception);

        if (! $this->meetsThreshold($severity)) {
            return null;
        }

        // Group non-HTTP errors by source rather than endpoint.
        $fingerprint = ErrorLog::generateFingerprint(
            get_class($exception),
            $exception->getFile(),
            $exception->getLine(),
            'source:'.$source
        );

        $errorGroup = $this->findOrCreateErrorGroup($exception, $fingerprint, $severity, $source, null);

        $errorLog = ErrorLog::create([
            'error_id' => 'ERR-'.strtoupper(Str::random(8)),
            'error_group_id' => $errorGroup->id,
            'exception_class' => get_class($exception),
            'exception_message' => $exception->getMessage(),
            'exception_code' => $exception->getCode() ?: null,
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'severity' => $severity,
            'source' => $source,
            'request_id' => $correlationId,
            'stack_trace' => $this->formatStackTrace($exception),
            'context' => ($this->sanitizeData($context) ?? []) + $this->captureContext($exception),
            'environment' => config('app.env'),
            'server_hostname' => gethostname(),
            'app_version' => config('app.api_version'),
            'fingerprint' => $fingerprint,
            'status' => ErrorLog::STATUS_NEW,
            'tags' => ['source:'.$source, 'exception:'.class_basename($exception)],
            'occurred_at' => now(),
        ]);

        $errorGroup->recordOccurrence(false);

        return $errorLog;
    }

    /**
     * Find or create an error group.
     */
    protected function findOrCreateErrorGroup(
        Throwable $exception,
        string $fingerprint,
        string $severity,
        string $source,
        ?string $endpoint
    ): ErrorGroup {
        $errorGroup = ErrorGroup::where('fingerprint', $fingerprint)->first();

        if (! $errorGroup) {
            $errorGroup = ErrorGroup::create([
                'fingerprint' => $fingerprint,
                'signature' => ErrorGroup::generateSignature(
                    get_class($exception),
                    $exception->getFile(),
                    $exception->getLine()
                ),
                'exception_class' => get_class($exception),
                'exception_message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'request_endpoint' => $endpoint,
                'source' => $source,
                // recordOccurrence() is called for every capture (including the
                // first) right after the group is resolved, so it owns the count.
                'occurrences_count' => 0,
                'affected_users_count' => 0,
                'first_seen_at' => now(),
                'last_seen_at' => now(),
                'severity' => $severity,
                'status' => ErrorGroup::STATUS_ACTIVE,
            ]);
        }

        return $errorGroup;
    }

    /**
     * Whether a captured severity meets the configured minimum threshold.
     */
    protected function meetsThreshold(string $severity): bool
    {
        return ErrorLog::severityMeetsThreshold(
            $severity,
            (string) config('error_logging.min_severity', ErrorLog::SEVERITY_ERROR)
        );
    }

    /**
     * Determine severity for an HTTP-request error from status code + type.
     */
    protected function determineHttpSeverity(Throwable $exception, int $httpStatusCode): string
    {
        if ($exception instanceof \PDOException) {
            return ErrorLog::SEVERITY_CRITICAL;
        }

        if ($httpStatusCode === 503) {
            return ErrorLog::SEVERITY_CRITICAL;
        }

        if ($httpStatusCode === 504) {
            return ErrorLog::SEVERITY_EMERGENCY;
        }

        return ErrorLog::SEVERITY_ERROR;
    }

    /**
     * Default severity for a non-HTTP failure when the caller gives no level.
     */
    protected function defaultSeverity(Throwable $exception): string
    {
        return $exception instanceof \PDOException
            ? ErrorLog::SEVERITY_CRITICAL
            : ErrorLog::SEVERITY_ERROR;
    }

    /**
     * Format stack trace for storage.
     */
    protected function formatStackTrace(Throwable $exception): string
    {
        return $exception->getTraceAsString();
    }

    /**
     * Sanitize request headers (redact sensitive information).
     */
    protected function sanitizeHeaders(array $headers): array
    {
        $sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

        foreach ($sensitiveHeaders as $header) {
            if (isset($headers[$header])) {
                $headers[$header] = ['***REDACTED***'];
            }
        }

        return $headers;
    }

    /**
     * Redact sensitive keys from an arbitrary payload (request body or the
     * caller-supplied context of a non-HTTP failure) and cap its size.
     */
    protected function sanitizeData(array $data): ?array
    {
        if (empty($data)) {
            return null;
        }

        $sensitiveFields = $this->sensitiveFieldKeys();

        array_walk_recursive($data, function (&$value, $key) use ($sensitiveFields) {
            if (in_array(strtolower((string) $key), $sensitiveFields, true)) {
                $value = '***REDACTED***';
            }
        });

        // Limit to 50KB
        if (strlen((string) json_encode($data)) > 51200) {
            return ['__truncated' => 'Payload too large (>50KB)'];
        }

        return $data;
    }

    /**
     * Keys whose values must never be stored in plaintext. Reuses the audit
     * redaction list (App\Traits\HasAuditLog::getAuditSensitiveFields) plus the
     * request-body specifics the error log has always redacted.
     *
     * @return array<int, string>
     */
    protected function sensitiveFieldKeys(): array
    {
        return [
            // Audit redaction list
            'password',
            'remember_token',
            'otp_code',
            'reset_token',
            'email_verification_token',
            'api_token',
            'access_token',
            'refresh_token',
            // Error-log request-body specifics
            'token',
            'api_key',
            'secret',
            'credit_card',
            'cvv',
        ];
    }

    /**
     * Capture additional context information.
     */
    protected function captureContext(Throwable $exception): array
    {
        $context = [];

        $previous = $exception->getPrevious();
        if ($previous) {
            $context['previous_exception'] = [
                'class' => get_class($previous),
                'message' => $previous->getMessage(),
                'file' => $previous->getFile(),
                'line' => $previous->getLine(),
            ];
        }

        return $context;
    }

    /**
     * Generate tags for categorization.
     */
    protected function generateTags(Throwable $exception, Request $request): array
    {
        $tags = [];

        $tags[] = 'exception:'.class_basename($exception);
        $tags[] = 'method:'.strtolower($request->method());

        if ($request->is('api/v*')) {
            $tags[] = 'api:v1';
        }

        $tags[] = $request->user() ? 'authenticated' : 'unauthenticated';

        return $tags;
    }

    /**
     * Capture detailed context snapshot.
     */
    protected function captureContextSnapshot(
        ErrorLog $errorLog,
        Request $request,
        Throwable $exception
    ): void {
        $startTime = defined('LARAVEL_START') ? LARAVEL_START : null;

        $snapshot = [
            'error_log_id' => $errorLog->id,
            'server_variables' => $this->captureServerVariables(),
            'config_snapshot' => $this->captureConfigSnapshot(),
            'session_data' => $this->captureSessionData($request),
            'route_parameters' => $request->route()?->parameters() ?? [],
            'memory_usage_bytes' => memory_get_usage(true),
            'memory_peak_bytes' => memory_get_peak_usage(true),
            'execution_time_ms' => $startTime ? (int) ((microtime(true) - $startTime) * 1000) : null,
            'previous_exceptions' => $this->capturePreviousExceptions($exception),
        ];

        if (config('error_logging.enable_query_logging', false)) {
            $queries = DB::getQueryLog();
            $snapshot['database_queries'] = array_map(function ($query) {
                return [
                    'query' => $query['query'],
                    'bindings' => $query['bindings'],
                    'time' => $query['time'],
                ];
            }, $queries);
            $snapshot['query_count'] = count($queries);
            $snapshot['query_time_ms'] = array_sum(array_column($queries, 'time'));
        }

        ErrorLogContextSnapshot::create($snapshot);
    }

    /**
     * Capture server variables.
     */
    protected function captureServerVariables(): array
    {
        return [
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? null,
            'server_protocol' => $_SERVER['SERVER_PROTOCOL'] ?? null,
        ];
    }

    /**
     * Capture relevant config snapshot.
     */
    protected function captureConfigSnapshot(): array
    {
        return [
            'app_debug' => config('app.debug'),
            'app_env' => config('app.env'),
            'app_timezone' => config('app.timezone'),
        ];
    }

    /**
     * Capture session data (sanitized).
     */
    protected function captureSessionData(Request $request): ?array
    {
        if (! $request->hasSession()) {
            return null;
        }

        $sessionData = $request->session()->all();

        unset($sessionData['password'], $sessionData['_token']);

        return $sessionData;
    }

    /**
     * Capture previous exception chain.
     */
    protected function capturePreviousExceptions(Throwable $exception): array
    {
        $previous = [];
        $current = $exception->getPrevious();

        while ($current) {
            $previous[] = [
                'class' => get_class($current),
                'message' => $current->getMessage(),
                'file' => $current->getFile(),
                'line' => $current->getLine(),
            ];
            $current = $current->getPrevious();
        }

        return $previous;
    }
}
