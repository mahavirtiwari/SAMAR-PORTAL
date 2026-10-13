<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Application Assessment Response
 *
 * Stores the assessor's response to a question, including the selected option
 * and calculated scores.
 */
class ApplicationAssessmentResponse extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_responses';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'assessment_id',
        'question_id',
        'selected_option',
        'selected_score',
        'rc_score',
        'weighted_score',
        'assessor_remarks',
        'assessed_by',
        'assessed_at',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'selected_option' => 'integer',
        'selected_score' => 'decimal:2',
        'rc_score' => 'decimal:2',
        'weighted_score' => 'decimal:2',
        'assessed_at' => 'datetime',
    ];

    /**
     * Get the assessment this response belongs to.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * Get the question this response is for.
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(ApplicationAssessmentQuestion::class, 'question_id');
    }

    /**
     * Get the user who assessed this question.
     */
    public function assessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assessed_by');
    }

    /**
     * Calculate and set scores based on selected option.
     *
     * Rating Committee override: if rc_score is set (committee adjusted the score),
     * use it instead of the assessor's selected_score when computing weighted_score.
     */
    public function calculateScores(): void
    {
        if ($this->selected_option === null || ! $this->question) {
            return;
        }

        $this->selected_score = $this->question->getOptionScore($this->selected_option);

        $weightage = $this->question->weightage ?? 0;
        $effectiveScore = $this->rc_score ?? $this->selected_score;
        $this->weighted_score = $effectiveScore * ($weightage / 100);
    }

    /**
     * Set response and calculate scores.
     *
     * `assessed_by` is the remark's AUTHOR (it drives the "comment by <assessor>"
     * display), not whoever last touched the score. When $attributeRemark is
     * false the caller is saving a score without authoring the remark, so the
     * existing remark and its author are left intact — otherwise a co-assessor
     * re-saving a question the lead remarked on would re-stamp the lead's text
     * with the co-assessor's name.
     */
    public function setResponse(int $selectedOption, ?string $remarks = null, ?int $assessorId = null, bool $attributeRemark = true): void
    {
        $this->selected_option = $selectedOption;
        if ($attributeRemark) {
            $this->assessor_remarks = $remarks;
            $this->assessed_by = $assessorId ?? auth()->id();
        }
        $this->assessed_at = now();
        // RC score is tied to the previous assessor input; a new response invalidates it.
        $this->rc_score = null;

        $this->calculateScores();
    }

    /**
     * Get all evidences for this response.
     */
    public function evidences(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentResponseEvidence::class, 'response_id');
    }
}
