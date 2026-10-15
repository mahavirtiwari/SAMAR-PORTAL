<?php

namespace App\Models;

use App\Traits\HasAuditLog;
use App\Traits\HasLgdLocation;
use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    use HasAuditLog, HasFactory, HasLgdLocation, TracksUserActions;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'alternate_email',
        'mobile_number',
        'landline_number',
        'pan',
        'registered_address',
        'registered_state',
        'registered_district',
        'registered_pincode',
        'owner_name',
        'owner_designation',
        'owner_email',
        'owner_mobile_number',
        'status',
        'is_verified',
        'verified_at',
        'verified_by',
        'is_profile_completed',
        'profile_completed_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_verified' => 'boolean',
        'verified_at' => 'datetime',
        'is_profile_completed' => 'boolean',
        'profile_completed_at' => 'datetime',
    ];

    /**
     * Get the users for the organization.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Get the units for the organization.
     */
    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }

    /**
     * Get the applications for the organization.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    /**
     * Get the assessments for the organization.
     */
    public function assessments(): HasMany
    {
        return $this->hasMany(Assessment::class);
    }

    /**
     * Get the payments for the organization.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Get the certificates for the organization.
     */
    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }

    /**
     * Check if organization profile is complete.
     */
    public function isProfileComplete(): bool
    {
        $requiredFields = [
            'name', 'email', 'mobile_number', 'pan',
            'registered_address', 'registered_state', 'registered_district',
            'registered_pincode', 'owner_name', 'owner_designation',
            'owner_email', 'owner_mobile_number',
        ];

        foreach ($requiredFields as $field) {
            if (empty($this->$field)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Mark organization profile as complete and activate.
     */
    public function markProfileAsComplete(): void
    {
        $this->update([
            'is_profile_completed' => true,
            'profile_completed_at' => now(),
            'status' => 'active',
        ]);
    }

    /**
     * Verify the organization.
     */
    public function verify(int $verifiedBy): void
    {
        $this->update([
            'is_verified' => true,
            'verified_at' => now(),
            'verified_by' => $verifiedBy,
            'status' => 'active',
        ]);
    }

    /**
     * Scope: Filter organizations by registered state.
     */
    public function scopeInStates(Builder $query, array $states): Builder
    {
        if (empty($states)) {
            return $query;
        }

        return $query->whereIn('registered_state', $states);
    }

    /**
     * Scope: Active organizations only.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope: Verified organizations only.
     */
    public function scopeVerified($query)
    {
        return $query->where('is_verified', true);
    }
}
