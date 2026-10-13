<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManufacturingBoughtOutPart extends Model
{
    protected $table = 'manufacturing_bought_out_parts';

    protected $fillable = [
        'part_name',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user who created this part.
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this part.
     */
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
