<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Operations Integration-Failure Categories
    |--------------------------------------------------------------------------
    |
    | The read-only System-Admin "Integration Failures" monitor groups the
    | non-HTTP failures already captured to error_logs (via
    | ErrorReporter::captureException) under friendly, operations-facing
    | labels. Each category maps to one or more captured `source` tags.
    | Sources not listed here (e.g. `http`, `database`) are internal and
    | never surface on this screen.
    |
    | Keyed by the category key used in the API (?category=<key>).
    |
    */

    'categories' => [
        'payment' => [
            'label' => 'Payment Gateway',
            'sources' => ['payment'],
        ],
        'erp' => [
            'label' => 'ERP',
            'sources' => ['business_central'],
        ],
        'email' => [
            'label' => 'Email Delivery',
            'sources' => ['email'],
        ],
        'system_job' => [
            'label' => 'System Job',
            'sources' => ['scheduler', 'queue'],
        ],
    ],

];
