<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManufacturingRawMaterial extends Model
{
    protected $table = 'manufacturing_raw_materials';

    protected $fillable = [
        'material_name',
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
     * Get the user who created this material.
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this material.
     */
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
