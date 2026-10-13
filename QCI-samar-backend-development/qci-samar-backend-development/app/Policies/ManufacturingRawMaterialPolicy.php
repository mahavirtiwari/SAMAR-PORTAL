<?php

namespace App\Policies;

use App\Models\ManufacturingRawMaterial;
use App\Models\User;

class ManufacturingRawMaterialPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ManufacturingRawMaterial $rawMaterial): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ManufacturingRawMaterial $rawMaterial): bool
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ManufacturingRawMaterial $rawMaterial): bool
    {
        return $user->hasRole('system_admin');
    }
}
