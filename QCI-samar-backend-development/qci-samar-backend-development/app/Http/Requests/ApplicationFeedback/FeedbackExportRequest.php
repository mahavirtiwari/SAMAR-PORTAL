<?php

namespace App\Http\Requests\ApplicationFeedback;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class FeedbackExportRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Authorization is enforced by the route's role middleware (Operations Manager /
     * Operations Admin / System Admin), matching the ApplicationExportRequest convention.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Mirrors the submittedFeedback listing filters so the bulk export honours the same
     * filters as the list. Query keys arrive snake_case (ConvertRequestToSnakeCase).
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'q' => [
                'nullable',
                'string',
                'max:100',
            ],
            'samar_id' => [
                'nullable',
                'string',
                'max:50',
            ],
        ];
    }
}
