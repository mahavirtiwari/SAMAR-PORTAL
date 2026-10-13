<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceOutsourcedComponent extends Model
{
    protected $table = 'service_outsourced_components';

    protected $fillable = [
        'component_name',
        'service_provider_type',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
