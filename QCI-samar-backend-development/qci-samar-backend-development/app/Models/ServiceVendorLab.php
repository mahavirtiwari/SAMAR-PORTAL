<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceVendorLab extends Model
{
    protected $table = 'service_vendor_labs';

    protected $fillable = [
        'lab_name',
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
