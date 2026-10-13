<?php

namespace App\Http\Requests\Discipline;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DisciplineExportRequest extends FormRequest
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
            'sector' => [
                'nullable',
                'string',
                Rule::in(['manufacturing', 'service']),
            ],
            'search' => [
                'nullable',
                'string',
                'min:2',
                'max:100',
            ],
            'is_active' => [
                'nullable',
                'in:true,false,1,0',
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
            'sector.in' => 'Sector must be one of: manufacturing, service.',
            'search.min' => 'Search term must be at least 2 characters.',
            'search.max' => 'Search term cannot exceed 100 characters.',
            'is_active.in' => 'Active status must be a boolean value (true, false, 1, or 0).',
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
            'sector' => 'sector',
            'search' => 'search term',
            'is_active' => 'active status',
        ];
    }
}
