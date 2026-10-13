<?php

namespace App\Policies;

use App\Models\ManufacturingKeyProcess;
use App\Models\User;

class ManufacturingKeyProcessPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ManufacturingKeyProcess $keyProcess): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ManufacturingKeyProcess $keyProcess): bool
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ManufacturingKeyProcess $keyProcess): bool
    {
        return $user->hasRole('system_admin');
    }
}
