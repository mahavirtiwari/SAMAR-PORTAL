<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\Role;
use App\Models\User;

class OrganizationPolicy
{
    /**
     * Determine if the user can view any organizations.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::DRDO_ADMIN,
            Role::DRDO_LAB,
            Role::ASSESSOR,
        ]);
    }

    /**
     * Determine if the user can view the organization.
     */
    public function view(User $user, Organization $organization): bool
    {
        // System-level roles can view all organizations
        if ($user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::DRDO_ADMIN,
            Role::DRDO_LAB,
            Role::ASSESSOR,
        ])) {
            return true;
        }

        // Enterprise/Unit admins can view their own organization only
        if ($user->hasAnyRole([Role::ENTERPRISE_ADMIN, Role::UNIT_ADMIN])) {
            return $user->organization_id === $organization->id;
        }

        return false;
    }

    /**
     * Determine if the user can create organizations.
     */
    public function create(User $user): bool
    {
        return $user->hasRole(Role::SYSTEM_ADMIN);
    }

    /**
     * Determine if the user can update the organization.
     */
    public function update(User $user, Organization $organization): bool
    {
        // System admins can update any organization
        if ($user->hasRole(Role::SYSTEM_ADMIN)) {
            return true;
        }

        // EnterpriseAdmin can update their own organization
        return $user->hasRole(Role::ENTERPRISE_ADMIN) &&
               $user->organization_id === $organization->id;
    }

    /**
     * Determine if the user can verify the organization.
     */
    public function verify(User $user, Organization $organization): bool
    {
        return $user->hasAnyRole([Role::SYSTEM_ADMIN, Role::DRDO_ADMIN]);
    }

    /**
     * Determine if the user can activate/deactivate the organization.
     */
    public function changeStatus(User $user, Organization $organization): bool
    {
        return $user->hasAnyRole([Role::SYSTEM_ADMIN, Role::OPERATIONS_ADMIN]);
    }
}
