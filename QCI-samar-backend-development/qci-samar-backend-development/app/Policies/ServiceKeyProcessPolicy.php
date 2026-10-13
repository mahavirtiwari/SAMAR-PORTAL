<?php

namespace App\Policies;

use App\Models\ServiceKeyProcess;
use App\Models\User;

class ServiceKeyProcessPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ServiceKeyProcess $keyProcess): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ServiceKeyProcess $keyProcess): bool
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ServiceKeyProcess $keyProcess): bool
    {
        return $user->hasRole('system_admin');
    }
}
