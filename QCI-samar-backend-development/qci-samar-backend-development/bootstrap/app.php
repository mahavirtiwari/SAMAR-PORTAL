<?php

use App\Exceptions\BusinessException;
use App\Exceptions\ErrorReporter;
use App\Http\Middleware\AddApiVersionHeader;
use App\Http\Middleware\CheckMaintenanceMode;
use App\Http\Middleware\CheckRoleMiddleware;
use App\Http\Middleware\ConvertRequestToSnakeCase;
use App\Http\Middleware\ConvertResponseToCamelCase;
use App\Http\Middleware\FileUploadSecurity;
use App\Http\Middleware\ForceJsonResponse;
use App\Http\Middleware\LogClientBuild;
use App\Http\Middleware\SanitizeInput;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SwaggerAccess;
use App\Http\Middleware\TrimStrings;
use App\Http\Middleware\TrustProxies;
use App\Http\Middleware\ValidateActiveSession;
use App\Http\Middleware\ValidateTokenType;
use App\Providers\AppServiceProvider;
use App\Providers\AuthServiceProvider;
use App\Providers\BusinessCentralServiceProvider;
use App\Providers\GstinVerifierServiceProvider;
use App\Providers\SupportPlatformServiceProvider;
use App\Support\EnvironmentLoader;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

// Force load .env file in local environment to override system environment variables
// This ensures .env file takes precedence during local development
require_once __DIR__.'/../app/Support/EnvironmentLoader.php';
EnvironmentLoader::forceLoadDotenv(dirname(__DIR__));

return Application::configure(basePath: dirname(__DIR__))
    ->withProviders([
        AppServiceProvider::class,
        AuthServiceProvider::class,
        SupportPlatformServiceProvider::class,
        BusinessCentralServiceProvider::class,
        GstinVerifierServiceProvider::class,
    ])
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Trust Azure proxies for proper HTTPS detection
        $middleware->trustProxies(at: [
            TrustProxies::class,
        ]);

        // Force JSON responses for API
        // TrimStrings trims whitespace from all string inputs (except passwords)
        // ConvertRequestToSnakeCase converts incoming camelCase to snake_case
        // ConvertResponseToCamelCase converts outgoing snake_case to camelCase
        // HandleCors MUST be first to ensure CORS headers are added even on error responses
        $middleware->api(prepend: [
            HandleCors::class,
            ForceJsonResponse::class,
            SecurityHeaders::class,
            AddApiVersionHeader::class,
            TrimStrings::class,
            SanitizeInput::class,
            ConvertRequestToSnakeCase::class,
            ConvertResponseToCamelCase::class,
            LogClientBuild::class,
        ]);

        // Register RBAC middleware aliases
        $middleware->alias([
            'role' => CheckRoleMiddleware::class,
            'swagger.access' => SwaggerAccess::class,
            'validate.token.type' => ValidateTokenType::class,
            'maintenance' => CheckMaintenanceMode::class,
            'file.security' => FileUploadSecurity::class,
            'validate.session' => ValidateActiveSession::class,
        ]);

        // Configure rate limiting
        $middleware->throttleApi('api');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Persist server errors to the database error-log subsystem (and email
        // alerts in production). Under Laravel 12 the App\Exceptions\Handler that
        // used to drive this was never bound, so this reportable is where the
        // pipeline is actually wired.
        $exceptions->report(function (Throwable $e) {
            app(ErrorReporter::class)->report($e);
        });

        // Rendering for /api/* is ours, not the framework's.
        //
        // Left to Laravel, what an API client sees on an unhandled exception is
        // decided by APP_DEBUG alone — so a single wrong .env turns every 500 into
        // a stack trace with SQL, the database host and the connection string in
        // it. That is exactly the STQC finding "Verbose SQL Error Message
        // Disclosure", and a deploy flag is too thin a control for it.
        //
        // The rule below inverts the default: nothing reaches the client unless it
        // is explicitly safe. BusinessException carries a message written for the
        // end user; validation returns field errors; the rest collapse to a fixed
        // string plus a reference id that ties the response to the logged
        // exception. APP_DEBUG is not consulted anywhere in this path.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            // Field-level validation errors are the contract the clients read.
            if ($e instanceof ValidationException) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed.',
                    'errors' => $e->errors(),
                ], 422);
            }

            if ($e instanceof BusinessException) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                ], $e->getStatusCode());
            }

            if ($e instanceof AuthenticationException) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.',
                ], 401);
            }

            if ($e instanceof AuthorizationException || $e instanceof AccessDeniedHttpException) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not authorized to perform this action.',
                ], 403);
            }

            // ModelNotFoundException's own message names the Eloquent class and the
            // id that was looked up ("No query results for model [App\Models\User]
            // 42"), which discloses both the internal model map and whether a given
            // id exists. Answered as a bare 404.
            if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
                return response()->json([
                    'success' => false,
                    'message' => 'The requested resource was not found.',
                ], 404);
            }

            if ($e instanceof MethodNotAllowedHttpException) {
                return response()->json([
                    'success' => false,
                    'message' => 'The requested method is not supported for this endpoint.',
                ], 405);
            }

            if ($e instanceof ThrottleRequestsException) {
                return response()->json([
                    'success' => false,
                    'message' => 'Too many requests. Please try again later.',
                ], 429, $e->getHeaders());
            }

            // A limiter that carries a ->response() callback does not throw the
            // exception above: ThrottleRequests::buildException() returns an
            // HttpResponseException wrapping the callback's response instead, and
            // every auth limiter in AppServiceProvider has such a callback. Laravel
            // runs these render callbacks BEFORE its own HttpResponseException
            // handling, so without this branch each throttle fell through to the
            // generic reference card below — as a 500, since HttpResponseException
            // is not an HttpExceptionInterface — and every rate-limit message we
            // write was unreachable. Hand back the response the limiter built.
            if ($e instanceof HttpResponseException) {
                return $e->getResponse();
            }

            // Everything else: the client is told nothing except a reference. The
            // exception itself is already persisted by the reportable above; this
            // line is what lets support tie a user's screenshot to that record.
            $reference = 'REF-'.strtoupper(Str::random(8));

            Log::error('Unhandled API exception', [
                'reference' => $reference,
                'exception' => $e::class,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'path' => $request->path(),
                'method' => $request->method(),
            ]);

            $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;

            return response()->json([
                'success' => false,
                'message' => 'An unexpected error occurred. Quote reference '.$reference.' if you contact support.',
                'reference' => $reference,
            ], $status);
        });
    })->create();
