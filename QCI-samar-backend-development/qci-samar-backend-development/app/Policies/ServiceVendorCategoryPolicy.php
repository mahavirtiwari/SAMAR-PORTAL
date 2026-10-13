<?php

namespace App\Policies;

use App\Models\ServiceVendorCategory;
use App\Models\User;

class ServiceVendorCategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ServiceVendorCategory $category): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ServiceVendorCategory $category): bool
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ServiceVendorCategory $category): bool
    {
        return $user->hasRole('system_admin');
    }
}
