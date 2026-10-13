<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicationAssessmentResponseEvidence extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'application_assessment_response_evidences';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'response_id',
        'source_site_tour_picture_id',
        'client_uuid',
        'file_name',
        'file_path',
        'file_size',
        'mime_type',
        'disk',
        'description',
        'uploaded_by',
        'latitude',
        'longitude',
        'captured_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'file_path',
        'disk',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'file_size' => 'integer',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'captured_at' => 'datetime',
    ];

    /**
     * Get the response this evidence belongs to.
     */
    public function response(): BelongsTo
    {
        return $this->belongsTo(ApplicationAssessmentResponse::class, 'response_id');
    }

    /**
     * Get the user who uploaded this evidence.
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Get the download URL for the evidence file.
     */
    public function getDownloadUrlAttribute(): ?string
    {
        if (! $this->file_path || ! $this->response) {
            return null;
        }

        return route('api.v1.application-assessments.responses.evidences.download', [
            'assessmentId' => $this->response->assessment_id,
            'questionId' => $this->response->question_id,
            'evidenceId' => $this->id,
        ]);
    }

    /**
     * Get formatted file size.
     */
    public function getFormattedSizeAttribute(): string
    {
        $bytes = $this->file_size;

        if ($bytes >= 1073741824) {
            return number_format($bytes / 1073741824, 2).' GB';
        } elseif ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 2).' MB';
        } elseif ($bytes >= 1024) {
            return number_format($bytes / 1024, 2).' KB';
        } else {
            return $bytes.' bytes';
        }
    }

    /**
     * Check if the evidence is an image.
     */
    public function isImage(): bool
    {
        return str_starts_with($this->mime_type ?? '', 'image/');
    }
}
