<?php

namespace App\Policies;

use App\Models\Certificate;
use App\Models\Role;
use App\Models\User;

class CertificatePolicy
{
    /**
     * Determine if the user can view any certificates.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
            Role::ENTERPRISE_ADMIN,
            Role::UNIT_ADMIN,
        ]);
    }

    /**
     * Determine if the user can view the certificate.
     */
    public function view(User $user, Certificate $certificate): bool
    {
        // System admins and operations can view all
        if ($user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ])) {
            return true;
        }

        if ($user->hasRole(Role::ENTERPRISE_ADMIN)) {
            return $certificate->application->organization_id === $user->organization_id;
        }

        if ($user->hasRole(Role::UNIT_ADMIN)) {
            return $certificate->application->organization_id === $user->organization_id
                && in_array($certificate->application->unit_id, $user->assignedUnitIds(), true);
        }

        return false;
    }

    /**
     * Determine if the user can download the certificate.
     */
    public function download(User $user, Certificate $certificate): bool
    {
        // System admins, DRDO admins, and operations can download any certificate
        if ($user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ])) {
            return true;
        }

        if ($user->hasRole(Role::ENTERPRISE_ADMIN)) {
            return $certificate->application->organization_id === $user->organization_id;
        }

        if ($user->hasRole(Role::UNIT_ADMIN)) {
            return $certificate->application->organization_id === $user->organization_id
                && in_array($certificate->application->unit_id, $user->assignedUnitIds(), true);
        }

        return false;
    }

    /**
     * Determine if the user can issue certificates.
     */
    public function issue(User $user): bool
    {
        return $user->hasAnyRole([
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ]);
    }

    /**
     * Determine if the user can approve certificates.
     */
    public function approve(User $user): bool
    {
        return $user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::DRDO_ADMIN,
        ]);
    }

    /**
     * Determine if the user can suspend certificates.
     */
    public function suspend(User $user): bool
    {
        return $user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ]);
    }

    /**
     * Determine if the user can revoke certificates.
     */
    public function revoke(User $user): bool
    {
        return $user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ]);
    }
}
