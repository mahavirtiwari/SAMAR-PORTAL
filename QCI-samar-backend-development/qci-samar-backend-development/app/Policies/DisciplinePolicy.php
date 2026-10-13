<?php

namespace App\Policies;

use App\Models\Discipline;
use App\Models\User;

class DisciplinePolicy
{
    public function viewAny(?User $user)
    {
        return true;
    }

    public function view(?User $user, Discipline $discipline)
    {
        return true;
    }

    public function create(User $user)
    {
        return $user->hasAnyRole(['system_admin', 'drdo_admin']);
    }

    public function update(User $user, Discipline $discipline)
    {
        return $user->hasAnyRole(['system_admin', 'drdo_admin']);
    }

    public function delete(User $user, Discipline $discipline)
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, Discipline $discipline)
    {
        return $user->hasRole('system_admin');
    }
}
