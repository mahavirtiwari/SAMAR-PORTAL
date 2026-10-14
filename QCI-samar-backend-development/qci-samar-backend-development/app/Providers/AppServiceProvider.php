<?php

namespace App\Providers;

use App\Exceptions\ErrorReporter;
use App\Listeners\ApplicationStatusChangedListener;
use App\Listeners\AssessmentStatusChangedListener;
use App\Models\AssessmentQuestion;
use App\Models\User;
use App\Observers\AssessmentQuestionObserver;
use App\Services\Email\MailConfigurationApplier;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Console\Events\ScheduledTaskFailed;
use Illuminate\Http\Request;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

/**
 * Application Service Provider
 *
 * Registers application services and configures rate limiting
 */
class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Mail server settings saved in Settings → Email Server override MAIL_*.
        $this->app->booted(fn () => app(MailConfigurationApplier::class)->apply());
        // ...and its BCC list is copied on every outgoing email.
        Event::listen(MessageSending::class, [MailConfigurationApplier::class, 'addBcc']);

        // Force HTTPS URLs in production/staging/development (Azure environments)
        if (app()->environment('production', 'staging', 'development')) {
            URL::forceScheme('https');
            // Also force HTTPS for asset URLs to prevent mixed content issues
            $this->app['request']->server->set('HTTPS', 'on');
        }

        // Prevent debug-level logging in production/staging to avoid leaking sensitive data
        if (app()->environment('production', 'staging')) {
            config(['logging.channels.stack.level' => 'warning']);
        }

        // Register event listeners
        Event::listen(
            'application.status.changed',
            ApplicationStatusChangedListener::class
        );

        Event::listen(
            'assessment.status.changed',
            AssessmentStatusChangedListener::class
        );

        AssessmentQuestion::observe(AssessmentQuestionObserver::class);

        $this->registerErrorCaptureListeners();

        $this->configureRateLimiting();
    }

    /**
     * Route failures that never reach the HTTP exception handler — failed queue
     * jobs and failed scheduled commands — into the error-log subsystem so the
     * System Admin error feed captures them alongside HTTP 500s.
     */
    protected function registerErrorCaptureListeners(): void
    {
        Queue::failing(function (JobFailed $event) {
            app(ErrorReporter::class)->captureException(
                $event->exception,
                'queue',
                [
                    'job' => $event->job->resolveName(),
                    'connection' => $event->connectionName,
                    'queue' => $event->job->getQueue(),
                    'attempts' => $event->job->attempts(),
                ],
            );
        });

        Event::listen(ScheduledTaskFailed::class, function (ScheduledTaskFailed $event) {
            app(ErrorReporter::class)->captureException(
                $event->exception,
                'scheduler',
                [
                    'command' => $event->task->command ?? $event->task->getSummaryForDisplay(),
                ],
            );
        });
    }

    /**
     * Configure rate limiting for authentication endpoints.
     */
    protected function configureRateLimiting(): void
    {
        // Check if rate limiting is globally disabled
        if (! config('app.rate_limits.enabled', true)) {
            // Register unlimited rate limiters when disabled
            RateLimiter::for('auth.login', fn () => Limit::none());
            RateLimiter::for('auth.register', fn () => Limit::none());
            RateLimiter::for('auth.verify', fn () => Limit::none());
            RateLimiter::for('auth.resend', fn () => Limit::none());
            RateLimiter::for('auth.resend.password', fn () => Limit::none());
            RateLimiter::for('auth.password', fn () => Limit::none());
            RateLimiter::for('auth.refresh', fn () => Limit::none());
            RateLimiter::for('auth.sensitive', fn () => Limit::none());
            RateLimiter::for('erp.ingest', fn () => Limit::none());
            RateLimiter::for('api', fn () => Limit::none());
            // Backwards-compatibility: Laravel may build a limiter name like "{Model}::api"
            // when resolving per-user limiters. Register an alias for the User model.
            RateLimiter::for(User::class.'::api', fn () => Limit::none());

            return;
        }

        // Per-IP anti-flood backstop for the login endpoints. Kept above the
        // per-account lockout (auth.lockout.max_attempts) so the account lock is
        // the gate that actually arms; this only stops request flooding.
        RateLimiter::for('auth.login', function (Request $request) {
            $maxAttempts = (int) config('app.rate_limits.login', 20);
            $decayMinutes = (int) config('app.rate_limits.login_decay', 1);

            return Limit::perMinutes($decayMinutes, $maxAttempts)
                ->by($request->ip())
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Too many login attempts. Please try again later.',
                        'retry_after' => $headers['Retry-After'] ?? 60,
                    ], 429, $headers);
                });
        });

        // Moderate rate limiting for registration (3 attempts per 5 minutes per IP)
        RateLimiter::for('auth.register', function (Request $request) {
            $maxAttempts = (int) config('app.rate_limits.register', 3);
            $decayMinutes = (int) config('app.rate_limits.register_decay', 5);

            return Limit::perMinutes($decayMinutes, $maxAttempts)
                ->by($request->ip())
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Too many registration attempts. Please try again later.',
                        'retry_after' => $headers['Retry-After'] ?? 300,
                    ], 429, $headers);
                });
        });

        // Rate limiting for OTP verification (10 attempts per 5 minutes per IP)
        RateLimiter::for('auth.verify', function (Request $request) {
            return Limit::perMinutes(5, 10)
                ->by($request->ip())
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Too many verification attempts. Please try again later.',
                        'retry_after' => $headers['Retry-After'] ?? 300,
                    ], 429, $headers);
                });
        });

        // Rate limiting for OTP resend (5 attempts per 5 minutes per IP)
        RateLimiter::for('auth.resend', function (Request $request) {
            return Limit::perMinutes(5, 5)
                ->by($request->ip())
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Too many OTP resend attempts. Please try again later.',
                        'retry_after' => $headers['Retry-After'] ?? 300,
                    ], 429, $headers);
                });
        });

        // Password-reset OTP resend: keyed by SAMAR ID (the target account), not IP,
        // so multiple users behind one NAT/proxy each get their own resend budget.
        // Abuse is bounded to emailing a real account's own registered address.
        RateLimiter::for('auth.resend.password', function (Request $request) {
            $maxAttempts = (int) config('app.rate_limits.resend', 5);
            $decayMinutes = (int) config('app.rate_limits.resend_decay', 5);
            $key = strtoupper((string) $request->input('samar_id')) ?: $request->ip();

            return Limit::perMinutes($decayMinutes, $maxAttempts)
                ->by('resend-pwd:'.$key)
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Too many OTP resend attempts. Please try again later.',
                        'retry_after' => $headers['Retry-After'] ?? 300,
                    ], 429, $headers);
                });
        });

        // Strict rate limiting for password reset requests (3 attempts per 10 minutes per IP)
        RateLimiter::for('auth.password', function (Request $request) {
            $maxAttempts = (int) config('app.rate_limits.password_reset', 3);
            $decayMinutes = (int) config('app.rate_limits.password_reset_decay', 10);

            return Limit::perMinutes($decayMinutes, $maxAttempts)
                ->by($request->ip())
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Too many password reset attempts. Please try again later.',
                        'retry_after' => $headers['Retry-After'] ?? 600,
                    ], 429, $headers);
                });
        });

        // Relaxed rate limiting for token refresh (10 attempts per minute per user)
        RateLimiter::for('auth.refresh', function (Request $request) {
            $maxAttempts = (int) config('app.rate_limits.refresh', 10);
            $decayMinutes = (int) config('app.rate_limits.refresh_decay', 1);

            return Limit::perMinutes($decayMinutes, $maxAttempts)
                ->by($request->user()?->id ?: $request->ip())
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Too many token refresh attempts. Please try again later.',
                        'retry_after' => $headers['Retry-After'] ?? 60,
                    ], 429, $headers);
                });
        });

        // Signed-in endpoints that verify the account password (change password,
        // disable two-factor). A stolen access token must not buy the general
        // 300-per-minute budget for guessing the password behind it.
        RateLimiter::for('auth.sensitive', function (Request $request) {
            return Limit::perMinute(5)
                ->by($request->user()?->id ?: $request->ip())
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Too many attempts. Please try again later.',
                        'retry_after' => $headers['Retry-After'] ?? 60,
                    ], 429, $headers);
                });
        });

        // ERP inbound document push (60 requests per minute per service account/IP)
        RateLimiter::for('erp.ingest', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // General API rate limiting. A signed-in user gets 300 requests per
        // minute: an assessor app flushing an offline day (dozens of photo
        // uploads plus the screens' own reads) and the web scheduler's off-time
        // bursts both exceeded the old 100 and stalled on 429s. Anonymous
        // traffic stays at 100 per minute per IP.
        $apiLimit = function (Request $request) {
            $user = $request->user();

            return $user
                ? Limit::perMinute(300)->by($user->id)
                : Limit::perMinute(100)->by($request->ip());
        };
        RateLimiter::for('api', $apiLimit);
        // Also register compatibility alias for model-specific limiter names
        RateLimiter::for(User::class.'::api', $apiLimit);
    }
}
