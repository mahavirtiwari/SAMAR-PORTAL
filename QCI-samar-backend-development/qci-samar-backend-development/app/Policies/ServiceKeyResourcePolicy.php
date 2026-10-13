<?php

namespace App\Policies;

use App\Models\ServiceKeyResource;
use App\Models\User;

class ServiceKeyResourcePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ServiceKeyResource $keyResource): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ServiceKeyResource $keyResource): bool
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ServiceKeyResource $keyResource): bool
    {
        return $user->hasRole('system_admin');
    }
}
