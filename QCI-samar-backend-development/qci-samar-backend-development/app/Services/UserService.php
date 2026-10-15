<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\Role;
use App\Models\Session;
use App\Models\Unit;
use App\Models\User;
use App\Services\Auth\AuthService;
use App\Services\Notification\NotificationService;
use App\Services\StateMachine\UserStateMachine;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class UserService
{
    public function __construct(
        private NotificationService $notificationService,
        private AuthService $authService
    ) {}

    /**
     * Get paginated users with filters.
     */
    public function getPaginatedUsers(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = User::with(['organization', 'activeRoles', 'assessorDomains']);

        // Apply organization filter (for scoping)
        if (isset($filters['organization_id'])) {
            $query->forOrganization($filters['organization_id']);
        }

        // Apply search filter
        if (isset($filters['search']) && ! empty($filters['search'])) {
            $query->searchUsers($filters['search']);
        }

        // Apply SAMAR ID filter (partial match)
        if (isset($filters['samar_id']) && ! empty($filters['samar_id'])) {
            $query->where('samar_id', 'like', "%{$filters['samar_id']}%");
        }

        // Apply assessor-domain filter (user assigned to the selected domain via the pivot)
        if (isset($filters['domain_id']) && ! empty($filters['domain_id'])) {
            $query->whereHas('assessorDomains', function (Builder $q) use ($filters) {
                $q->where('assessor_domains.id', $filters['domain_id']);
            });
        }

        // Apply role filter
        if (isset($filters['role']) && ! empty($filters['role'])) {
            $query->whereHas('activeRoles', function (Builder $q) use ($filters) {
                $q->where('slug', $filters['role']);
            });
        }

        // Apply status filter
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // Apply assigned_state filter (for filtering assessors by their assigned state)
        if (isset($filters['assigned_state']) && ! empty($filters['assigned_state'])) {
            $query->whereJsonContains('assigned_states', $filters['assigned_state']);
        }

        // Apply Operations Manager state-based filtering
        // Show only users (assessors) whose assigned_states overlap with OM's assigned states
        if (isset($filters['om_assigned_states']) && ! empty($filters['om_assigned_states'])) {
            $omStates = $filters['om_assigned_states'];
            $query->where(function (Builder $q) use ($omStates) {
                foreach ($omStates as $state) {
                    $q->orWhereJsonContains('assigned_states', $state);
                }
            });
        }

        // Default ordering
        $query->orderBy('created_at', 'desc');

        return $query->paginate($perPage);
    }

    /**
     * Create a new user.
     */
    public function createUser(array $data, User $createdBy): User
    {
        return DB::transaction(function () use ($data, $createdBy) {
            // Caller-controlled flag: when true, callers (e.g. contact-person-authorized flow)
            // send their own context-specific invitation email after createUser returns.
            $skipInvitationEmail = (bool) ($data['_skip_invitation_email'] ?? false);
            unset($data['_skip_invitation_email']);

            // Generate password if not provided
            if (! isset($data['password'])) {
                $data['password'] = $this->generateTemporaryPassword();
            }

            // Store the plain password before hashing (for email)
            $temporaryPassword = $data['password'];

            // Hash password if it's not already hashed
            if (! isset($data['password']) || ! Hash::isHashed($data['password'])) {
                $data['password'] = Hash::make($data['password']);
            }

            // Set default values
            $data['status'] = $data['status'] ?? 'invited'; // Default to 'invited' for new users
            $data['is_profile_completed'] = false;

            // Extract assessor-specific data before creating user (not user table columns)
            $assessorDomains = $data['assessor_domains'] ?? null;
            unset($data['assessor_domains'], $data['assessor_districts']);

            // Create the user
            $user = User::create($data);

            // Assign roles if provided
            if (isset($data['roles']) && is_array($data['roles'])) {
                $this->assignRolesToUser($user, $data['roles'], $createdBy);
            }

            // Sync assessor domains if provided
            if ($assessorDomains && is_array($assessorDomains)) {
                $domainSyncData = [];
                foreach ($assessorDomains as $domainId) {
                    $domainSyncData[$domainId] = ['assigned_by' => $createdBy->id];
                }
                $user->assessorDomains()->sync($domainSyncData);
            }

            // Load relationships
            $user->load(['organization', 'activeRoles', 'assessorDomains']);

            // Send invitation email
            if (! $skipInvitationEmail) {
                try {
                    $this->sendUserInvitationEmail($user, $temporaryPassword, $createdBy);
                } catch (\Exception $e) {
                    Log::error('Failed to send user invitation email', [
                        'user_id' => $user->id,
                        'user_email' => $user->email,
                        'error' => $e->getMessage(),
                    ]);
                    // Don't fail the user creation if email fails
                }
            }

            return $user;
        });
    }

    /**
     * Update an existing user.
     */
    public function updateUser(User $user, array $data, User $updatedBy): User
    {
        return DB::transaction(function () use ($user, $data, $updatedBy) {
            // Handle password update separately
            if (isset($data['password'])) {
                $data['password'] = Hash::make($data['password']);
                $data['password_changed_at'] = now();
            }

            // Extract assessor-specific data before updating user (not user table columns)
            $assessorDomains = $data['assessor_domains'] ?? null;
            unset($data['assessor_domains'], $data['assessor_districts']);

            // Update user fields
            $user->update($data);

            // Sync assessor domains if provided
            if ($assessorDomains !== null && is_array($assessorDomains)) {
                $domainSyncData = [];
                foreach ($assessorDomains as $domainId) {
                    $domainSyncData[$domainId] = ['assigned_by' => $updatedBy->id];
                }
                $user->assessorDomains()->sync($domainSyncData);
            }

            return $user->load(['organization', 'activeRoles', 'assessorDomains']);
        });
    }

    /**
     * Activate a user account (reactivate from inactive/suspended).
     */
    public function activateUser(User $user, ?User $performedBy = null, ?string $reason = null): User
    {
        $user->transitionTo(UserStateMachine::TRANSITION_REACTIVATE, $this->reasonData($reason), $performedBy);

        return $user->load(['organization', 'activeRoles']);
    }

    /**
     * Deactivate a user account.
     */
    public function deactivateUser(User $user, ?User $performedBy = null, ?string $reason = null): User
    {
        $user->transitionTo(UserStateMachine::TRANSITION_DEACTIVATE, $this->reasonData($reason), $performedBy);

        return $user->load(['organization', 'activeRoles']);
    }

    /**
     * Transition data carrying the reason; the state machine stores it as the
     * remarks of the account status history row.
     *
     * @return array{remarks?: string}
     */
    private function reasonData(?string $reason): array
    {
        $reason = $reason !== null ? trim($reason) : '';

        return $reason === '' ? [] : ['remarks' => $reason];
    }

    /**
     * Issue a new temporary password and email it with the user's role invitation
     * (the same email sent when the account was created). Passwords are stored
     * hashed, so the old one cannot be resent; it stops working, and every session
     * of the user is signed out.
     *
     * @throws BusinessException when the account is not active or invited
     */
    public function resendCredentials(User $user, User $performedBy): User
    {
        if (! in_array($user->status, ['active', 'invited'], true)) {
            throw new BusinessException('Credentials can only be sent to active or invited accounts. Activate this account first.');
        }

        $temporaryPassword = $this->generateTemporaryPassword();

        DB::transaction(function () use ($user, $temporaryPassword) {
            $user->forceFill(['password' => Hash::make($temporaryPassword)])->save();
            $this->authService->terminateUserSessions($user, Session::TERMINATION_PASSWORD_RESET);
        });

        $user->load('activeRoles');
        $this->sendUserInvitationEmail($user, $temporaryPassword, $performedBy);

        $user->logAudit('credentials_resent', description: 'A new temporary password was emailed to the user.', actor: $performedBy);
        Log::info('User credentials resent', ['user_id' => $user->id, 'by' => $performedBy->id]);

        return $user;
    }

    /**
     * Suspend a user account.
     */
    public function suspendUser(User $user, ?User $performedBy = null): User
    {
        $user->transitionTo(UserStateMachine::TRANSITION_SUSPEND, [], $performedBy);

        return $user->load(['organization', 'activeRoles']);
    }

    /**
     * Assign roles to a user.
     */
    public function assignRolesToUser(User $user, array $roleData, User $assignedBy): void
    {
        // Validate role assignment permissions first
        $this->validateRoleAssignmentPermissions($assignedBy, $roleData, $user);

        foreach ($roleData as $roleInfo) {
            $roleSlug = is_array($roleInfo) ? $roleInfo['slug'] : $roleInfo;
            $organizationId = is_array($roleInfo) ? ($roleInfo['organization_id'] ?? $user->organization_id) : $user->organization_id;
            $unitId = is_array($roleInfo) ? ($roleInfo['unit_id'] ?? null) : null;

            $role = Role::where('slug', $roleSlug)->firstOrFail();

            // Validate role requirements
            $this->validateRoleAssignment($role, $user, $organizationId, $unitId);

            // Idempotency must include scope: a user can hold the same role for multiple
            // (organization, unit) pairs (e.g. unit_admin of several units).
            $alreadyAssigned = $user->roles()
                ->wherePivot('role_id', $role->id)
                ->wherePivot('organization_id', $organizationId)
                ->wherePivot('unit_id', $unitId)
                ->exists();

            if (! $alreadyAssigned) {
                $user->roles()->attach($role->id, [
                    'organization_id' => $organizationId,
                    'unit_id' => $unitId,
                    'is_active' => true,
                    'assigned_at' => now(),
                ]);
                $user->forgetRoleCache();

                // Pivot attach() does not fire the User model's updated event, so
                // HasAuditLog never sees role grants — record them explicitly.
                $user->logAudit('role_assigned', description: "Role '{$role->name}' assigned.", metadata: [
                    'role_slug' => $role->slug,
                    'role_name' => $role->name,
                    'organization_id' => $organizationId,
                    'unit_id' => $unitId,
                    'assigned_by' => $assignedBy->id,
                ], actor: $assignedBy);
            }
        }
    }

    /**
     * Validate that the assigned-by user has permission to assign the requested roles.
     *
     * @param  User  $assignedBy  The user performing the role assignment
     * @param  array  $roleData  Array of roles to be assigned (each with 'slug' key)
     * @param  User  $targetUser  The user receiving the roles
     *
     * @throws \Exception
     */
    protected function validateRoleAssignmentPermissions(User $assignedBy, array $roleData, User $targetUser): void
    {
        foreach ($roleData as $roleInfo) {
            $roleSlug = is_array($roleInfo) ? $roleInfo['slug'] : $roleInfo;

            // Get the role being assigned
            $role = Role::where('slug', $roleSlug)->first();
            if (! $role) {
                throw new \Exception("Role '{$roleSlug}' does not exist.");
            }

            // A Unit Admin can never assign roles — including another Unit Admin.
            // This is enforced at the route and policy layers too; kept here as an
            // explicit backstop so loosening either layer cannot silently allow it.
            if ($assignedBy->hasRole(Role::UNIT_ADMIN)) {
                throw new \Exception('Unit Admins cannot create or assign user accounts.');
            }

            // System Admin restrictions
            if ($assignedBy->hasRole(Role::SYSTEM_ADMIN)) {
                // Cannot assign Enterprise Admin or Unit Admin
                if (in_array($roleSlug, [Role::ENTERPRISE_ADMIN, Role::UNIT_ADMIN])) {
                    throw new \Exception(
                        "System Admins cannot assign the '{$role->name}' role. ".
                        ($roleSlug === Role::ENTERPRISE_ADMIN
                            ? 'Enterprise Admins must self-register via /api/v1/auth/register.'
                            : 'Only Enterprise Admins can assign Unit Admin roles.')
                    );
                }
            }

            // Enterprise Admin restrictions
            if ($assignedBy->hasRole(Role::ENTERPRISE_ADMIN)) {
                // Can ONLY assign Unit Admin role
                if ($roleSlug !== Role::UNIT_ADMIN) {
                    throw new \Exception(
                        "Enterprise Admins can only assign the 'Unit Admin' role. ".
                        "You cannot assign the '{$role->name}' role."
                    );
                }

                // Validate organization scoping
                $orgId = is_array($roleInfo) ? ($roleInfo['organization_id'] ?? $targetUser->organization_id) : $targetUser->organization_id;
                if ($orgId !== $assignedBy->organization_id) {
                    throw new \Exception('You can only assign roles within your organization.');
                }
            }
        }
    }

    /**
     * Validate role assignment.
     *
     * @throws \Exception
     */
    protected function validateRoleAssignment(Role $role, User $user, ?int $organizationId, ?int $unitId): void
    {
        // Check if role is active
        if (! $role->is_active) {
            throw new \Exception("Role '{$role->name}' is not active.");
        }

        // Check if role requires organization
        if ($role->requires_organization && ! $organizationId) {
            throw new \Exception("Role '{$role->name}' requires an organization.");
        }

        // Check if role requires unit
        if ($role->requires_unit && ! $unitId) {
            throw new \Exception("Role '{$role->name}' requires a unit.");
        }

        // The unit must belong to the organization the role is scoped to. Without this,
        // a unit_id from a different organization passes `exists:units,id` validation and
        // mis-maps the user across org boundaries.
        if ($unitId && $organizationId) {
            $unitBelongsToOrg = Unit::where('id', $unitId)
                ->where('organization_id', $organizationId)
                ->exists();

            if (! $unitBelongsToOrg) {
                throw new \Exception('The selected unit does not belong to the specified organization.');
            }
        }

        // Identity model: a user is not bound 1:1 to an organization. The pivot
        // (user_role.organization_id / unit_id) carries scope per assignment, so a user
        // may legitimately hold roles across multiple organizations or units.
    }

    /**
     * Create a Unit Admin user from contact person data.
     */
    public function createUnitAdminFromContactPerson(
        array $contactData,
        int $organizationId,
        int $unitId,
        ?User $createdBy = null,
        ?string $applicationNumber = null
    ): User {
        // Parse name into first_name and last_name
        $fullName = trim($contactData['name'] ?? '');
        $nameParts = explode(' ', $fullName, 2);
        $firstName = $nameParts[0] ?? 'User';
        $lastName = $nameParts[1] ?? '';

        // Generate temporary password
        $temporaryPassword = $this->generateTemporaryPassword();

        // Prepare user data. _skip_invitation_email tells createUser() not to fire the
        // generic 'user-invitation' email — this flow sends 'contact-person-authorized'
        // below, which carries the Application ID and the correct authorization wording.
        $userData = [
            'email' => $contactData['email'],
            'first_name' => $firstName,
            'last_name' => $lastName,
            'mobile_number' => $contactData['mobile'] ?? null,
            'designation' => $contactData['designation'] ?? null,
            'organization_id' => $organizationId,
            'status' => 'invited',
            'is_profile_completed' => false,
            'password' => $temporaryPassword,
            '_skip_invitation_email' => true,
        ];

        // Prepare role assignment data
        $roleData = [
            [
                'slug' => Role::UNIT_ADMIN,
                'organization_id' => $organizationId,
                'unit_id' => $unitId,
            ],
        ];

        $userData['roles'] = $roleData;

        // Create user with role assignment (uses existing createUser method)
        $user = $this->createUser($userData, $createdBy ?? auth()->user());

        Log::info('Unit Admin created from contact person', [
            'user_id' => $user->id,
            'email' => $user->email,
            'organization_id' => $organizationId,
            'unit_id' => $unitId,
            'application_number' => $applicationNumber,
            'created_by' => $createdBy?->id ?? auth()->id(),
        ]);

        // Callers create the user inside a transaction that also stores files and
        // can still roll back; only email the credentials once it has committed.
        DB::afterCommit(function () use ($user, $applicationNumber, $temporaryPassword) {
            try {
                $this->notificationService->send(
                    $user,
                    'contact-person-authorized',
                    [
                        'user_name' => $user->full_name,
                        'samar_id' => $user->samar_id,
                        'organization_name' => $user->organization?->name ?? 'N/A',
                        'application_number' => $applicationNumber ?? 'N/A',
                        'password' => $temporaryPassword,
                        'login_url' => config('app.frontend_url', config('app.url')),
                    ],
                    ['priority' => 9]
                );
            } catch (\Exception $e) {
                Log::error('Failed to send contact-person-authorized email', [
                    'user_id' => $user->id,
                    'user_email' => $user->email,
                    'application_number' => $applicationNumber,
                    'error' => $e->getMessage(),
                ]);
                // Don't fail user creation if email dispatch fails
            }
        });

        return $user;
    }

    /**
     * Update the unit's existing Unit Admin from contact-person data.
     *
     * The SAMAR id is the unit's identity, not the email — so this keeps the same User row
     * and SAMAR id and never creates a new Unit Admin. Name/designation/mobile are refreshed
     * whenever supplied. When the email actually changes, the new address takes over all
     * communications (recipients resolve off User.email) and the new holder cannot know the
     * previous password, so the password is reset and login credentials are emailed to the
     * new address. Returns the updated user, or null when the unit has no Unit Admin.
     */
    public function updateUnitAdminContactPerson(
        int $unitId,
        int $organizationId,
        array $contactData,
        ?string $applicationNumber = null,
        ?User $performedBy = null
    ): ?User {
        $unitAdmin = User::whereHas('activeRoles', function (Builder $q) use ($unitId) {
            $q->where('slug', Role::UNIT_ADMIN)
                ->where('user_role.unit_id', $unitId);
        })->where('organization_id', $organizationId)->first();

        if (! $unitAdmin) {
            return null;
        }

        if (array_key_exists('name', $contactData) && ! empty($contactData['name'])) {
            $nameParts = explode(' ', trim($contactData['name']), 2);
            $unitAdmin->first_name = $nameParts[0] ?? 'User';
            $unitAdmin->last_name = $nameParts[1] ?? '';
        }
        if (array_key_exists('designation', $contactData)) {
            $unitAdmin->designation = $contactData['designation'];
        }
        if (array_key_exists('mobile', $contactData) && ! empty($contactData['mobile'])) {
            $unitAdmin->mobile_number = $contactData['mobile'];
        }

        $newEmail = trim((string) ($contactData['email'] ?? ''));
        $emailChanged = $newEmail !== '' && strcasecmp($newEmail, (string) $unitAdmin->email) !== 0;

        $temporaryPassword = null;
        if ($emailChanged) {
            $activeUnitCount = DB::table('user_role')
                ->where('user_id', $unitAdmin->id)
                ->where('is_active', true)
                ->whereIn('role_id', function ($q) {
                    $q->select('id')->from('roles')->where('slug', Role::UNIT_ADMIN);
                })
                ->distinct()
                ->count('unit_id');
            if ($activeUnitCount > 1) {
                Log::warning('Unit Admin contact email changed on a multi-unit account; login email reassigned across all of its units', [
                    'unit_id' => $unitId,
                    'unit_admin_user_id' => $unitAdmin->id,
                    'active_unit_count' => $activeUnitCount,
                ]);
            }

            $temporaryPassword = $this->generateTemporaryPassword();
            $unitAdmin->email = $newEmail;
            $unitAdmin->password = Hash::make($temporaryPassword);
        }

        if ($unitAdmin->isDirty()) {
            $unitAdmin->save();
        }

        if ($emailChanged) {
            $this->authService->terminateUserSessions($unitAdmin, Session::TERMINATION_SPOC_CHANGED);
        }

        Log::info('Unit Admin contact person updated', [
            'unit_id' => $unitId,
            'organization_id' => $organizationId,
            'unit_admin_user_id' => $unitAdmin->id,
            'samar_id' => $unitAdmin->samar_id,
            'email_changed' => $emailChanged,
            'performed_by' => $performedBy?->id ?? auth()->id(),
        ]);

        if ($emailChanged) {
            try {
                $this->notificationService->send(
                    $unitAdmin,
                    'contact-person-authorized',
                    [
                        'user_name' => $unitAdmin->full_name,
                        'samar_id' => $unitAdmin->samar_id,
                        'organization_name' => $unitAdmin->organization?->name ?? 'N/A',
                        'application_number' => $applicationNumber ?? 'N/A',
                        'password' => $temporaryPassword,
                        'login_url' => config('app.frontend_url', config('app.url')),
                    ],
                    ['priority' => 9]
                );
            } catch (\Exception $e) {
                Log::error('Failed to send contact-person-authorized email after contact email change', [
                    'unit_admin_user_id' => $unitAdmin->id,
                    'user_email' => $unitAdmin->email,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $unitAdmin;
    }

    /**
     * Change the spoke (Unit Admin) for a unit.
     *
     * Hands a unit over to a new person WITHOUT changing the account identity that owns
     * the unit's data: the same User row and SAMAR ID are kept, the user_role pivot is
     * untouched, so every application already mapped to the unit stays visible to the
     * new spoke. Only the contact identity (email, optionally name/designation/mobile)
     * and login password change, and a credentials email is sent to the NEW spoke email.
     *
     * @throws \Exception when the unit has no active Unit Admin to replace.
     */
    public function changeSpoke(Unit $unit, array $spokeData, ?User $performedBy = null): User
    {
        $unitAdmin = User::whereHas('activeRoles', function (Builder $q) use ($unit) {
            $q->where('slug', Role::UNIT_ADMIN)
                ->where('user_role.unit_id', $unit->id);
        })->where('organization_id', $unit->organization_id)->first();

        if (! $unitAdmin) {
            throw new \Exception('This unit has no active Unit Admin to change.');
        }

        $temporaryPassword = $this->generateTemporaryPassword();

        $unitAdmin->email = $spokeData['email'];
        if (! empty($spokeData['name'])) {
            $nameParts = explode(' ', trim($spokeData['name']), 2);
            $unitAdmin->first_name = $nameParts[0] ?? 'User';
            $unitAdmin->last_name = $nameParts[1] ?? '';
        }
        if (array_key_exists('designation', $spokeData)) {
            $unitAdmin->designation = $spokeData['designation'];
        }
        if (! empty($spokeData['mobile'])) {
            $unitAdmin->mobile_number = $spokeData['mobile'];
        }
        $unitAdmin->password = Hash::make($temporaryPassword);
        $unitAdmin->save();

        $this->authService->terminateUserSessions($unitAdmin, Session::TERMINATION_SPOC_CHANGED);

        Log::info('Spoke changed for unit', [
            'unit_id' => $unit->id,
            'organization_id' => (int) $unit->organization_id,
            'unit_admin_user_id' => $unitAdmin->id,
            'samar_id' => $unitAdmin->samar_id,
            'performed_by' => $performedBy?->id ?? auth()->id(),
        ]);

        try {
            $this->notificationService->send(
                $unitAdmin,
                'spoke-changed',
                [
                    'user_name' => $unitAdmin->full_name,
                    'samar_id' => $unitAdmin->samar_id,
                    'organization_name' => $unitAdmin->organization?->name ?? 'N/A',
                    'unit_name' => $unit->name ?? 'N/A',
                    'password' => $temporaryPassword,
                    'login_url' => config('app.frontend_url', config('app.url')),
                ],
                ['priority' => 9]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send spoke-changed email', [
                'unit_id' => $unit->id,
                'unit_admin_user_id' => $unitAdmin->id,
                'error' => $e->getMessage(),
            ]);
            // Don't fail the spoke change if email dispatch fails.
        }

        return $unitAdmin->load(['organization', 'activeRoles']);
    }

    /**
     * Generate a cryptographically secure temporary password.
     */
    protected function generateTemporaryPassword(int $length = 7): string
    {
        $uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $lowercase = 'abcdefghijklmnopqrstuvwxyz';
        $numbers = '0123456789';
        $special = '!@#$%^&*';

        $password = '';
        // Use random_int() for cryptographically secure random numbers
        $password .= $uppercase[random_int(0, strlen($uppercase) - 1)];
        $password .= $lowercase[random_int(0, strlen($lowercase) - 1)];
        $password .= $numbers[random_int(0, strlen($numbers) - 1)];
        // $password .= $special[random_int(0, strlen($special) - 1)];

        $all = $uppercase.$lowercase.$numbers.$special;
        for ($i = 3; $i < $length; $i++) {
            $password .= $all[random_int(0, strlen($all) - 1)];
        }

        return str_shuffle($password);

    }

    /**
     * Get user by ID with relationships.
     */
    public function getUserById(int $userId): User
    {
        return User::with(['organization', 'activeRoles', 'assessorDomains'])->findOrFail($userId);
    }

    /**
     * Delete a user (hard delete).
     * Only users with 'invited' status can be deleted.
     *
     * @param  User  $user  The user to delete
     *
     * @throws \Exception
     */
    public function deleteUser(User $user): bool
    {
        return DB::transaction(function () use ($user) {
            // Double-check status (defense in depth)
            if ($user->status !== 'invited') {
                throw new \Exception(
                    "Only users with 'invited' status can be deleted. Current status: {$user->status}"
                );
            }

            $userId = $user->id;
            $userEmail = $user->email;

            // Detach all roles before deletion
            $user->roles()->detach();
            $user->forgetRoleCache();

            // Detach assessor domains if any
            if ($user->assessorDomains()->exists()) {
                $user->assessorDomains()->detach();
            }

            // Detach assessor districts if any
            if ($user->assessorDistricts()->exists()) {
                $user->assessorDistricts()->detach();
            }

            // Perform hard delete
            $deleted = $user->forceDelete();

            Log::info('User deleted successfully', [
                'user_id' => $userId,
                'email' => $userEmail,
                'deleted_by' => auth()->id(),
            ]);

            return $deleted;
        });
    }

    /**
     * Send user invitation email with login credentials.
     *
     * @param  User  $user  The newly created user
     * @param  string  $temporaryPassword  The plain text temporary password
     * @param  User  $createdBy  The admin who created the user
     */
    protected function sendUserInvitationEmail(User $user, string $temporaryPassword, User $createdBy): void
    {
        $assignedRoles = $user->activeRoles->pluck('name')->toArray();
        $assignedRoleSlugs = $user->activeRoles->pluck('slug')->toArray();

        // Check if user is an Assessor-only (single role = assessor)
        $isAssessorOnly = count($assignedRoleSlugs) === 1 && in_array('assessor', $assignedRoleSlugs);
        // Check if user is a DRDO Lab-only (single role = drdo_lab)
        $isDrdoLabOnly = count($assignedRoleSlugs) === 1 && in_array(Role::DRDO_LAB, $assignedRoleSlugs);
        // Check if user is an Operations Admin-only (single role = operations_admin)
        $isOpsAdminOnly = count($assignedRoleSlugs) === 1 && in_array(Role::OPERATIONS_ADMIN, $assignedRoleSlugs);
        // Check if user is an Operations Manager-only (single role = operations_manager)
        $isOpsManagerOnly = count($assignedRoleSlugs) === 1 && in_array(Role::OPERATIONS_MANAGER, $assignedRoleSlugs);
        // Check if user is a DRDO Admin-only (single role = drdo_admin)
        $isDrdoAdminOnly = count($assignedRoleSlugs) === 1 && in_array(Role::DRDO_ADMIN, $assignedRoleSlugs);

        if ($isOpsManagerOnly) {
            // Use Operations Manager-specific invitation template
            $emailData = [
                'operations_manager_id' => $user->samar_id,
                'password' => $temporaryPassword,
                'login_url' => config('app.frontend_url', config('app.url')),
            ];

            $this->notificationService->send(
                $user,
                'operations-manager-invitation',
                $emailData,
                ['priority' => 9]
            );

            Log::info('Operations Manager invitation email sent', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'created_by' => $createdBy->id,
            ]);
        } elseif ($isOpsAdminOnly) {
            // Use Operations Admin-specific invitation template
            $emailData = [
                'operations_admin_id' => $user->samar_id,
                'password' => $temporaryPassword,
                'login_url' => config('app.frontend_url', config('app.url')),
                'query_form_link' => config('app.frontend_url', config('app.url')).'/support',
            ];

            $this->notificationService->send(
                $user,
                'operations-admin-invitation',
                $emailData,
                ['priority' => 9]
            );

            Log::info('Operations Admin invitation email sent', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'created_by' => $createdBy->id,
            ]);
        } elseif ($isDrdoLabOnly) {
            // Use DRDO Lab-specific invitation template
            $emailData = [
                'drdo_lab_id' => $user->samar_id,
                'password' => $temporaryPassword,
                'login_url' => config('app.frontend_url', config('app.url')),
                'query_form_link' => config('app.frontend_url', config('app.url')).'/support',
            ];

            $this->notificationService->send(
                $user,
                'drdo-lab-invitation',
                $emailData,
                ['priority' => 9]
            );

            Log::info('DRDO Lab invitation email sent', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'created_by' => $createdBy->id,
            ]);
        } elseif ($isDrdoAdminOnly) {
            // Use DRDO Admin-specific invitation template
            $emailData = [
                'drdo_admin_id' => $user->samar_id,
                'password' => $temporaryPassword,
                'login_url' => config('app.frontend_url', config('app.url')),
                'query_form_link' => config('app.frontend_url', config('app.url')).'/support',
            ];

            $this->notificationService->send(
                $user,
                'drdo-admin-invitation',
                $emailData,
                ['priority' => 9]
            );

            Log::info('DRDO Admin invitation email sent', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'created_by' => $createdBy->id,
            ]);
        } elseif ($isAssessorOnly) {
            // Use Assessor-specific invitation template
            $emailData = [
                'user_name' => $user->full_name,
                'assessor_id' => $user->samar_id,
                'password' => $temporaryPassword,
                'login_url' => config('app.frontend_url', config('app.url')),
                'query_form_url' => config('app.frontend_url', config('app.url')).'/support',
            ];

            $this->notificationService->send(
                $user,
                'assessor-invitation',
                $emailData,
                ['priority' => 9]
            );

            Log::info('Assessor invitation email sent', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'created_by' => $createdBy->id,
            ]);
        } else {
            // Use standard user invitation template
            $emailData = [
                'user_name' => $user->full_name,
                'user_email' => $user->email,
                'samar_id' => $user->samar_id,
                'password' => $temporaryPassword,
                'organization_name' => $user->organization?->name ?? 'QCI SAMAR',
                'created_by_name' => $createdBy->full_name,
                'assigned_roles' => $assignedRoles,
                'portal_url' => config('app.frontend_url', config('app.url')),
            ];

            $this->notificationService->send(
                $user,
                'user-invitation',
                $emailData,
                ['priority' => 9]
            );

            Log::info('User invitation email sent', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'created_by' => $createdBy->id,
            ]);
        }
    }
}
