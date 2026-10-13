<?php

namespace App\Policies;

use App\Models\AssessmentParameter;
use App\Models\User;

class AssessmentParameterPolicy
{
    public function viewAny(?User $user)
    {
        return true;
    }

    public function view(?User $user, AssessmentParameter $assessmentParameter)
    {
        return true;
    }

    public function create(User $user)
    {
        return $user->hasAnyRole(['system_admin', 'drdo_admin']);
    }

    public function update(User $user, AssessmentParameter $assessmentParameter)
    {
        return $user->hasAnyRole(['system_admin', 'drdo_admin']);
    }

    public function delete(User $user, AssessmentParameter $assessmentParameter)
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, AssessmentParameter $assessmentParameter)
    {
        return $user->hasRole('system_admin');
    }
}
