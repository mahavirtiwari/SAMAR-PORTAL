<?php

namespace App\Exceptions;

use App\Services\ErrorLogging\ErrorLoggerService;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;
use PHPOpenSourceSaver\JWTAuth\Exceptions\TokenExpiredException;
use PHPOpenSourceSaver\JWTAuth\Exceptions\TokenInvalidException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Throwable;

/**
 * Captures server errors into the database error-log subsystem and, in
 * production, emails an alert. Wired as the reportable callback in
 * bootstrap/app.php withExceptions() — HTTP response rendering is left to the
 * framework, this only handles the reporting side.
 */
class ErrorReporter
{
    public function __construct(private ErrorLoggerService $errorLogger) {}

    /**
     * Report a thrown exception. Only server errors (5xx) from HTTP requests are
     * persisted — client errors (validation, auth, 404) are expected noise, and
     * console/scheduler failures have no request context to record.
     */
    public function report(Throwable $exception): void
    {
        // Skip real console/scheduler failures (no HTTP request to record); still
        // fire under PHPUnit so the pipeline stays covered.
        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            return;
        }

        if ($this->statusCode($exception) < 500) {
            return;
        }

        $request = request();
        $errorId = 'ERR-'.strtoupper(Str::random(8));

        Log::error('Server Error', [
            'error_id' => $errorId,
            'exception' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'user_id' => $request->user()?->id,
        ]);

        $this->logToDatabase($exception, $request, $errorId);
        $this->maybeEmail($exception);
    }

    /**
     * Capture a non-HTTP failure (queue job, scheduled command, integration or
     * gateway call, storage/PDF operation) into the error-log subsystem. There
     * is no request to record, so the failure is tagged by its $source.
     *
     * Guarded end to end — logging must never break the caller that failed.
     *
     * @param  string  $source  Subsystem tag: queue, scheduler, business_central,
     *                          payment, email, storage, pdf, database.
     * @param  array<string, mixed>  $context  Extra diagnostics (redacted before store).
     * @param  string|null  $level  Override severity (warning/error/critical/…).
     */
    public function captureException(
        Throwable $exception,
        string $source,
        array $context = [],
        ?string $level = null,
        ?string $correlationId = null
    ): void {
        try {
            if (! config('error_logging.enabled', true)) {
                return;
            }

            $this->errorLogger->logException($exception, $source, $context, $level, $correlationId);
        } catch (Throwable $e) {
            Log::warning('Failed to capture non-HTTP error to database', [
                'source' => $source,
                'original_exception' => get_class($exception),
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function logToDatabase(Throwable $exception, Request $request, string $errorId): void
    {
        try {
            if (! config('error_logging.enabled', true)) {
                return;
            }

            $this->errorLogger->logError(
                $exception,
                $request,
                $errorId,
                $this->statusCode($exception),
                config('error_logging.capture_detailed_context', true)
            );
        } catch (Throwable $e) {
            Log::warning('Failed to log error to database', [
                'error' => $e->getMessage(),
                'error_id' => $errorId,
            ]);
        }
    }

    private function maybeEmail(Throwable $exception): void
    {
        if (! config('logging.error_email_enabled') || ! $this->shouldEmail($exception)) {
            return;
        }

        try {
            $errorEmail = config('logging.error_email');
            if (! $errorEmail) {
                return;
            }

            $errorId = 'ERR-'.strtoupper(Str::random(8));
            $request = request();

            Mail::raw(
                $this->formatEmailBody($exception, $errorId, $request),
                function ($message) use ($errorEmail, $exception, $errorId) {
                    $message->to($errorEmail)
                        ->subject("[QCI SAMAR ERROR] {$errorId}: ".Str::limit(get_class($exception), 50));
                }
            );
        } catch (Throwable $mailException) {
            Log::warning('Failed to send error email', [
                'original_error' => get_class($exception),
                'mail_error' => $mailException->getMessage(),
            ]);
        }
    }

    private function shouldEmail(Throwable $e): bool
    {
        if (config('app.debug') || config('app.env') !== 'production') {
            return false;
        }

        $ignored = [
            ValidationException::class,
            AuthenticationException::class,
            ModelNotFoundException::class,
            NotFoundHttpException::class,
            MethodNotAllowedHttpException::class,
            TooManyRequestsHttpException::class,
            TokenExpiredException::class,
            TokenInvalidException::class,
        ];

        foreach ($ignored as $class) {
            if ($e instanceof $class) {
                return false;
            }
        }

        return true;
    }

    private function formatEmailBody(Throwable $e, string $errorId, Request $request): string
    {
        $body = "=== QCI SAMAR SERVER ERROR ===\n\n";
        $body .= "Error ID: {$errorId}\n";
        $body .= 'Time: '.now()->toDateTimeString()."\n";
        $body .= 'Environment: '.config('app.env')."\n\n";

        $body .= "--- Exception ---\n";
        $body .= 'Type: '.get_class($e)."\n";
        $body .= 'Message: '.$e->getMessage()."\n";
        $body .= 'File: '.$e->getFile().':'.$e->getLine()."\n\n";

        $body .= "--- Request ---\n";
        $body .= 'URL: '.$request->fullUrl()."\n";
        $body .= 'Method: '.$request->method()."\n";
        $body .= 'IP: '.$request->ip()."\n";
        $body .= 'User ID: '.($request->user()?->id ?? 'Guest')."\n\n";

        $body .= "--- Stack Trace (first 10 frames) ---\n";
        $body .= collect($e->getTrace())->take(10)->map(function ($t, $i) {
            $file = $t['file'] ?? 'unknown';
            $line = $t['line'] ?? '?';
            $func = ($t['class'] ?? '').($t['type'] ?? '').($t['function'] ?? 'unknown');

            return "#{$i} {$file}:{$line} - {$func}()";
        })->implode("\n");

        return $body."\n";
    }

    private function statusCode(Throwable $exception): int
    {
        if ($exception instanceof HttpException) {
            return $exception->getStatusCode();
        }

        // A throttle whose limiter carries a ->response() callback arrives as an
        // HttpResponseException, which is not an HttpException, so without this it
        // fell through to the 500 default: every rate-limited request was persisted
        // to the error log and emailed in production as a server error.
        if ($exception instanceof HttpResponseException) {
            return $exception->getResponse()->getStatusCode();
        }

        if ($exception instanceof ValidationException) {
            return 422;
        }

        if ($exception instanceof ModelNotFoundException) {
            return 404;
        }

        if ($exception instanceof TokenExpiredException
            || $exception instanceof TokenInvalidException
            || $exception instanceof JWTException
            || $exception instanceof AuthenticationException) {
            return 401;
        }

        return 500;
    }
}
