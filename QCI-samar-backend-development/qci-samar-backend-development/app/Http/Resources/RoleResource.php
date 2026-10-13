<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'is_system_role' => $this->is_system_role,
            'requires_organization' => $this->requires_organization,
            'requires_unit' => $this->requires_unit,
            'enforce_single_session' => $this->enforce_single_session,
            'level' => $this->level,
            'is_active' => $this->is_active,

            // Pivot data (when accessed through user relationship)
            'pivot' => $this->when(isset($this->pivot), [
                'organization_id' => $this->pivot?->organization_id,
                'unit_id' => $this->pivot?->unit_id,
                'is_active' => $this->pivot?->is_active,
                'assigned_at' => $this->pivot?->assigned_at,
                'expires_at' => $this->pivot?->expires_at,
            ]),

            // Timestamps
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
