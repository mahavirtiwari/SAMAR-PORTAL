<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManufacturingKeyProcess extends Model
{
    protected $table = 'manufacturing_key_processes';

    protected $fillable = [
        'process_name',
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
     * Get the user who created this process.
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this process.
     */
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
