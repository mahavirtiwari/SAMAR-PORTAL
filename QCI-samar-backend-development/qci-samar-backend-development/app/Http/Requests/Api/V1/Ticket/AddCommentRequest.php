<?php

namespace App\Http\Requests\Api\V1\Ticket;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AddCommentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Authorization is handled in the controller (owner or admin)
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
            'comment_text' => ['required', 'string', 'min:1', 'max:5000'],
            'is_internal' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'comment_text.required' => 'Comment text is required.',
            'comment_text.min' => 'Comment cannot be empty.',
            'comment_text.max' => 'Comment cannot exceed 5000 characters.',
            'is_internal.boolean' => 'Internal flag must be true or false.',
        ];
    }

    /**
     * Get custom attribute names for validation errors.
     */
    public function attributes(): array
    {
        return [
            'comment_text' => 'comment',
        ];
    }
}
