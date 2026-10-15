<?php

namespace App\Models;

use App\Services\Lgd\LgdDirectory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class District extends Model
{
    use HasFactory;

    protected $fillable = [
        'state_id',
        'name',
        'code',
        'lgd_code',
        'is_active',
    ];

    protected $casts = [
        'state_id' => 'integer',
        'lgd_code' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * District name for display: LGD spelling as published, old all-caps names title-cased.
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => LgdDirectory::displayName($value)
        );
    }

    /**
     * Get the state that owns the district.
     */
    public function state(): BelongsTo
    {
        return $this->belongsTo(State::class);
    }

    /**
     * Get the assessors assigned to this district.
     */
    public function assessors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_assessor_district')
            ->withPivot('assigned_by')
            ->withTimestamps();
    }
}
