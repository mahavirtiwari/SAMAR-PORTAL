<?php

namespace App\Policies;

use App\Models\FeedbackQuestion;
use App\Models\User;

class FeedbackQuestionPolicy
{
    public function viewAny(?User $user)
    {
        return true;
    }

    public function view(?User $user, FeedbackQuestion $feedbackQuestion)
    {
        return true;
    }

    public function create(User $user)
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, FeedbackQuestion $feedbackQuestion)
    {
        return $user->hasRole('system_admin');
    }

    public function delete(User $user, FeedbackQuestion $feedbackQuestion)
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, FeedbackQuestion $feedbackQuestion)
    {
        return $user->hasRole('system_admin');
    }
}
