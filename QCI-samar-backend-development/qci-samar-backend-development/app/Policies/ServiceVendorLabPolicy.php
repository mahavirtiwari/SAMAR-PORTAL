<?php

namespace App\Policies;

use App\Models\ServiceVendorLab;
use App\Models\User;

class ServiceVendorLabPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ServiceVendorLab $vendorLab): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ServiceVendorLab $vendorLab): bool
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ServiceVendorLab $vendorLab): bool
    {
        return $user->hasRole('system_admin');
    }
}
