<?php

namespace App\Http\Requests\AssessmentParameter;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssessmentParameterExportRequest extends FormRequest
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
            ],
            'is_active' => [
                'nullable',
                'in:true,false,1,0',
            ],
            'discipline_id' => [
                'nullable',
                'integer',
                'exists:disciplines,id',
            ],
            'enterprise_size' => [
                'nullable',
                'string',
                Rule::in(['startup', 'micro', 'small', 'medium', 'large']),
            ],
            'is_mandatory' => [
                'nullable',
                'in:true,false,1,0',
            ],
            'vendor_category_id' => [
                'nullable',
                'integer',
            ],
            'service_provider_type' => [
                'nullable',
                'string',
                Rule::in(['annual_maintenance_contract', 'critical_service_provider']),
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
            'is_active.in' => 'Active status must be a boolean value (true, false, 1, or 0).',
            'discipline_id.exists' => 'The selected discipline does not exist.',
            'enterprise_size.in' => 'Enterprise size must be one of: startup, micro, small, medium, large.',
            'is_mandatory.in' => 'Mandatory status must be a boolean value (true, false, 1, or 0).',
            'vendor_category_id.integer' => 'DRDO vendor category ID must be an integer.',
            'service_provider_type.in' => 'Service provider type must be one of: annual_maintenance_contract, critical_service_provider.',
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
            'discipline_id' => 'discipline',
            'enterprise_size' => 'enterprise size',
            'is_mandatory' => 'mandatory status',
            'vendor_category_id' => 'DRDO vendor category',
            'service_provider_type' => 'service provider type',
        ];
    }
}
