<?php

namespace App\Models;

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
    ];

    protected $casts = [
        'state_id' => 'integer',
    ];

    /**
     * Get the district name in title case format.
     * Converts names with proper handling of minor words.
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: function ($value) {
                // Convert to title case
                $titleCase = ucwords(strtolower($value));

                // Keep minor words lowercase (and, or, of, the, etc.)
                $minorWords = ['And', 'Or', 'Of', 'The', 'A', 'An', 'In', 'On', 'At', 'To', 'For', 'With'];
                foreach ($minorWords as $word) {
                    $titleCase = str_replace(' '.$word.' ', ' '.strtolower($word).' ', $titleCase);
                }

                return $titleCase;
            }
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
