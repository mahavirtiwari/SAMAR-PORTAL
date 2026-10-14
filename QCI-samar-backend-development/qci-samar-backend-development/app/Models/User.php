<?php

namespace App\Models;

use App\Services\StateMachine\UserStateMachine;
use App\Traits\HasAuditLog;
use App\Traits\HasStateMachine;
use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasAuditLog, HasFactory, HasStateMachine, Notifiable, TracksUserActions;

    /**
     * Boot the model.
     */
    protected static function boot(): void
    {
        parent::boot();

        static::created(function (User $user) {
            if (empty($user->samar_id)) {
                $user->samar_id = sprintf(
                    'SAMAR-%s-%d',
                    now()->format('dmy'),
                    $user->id
                );
                $user->saveQuietly();
            }
        });
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'organization_id',
        'samar_id',
        'first_name',
        'last_name',
        'email',
        'mobile_number',
        'designation',
        'external_organization',
        'district',
        'state',
        'address',
        'city',
        'pincode',
        'password',
        'password_changed_at',
        'is_two_factor_enabled',
        'email_verified_at',
        'email_verification_token',
        'failed_login_attempts',
        'locked_until',
        'last_login_at',
        'last_login_ip',
        'status',
        'is_profile_completed',
        'profile_completed_at',
        'assigned_states',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'otp_code',
        'email_verification_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'password_changed_at' => 'datetime',
        'is_two_factor_enabled' => 'boolean',
        'email_verified_at' => 'datetime',
        'otp_expires_at' => 'datetime',
        'otp_locked_until' => 'datetime',
        'locked_until' => 'datetime',
        'last_login_at' => 'datetime',
        'is_profile_completed' => 'boolean',
        'profile_completed_at' => 'datetime',
        'session_started_at' => 'datetime',
        'password' => 'hashed',
        'assigned_states' => 'array',
    ];

    /**
     * Get the organization that owns the user.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the roles for the user.
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_role')
            ->withPivot(['organization_id', 'unit_id', 'is_active', 'assigned_at', 'expires_at'])
            ->withTimestamps();
    }

    /**
     * Get active roles only.
     */
    public function activeRoles(): BelongsToMany
    {
        return $this->roles()->wherePivot('is_active', true);
    }

    /**
     * Get the first unit assigned to the user (for unit_admin role).
     * NOTE: Unit admins may have multiple units in user_role pivot rows.
     * Use assignedUnitIds() when authorization must cover all assignments.
     */
    public function assignedUnit(): ?Unit
    {
        $unitAdminRole = $this->activeRoles()
            ->where('slug', Role::UNIT_ADMIN)
            ->first();

        if ($unitAdminRole && $unitAdminRole->pivot->unit_id) {
            return Unit::find($unitAdminRole->pivot->unit_id);
        }

        return null;
    }

    /**
     * Get all unit IDs assigned to the user via active unit_admin role pivots.
     */
    public function assignedUnitIds(): array
    {
        return $this->roles()
            ->where('slug', Role::UNIT_ADMIN)
            ->wherePivot('is_active', true)
            ->get()
            ->pluck('pivot.unit_id')
            ->filter()
            ->values()
            ->toArray();
    }

    /**
     * Get the sessions for the user.
     */
    public function sessions(): HasMany
    {
        return $this->hasMany(Session::class);
    }

    /**
     * Get the active session.
     */
    public function activeSession(): HasMany
    {
        return $this->sessions()->where('is_active', true);
    }

    /**
     * Get the applications created by the user.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class, 'created_by');
    }

    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     *
     * @return mixed
     */
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     *
     * @return array
     */
    public function getJWTCustomClaims()
    {
        return [
            'email' => $this->email,
            'organization_id' => $this->organization_id,
            'roles' => $this->activeRoles->pluck('slug')->toArray(),
        ];
    }

    /**
     * Get the user's full name.
     */
    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    /**
     * Check if user has a specific role.
     */
    public function hasRole(string $roleSlug): bool
    {
        return $this->activeRoles()->where('slug', $roleSlug)->exists();
    }

    /**
     * Check if user has any of the given roles.
     */
    public function hasAnyRole(array $roleSlugs): bool
    {
        return $this->activeRoles()->whereIn('slug', $roleSlugs)->exists();
    }

    /**
     * Check if user has all of the given roles.
     */
    public function hasAllRoles(array $roleSlugs): bool
    {
        return $this->activeRoles()->whereIn('slug', $roleSlugs)->count() === count($roleSlugs);
    }

    /**
     * Assign a role to the user with authorization checks.
     *
     * @param  Role|string  $role
     * @param  User|null  $assignedBy  The user performing the assignment (for authorization)
     *
     * @throws \InvalidArgumentException if authorization fails
     */
    public function assignRole($role, ?int $organizationId = null, ?int $unitId = null, ?User $assignedBy = null): void
    {
        $roleModel = $role instanceof Role ? $role : Role::where('slug', $role)->firstOrFail();
        $targetOrganizationId = $organizationId ?? $this->organization_id;

        // Authorization checks if assignedBy user is provided
        if ($assignedBy !== null) {
            $this->validateRoleAssignment($roleModel, $targetOrganizationId, $unitId, $assignedBy);
        }

        // Validate that unit belongs to organization if both are specified
        if ($unitId !== null && $targetOrganizationId !== null) {
            $unit = Unit::find($unitId);
            if (! $unit || $unit->organization_id !== $targetOrganizationId) {
                throw new \InvalidArgumentException(
                    'Unit does not belong to the specified organization'
                );
            }
        }

        // Idempotency must include scope: a user can hold the same role for multiple
        // (organization, unit) pairs.
        $alreadyAssigned = $this->roles()
            ->wherePivot('role_id', $roleModel->id)
            ->wherePivot('organization_id', $targetOrganizationId)
            ->wherePivot('unit_id', $unitId)
            ->exists();

        if (! $alreadyAssigned) {
            $this->roles()->attach($roleModel->id, [
                'organization_id' => $targetOrganizationId,
                'unit_id' => $unitId,
                'is_active' => true,
                'assigned_at' => now(),
            ]);
        }
    }

    /**
     * Validate that the assigning user has permission to assign the role.
     *
     * @throws \InvalidArgumentException
     */
    protected function validateRoleAssignment(Role $role, ?int $organizationId, ?int $unitId, User $assignedBy): void
    {
        // System admins can assign any role
        if ($assignedBy->hasRole(Role::SYSTEM_ADMIN)) {
            return;
        }

        // Check if the assigning user belongs to the same organization
        if ($organizationId !== null && $assignedBy->organization_id !== $organizationId) {
            throw new \InvalidArgumentException(
                'You cannot assign roles to users in other organizations'
            );
        }

        // Define which roles can assign which other roles
        $roleHierarchy = [
            Role::SYSTEM_ADMIN => [
                Role::SYSTEM_ADMIN, Role::DRDO_ADMIN, Role::OPERATIONS_MANAGER,
                Role::OPERATIONS_ADMIN, Role::DRDO_LAB, Role::ASSESSOR, Role::UNIT_ADMIN,
                Role::ENTERPRISE_ADMIN,
            ],
            Role::DRDO_ADMIN => [
                Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN, Role::DRDO_LAB,
                Role::ASSESSOR,
            ],
            Role::OPERATIONS_MANAGER => [
                Role::OPERATIONS_ADMIN, Role::ASSESSOR,
            ],
            Role::ENTERPRISE_ADMIN => [
                Role::UNIT_ADMIN,
            ],
            Role::UNIT_ADMIN => [],
            Role::ASSESSOR => [],
            Role::OPERATIONS_ADMIN => [],
            Role::DRDO_LAB => [],
        ];

        // Get the highest role of the assigning user
        $assignerRoles = $assignedBy->roles()->pluck('slug')->toArray();
        $canAssign = false;

        foreach ($assignerRoles as $assignerRole) {
            if (isset($roleHierarchy[$assignerRole])) {
                if (in_array($role->slug, $roleHierarchy[$assignerRole])) {
                    $canAssign = true;
                    break;
                }
            }
        }

        if (! $canAssign) {
            throw new \InvalidArgumentException(
                "You do not have permission to assign the role '{$role->name}'"
            );
        }

        // If assigning unit_admin, ensure the assigner has access to that unit
        if ($role->slug === Role::UNIT_ADMIN && $unitId !== null) {
            if (! $assignedBy->hasRole(Role::SYSTEM_ADMIN) && ! $assignedBy->hasRole(Role::ENTERPRISE_ADMIN)) {
                throw new \InvalidArgumentException(
                    'Only System Admins or Enterprise Admins can assign Unit Admin roles'
                );
            }
        }
    }

    /**
     * Remove a role from the user.
     *
     * @param  Role|string  $role
     */
    public function removeRole($role): void
    {
        $roleId = $role instanceof Role ? $role->id : Role::where('slug', $role)->firstOrFail()->id;
        $this->roles()->detach($roleId);
    }

    /**
     * Generate and set OTP for the user.
     */
    public function generateOtp(int $length = 6, ?int $expiryMinutes = null): string
    {
        $expiryMinutes ??= (int) config('auth.otp.expiry_minutes');

        $otp = str_pad((string) random_int(0, (10 ** $length) - 1), $length, '0', STR_PAD_LEFT);

        // otp_attempts is deliberately not reset here: requesting a fresh code
        // must not hand out a fresh set of guesses, or the 5-attempt lock could
        // be dodged by resending after every 4 wrong tries.
        $this->forceFill([
            'otp_code' => Hash::make($otp),
            'otp_expires_at' => now()->addMinutes($expiryMinutes),
        ])->save();

        return $otp;
    }

    /**
     * Verify OTP.
     */
    public function verifyOtp(string $otp): bool
    {
        if ($this->otp_locked_until && now()->lt($this->otp_locked_until)) {
            return false;
        }

        // A lock that has run out starts a new round of attempts.
        if ($this->otp_locked_until) {
            $this->forceFill(['otp_attempts' => 0, 'otp_locked_until' => null])->save();
        }

        if (! $this->otp_code || ! $this->otp_expires_at || now()->gt($this->otp_expires_at)) {
            return false;
        }

        if (! Hash::check($otp, $this->otp_code)) {
            $this->increment('otp_attempts');

            if ($this->otp_attempts >= 5) {
                $this->forceFill(['otp_locked_until' => now()->addMinutes(30)])->save();
            }

            return false;
        }

        $this->forceFill([
            'otp_code' => null,
            'otp_expires_at' => null,
            'otp_attempts' => 0,
            'otp_locked_until' => null,
        ])->save();

        return true;
    }

    /**
     * Check if account is locked.
     */
    public function isLocked(): bool
    {
        if (! config('auth.lockout.enabled', true)) {
            return false;
        }

        return $this->locked_until && now()->lt($this->locked_until);
    }

    /**
     * Record failed login attempt.
     */
    public function recordFailedLogin(): void
    {
        // Keep counting attempts even when lockout is disabled (useful audit
        // signal during security testing); only the arming is gated.
        $this->increment('failed_login_attempts');

        if (! config('auth.lockout.enabled', true)) {
            return;
        }

        if ($this->failed_login_attempts >= (int) config('auth.lockout.max_attempts')) {
            $this->update(['locked_until' => now()->addMinutes((int) config('auth.lockout.duration_minutes'))]);
        }
    }

    /**
     * Reset failed login attempts.
     */
    public function resetFailedLogins(): void
    {
        $this->update([
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ]);
    }

    /**
     * Scope: Active users only.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope: Users by organization.
     */
    public function scopeForOrganization($query, int $organizationId)
    {
        return $query->where('organization_id', $organizationId);
    }

    /**
     * Scope: Users by role.
     */
    public function scopeByRole($query, string $roleSlug)
    {
        return $query->whereHas('activeRoles', function ($q) use ($roleSlug) {
            $q->where('slug', $roleSlug);
        });
    }

    /**
     * Scope: Search users by name (either part or the full "First Last" form), email or mobile number.
     */
    public function scopeSearchUsers($query, ?string $search)
    {
        $search = trim((string) $search);
        if ($search === '') {
            return $query;
        }

        return $query->where(function ($q) use ($search) {
            $q->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhereRaw("CONCAT_WS(' ', first_name, last_name) LIKE ?", ["%{$search}%"])
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('mobile_number', 'like', "%{$search}%");
        });
    }

    /**
     * Get the assessor domains assigned to the user.
     */
    public function assessorDomains(): BelongsToMany
    {
        return $this->belongsToMany(AssessorDomain::class, 'user_assessor_domain')
            ->withPivot('assigned_by')
            ->withTimestamps();
    }

    /**
     * Get the districts assigned to the assessor.
     */
    public function assessorDistricts(): BelongsToMany
    {
        return $this->belongsToMany(District::class, 'user_assessor_district')
            ->withPivot('assigned_by')
            ->withTimestamps();
    }

    /**
     * Check if the user has logged in at least once.
     */
    public function hasLoggedIn(): bool
    {
        return ! is_null($this->last_login_at);
    }

    /**
     * Check if user's organization is active (for organization-dependent roles).
     * Returns true for users without organization or with system-level roles.
     */
    public function hasActiveOrganization(): bool
    {
        // If user has no organization, they're a system user - allow access
        if (! $this->organization_id || ! $this->organization) {
            return true;
        }

        // Check if user has any organization-dependent role
        $hasOrgDependentRole = $this->activeRoles()
            ->where('requires_organization', true)
            ->exists();

        // If user doesn't have organization-dependent roles, allow access
        if (! $hasOrgDependentRole) {
            return true;
        }

        // User has organization-dependent role - check if organization is active or pending details
        // Allow 'pending_details' so users can log in to complete their organization profile
        return in_array($this->organization->status, ['active', 'pending_details']);
    }

    /**
     * Get organization inactive reason message.
     */
    public function getOrganizationInactiveMessage(): string
    {
        if (! $this->organization) {
            return 'Organization not found.';
        }

        $status = $this->organization->status;

        return match ($status) {
            'suspended' => 'Your organization has been suspended. Please contact support for assistance.',
            'inactive' => 'Your organization is currently inactive. Please contact support for assistance.',
            'pending_details' => 'Your organization profile is incomplete. Please complete your organization profile first.',
            default => 'Your organization is not active. Please contact support for assistance.',
        };
    }

    /**
     * Get the assigned states as a guaranteed array.
     */
    public function getAssignedStatesArray(): array
    {
        return $this->assigned_states ?? [];
    }

    /**
     * Check if this user has state-based restrictions configured.
     */
    public function hasStateRestrictions(): bool
    {
        return ! empty($this->assigned_states);
    }

    /**
     * Get the state machine class for the User model.
     */
    protected function getStateMachineClass(): string
    {
        return UserStateMachine::class;
    }
}
