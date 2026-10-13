<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ApplicationFeedbackResource extends JsonResource
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
            'application_id' => $this->application_id,
            'feedback_question_id' => $this->feedback_question_id,

            // Immutable question snapshot
            'question_text' => $this->question_text,
            'question_type' => $this->question_type,
            'question_type_label' => $this->getTypeLabel(),

            // Answer
            'rating' => $this->rating,
            'yes_no_answer' => $this->yes_no_answer,
            'answer' => $this->answer,
            'formatted_answer' => $this->formatted_answer,

            // Remarks
            'remarks' => $this->remarks,

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

        return $labels[$this->question_type] ?? $this->question_type;
    }
}
