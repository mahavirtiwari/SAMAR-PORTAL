<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Pincode extends Model
{
    use HasFactory;

    protected $table = 'pincodes';

    protected $fillable = [
        'pincode',
        'district',
        'state',
    ];

    public $timestamps = true;

    /**
     * Get the state name in title case format.
     * Converts "JAMMU AND KASHMIR" to "Jammu and Kashmir"
     */
    protected function state(): Attribute
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
     * Get the district name in title case format.
     * Converts names with proper handling of minor words.
     */
    protected function district(): Attribute
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
}
