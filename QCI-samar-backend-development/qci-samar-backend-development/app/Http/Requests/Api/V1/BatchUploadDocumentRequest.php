<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BatchUploadDocumentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by controller/policy
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $maxSize = config('documents.max_file_size', 10485760); // bytes
        $maxSizeMB = $maxSize / 1048576;

        return [
            'files' => 'required|array|min:1|max:10',
            'files.*' => [
                'required',
                'file',
                'max:'.($maxSizeMB * 1024),
                'mimes:pdf',
            ],
            'titles' => 'nullable|array',
            'titles.*' => 'string|max:255',
            'names' => 'nullable|array',
            'names.*' => 'string|max:255',
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        $maxSizeMB = config('documents.max_file_size', 10485760) / 1048576;

        return [
            'files.required' => 'Please select at least one file to upload.',
            'files.array' => 'Files must be provided as an array.',
            'files.min' => 'At least one file is required.',
            'files.max' => 'Maximum 10 files can be uploaded at once.',
            'files.*.required' => 'Each file is required.',
            'files.*.file' => 'One or more uploaded files are invalid or corrupted.',
            'files.*.max' => "One or more files exceed the maximum allowed limit of {$maxSizeMB}MB.",
            'files.*.mimes' => 'One or more file types not allowed. Only PDF files are accepted.',
        ];
    }
}
