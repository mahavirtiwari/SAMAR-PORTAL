<?php

namespace App\Http\Requests\Organization;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OrganizationListRequest extends FormRequest
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
            'sort_by' => [
                'nullable',
                'string',
                Rule::in(['name', 'created_at', 'updated_at', 'latest_application_date']),
            ],
            'sort_order' => [
                'nullable',
                'string',
                Rule::in(['asc', 'desc']),
            ],
            'per_page' => [
                'nullable',
                'integer',
                'min:5',
                'max:100',
            ],
            'page' => [
                'nullable',
                'integer',
                'min:1',
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
            'sort_by.in' => 'Sort by field must be one of: name, created_at, updated_at, latest_application_date.',
            'sort_order.in' => 'Sort order must be either asc or desc.',
            'per_page.integer' => 'Items per page must be an integer.',
            'per_page.min' => 'Items per page must be at least 5.',
            'per_page.max' => 'Items per page cannot exceed 100.',
            'page.integer' => 'Page number must be an integer.',
            'page.min' => 'Page number must be at least 1.',
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
            'sort_by' => 'sort by field',
            'sort_order' => 'sort order',
            'per_page' => 'items per page',
            'page' => 'page number',
        ];
    }
}
