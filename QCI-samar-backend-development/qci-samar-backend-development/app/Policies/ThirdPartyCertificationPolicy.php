<?php

namespace App\Policies;

use App\Models\ThirdPartyCertification;
use App\Models\User;

class ThirdPartyCertificationPolicy
{
    public function viewAny(?User $user)
    {
        return true;
    }

    public function view(?User $user, ThirdPartyCertification $thirdPartyCertification)
    {
        return true;
    }

    public function create(User $user)
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ThirdPartyCertification $thirdPartyCertification)
    {
        return $user->hasRole('system_admin');
    }

    public function delete(User $user, ThirdPartyCertification $thirdPartyCertification)
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ThirdPartyCertification $thirdPartyCertification)
    {
        return $user->hasRole('system_admin');
    }
}
