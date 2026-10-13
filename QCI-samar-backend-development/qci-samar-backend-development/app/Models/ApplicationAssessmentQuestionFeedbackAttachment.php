<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Application Assessment Question Feedback Attachment
 *
 * Stores file attachments associated with assessor clarifications and other feedback.
 */
class ApplicationAssessmentQuestionFeedbackAttachment extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_question_feedback_attachments';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'feedback_id',
        'file_name',
        'file_path',
        'file_size',
        'mime_type',
        'disk',
        'uploaded_by',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'file_size' => 'integer',
    ];

    /**
     * Get the feedback this attachment belongs to.
     */
    public function feedback(): BelongsTo
    {
        return $this->belongsTo(ApplicationAssessmentQuestionFeedback::class, 'feedback_id');
    }

    /**
     * Get the user who uploaded this attachment.
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Check if the file is an image.
     */
    public function isImage(): bool
    {
        return $this->mime_type && str_starts_with($this->mime_type, 'image/');
    }

    /**
     * Get human-readable file size.
     */
    public function getFormattedSizeAttribute(): string
    {
        $bytes = $this->file_size;
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);

        return round($bytes, 2).' '.$units[$pow];
    }
}
