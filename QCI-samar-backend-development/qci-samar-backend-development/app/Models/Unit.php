<?php

namespace App\Models;

use App\Traits\HasAuditLog;
use App\Traits\HasOrganizationScope;
use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Unit extends Model
{
    use HasAuditLog, HasFactory, HasOrganizationScope, SoftDeletes, TracksUserActions;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'organization_id',
        'name',
        'email',
        'alternate_email',
        'mobile_number',
        'landline_number',
        'contact_person_name',
        'contact_person_designation',
        'contact_person_email',
        'contact_person_mobile_number',
        'address',
        'state',
        'district',
        'pincode',
        'unit_type',
        'commencement_date',
        'status',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'commencement_date' => 'date',
    ];

    /**
     * Get the organization that owns the unit.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the applications for the unit.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    /**
     * Get the assessments for the unit.
     */
    public function assessments(): HasMany
    {
        return $this->hasMany(Assessment::class);
    }

    /**
     * Get the certificates for the unit.
     */
    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }

    /**
     * Scope: Filter by unit type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('unit_type', $type);
    }

    /**
     * Scope: Filter by status.
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope: Filter by unit admin (user assigned as UNIT_ADMIN for this unit).
     */
    public function scopeByUnitAdmin($query, int $userId)
    {
        return $query->whereExists(function ($subQuery) use ($userId) {
            $subQuery->select(\DB::raw(1))
                ->from('user_role')
                ->join('roles', 'user_role.role_id', '=', 'roles.id')
                ->where('user_role.user_id', $userId)
                ->where('roles.slug', Role::UNIT_ADMIN)
                ->where('user_role.is_active', true)
                ->whereColumn('user_role.unit_id', 'units.id');
        });
    }
}
