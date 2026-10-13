<?php

namespace App\Policies;

use App\Models\AssessorDomain;
use App\Models\User;

class AssessorDomainPolicy
{
    public function viewAny(?User $user)
    {
        return true;
    }

    public function view(?User $user, AssessorDomain $assessorDomain)
    {
        return true;
    }

    public function create(User $user)
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, AssessorDomain $assessorDomain)
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, AssessorDomain $assessorDomain)
    {
        return $user->hasRole('system_admin');
    }
}
