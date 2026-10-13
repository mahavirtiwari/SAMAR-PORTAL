<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DocumentListRequest extends FormRequest
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
            'mime_type' => [
                'nullable',
                'string',
            ],
            'extension' => [
                'nullable',
                'string',
            ],
            'sort_by' => [
                'nullable',
                'string',
                Rule::in(['created_at', 'size', 'original_filename']),
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
            'search.min' => 'Search term must be at least 2 characters.',
            'search.max' => 'Search term cannot exceed 100 characters.',
            'sort_by.in' => 'Sort by field must be one of: created_at, size, original_filename.',
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
            'mime_type' => 'MIME type',
            'extension' => 'file extension',
            'sort_by' => 'sort by field',
            'sort_order' => 'sort order',
            'per_page' => 'items per page',
            'page' => 'page number',
        ];
    }
}
