<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class State extends Model
{
    use HasFactory;

    protected $fillable = [
        'country_id',
        'name',
        'code',
        'lgd_code',
    ];

    protected $casts = [
        'country_id' => 'integer',
        'lgd_code' => 'integer',
    ];

    /**
     * Get the state name in title case format.
     * Converts "JAMMU AND KASHMIR" to "Jammu and Kashmir"
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
     * Get the country that owns the state.
     */
    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the districts for the state.
     */
    public function districts(): HasMany
    {
        return $this->hasMany(District::class);
    }
}
