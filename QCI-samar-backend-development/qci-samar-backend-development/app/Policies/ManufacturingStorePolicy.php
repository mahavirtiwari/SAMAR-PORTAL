<?php

namespace App\Policies;

use App\Models\ManufacturingStore;
use App\Models\User;

class ManufacturingStorePolicy
{
    /**
     * Determine whether the user can view any manufacturing stores.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the manufacturing store.
     */
    public function view(User $user, ManufacturingStore $store): bool
    {
        return true;
    }

    /**
     * Determine whether the user can create manufacturing stores.
     */
    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    /**
     * Determine whether the user can update the manufacturing store.
     */
    public function update(User $user, ManufacturingStore $store): bool
    {
        return $user->hasRole('system_admin');
    }

    /**
     * Determine whether the user can delete the manufacturing store.
     */
    public function delete(User $user, ManufacturingStore $store): bool
    {
        return $user->hasRole('system_admin');
    }

    /**
     * Determine whether the user can restore the manufacturing store.
     */
    public function restore(User $user, ManufacturingStore $store): bool
    {
        return $user->hasRole('system_admin');
    }

    /**
     * Determine whether the user can permanently delete the manufacturing store.
     */
    public function forceDelete(User $user, ManufacturingStore $store): bool
    {
        return $user->hasRole('system_admin');
    }

    /**
     * Determine whether the user can change the status of the manufacturing store.
     */
    public function changeStatus(User $user, ManufacturingStore $store): bool
    {
        return $user->hasRole('system_admin');
    }
}
