<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Document;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UploadDocumentRequest extends FormRequest
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
            'file' => [
                'required',
                'file',
                'max:'.($maxSizeMB * 1024), // in KB for Laravel validation
                'mimes:pdf',
            ],
            'title' => [
                'nullable',
                'string',
                'max:150',
                function ($attribute, $value, $fail) {
                    if ($value) {
                        $exists = Document::whereRaw('LOWER(TRIM(title)) = ?', [strtolower(trim($value))])
                            ->whereNull('deleted_at')
                            ->exists();
                        if ($exists) {
                            $fail('A document with this title already exists.');
                        }
                    }
                },
            ],
            'name' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
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
            'file.required' => 'Please select a file to upload.',
            'file.file' => 'The uploaded file is invalid or corrupted.',
            'file.max' => "File size exceeds the maximum allowed limit of {$maxSizeMB}MB.",
            'file.mimes' => 'File type not allowed. Only PDF files are accepted.',
        ];
    }
}
