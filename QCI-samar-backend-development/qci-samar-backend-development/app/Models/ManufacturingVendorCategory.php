<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManufacturingVendorCategory extends Model
{
    protected $table = 'manufacturing_vendor_categories';

    protected $fillable = [
        'category_name',
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
