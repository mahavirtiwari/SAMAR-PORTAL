<?php

use App\Models\User;

return [

    /*
    |--------------------------------------------------------------------------
    | Authentication Defaults
    |--------------------------------------------------------------------------
    |
    | This option defines the default authentication "guard" and password
    | reset "broker" for your application. You may change these values
    | as required, but they're a perfect start for most applications.
    |
    */

    'defaults' => [
        'guard' => env('AUTH_GUARD', 'api'),
        'passwords' => env('AUTH_PASSWORD_BROKER', 'users'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Authentication Guards
    |--------------------------------------------------------------------------
    |
    | Next, you may define every authentication guard for your application.
    | Of course, a great default configuration has been defined for you
    | which utilizes session storage plus the Eloquent user provider.
    |
    | All authentication guards have a user provider, which defines how the
    | users are actually retrieved out of your database or other storage
    | system used by the application. Typically, Eloquent is utilized.
    |
    | Supported: "session"
    |
    */

    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],

        'api' => [
            'driver' => 'jwt',
            'provider' => 'users',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | User Providers
    |--------------------------------------------------------------------------
    |
    | All authentication guards have a user provider, which defines how the
    | users are actually retrieved out of your database or other storage
    | system used by the application. Typically, Eloquent is utilized.
    |
    | If you have multiple user tables or models you may configure multiple
    | providers to represent the model / table. These providers may then
    | be assigned to any extra authentication guards you have defined.
    |
    | Supported: "database", "eloquent"
    |
    */

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => env('AUTH_MODEL', User::class),
        ],

        // 'users' => [
        //     'driver' => 'database',
        //     'table' => 'users',
        // ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Resetting Passwords
    |--------------------------------------------------------------------------
    |
    | These configuration options specify the behavior of Laravel's password
    | reset functionality, including the table utilized for token storage
    | and the user provider that is invoked to actually retrieve users.
    |
    | The expiry time is the number of minutes that each reset token will be
    | considered valid. This security feature keeps tokens short-lived so
    | they have less time to be guessed. You may change this as needed.
    |
    | The throttle setting is the number of seconds a user must wait before
    | generating more password reset tokens. This prevents the user from
    | quickly generating a very large amount of password reset tokens.
    |
    */

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => env('AUTH_PASSWORD_RESET_TOKEN_TABLE', 'password_reset_tokens'),
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Password Confirmation Timeout
    |--------------------------------------------------------------------------
    |
    | Here you may define the number of seconds before a password confirmation
    | window expires and users are asked to re-enter their password via the
    | confirmation screen. By default, the timeout lasts for three hours.
    |
    */

    'password_timeout' => env('AUTH_PASSWORD_TIMEOUT', 10800),

    /*
    |--------------------------------------------------------------------------
    | OTP Settings
    |--------------------------------------------------------------------------
    |
    | How long a one-time password remains valid for verification, in minutes.
    | Applies to login 2FA, registration verification, and password reset.
    |
    */

    'otp' => [
        'expiry_minutes' => (int) env('OTP_EXPIRY_MINUTES', 2),
    ],

    /*
    |--------------------------------------------------------------------------
    | Account Lockout
    |--------------------------------------------------------------------------
    |
    | After this many failed password attempts the account is locked for the
    | configured duration. This is the authoritative per-account brute-force
    | gate; the per-IP login throttle (app.rate_limits.login) is a coarser
    | backstop and must stay above max_attempts so the lock can actually arm.
    |
    | enabled is the master switch (mirrors app.rate_limits.enabled): set
    | LOGIN_LOCKOUT_ENABLED=false to turn the per-account lock off entirely.
    | It defaults to true so an unset var never leaves production unprotected.
    |
    */

    'lockout' => [
        'enabled' => (bool) env('LOGIN_LOCKOUT_ENABLED', true),
        'max_attempts' => (int) env('LOGIN_LOCKOUT_MAX_ATTEMPTS', 10),
        'duration_minutes' => (int) env('LOGIN_LOCKOUT_DURATION_MINUTES', 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | Single Session Enforcement
    |--------------------------------------------------------------------------
    |
    | Master switch for concurrent-login prevention (mirrors lockout.enabled):
    | when disabled, the pre-login active-session check reports no conflict
    | and a new login no longer displaces the user's other sessions, so
    | multiple concurrent tokens stay valid. Logout, password-reset, and
    | admin-forced terminations are unaffected. Defaults to true so an unset
    | var never leaves production unprotected.
    |
    */

    'single_session' => [
        'enabled' => (bool) env('SINGLE_SESSION_ENABLED', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Session Liveness
    |--------------------------------------------------------------------------
    |
    | liveness_minutes: how recently a session must have been used (its
    | last_activity_at, falling back to started_at) for the concurrent-login
    | check to treat it as an active session on another device. A client that
    | just closes the tab or kills the app stops updating last_activity_at, so
    | its row ages out of "active" after this window instead of lingering for
    | the full JWT TTL.
    |
    | idle_timeout_minutes: the idle-sweep threshold. Access sessions untouched
    | for longer than this are reaped (is_active = false, reason 'timeout') by
    | the scheduled sweep. Kept >= liveness_minutes so the sweep never reaps a
    | row the concurrent-login check still counts as live.
    |
    */

    'session' => [
        'liveness_minutes' => (int) env('SESSION_LIVENESS_MINUTES', 30),
        'idle_timeout_minutes' => (int) env('SESSION_IDLE_TIMEOUT_MINUTES', 60),
    ],

];
