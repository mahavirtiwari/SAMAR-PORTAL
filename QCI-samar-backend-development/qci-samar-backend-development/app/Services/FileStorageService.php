<?php

namespace App\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\ImageManager;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Centralized file storage service for secure, private file management.
 *
 * All files are stored on the 'private' disk with organized folder structure:
 * - /documents/{year}/{month}/          - General documents
 * - /applications/{app_id}/             - Application-specific files
 * - /assessments/{assessment_id}/       - Assessment-specific files
 * - /tickets/{ticket_id}/               - Support ticket attachments
 * - /temp/                              - Temporary files
 */
class FileStorageService
{
    /**
     * The storage disk to use for all file operations.
     */
    protected const DISK = 'private';

    /**
     * Storage category constants for organized folder structure.
     */
    public const CATEGORY_DOCUMENTS = 'documents';

    public const CATEGORY_APPLICATIONS = 'applications';

    public const CATEGORY_ASSESSMENTS = 'assessments';

    public const CATEGORY_TICKETS = 'tickets';

    public const CATEGORY_TEMP = 'temp';

    /**
     * Assessment sub-folder constants.
     */
    public const ASSESSMENT_SITE_PICTURES = 'site-pictures';

    public const ASSESSMENT_SITE_TOUR = 'site-tour';

    public const ASSESSMENT_MEETINGS = 'meetings';

    public const ASSESSMENT_EVIDENCES = 'evidences';

    public const ASSESSMENT_SCORECARDS = 'scorecards';

    public const ASSESSMENT_ATTENDANCE = 'attendance';

    public const ASSESSMENT_CLARIFICATIONS = 'clarifications';

    /**
     * Application sub-folder constants.
     */
    public const APPLICATION_CERTIFICATES = 'certificates';

    public const APPLICATION_ATTACHMENTS = 'attachments';

    /**
     * Allowed MIME types for different file categories.
     */
    protected array $allowedMimeTypes = [
        'images' => [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
        ],
        'documents' => [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
        ],
        'archives' => [
            'application/zip',
            'application/x-zip-compressed',
        ],
    ];

    /**
     * Get the storage disk instance.
     *
     * @return Filesystem
     */
    protected function disk()
    {
        return Storage::disk(self::DISK);
    }

    /**
     * Get the disk name used by this service.
     */
    public function getDiskName(): string
    {
        return self::DISK;
    }

    /**
     * Store a file for an assessment.
     *
     * @param  string  $subFolder  One of the ASSESSMENT_* constants
     * @return array ['path' => string, 'filename' => string, 'size' => int, 'mime_type' => string]
     */
    public function storeAssessmentFile(UploadedFile $file, int $assessmentId, string $subFolder): array
    {
        $path = $this->buildPath(self::CATEGORY_ASSESSMENTS, $assessmentId, $subFolder);

        return $this->storeFile($file, $path);
    }

    /**
     * Store a file for an application.
     *
     * @param  string  $subFolder  One of the APPLICATION_* constants
     * @return array ['path' => string, 'filename' => string, 'size' => int, 'mime_type' => string]
     */
    public function storeApplicationFile(UploadedFile $file, int $applicationId, string $subFolder): array
    {
        $path = $this->buildPath(self::CATEGORY_APPLICATIONS, $applicationId, $subFolder);

        return $this->storeFile($file, $path);
    }

    /**
     * Store a general document with date-based organization.
     *
     * @return array ['path' => string, 'filename' => string, 'size' => int, 'mime_type' => string]
     */
    public function storeDocument(UploadedFile $file): array
    {
        $year = now()->year;
        $month = str_pad(now()->month, 2, '0', STR_PAD_LEFT);
        $path = self::CATEGORY_DOCUMENTS."/{$year}/{$month}";

        return $this->storeFile($file, $path);
    }

    /**
     * Store a temporary file.
     *
     * @param  string|null  $prefix  Optional prefix for organization
     * @return array ['path' => string, 'filename' => string, 'size' => int, 'mime_type' => string]
     */
    public function storeTemporaryFile(UploadedFile $file, ?string $prefix = null): array
    {
        $path = $prefix ? self::CATEGORY_TEMP."/{$prefix}" : self::CATEGORY_TEMP;

        return $this->storeFile($file, $path);
    }

