<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeeConfigurationResource extends JsonResource
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
            'sector' => $this->sector,
            'enterprise_size' => $this->enterprise_size,
            'base_certification_fee' => $this->base_certification_fee,
            'food_and_accommodation_fee' => $this->food_and_accommodation_fee,
            'gst_percentage' => $this->gst_percentage,
            'tds_enabled' => $this->tds_enabled,

            // Computed fields. No total is published here: the configuration has no
            // TDS rate, so any "total" it could offer would be wrong for a
            // TDS-electing applicant. GET /applications/{id}/fee is authoritative.
            'total_fee' => $this->total_fee,
            'gst_amount' => $this->gst_amount,

            // Timestamps
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
