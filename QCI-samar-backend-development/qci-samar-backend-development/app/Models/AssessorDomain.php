<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class AssessorDomain extends Model
{
    use HasFactory;

    protected $table = 'assessor_domains';

    protected $fillable = [
        'domain_name',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
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

    /**
     * Get the users (assessors) assigned to this domain.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_assessor_domain')
            ->withPivot('assigned_by')
            ->withTimestamps();
    }
}
