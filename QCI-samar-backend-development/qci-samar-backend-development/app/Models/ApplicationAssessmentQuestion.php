<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Application Assessment Question
 *
 * Stores copied question and options data for an assessment. This is immutable -
 * copied from master assessment_questions and assessment_question_options when
 * assessment starts.
 */
class ApplicationAssessmentQuestion extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_questions';

    /**
     * Review status constants
     */
    public const REVIEW_STATUS_PENDING = 'pending';

    public const REVIEW_STATUS_APPROVED = 'approved';

    public const REVIEW_STATUS_FLAGGED = 'flagged';

    public const REVIEW_STATUS_CLARIFIED = 'clarified';

    /**
     * Review type constants
     */
    public const REVIEW_TYPE_QC = 'qc';

    public const REVIEW_TYPE_COMMITTEE = 'committee';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'assessment_id',
        'parameter_id',
        'code',
        'question_text',
        'category',
        'weightage',
        'option_1_text',
        'option_1_score',
        'option_2_text',
        'option_2_score',
        'option_3_text',
        'option_3_score',
        'option_4_text',
        'option_4_score',
        'option_5_text',
        'option_5_score',
        'review_status',
        'review_type',
        'reviewed_by',
        'reviewed_at',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'weightage' => 'integer',
        'option_1_score' => 'decimal:2',
        'option_2_score' => 'decimal:2',
        'option_3_score' => 'decimal:2',
        'option_4_score' => 'decimal:2',
        'option_5_score' => 'decimal:2',
        'reviewed_at' => 'datetime',
    ];

    /**
     * Get the assessment this question belongs to.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * Get the parameter this question belongs to.
     */
    public function parameter(): BelongsTo
    {
        return $this->belongsTo(ApplicationAssessmentParameter::class, 'parameter_id');
    }

    /**
     * Get the response for this question.
     */
    public function response(): HasOne
    {
        return $this->hasOne(ApplicationAssessmentResponse::class, 'question_id');
    }

    /**
     * Get option text by number (1-5).
     */
    public function getOptionText(int $optionNumber): ?string
    {
        $field = "option_{$optionNumber}_text";

        return $this->$field ?? null;
    }

    /**
     * Get option score by number (1-5).
     */
    public function getOptionScore(int $optionNumber): ?float
    {
        $field = "option_{$optionNumber}_score";

        return $this->$field ?? null;
    }

    /**
     * Get all options as array.
     */
    public function getOptionsArray(): array
    {
        return [
            1 => ['text' => $this->option_1_text, 'score' => $this->option_1_score],
            2 => ['text' => $this->option_2_text, 'score' => $this->option_2_score],
            3 => ['text' => $this->option_3_text, 'score' => $this->option_3_score],
            4 => ['text' => $this->option_4_text, 'score' => $this->option_4_score],
            5 => ['text' => $this->option_5_text, 'score' => $this->option_5_score],
        ];
    }

    /**
     * Get all feedbacks for this question.
     */
    public function feedbacks(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentQuestionFeedback::class, 'application_assessment_question_id');
    }

    /**
     * Get the latest RC score from committee feedback.
     */
    public function latestRcScore(): ?float
    {
        $latestFeedback = $this->feedbacks()
            ->where('feedback_type', ApplicationAssessmentQuestionFeedback::COMMITTEE_FEEDBACK)
            ->whereNotNull('rc_score')
            ->latest()
            ->first();

        return $latestFeedback?->rc_score;
    }

    /**
     * Get the user who reviewed this question (QC or committee).
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Mark question as reviewed with a specific status and type.
     *
     * @param  string  $status  One of REVIEW_STATUS_* constants
     * @param  string  $type  One of REVIEW_TYPE_* constants
     * @param  int  $userId  The ID of the user performing the review
     */
    public function markReviewed(string $status, string $type, int $userId): void
    {
        $this->update([
            'review_status' => $status,
            'review_type' => $type,
            'reviewed_by' => $userId,
            'reviewed_at' => now(),
        ]);
    }

    /**
     * Reset review status to pending (clears all review fields).
     */
    public function resetReviewStatus(): void
    {
        $this->update([
            'review_status' => self::REVIEW_STATUS_PENDING,
            'review_type' => null,
            'reviewed_by' => null,
            'reviewed_at' => null,
        ]);
    }

    /**
     * Check if question is approved.
     */
    public function isApproved(): bool
    {
        return $this->review_status === self::REVIEW_STATUS_APPROVED;
    }

    /**
     * Check if question is flagged.
     */
    public function isFlagged(): bool
    {
        return $this->review_status === self::REVIEW_STATUS_FLAGGED;
    }

    /**
     * Check if question has been clarified by assessor.
     */
    public function isClarified(): bool
    {
        return $this->review_status === self::REVIEW_STATUS_CLARIFIED;
    }

    /**
     * Check if question is flagged or clarified (both allow clarification submissions).
     */
    public function isFlaggedOrClarified(): bool
    {
        return in_array($this->review_status, [
            self::REVIEW_STATUS_FLAGGED,
            self::REVIEW_STATUS_CLARIFIED,
        ]);
    }
}
