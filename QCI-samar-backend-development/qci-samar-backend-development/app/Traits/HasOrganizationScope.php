<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

trait HasOrganizationScope
{
    /**
     * Boot the trait.
     */
    protected static function bootHasOrganizationScope(): void
    {
        // Auto-set organization_id on creation if not provided
        static::creating(function ($model) {
            if (! $model->organization_id && Auth::check() && Auth::user()->organization_id) {
                $model->organization_id = Auth::user()->organization_id;
            }
        });
    }

    /**
     * Scope query to current user's organization.
     */
    public function scopeForOrganization(Builder $query, ?int $organizationId = null): Builder
    {
        $orgId = $organizationId ?? Auth::user()?->organization_id;

        if ($orgId) {
            return $query->where($this->getTable().'.organization_id', $orgId);
        }

        return $query;
    }

    /**
     * Scope query to specific organization.
     */
    public function scopeWhereOrganization(Builder $query, int $organizationId): Builder
    {
        return $query->where($this->getTable().'.organization_id', $organizationId);
    }
}
