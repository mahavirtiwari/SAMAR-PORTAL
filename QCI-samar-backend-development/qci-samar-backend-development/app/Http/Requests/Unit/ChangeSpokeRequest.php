<?php

namespace App\Http\Requests\Unit;

use App\Rules\PersonName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ChangeSpokeRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Role gate (enterprise_admin) is on the route; org-scoping is enforced in the controller.
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
            'email' => ['required', 'email', 'max:320'],
            'name' => ['nullable', 'string', 'max:100', new PersonName],
            'designation' => ['nullable', 'string', 'max:100'],
            'mobile' => ['nullable', 'string', 'regex:/^[0-9]{10}$/'],
        ];
    }
}
