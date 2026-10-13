<?php

namespace App\Http\Requests\AssessmentParameter;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BulkUpdateAssessmentParameterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Authorization handled by route middleware.
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
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
            'sector' => ['required', 'string', 'in:manufacturing,service'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Please upload a file.',
            'file.file' => 'The uploaded file is invalid.',
            'file.mimes' => 'The file must be an Excel (.xlsx, .xls) or CSV (.csv) file.',
            'file.max' => 'The file size must not exceed 5MB.',
            'sector.required' => 'Sector is required.',
            'sector.in' => 'Sector must be either manufacturing or service.',
        ];
    }
}