    /**
     * Store a file with secure filename generation.
     *
     * @return array ['path' => string, 'filename' => string, 'size' => int, 'mime_type' => string]
     */
    protected function storeFile(UploadedFile $file, string $directory): array
    {
        $originalFilename = $file->getClientOriginalName();
        $extension = $file->getClientOriginalExtension();
        $secureFilename = $this->generateSecureFilename($extension);

        $storedPath = $this->disk()->putFileAs($directory, $file, $secureFilename);

        return [
            'path' => $storedPath,
            'original_filename' => $originalFilename,
            'filename' => $secureFilename,
            'size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'extension' => $extension,
            'disk' => self::DISK,
        ];
    }

    /**
     * Generate a secure filename using UUID.
     */
    protected function generateSecureFilename(string $extension): string
    {
        return Str::uuid().'.'.strtolower($extension);
    }

    /**
     * Build a storage path from components.
     */
    protected function buildPath(string $category, int|string $id, string $subFolder): string
    {
        return "{$category}/{$id}/{$subFolder}";
    }

    /**
     * Check if a file exists.
     */
    public function exists(string $path): bool
    {
        return $this->disk()->exists($path);
    }

    /**
     * Delete a file.
     */
    public function delete(string $path): bool
    {
        if ($this->exists($path)) {
            return $this->disk()->delete($path);
        }

        return true;
    }

    /**
     * Delete multiple files.
     */
    public function deleteMany(array $paths): bool
    {
        $success = true;
        foreach ($paths as $path) {
            if (! $this->delete($path)) {
                $success = false;
            }
        }

        return $success;
    }

    /**
     * Get the full filesystem path to a file.
     */
    public function getFullPath(string $path): string
    {
        return $this->disk()->path($path);
    }

    /**
     * Get file contents.
     */
    public function get(string $path): ?string
    {
        if (! $this->exists($path)) {
            return null;
        }

        return $this->disk()->get($path);
    }

    /**
     * Get file size.
     */
    public function size(string $path): ?int
    {
        if (! $this->exists($path)) {
            return null;
        }

        return $this->disk()->size($path);
    }

    /**
     * Get file MIME type.
     */
    public function mimeType(string $path): ?string
    {
        if (! $this->exists($path)) {
            return null;
        }

        return $this->disk()->mimeType($path);
    }

    /**
     * Stream a file download response.
     *
     * @param  string|null  $filename  Override the download filename
     * @param  array  $headers  Additional headers
     */
    public function download(string $path, ?string $filename = null, array $headers = []): StreamedResponse
    {
        return $this->disk()->download($path, $filename, $headers);
    }

    /** Longest side of a ?size=thumb image, in pixels. */
    public const THUMBNAIL_MAX_SIZE = 480;

    /** Originals above this are served as-is rather than decoded for a thumbnail. */
    private const THUMBNAIL_SOURCE_MAX_BYTES = 30 * 1024 * 1024;

