<?php

namespace App\Models;

use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ThirdPartyCertification extends Model
{
    use HasFactory, TracksUserActions;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'certification_name',
        'created_by',
        'updated_by',
        'is_active',
    ];

    /**
     * Scope: Order by name.
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('certification_name');
    }
}
