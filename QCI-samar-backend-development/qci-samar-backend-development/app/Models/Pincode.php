<?php

namespace App\Models;

use App\Services\Lgd\LgdDirectory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $pincode
 * @property string $district
 * @property string $state
 * @property int|null $state_lgd_code
 * @property int|null $district_lgd_code
 */
class Pincode extends Model
{
    use HasFactory;

    protected $table = 'pincodes';

    protected $fillable = [
        'pincode',
        'district',
        'state',
        'state_lgd_code',
        'district_lgd_code',
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
     * District name for display: LGD spelling as published, old all-caps names title-cased.
     */
    protected function district(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => LgdDirectory::displayName($value)
        );
    }
}
