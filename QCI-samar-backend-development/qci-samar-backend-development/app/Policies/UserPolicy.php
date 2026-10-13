<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

class UserPolicy
{
    /**
     * Determine if the user can view any users.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::ENTERPRISE_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ]);
    }

    /**
     * Determine if the user can view the specific user.
     */
    public function view(User $user, User $targetUser): bool
    {
        // Users can always view their own profile
        if ($user->id === $targetUser->id) {
            return true;
        }

        // System admins and operations can view all users
        if ($user->hasAnyRole([Role::SYSTEM_ADMIN, Role::OPERATIONS_ADMIN, Role::OPERATIONS_MANAGER])) {
            return true;
        }

        // Enterprise admins can view users in their organization
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) && $user->organization_id === $targetUser->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can create users.
     */
    public function create(User $user): bool
    {
        return $user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::ENTERPRISE_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ]);
    }

    /**
     * Determine if the user can update the specific user.
     */
    public function update(User $user, User $targetUser): bool
    {
        // Users can update their own profile (limited fields)
        if ($user->id === $targetUser->id) {
            return true;
        }

        // System admins can update all users
        if ($user->hasRole(Role::SYSTEM_ADMIN)) {
            return true;
        }

        // Operations Manager and Operations Admin can update assessors
        if ($user->hasAnyRole([Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN]) &&
            $targetUser->hasRole(Role::ASSESSOR)) {
            return true;
        }

        // Enterprise admins can update users in their organization
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) &&
            $user->organization_id === $targetUser->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can activate/deactivate the target user.
     */
    public function changeStatus(User $user, User $targetUser): bool
    {
        // Cannot change own status
        if ($user->id === $targetUser->id) {
            return false;
        }

        // System admins can change any user's status
        if ($user->hasRole(Role::SYSTEM_ADMIN)) {
            return true;
        }

        // Operations Manager and Operations Admin can change status for assessors
        if ($user->hasAnyRole([Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN]) &&
            $targetUser->hasRole(Role::ASSESSOR)) {
            return true;
        }

        // Enterprise admins can change status for users in their organization
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) &&
            $user->organization_id === $targetUser->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can perform full updates (including restricted fields).
     */
    public function updateRestricted(User $user, User $targetUser): bool
    {
        // Self-update should not allow restricted fields
        if ($user->id === $targetUser->id) {
            return false;
        }

        // System Admins can update restricted fields for all users
        if ($user->hasRole(Role::SYSTEM_ADMIN)) {
            return true;
        }

        // Operations Manager and Operations Admin can update restricted fields for assessors
        if ($user->hasAnyRole([Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN]) &&
            $targetUser->hasRole(Role::ASSESSOR)) {
            return true;
        }

        // Enterprise Admins can update restricted fields for users in their organization
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) &&
            $user->organization_id === $targetUser->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if the user can delete the target user.
     * Only users with 'invited' status can be deleted.
     *
     * - System Admin: Can delete any user with 'invited' status
     * - Enterprise Admin: Can delete invited Unit Admins from their organization only
     */
    public function delete(User $user, User $targetUser): bool
    {
        // Cannot delete self
        if ($user->id === $targetUser->id) {
            return false;
        }

        // Only users with 'invited' status can be deleted
        if ($targetUser->status !== 'invited') {
            return false;
        }

        // System Admin can delete any invited user
        if ($user->hasRole(Role::SYSTEM_ADMIN)) {
            return true;
        }

        // Enterprise Admin can delete invited Unit Admins from their organization
        if ($user->hasRole(Role::ENTERPRISE_ADMIN)) {
            // Check same organization
            if ($user->organization_id !== $targetUser->organization_id) {
                return false;
            }

            // Check if target user has Unit Admin role
            if (! $targetUser->hasRole(Role::UNIT_ADMIN)) {
                return false;
            }

            return true;
        }

        return false;
    }
}
