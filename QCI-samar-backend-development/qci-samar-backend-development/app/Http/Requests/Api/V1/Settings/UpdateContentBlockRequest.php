<?php

namespace App\Http\Requests\Api\V1\Settings;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Settings → Content & Disclaimers: edits an instruction, declaration or
 * disclaimer. HTML blocks are sanitised before storage.
 */
class UpdateContentBlockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:200000'],
        ];
    }
}
