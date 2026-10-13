<?php

namespace App\Policies;

use App\Models\Application;
use App\Models\Role;
use App\Models\User;

class ApplicationPolicy
{
    /**
     * Determine if the user can view any applications.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole([
            Role::ENTERPRISE_ADMIN,
            Role::UNIT_ADMIN,
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
            Role::SYSTEM_ADMIN,
        ]);
    }

    /**
     * Determine if the user can view the application.
     */
    public function view(User $user, Application $application): bool
    {
        // System admins and operations can view all
        if ($user->hasAnyRole([Role::SYSTEM_ADMIN, Role::OPERATIONS_ADMIN, Role::OPERATIONS_MANAGER, Role::DRDO_ADMIN])) {
            return true;
        }

        // EnterpriseAdmin can view their organization's applications
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) && $user->organization_id === $application->organization_id) {
            return true;
        }

        // UnitAdmin can view only their unit's applications
        if ($user->hasRole(Role::UNIT_ADMIN)) {
            // Check if user has access to this unit
            $userUnits = $user->roles()
                ->where('slug', Role::UNIT_ADMIN)
                ->wherePivot('is_active', true)
                ->get()
                ->pluck('pivot.unit_id')
                ->filter()
                ->toArray();

            return in_array($application->unit_id, $userUnits);
        }

        return false;
    }

    /**
     * Determine if the user can create applications.
     */
    public function create(User $user): bool
    {
        return $user->hasAnyRole([
            Role::ENTERPRISE_ADMIN,
            Role::UNIT_ADMIN,
        ]);
    }

    /**
     * Determine if the user can update the application.
     */
    public function update(User $user, Application $application): bool
    {
        // Can only update if in draft, drdo_approval_pending, or payment_pending status
        if (! in_array($application->status, ['draft', 'drdo_approval_pending', 'payment_pending'])) {
            return false;
        }

        // EnterpriseAdmin can update their organization's applications
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) &&
            $user->organization_id === $application->organization_id) {
            return true;
        }

        // UnitAdmin can update only their unit's applications
        if ($user->hasRole(Role::UNIT_ADMIN)) {
            $userUnits = $user->roles()
                ->where('slug', Role::UNIT_ADMIN)
                ->wherePivot('is_active', true)
                ->get()
                ->pluck('pivot.unit_id')
                ->filter()
                ->toArray();

            return in_array($application->unit_id, $userUnits);
        }

        return false;
    }

    /**
     * Determine if the user can delete the application.
     */
    public function delete(User $user, Application $application): bool
    {
        // Only draft applications can be deleted
        if ($application->status !== 'draft') {
            return false;
        }

        return $user->hasRole(Role::ENTERPRISE_ADMIN) &&
               $user->organization_id === $application->organization_id;
    }

    /**
     * Determine if the user can submit the application.
     */
    public function submit(User $user, Application $application): bool
    {
        if ($application->status !== 'draft') {
            return false;
        }

        // Check if user can update the application
        return $this->update($user, $application);
    }

    /**
     * Determine if the user can initiate a renewal of the application.
     *
     * Scope for now: only the Enterprise Admin of the owning organization may
     * renew, and only a certified application can be renewed.
     */
    public function renew(User $user, Application $application): bool
    {
        return $user->hasRole(Role::ENTERPRISE_ADMIN)
            && $user->organization_id === $application->organization_id
            && $application->status === 'certified';
    }

    /**
     * Determine if the user can approve the application.
     */
    public function approve(User $user, Application $application): bool
    {
        return $user->hasAnyRole([
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ]);
    }

    /**
     * Determine if the user can reject the application.
     */
    public function reject(User $user, Application $application): bool
    {
        return $user->hasAnyRole([
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ]);
    }
}
