<?php

namespace App\Policies;

use App\Models\Unit;
use App\Models\User;

class UnitPolicy
{
    public function viewAny(?User $user)
    {
        return true;
    }

    public function view(?User $user, Unit $unit)
    {
        return true;
    }

    public function create(User $user)
    {
        return $user->hasRole('enterprise_admin');
    }

    public function update(User $user, Unit $unit)
    {
        return $user->hasRole('enterprise_admin') && $unit->organization_id === $user->organization_id;
    }

    public function delete(User $user, Unit $unit)
    {
        return $user->hasRole('system_admin');
    }
}
