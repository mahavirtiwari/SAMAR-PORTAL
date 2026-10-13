<?php

namespace App\Models;

use App\Traits\HasAuditLog;
use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Role extends Model
{
    use HasAuditLog, HasFactory, SoftDeletes, TracksUserActions;

    /**
     * Role slugs constants.
     */
    public const ENTERPRISE_ADMIN = 'enterprise_admin';

    public const UNIT_ADMIN = 'unit_admin';

    public const DRDO_ADMIN = 'drdo_admin';

    public const OPERATIONS_MANAGER = 'operations_manager';

    public const OPERATIONS_ADMIN = 'operations_admin';

    public const SYSTEM_ADMIN = 'system_admin';

    public const ASSESSOR = 'assessor';

    public const DRDO_LAB = 'drdo_lab';

    public const ERP_INTEGRATION = 'erp_integration';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'slug',
        'description',
        'is_system_role',
        'requires_organization',
        'requires_unit',
        'enforce_single_session',
        'level',
        'default_permissions',
        'is_active',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_system_role' => 'boolean',
        'requires_organization' => 'boolean',
        'requires_unit' => 'boolean',
        'enforce_single_session' => 'boolean',
        'is_active' => 'boolean',
        'default_permissions' => 'array',
    ];

    /**
     * Get the users with this role.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_role')
            ->withPivot(['organization_id', 'unit_id', 'is_active', 'assigned_at', 'expires_at'])
            ->withTimestamps();
    }

    /**
     * Scope: Active roles only.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: System roles.
     */
    public function scopeSystem($query)
    {
        return $query->where('is_system_role', true);
    }

    /**
     * Scope: Non-system roles.
     */
    public function scopeCustom($query)
    {
        return $query->where('is_system_role', false);
    }
}
