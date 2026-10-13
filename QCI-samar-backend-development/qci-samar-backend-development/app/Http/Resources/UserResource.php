<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
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
            'samar_id' => $this->samar_id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'mobile_number' => $this->mobile_number,
            'designation' => $this->designation,
            'district' => $this->district,
            'state' => $this->state,
            'assigned_states' => $this->assigned_states,
            'address' => $this->address,
            'city' => $this->city,
            'pincode' => $this->pincode,
            'status' => $this->status,
            'is_profile_completed' => $this->is_profile_completed,
            'profile_completed_at' => $this->profile_completed_at?->toIso8601String(),
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'last_login_ip' => $this->last_login_ip,

            // Relationships
            'organization' => $this->when($this->relationLoaded('organization'), [
                'id' => $this->organization?->id,
                'name' => $this->organization?->name,
                'email' => $this->organization?->email,
                'phone' => $this->organization?->phone,
            ]),

            'roles' => $this->when(
                $this->relationLoaded('activeRoles'),
                RoleResource::collection($this->activeRoles)
            ),

            'assessor_domains' => $this->when(
                $this->relationLoaded('assessorDomains'),
                $this->assessorDomains->map(fn ($domain) => [
                    'id' => $domain->id,
                    'domain_name' => $domain->domain_name,
                    'is_active' => $domain->is_active,
                    'assigned_at' => $domain->pivot->created_at ?? null,
                    'assigned_by' => $domain->pivot->assigned_by ?? null,
                ])
            ),

            'assessor_districts' => $this->when(
                $this->relationLoaded('assessorDistricts'),
                $this->assessorDistricts->map(fn ($district) => [
                    'id' => $district->id,
                    'name' => $district->name,
                    'code' => $district->code,
                    'state_id' => $district->state_id,
                    'state' => $district->relationLoaded('state') && $district->state ? [
                        'id' => $district->state->id,
                        'name' => $district->state->name,
                        'code' => $district->state->code,
                    ] : null,
                    'assigned_by' => $district->pivot->assigned_by ?? null,
                    'assigned_at' => $district->pivot->created_at ?? null,
                ])
            ),

            // Assigned unit (for unit_admin role)
            'assigned_unit' => $this->when(
                $this->relationLoaded('activeRoles'),
                function () {
                    $unit = $this->assignedUnit();
                    if (! $unit) {
                        return null;
                    }

                    return [
                        'id' => $unit->id,
                        'name' => $unit->name,
                        'address' => $unit->address,
                        'state' => $unit->state,
                        'district' => $unit->district,
                        'pincode' => $unit->pincode,
                        'unit_type' => $unit->unit_type,
                        'contact_person_name' => $unit->contact_person_name,
                        'email' => $unit->email,
                        'mobile_number' => $unit->mobile_number,
                    ];
                }
            ),

            // Timestamps
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
