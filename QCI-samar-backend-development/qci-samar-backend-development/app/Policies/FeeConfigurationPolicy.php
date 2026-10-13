<?php

namespace App\Policies;

use App\Models\FeeConfiguration;
use App\Models\User;

class FeeConfigurationPolicy
{
    public function viewAny(?User $user)
    {
        return true;
    }

    public function view(?User $user, FeeConfiguration $feeConfiguration)
    {
        return true;
    }

    public function create(User $user)
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, FeeConfiguration $feeConfiguration)
    {
        return $user->hasRole('system_admin');
    }

    public function delete(User $user, FeeConfiguration $feeConfiguration)
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, FeeConfiguration $feeConfiguration)
    {
        return $user->hasRole('system_admin');
    }
}
