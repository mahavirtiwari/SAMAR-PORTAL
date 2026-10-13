<?php

namespace App\Models;

use App\Traits\HasAuditLog;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class Document extends Model
{
    use HasAuditLog, HasFactory, SoftDeletes;

    /**
     * The "booting" method of the model.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($document) {
            if (empty($document->uuid)) {
                $document->uuid = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'uuid',
        'title',
        'name',
        'original_filename',
        'file_path',
        'disk',
        'mime_type',
        'size',
        'extension',
        'uploaded_by',
        'is_active',
    ];

    protected $casts = [
        'size' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<string>
     */
    protected $hidden = [
        'file_path',
        'disk',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<string>
     */
    protected $appends = [
        'download_url',
    ];

    /**
     * Get the user who uploaded this document.
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Get the download URL for authenticated access.
     */
    public function getDownloadUrlAttribute(): string
    {
        return route('api.v1.documents.download', ['document' => $this->uuid]);
    }

    /**
     * Get the full file path.
     */
    public function getFullPath(): string
    {
        return Storage::disk($this->disk)->path($this->file_path);
    }

    /**
     * Check if document exists in storage.
     */
    public function exists(): bool
    {
        return Storage::disk($this->disk)->exists($this->file_path);
    }

    /**
     * Download the document.
     */
    public function download(): StreamedResponse
    {
        return Storage::disk($this->disk)->download($this->file_path, $this->original_filename);
    }

    /**
     * Route key name for model binding using UUID.
     */
    public function getRouteKeyName(): string
    {
        return 'uuid';
    }
}
