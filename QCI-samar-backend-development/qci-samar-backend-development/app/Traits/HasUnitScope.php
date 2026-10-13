<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

trait HasUnitScope
{
    /**
     * Boot the trait.
     */
    protected static function bootHasUnitScope(): void
    {
        // Auto-set unit_id on creation if not provided (and user has a default unit)
        static::creating(function ($model) {
            if (! $model->unit_id && Auth::check()) {
                // This could be enhanced to get user's assigned unit
                // For now, we'll let it be explicitly set
            }
        });
    }

    /**
     * Scope query to specific unit(s).
     *
     * @param  int|array  $unitId
     */
    public function scopeForUnit(Builder $query, $unitId): Builder
    {
        if (is_array($unitId)) {
            return $query->whereIn($this->getTable().'.unit_id', $unitId);
        }

        return $query->where($this->getTable().'.unit_id', $unitId);
    }

    /**
     * Scope query to units within an organization.
     */
    public function scopeForOrganizationUnits(Builder $query, int $organizationId): Builder
    {
        return $query->whereHas('unit', function ($q) use ($organizationId) {
            $q->where('organization_id', $organizationId);
        });
    }
}
