<?php

namespace App\Policies;

use App\Models\ServiceOutsourcedComponent;
use App\Models\User;

class ServiceOutsourcedComponentPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ServiceOutsourcedComponent $component): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ServiceOutsourcedComponent $component): bool
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ServiceOutsourcedComponent $component): bool
    {
        return $user->hasRole('system_admin');
    }
}
