<?php

namespace App\Models;

use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicationFeedback extends Model
{
    use HasFactory, TracksUserActions;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'application_feedbacks';

    /**
     * Question type constants.
     */
    public const TYPE_RATING = 'rating';

    public const TYPE_YES_NO = 'yes_no';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'application_id',
        'feedback_question_id',
        'question_text',
        'question_type',
        'rating',
        'yes_no_answer',
        'remarks',
        'created_by',
        'updated_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'feedback_question_id' => 'integer',
        'rating' => 'integer',
        'yes_no_answer' => 'boolean',
    ];

    /**
     * Get the application for this feedback.
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /**
     * Get the user who submitted this feedback.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the answer based on question type.
     */
    public function getAnswerAttribute(): mixed
    {
        if ($this->question_type === self::TYPE_RATING) {
            return $this->rating;
        }

        if ($this->question_type === self::TYPE_YES_NO) {
            return $this->yes_no_answer;
        }

        return null;
    }

    /**
     * Get formatted answer for display.
     */
    public function getFormattedAnswerAttribute(): ?string
    {
        if ($this->question_type === self::TYPE_RATING) {
            return $this->rating ? "{$this->rating}/5" : null;
        }

        if ($this->question_type === self::TYPE_YES_NO) {
            if ($this->yes_no_answer === null) {
                return null;
            }

            return $this->yes_no_answer ? 'Yes' : 'No';
        }

        return null;
    }

    /**
     * Scope: Filter by application.
     */
    public function scopeForApplication(Builder $query, int $applicationId): Builder
    {
        return $query->where('application_id', $applicationId);
    }

    /**
     * Scope: Filter by question type.
     */
    public function scopeByType(Builder $query, string $type): Builder
    {
        return $query->where('question_type', $type);
    }

    /**
     * Scope: Rating type feedbacks.
     */
    public function scopeRating(Builder $query): Builder
    {
        return $query->where('question_type', self::TYPE_RATING);
    }

    /**
     * Scope: Yes/No type feedbacks.
     */
    public function scopeYesNo(Builder $query): Builder
    {
        return $query->where('question_type', self::TYPE_YES_NO);
    }
}
