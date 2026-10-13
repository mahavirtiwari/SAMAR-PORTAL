<?php

namespace App\Policies;

use App\Models\ManufacturingVendorCategory;
use App\Models\User;

class ManufacturingVendorCategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ManufacturingVendorCategory $category): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ManufacturingVendorCategory $category): bool
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ManufacturingVendorCategory $category): bool
    {
        return $user->hasRole('system_admin');
    }
}
