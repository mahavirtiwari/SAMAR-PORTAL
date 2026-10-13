<?php

namespace App\Models;

use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Discipline extends Model
{
    use HasFactory, TracksUserActions;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'disciplines';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'sector',
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
        'is_active' => 'boolean',
    ];

    /**
     * Get the assessment parameters for this discipline.
     */
    public function parameters(): HasMany
    {
        return $this->hasMany(AssessmentParameter::class, 'discipline_id');
    }

    /**
     * Get all assessment questions for this discipline through parameters.
     */
    public function questions(): HasManyThrough
    {
        return $this->hasManyThrough(
            AssessmentQuestion::class,
            AssessmentParameter::class,
            'discipline_id',
            'parameter_id',
            'id',
            'id'
        );
    }

    /**
     * Scope: Search by name.
     */
    public function scopeSearch(Builder $query, string $search): Builder
    {
        return $query->where('name', 'like', "%{$search}%");
    }
}
