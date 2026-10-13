<?php

namespace App\Services;

use App\Models\Document;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DocumentService
{
    /**
     * Allowed MIME types for document uploads.
     */
    protected array $allowedMimeTypes = [
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
    ];

    /**
     * Allowed file extensions.
     */
    protected array $allowedExtensions = [
        'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'zip',
    ];

    /**
     * Maximum file size in bytes (default 10MB).
     */
    protected int $maxFileSize;

    /**
     * Storage disk to use.
     */
    protected string $storageDisk;

    /**
     * Constructor.
     */
    public function __construct()
    {
        $this->maxFileSize = config('documents.max_file_size', 10485760); // 10MB default
        $this->storageDisk = config('documents.storage_disk', 'documents');
    }

    /**
     * Upload and store a document.
     *
     * @throws \Exception
     */
    public function upload(UploadedFile $file, array $metadata, User $user): Document
    {
        // Validate file
        $this->validateFile($file);

        // Generate secure filename
        $secureFilename = $this->generateSecureFilename($file);

        // Generate file path (organized by year/month)
        $filePath = $this->generateFilePath($secureFilename);

        // Store file
        $storedPath = Storage::disk($this->storageDisk)->putFileAs(
            dirname($filePath),
            $file,
            basename($filePath)
        );

        if (! $storedPath) {
            throw new \Exception('Failed to store file');
        }

        // Create document record
        $document = Document::create([
            'title' => $metadata['title'] ?? $file->getClientOriginalName(),
            'name' => $metadata['name'] ?? $file->getClientOriginalName(),
            'original_filename' => $file->getClientOriginalName(),
            'file_path' => $storedPath,
            'disk' => $this->storageDisk,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'extension' => $file->getClientOriginalExtension(),
            'uploaded_by' => $user->id,
            'is_active' => $metadata['is_active'] ?? true,
        ]);

        Log::info('Document uploaded successfully', [
            'document_id' => $document->id,
            'uuid' => $document->uuid,
            'filename' => $document->original_filename,
            'size' => $document->size,
            'uploaded_by' => $user->id,
        ]);

        return $document;
    }

    /**
     * Validate uploaded file.
     *
     * @throws \Exception
     */
    protected function validateFile(UploadedFile $file): void
    {
        // Check file size
        if ($file->getSize() > $this->maxFileSize) {
            throw new \Exception('File size exceeds maximum allowed size of '.($this->maxFileSize / 1048576).'MB');
        }

        // Check MIME type
        if (! in_array($file->getMimeType(), $this->allowedMimeTypes)) {
            throw new \Exception('File type not allowed. Allowed types: '.implode(', ', $this->allowedExtensions));
        }

        // Check extension
        $extension = strtolower($file->getClientOriginalExtension());
        if (! in_array($extension, $this->allowedExtensions)) {
            throw new \Exception('File extension not allowed. Allowed extensions: '.implode(', ', $this->allowedExtensions));
        }

        // Check if file is valid
        if (! $file->isValid()) {
            throw new \Exception('Invalid file upload');
        }
    }

    /**
     * Generate secure filename using UUID.
     */
    protected function generateSecureFilename(UploadedFile $file): string
    {
        $uuid = Str::uuid();
        $extension = $file->getClientOriginalExtension();

        return "{$uuid}.{$extension}";
    }

    /**
     * Generate file path organized by year and month.
     */
    protected function generateFilePath(string $filename): string
    {
        $year = now()->year;
        $month = str_pad(now()->month, 2, '0', STR_PAD_LEFT);

        return "documents/{$year}/{$month}/{$filename}";
    }
}
