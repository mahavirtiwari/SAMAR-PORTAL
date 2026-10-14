<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    | Let nginx send private files after Laravel has authorised the request
    | (X-Accel-Redirect to the internal /_protected_files/ location in
    | deploy/nginx/qci-samar.conf). Turn on only where that location exists.
    */
    'x_accel_redirect' => (bool) env('FILES_X_ACCEL_REDIRECT', false),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        /*
        |--------------------------------------------------------------------------
        | Local Disk (Default Private Storage)
        |--------------------------------------------------------------------------
        |
        | General-purpose private storage for temporary files and miscellaneous
        | private data. Not publicly accessible.
        |
        */
        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        /*
        |--------------------------------------------------------------------------
        | Public Disk (Deprecated - Do Not Use)
        |--------------------------------------------------------------------------
        |
        | SECURITY WARNING: This disk is publicly accessible via symlink.
        | DO NOT store any sensitive files here. All application data should
        | use the 'private' disk instead. This disk is kept for Laravel
        | compatibility but should not be used in this application.
        |
        */
        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        /*
        |--------------------------------------------------------------------------
        | S3 Disk (Cloud Storage)
        |--------------------------------------------------------------------------
        |
        | Amazon S3 compatible storage for production deployments.
        | Configure via environment variables.
        |
        */
        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

        /*
        |--------------------------------------------------------------------------
        | Private Disk (Primary Secure Storage)
        |--------------------------------------------------------------------------
        |
        | Primary storage for all secure application data. All files are stored
        | with private visibility and require authenticated API access.
        |
        | Folder Structure:
        | - /documents/{year}/{month}/          - General documents (DocumentService)
        | - /applications/{app_id}/             - Application-specific files
        |   - /certificates/                    - Certificate files
        |   - /attachments/                     - Form attachments
        | - /assessments/{assessment_id}/       - Assessment-specific files
        |   - /site-pictures/                   - Site arrival pictures
        |   - /site-tour/                       - Site tour pictures
        |   - /meetings/                        - Meeting photos
        |   - /evidences/                       - Response evidence files
        |   - /scorecards/                      - Generated scorecards
        | - /tickets/{ticket_id}/               - Support ticket attachments
        | - /temp/                              - Temporary files (auto-cleaned)
        |
        */
        'private' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'visibility' => 'private',
            'throw' => false,
            'report' => false,
        ],

        /*
        |--------------------------------------------------------------------------
        | Documents Disk (Legacy - Migrating to Private)
        |--------------------------------------------------------------------------
        |
        | Legacy disk for DocumentService. New code should use 'private' disk.
        | Existing documents will be migrated to /private/documents/
        |
        */
        'documents' => [
            'driver' => 'local',
            'root' => storage_path('app/private/documents'),
            'visibility' => 'private',
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
