<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Document Storage Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains configuration for document management system.
    |
    */

    /**
     * Storage disk to use for documents
     * Must be configured in config/filesystems.php
     */
    'storage_disk' => env('DOCUMENTS_STORAGE_DISK', 'documents'),

    /**
     * Maximum file size in bytes
     * Default: 50MB (50 * 1024 * 1024)
     */
    'max_file_size' => env('DOCUMENTS_MAX_FILE_SIZE', 52428800),

    /**
     * Allowed MIME types for document uploads
     */
    'allowed_mime_types' => [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/x-zip-compressed',
    ],

    /**
     * Allowed file extensions
     */
    'allowed_extensions' => [
        'pdf',
        'jpg',
        'jpeg',
        'png',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'zip',
    ],

];
