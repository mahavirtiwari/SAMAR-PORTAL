<?php

namespace App\Models;

use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class FeedbackQuestion extends Model
{
    use HasFactory, SoftDeletes, TracksUserActions;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'question_text',
        'type',
        'display_order',
        'is_active',
        'created_by',
        'updated_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'display_order' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * Question type constants.
     */
    public const TYPE_RATING = 'rating';

    public const TYPE_YES_NO = 'yes_no';

    /**
     * Get all available question types.
     *
     * @return array<string>
     */
    public static function getTypes(): array
    {
        return [
            self::TYPE_RATING,
            self::TYPE_YES_NO,
        ];
    }

    /**
     * Get type labels for display.
     *
     * @return array<string, string>
     */
    public static function getTypeLabels(): array
    {
        return [
            self::TYPE_RATING => '5 Star Rating',
            self::TYPE_YES_NO => 'Yes/No',
        ];
    }

    /**
     * Get the feedbacks for this question.
     */
    public function feedbacks(): HasMany
    {
        return $this->hasMany(ApplicationFeedback::class, 'feedback_question_id');
    }

    /**
     * Scope: Active questions.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: Filter by type.
     */
    public function scopeByType(Builder $query, string $type): Builder
    {
        return $query->where('type', $type);
    }

    /**
     * Scope: Rating type questions.
     */
    public function scopeRating(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_RATING);
    }

    /**
     * Scope: Yes/No type questions.
     */
    public function scopeYesNo(Builder $query): Builder
    {
        return $query->where('type', self::TYPE_YES_NO);
    }

    /**
     * Scope: Order by display order.
     */
    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('display_order');
    }
}
