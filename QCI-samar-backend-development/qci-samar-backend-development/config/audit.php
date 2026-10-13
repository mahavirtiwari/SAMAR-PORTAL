<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Audit Log Retention
    |--------------------------------------------------------------------------
    |
    | How long audit_logs rows are kept before the audit-logs:cleanup command
    | deletes them. Audit logs are append-only, so cleanup is a delete-by-age.
    | Defaults to two years — long enough for a certification/defense system's
    | accountability window, overridable per environment.
    |
    */

    'retention_days' => (int) env('AUDIT_LOG_RETENTION_DAYS', 730),

];
