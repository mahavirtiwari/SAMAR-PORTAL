<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpFoundation\Response;

/**
 * FileUploadSecurity Middleware
 *
 * Validates uploaded files for security:
 * - Blocks dangerous file extensions
 * - Enforces maximum file size
 * - Validates MIME type against extension
 * - Detects null bytes in filenames
 */
class FileUploadSecurity
{
    /**
     * File extensions that are blocked (executables, scripts, server-side code).
     */
    private const BLOCKED_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'php7', 'phtml', 'phar',
        'exe', 'bat', 'cmd', 'sh', 'bash', 'zsh',
        'py', 'rb', 'pl', 'perl',
        'js', 'mjs', 'cjs',
        'asp', 'aspx', 'jsp', 'cfm',
        'htaccess', 'htpasswd',
        'svg',
        'html', 'htm',
    ];

    /**
     * Allowed MIME types mapped to their expected extensions.
     */
    private const ALLOWED_MIME_MAP = [
        'application/pdf' => ['pdf'],
        'image/jpeg' => ['jpg', 'jpeg'],
        'image/png' => ['png'],
        'image/gif' => ['gif'],
        'image/webp' => ['webp'],
        'application/msword' => ['doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => ['docx'],
        'application/vnd.ms-excel' => ['xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => ['xlsx'],
        'application/vnd.ms-powerpoint' => ['ppt'],
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => ['pptx'],
        'application/zip' => ['zip'],
        'text/plain' => ['txt', 'csv'],
        'text/csv' => ['csv'],
    ];

    /**
     * Maximum file size in bytes (20 MB).
     */
    private const MAX_FILE_SIZE = 20 * 1024 * 1024;

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->requestHasAnyFile($request)) {
            $files = $this->getAllUploadedFiles($request);

            foreach ($files as $fieldName => $file) {
                $error = $this->validateFile($file, $fieldName);
                if ($error !== null) {
                    return response()->json([
                        'success' => false,
                        'message' => $error,
                    ], 422);
                }
            }
        }

        return $next($request);
    }

    private function requestHasAnyFile(Request $request): bool
    {
        foreach ($request->allFiles() as $file) {
            if ($file instanceof UploadedFile || is_array($file)) {
                return true;
            }
        }

        return false;
    }

    private function getAllUploadedFiles(Request $request): array
    {
        $files = [];
        foreach ($request->allFiles() as $field => $file) {
            if (is_array($file)) {
                foreach ($file as $i => $f) {
                    $files["{$field}[{$i}]"] = $f;
                }
            } else {
                $files[$field] = $file;
            }
        }

        return $files;
    }

    private function validateFile(UploadedFile $file, string $fieldName): ?string
    {
        // 1. Size check
        if ($file->getSize() > self::MAX_FILE_SIZE) {
            $maxMb = self::MAX_FILE_SIZE / 1024 / 1024;

            return "File '{$fieldName}' exceeds the maximum allowed size of {$maxMb}MB.";
        }

        // 2. Extension check
        $extension = strtolower($file->getClientOriginalExtension());
        if (in_array($extension, self::BLOCKED_EXTENSIONS)) {
            return "File type '.{$extension}' is not permitted for security reasons.";
        }

        // 3. MIME type validation
        $mimeType = $file->getMimeType();
        if (! isset(self::ALLOWED_MIME_MAP[$mimeType])) {
            return "File type '{$mimeType}' is not allowed.";
        }

        // 4. Extension/MIME consistency check
        $allowedExtensions = self::ALLOWED_MIME_MAP[$mimeType];
        if (! in_array($extension, $allowedExtensions)) {
            return "File extension '.{$extension}' does not match its detected type '{$mimeType}'.";
        }

        // 5. Null byte and path traversal detection
        $originalName = $file->getClientOriginalName();
        if (str_contains($originalName, "\0") || str_contains($originalName, '..')) {
            return 'Invalid filename detected.';
        }

        // 6. Double extension detection (e.g., malware.php.jpg, shell.exe.png)
        $nameParts = explode('.', $originalName);
        if (count($nameParts) > 2) {
            // Check all inner extensions (excluding the last/final extension)
            for ($i = 1; $i < count($nameParts) - 1; $i++) {
                $innerExt = strtolower($nameParts[$i]);
                if (in_array($innerExt, self::BLOCKED_EXTENSIONS)) {
                    return "File contains a blocked extension '.{$innerExt}' in its name. Double extensions are not permitted.";
                }
            }
        }

        return null;
    }
}