    /**
     * Stream a file for inline viewing (e.g., PDF in browser).
     *
     * Images requested with ?size=thumb get a ~480px JPEG instead of the original
     * (grids used to download every 5-10 MB photo in full). The thumbnail is made
     * on first request and kept next to the originals; if it cannot be made the
     * original is served.
     *
     * With filesystems.x_accel_redirect on, nginx sends the bytes (internal
     * /_protected_files/ location) after this request has been authorised, so a
     * PHP-FPM worker is not held for the whole transfer.
     */
    public function stream(string $path, ?string $filename = null): Response
    {
        $filename ??= basename($path);
        if (request()->query('size') === 'thumb' && ($thumb = $this->thumbnailFor($path))) {
            $path = $thumb;
            $filename = pathinfo($filename, PATHINFO_FILENAME).'-thumb.jpg';
        }

        $mimeType = $this->mimeType($path) ?? 'application/octet-stream';
        $headers = [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="'.str_replace('"', '', $filename).'"',
            'Cache-Control' => 'private, max-age=3600',
        ];

        if (($internalUri = $this->xAccelUri($path)) !== null) {
            return response('', 200, $headers + ['X-Accel-Redirect' => $internalUri]);
        }

        $headers['Content-Length'] = $this->size($path);

        return response()->stream(function () use ($path) {
            $stream = $this->disk()->readStream($path);
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, $headers);
    }

    /**
     * Path of a JPEG thumbnail for an image, creating it when missing. Null when
     * the file is not a raster image or cannot be decoded.
     */
    public function thumbnailFor(string $path): ?string
    {
        $mime = (string) $this->mimeType($path);
        if (! str_starts_with($mime, 'image/') || $mime === 'image/svg+xml') {
            return null;
        }

        $thumb = 'thumbnails/'.sha1($path).'.jpg';
        if ($this->exists($thumb)) {
            return $thumb;
        }
        if (($this->size($path) ?? PHP_INT_MAX) > self::THUMBNAIL_SOURCE_MAX_BYTES) {
            return null;
        }

        try {
            $encoded = ImageManager::usingDriver(GdDriver::class)
                ->decodeBinary((string) $this->disk()->get($path))
                ->orient()
                ->scaleDown(self::THUMBNAIL_MAX_SIZE, self::THUMBNAIL_MAX_SIZE)
                ->encode(new JpegEncoder(quality: 75));
            $this->disk()->put($thumb, $encoded->toString());

            return $thumb;
        } catch (\Throwable $e) {
            Log::warning('Thumbnail could not be created; serving the original', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * nginx-internal URI for a file on the private disk, or null when
     * X-Accel-Redirect is off or the file lives outside storage/app/private.
     */
    private function xAccelUri(string $path): ?string
    {
        if (! config('filesystems.x_accel_redirect')) {
            return null;
        }
        $base = rtrim(str_replace('\\', '/', storage_path('app/private')), '/').'/';
        $full = str_replace('\\', '/', $this->disk()->path($path));
        if (! str_starts_with($full, $base)) {
            return null;
        }

        return '/_protected_files/'.implode('/', array_map('rawurlencode', explode('/', substr($full, strlen($base)))));
    }

    /**
     * Move a file from one location to another.
     */
    public function move(string $from, string $to): bool
    {
        return $this->disk()->move($from, $to);
    }

    /**
     * Copy a file.
     */
    public function copy(string $from, string $to): bool
    {
        return $this->disk()->copy($from, $to);
    }

    /**
     * List files in a directory.
     */
    public function files(string $directory, bool $recursive = false): array
    {
        if ($recursive) {
            return $this->disk()->allFiles($directory);
        }

        return $this->disk()->files($directory);
    }

    /**
     * Validate that a file meets the allowed criteria.
     *
     * @param  array  $allowedCategories  Array of category keys from $allowedMimeTypes
     * @param  int  $maxSizeBytes  Maximum file size in bytes
     * @return array ['valid' => bool, 'error' => string|null]
     */
    public function validateFile(UploadedFile $file, array $allowedCategories = [], int $maxSizeBytes = 10485760): array
    {
        // Check file is valid
        if (! $file->isValid()) {
            return ['valid' => false, 'error' => 'Invalid file upload'];
        }

        // Check file size
        if ($file->getSize() > $maxSizeBytes) {
            $maxSizeMB = $maxSizeBytes / 1048576;

            return ['valid' => false, 'error' => "File size exceeds maximum allowed size of {$maxSizeMB}MB"];
        }

        // Check MIME type if categories specified
        if (! empty($allowedCategories)) {
            $allowedMimeTypes = [];
            foreach ($allowedCategories as $category) {
                if (isset($this->allowedMimeTypes[$category])) {
                    $allowedMimeTypes = array_merge($allowedMimeTypes, $this->allowedMimeTypes[$category]);
                }
            }

            if (! empty($allowedMimeTypes) && ! in_array($file->getMimeType(), $allowedMimeTypes)) {
                return ['valid' => false, 'error' => 'File type not allowed'];
            }
        }

        return ['valid' => true, 'error' => null];
    }

    /**
     * Clean up temporary files older than specified hours.
     *
     * @return int Number of files deleted
     */
    public function cleanupTemporaryFiles(int $hoursOld = 24): int
    {
        $deleted = 0;
        $cutoff = now()->subHours($hoursOld)->timestamp;

        $files = $this->files(self::CATEGORY_TEMP, true);

        foreach ($files as $file) {
            $lastModified = $this->disk()->lastModified($file);
            if ($lastModified < $cutoff) {
                if ($this->delete($file)) {
                    $deleted++;
                }
            }
        }

        return $deleted;
    }

    /**
     * Get storage statistics for a category.
     *
     * @return array ['file_count' => int, 'total_size' => int]
     */
    public function getStorageStats(string $category): array
    {
        $files = $this->files($category, true);
        $totalSize = 0;

        foreach ($files as $file) {
            $totalSize += $this->size($file) ?? 0;
        }

        return [
            'file_count' => count($files),
            'total_size' => $totalSize,
            'total_size_human' => $this->formatBytes($totalSize),
        ];
    }

    /**
     * Format bytes to human-readable size.
     */
    protected function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);

        return round($bytes, $precision).' '.$units[$pow];
    }
}
