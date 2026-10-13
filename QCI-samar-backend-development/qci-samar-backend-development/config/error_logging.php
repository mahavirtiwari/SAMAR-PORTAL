<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Error Logging Enabled
    |--------------------------------------------------------------------------
    |
    | Enable or disable error logging to database. When disabled, errors will
    | still be logged to files but not stored in the database.
    |
    */

    'enabled' => env('ERROR_LOGGING_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Minimum Severity
    |--------------------------------------------------------------------------
    |
    | Failures below this severity are dropped before hitting the database
    | (they still reach the file logs). Ordered least→most severe:
    | notice < warning < error < critical < emergency. HTTP 500s are always
    | 'error' or above, so the default leaves the HTTP capture path unchanged
    | and only filters low-severity non-HTTP captures.
    |
    */

    'min_severity' => env('ERROR_LOG_MIN_SEVERITY', 'error'),

    /*
    |--------------------------------------------------------------------------
    | Capture Detailed Context
    |--------------------------------------------------------------------------
    |
    | When enabled, captures detailed context snapshots including server
    | variables, config, session data, route parameters, database queries,
    | memory usage, and execution time. This provides more debugging info
    | but increases storage requirements.
    |
    */

    'capture_detailed_context' => env('ERROR_LOGGING_DETAILED_CONTEXT', true),

    /*
    |--------------------------------------------------------------------------
    | Retention Policy
    |--------------------------------------------------------------------------
    |
    | Defines how long error logs should be retained in the database.
    | Resolved errors can be archived, and archived errors can be deleted.
    |
    */

    'retention' => [
        'archive_resolved_after_days' => env('ERROR_LOG_ARCHIVE_DAYS', 90),
        'delete_archived_after_days' => env('ERROR_LOG_DELETE_DAYS', 365),
    ],

    /*
    |--------------------------------------------------------------------------
    | Query Logging
    |--------------------------------------------------------------------------
    |
    | When enabled, captures all database queries executed during the request
    | that resulted in an error. WARNING: This can significantly increase
    | storage requirements and may impact performance. Only enable for
    | debugging specific issues.
    |
    */

    'enable_query_logging' => env('ERROR_LOG_QUERY_LOGGING', false),

];
