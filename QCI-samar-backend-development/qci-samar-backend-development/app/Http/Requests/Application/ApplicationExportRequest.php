<?php

namespace App\Http\Requests\Application;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ApplicationExportRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'search' => [
                'nullable',
                'string',
                'min:2',
                'max:100',
            ],
            'status' => [
                'nullable',
                'string',
                Rule::in(['draft', 'drdo_approval_pending', 'payment_pending', 'payment_completed', 'in_progress', 'certified', 'rejected']),
            ],
            'sector' => [
                'nullable',
                'string',
                Rule::in(['manufacturing', 'service']),
            ],
            'type' => [
                'nullable',
                'string',
                Rule::in(['new', 'renewal']),
            ],
            'enterprise_classification' => [
                'nullable',
                'string',
            ],
            'exclude_status' => [
                'nullable',
                'string',
            ],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'search.min' => 'Search term must be at least 2 characters.',
            'search.max' => 'Search term cannot exceed 100 characters.',
            'status.in' => 'Status must be one of: draft, drdo_approval_pending, payment_pending, payment_completed, in_progress, certified, rejected.',
            'sector.in' => 'Sector must be one of: manufacturing, service.',
            'type.in' => 'Application type must be one of: new, renewal.',
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'search' => 'search term',
            'status' => 'status',
            'sector' => 'sector',
            'type' => 'application type',
        ];
    }
}
