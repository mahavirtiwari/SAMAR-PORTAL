<?php

namespace App\Policies;

use App\Models\AssessmentQuestion;
use App\Models\User;

class AssessmentQuestionPolicy
{
    public function viewAny(?User $user)
    {
        return true;
    }

    public function view(?User $user, AssessmentQuestion $assessmentQuestion)
    {
        return true;
    }

    public function create(User $user)
    {
        return $user->hasAnyRole(['system_admin', 'drdo_admin']);
    }

    public function update(User $user, AssessmentQuestion $assessmentQuestion)
    {
        return $user->hasAnyRole(['system_admin', 'drdo_admin']);
    }

    public function delete(User $user, AssessmentQuestion $assessmentQuestion)
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, AssessmentQuestion $assessmentQuestion)
    {
        return $user->hasRole('system_admin');
    }
}
