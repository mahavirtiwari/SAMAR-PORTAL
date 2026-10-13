<?php

namespace App\Policies;

use App\Models\AssessmentQuestionOption;
use App\Models\User;

class AssessmentQuestionOptionPolicy
{
    public function viewAny(?User $user)
    {
        return true;
    }

    public function view(?User $user, AssessmentQuestionOption $assessmentQuestionOption)
    {
        return true;
    }

    public function create(User $user)
    {
        return $user->hasAnyRole(['system_admin', 'drdo_admin']);
    }

    public function update(User $user, AssessmentQuestionOption $assessmentQuestionOption)
    {
        return $user->hasAnyRole(['system_admin', 'drdo_admin']);
    }

    public function delete(User $user, AssessmentQuestionOption $assessmentQuestionOption)
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, AssessmentQuestionOption $assessmentQuestionOption)
    {
        return $user->hasRole('system_admin');
    }
}
