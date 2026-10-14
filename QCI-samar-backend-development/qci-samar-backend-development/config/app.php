<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Application Name
    |--------------------------------------------------------------------------
    |
    | This value is the name of your application, which will be used when the
    | framework needs to place the application's name in a notification or
    | other UI elements where an application name needs to be displayed.
    |
    */

    'name' => env('APP_NAME', 'Laravel'),

    /*
    |--------------------------------------------------------------------------
    | API Version
    |--------------------------------------------------------------------------
    |
    | This value defines the current API version. It is used in Swagger
    | documentation and returned in the X-Api-Version response header.
    | Increment this version as the API evolves.
    |
    | Set via APP_VERSION in your .env file.
    |
    */

    'api_version' => env('APP_VERSION'),

    /*
    |--------------------------------------------------------------------------
    | Application Environment
    |--------------------------------------------------------------------------
    |
    | This value determines the "environment" your application is currently
    | running in. This may determine how you prefer to configure various
    | services the application utilizes. Set this in your ".env" file.
    |
    */

    'env' => env('APP_ENV', 'production'),

    /*
    |--------------------------------------------------------------------------
    | Application Debug Mode
    |--------------------------------------------------------------------------
    |
    | When your application is in debug mode, detailed error messages with
    | stack traces will be shown on every error that occurs within your
    | application. If disabled, a simple generic error page is shown.
    |
    */

    'debug' => (bool) env('APP_DEBUG', false),

    /*
    |--------------------------------------------------------------------------
    | Application URL
    |--------------------------------------------------------------------------
    |
    | This URL is used by the console to properly generate URLs when using
    | the Artisan command line tool. You should set this to the root of
    | the application so that it's available within Artisan commands.
    |
    */

    'url' => env('APP_URL', 'http://localhost'),

    /*
    |--------------------------------------------------------------------------
    | Frontend Application URL
    |--------------------------------------------------------------------------
    |
    | This URL points to the frontend application. It is used in emails
    | and notifications to provide users with links to the frontend portal.
    |
    */

    'frontend_url' => env('FRONTEND_URL', env('APP_URL', 'http://localhost:3000')),

    /*
    |--------------------------------------------------------------------------
    | Support / Query Form URL
    |--------------------------------------------------------------------------
    |
    | Public support/query form linked from every outgoing email. Defaults to
    | the frontend portal's /support route so each environment resolves its own
    | URL (staging -> samar-staging1.qci.org.in/support, production -> its own),
    | and can be overridden per environment via the SUPPORT_URL env var.
    |
    */

    'support_url' => env('SUPPORT_URL', rtrim(env('FRONTEND_URL', env('APP_URL', 'http://localhost:3000')), '/').'/support'),

    /*
    |--------------------------------------------------------------------------
    | Feedback Form URL
    |--------------------------------------------------------------------------
    |
    | Enterprise Admin "Feedback" tab in the frontend portal, linked from the
    | assessment feedback-request email. Defaults to the frontend portal's
    | /rating-feedback route so each environment resolves its own URL, and can
    | be overridden per environment via the FEEDBACK_FORM_URL env var. A
    | logged-out user clicking the link is sent to login and returned here
    | after authenticating.
    |
    */

    'feedback_form_url' => env('FEEDBACK_FORM_URL', rtrim(env('FRONTEND_URL', env('APP_URL', 'http://localhost:3000')), '/').'/rating-feedback'),

    'swagger_enabled' => env('L5_SWAGGER_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Application Timezone
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default timezone for your application, which
    | will be used by the PHP date and date-time functions. The timezone
    | is set to "UTC" by default as it is suitable for most use cases.
    |
    */

    'timezone' => 'UTC',

    /*
    |--------------------------------------------------------------------------
    | Application Locale Configuration
    |--------------------------------------------------------------------------
    |
    | The application locale determines the default locale that will be used
    | by Laravel's translation / localization methods. This option can be
    | set to any locale for which you plan to have translation strings.
    |
    */

    'locale' => env('APP_LOCALE', 'en'),

    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),

    'faker_locale' => env('APP_FAKER_LOCALE', 'en_US'),

    /*
    |--------------------------------------------------------------------------
    | Encryption Key
    |--------------------------------------------------------------------------
    |
    | This key is utilized by Laravel's encryption services and should be set
    | to a random, 32 character string to ensure that all encrypted values
    | are secure. You should do this prior to deploying the application.
    |
    */

    'cipher' => 'AES-256-CBC',

    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(
            explode(',', (string) env('APP_PREVIOUS_KEYS', ''))
        ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Maintenance Mode Driver
    |--------------------------------------------------------------------------
    |
    | These configuration options determine the driver used to determine and
    | manage Laravel's "maintenance mode" status. The "cache" driver will
    | allow maintenance mode to be controlled across multiple machines.
    |
    | Supported drivers: "file", "cache"
    |
    */

    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting Configuration
    |--------------------------------------------------------------------------
    |
    | Configure rate limiting for authentication endpoints to protect against
    | brute force attacks. Values are attempts per time window (in minutes).
    |
    | Set 'enabled' to false to globally disable all rate limiting (useful
    | for development, testing, or debugging). WARNING: Never disable rate
    | limiting in production environments.
    |
    */

    'rate_limits' => [
        'enabled' => env('RATE_LIMIT_ENABLED', true),
        'login' => (int) env('RATE_LIMIT_LOGIN', 20),
        'login_decay' => (int) env('RATE_LIMIT_LOGIN_DECAY', 1),
        // Per-IP flood ceilings on top of the per-account limits (an office NAT
        // shares one IP).
        'login_ip_ceiling' => (int) env('RATE_LIMIT_LOGIN_IP_CEILING', 300),
        'register' => (int) env('RATE_LIMIT_REGISTER', 5),
        'register_decay' => (int) env('RATE_LIMIT_REGISTER_DECAY', 5),
        'password_reset' => (int) env('RATE_LIMIT_PASSWORD_RESET', 5),
        'password_reset_decay' => (int) env('RATE_LIMIT_PASSWORD_RESET_DECAY', 5),
        'refresh' => (int) env('RATE_LIMIT_REFRESH', 20),
        'refresh_decay' => (int) env('RATE_LIMIT_REFRESH_DECAY', 1),
        'refresh_ip_ceiling' => (int) env('RATE_LIMIT_REFRESH_IP_CEILING', 1000),
        'exports' => (int) env('RATE_LIMIT_EXPORTS', 10),
    ],

];
