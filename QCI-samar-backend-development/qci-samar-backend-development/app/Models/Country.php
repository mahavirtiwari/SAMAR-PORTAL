<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Country extends Model
{
    use HasFactory;

    protected $table = 'countries';

    protected $fillable = [
        'name',
        'code',
        'phone_code',
    ];

    public $timestamps = true;

    /**
     * Get the states for the country.
     */
    public function states(): HasMany
    {
        return $this->hasMany(State::class);
    }
}
