<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeedbackQuestionResource extends JsonResource
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
            'question_text' => $this->question_text,
            'type' => $this->type,
            'type_label' => $this->getTypeLabel(),
            'display_order' => $this->display_order,
            'is_active' => $this->is_active,

            // Timestamps
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Get human-readable type label.
     */
    protected function getTypeLabel(): string
    {
        $labels = [
            'rating' => '5 Star Rating',
            'yes_no' => 'Yes/No',
        ];

        return $labels[$this->type] ?? $this->type;
    }
}
