<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Application Assessment Question Feedback
 *
 * Stores feedback for assessment questions including QC feedback,
 * committee feedback, and send-back comments.
 */
class ApplicationAssessmentQuestionFeedback extends Model
{
    use HasFactory;

    /**
     * Feedback type constants
     */
    public const QC_FEEDBACK = 'qc_feedback';

    public const COMMITTEE_FEEDBACK = 'committee_feedback';

    public const SEND_BACK = 'send_back';

    public const ASSESSOR_CLARIFICATION = 'assessor_clarification';

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_question_feedbacks';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'application_assessment_question_id',
        'user_id',
        'feedback_type',
        'rc_score',
        'comment',
        'parent_feedback_id',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'rc_score' => 'decimal:2',
    ];

    /**
     * Get the question this feedback belongs to.
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(ApplicationAssessmentQuestion::class, 'application_assessment_question_id');
    }

    /**
     * Get the user who created this feedback.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the parent feedback this is a reply to.
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_feedback_id');
    }

    /**
     * Get all replies to this feedback.
     */
    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_feedback_id');
    }

    /**
     * Get all attachments for this feedback.
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentQuestionFeedbackAttachment::class, 'feedback_id');
    }

    /**
     * Get human-readable feedback type label.
     */
    public function getFeedbackTypeLabel(): string
    {
        return match ($this->feedback_type) {
            self::QC_FEEDBACK => 'QC Feedback',
            self::COMMITTEE_FEEDBACK => 'Committee Feedback',
            self::SEND_BACK => 'Send Back',
            self::ASSESSOR_CLARIFICATION => 'Assessor Clarification',
            default => ucfirst(str_replace('_', ' ', $this->feedback_type)),
        };
    }
}
