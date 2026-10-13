<?php

namespace App\Policies;

use App\Models\ManufacturingBoughtOutPart;
use App\Models\User;

class ManufacturingBoughtOutPartPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ManufacturingBoughtOutPart $part): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole('system_admin');
    }

    public function update(User $user, ManufacturingBoughtOutPart $part): bool
    {
        return $user->hasRole('system_admin');
    }

    public function changeStatus(User $user, ManufacturingBoughtOutPart $part): bool
    {
        return $user->hasRole('system_admin');
    }
}
