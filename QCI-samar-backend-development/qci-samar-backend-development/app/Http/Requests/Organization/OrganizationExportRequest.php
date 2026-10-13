<?php

namespace App\Http\Requests\Organization;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OrganizationExportRequest extends FormRequest
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
                Rule::in(['active', 'inactive', 'pending_details']),
            ],
            'is_verified' => [
                'nullable',
                'in:true,false,1,0',
            ],
            'is_profile_completed' => [
                'nullable',
                'in:true,false,1,0',
            ],
            'certification_status' => [
                'nullable',
                'string',
                Rule::in(['certified', 'expired', 'never_certified', 'suspended', 'revoked']),
            ],
            'state' => [
                'nullable',
                'string',
                'max:100',
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
            'status.in' => 'Status must be one of: active, inactive, pending_details.',
            'is_verified.in' => 'Verification status must be a boolean value (true, false, 1, or 0).',
            'is_profile_completed.in' => 'Profile completion status must be a boolean value (true, false, 1, or 0).',
            'certification_status.in' => 'Certification status must be one of: certified, expired, never_certified, suspended, revoked.',
            'state.max' => 'State name cannot exceed 100 characters.',
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
            'is_verified' => 'verification status',
            'is_profile_completed' => 'profile completion status',
            'certification_status' => 'certification status',
            'state' => 'state',
        ];
    }
}
