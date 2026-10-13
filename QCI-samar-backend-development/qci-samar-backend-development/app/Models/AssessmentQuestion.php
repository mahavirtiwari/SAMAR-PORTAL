<?php

namespace App\Models;

use App\Traits\HasAuditLog;
use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssessmentQuestion extends Model
{
    use HasAuditLog, HasFactory, SoftDeletes, TracksUserActions;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'assessment_questions';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'code',
        'parameter_id',
        'question_text',
        'category',
        'weightage',
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
        'weightage' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * Get the parameter that owns the question.
     */
    public function parameter(): BelongsTo
    {
        return $this->belongsTo(AssessmentParameter::class, 'parameter_id');
    }

    /**
     * Build the next codes for a parameter, e.g. MFG-274-Q01. The code is what the export
     * and Bulk Update files carry as "Question ID", so an edited sheet can be matched back
     * to the exact question rather than to its text.
     *
     * Codes are allocated in a batch because questions are created in sets; the sequence
     * continues past soft-deleted rows so a number is never handed out twice.
     *
     * @return array<int, string>
     */
    public static function generateCodes(AssessmentParameter $parameter, int $count): array
    {
        $maxSequence = 0;

        $existing = static::withTrashed()
            ->where('parameter_id', $parameter->id)
            ->whereNotNull('code')
            ->pluck('code');

        foreach ($existing as $code) {
            if (preg_match('/-Q(\d+)$/', (string) $code, $matches)) {
                $maxSequence = max($maxSequence, (int) $matches[1]);
            }
        }

        $codes = [];
        for ($i = 1; $i <= $count; $i++) {
            $codes[] = $parameter->code.'-Q'.str_pad((string) ($maxSequence + $i), 2, '0', STR_PAD_LEFT);
        }

        return $codes;
    }

    /**
     * Get the options for this question.
     */
    public function options(): HasMany
    {
        return $this->hasMany(AssessmentQuestionOption::class, 'question_id')->orderBy('score');
    }

    /**
     * Scope: Active questions.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: By category.
     */
    public function scopeByCategory(Builder $query, string $category): Builder
    {
        return $query->where('category', $category);
    }

    /**
     * Scope: Planning questions.
     */
    public function scopePlanning(Builder $query): Builder
    {
        return $query->where('category', 'planning');
    }

    /**
     * Scope: Deployment questions.
     */
    public function scopeDeployment(Builder $query): Builder
    {
        return $query->where('category', 'deployment');
    }

    /**
     * Scope: Monitoring questions.
     */
    public function scopeMonitoring(Builder $query): Builder
    {
        return $query->where('category', 'monitoring');
    }
}
