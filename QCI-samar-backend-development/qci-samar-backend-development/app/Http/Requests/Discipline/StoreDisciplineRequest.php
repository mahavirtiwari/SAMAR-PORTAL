<?php

namespace App\Http\Requests\Discipline;

use App\Rules\EntityName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreDisciplineRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Authorization handled in controller
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
            'name' => [
                'required',
                'string',
                'max:100',
                new EntityName,
                'unique:disciplines,name,NULL,id,sector,'.$this->input('sector'),
            ],
            'sector' => ['required', 'string', 'in:manufacturing,service'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Discipline name is required.',
            'name.max' => 'Discipline name cannot exceed 100 characters.',
            'name.unique' => 'A discipline with this name already exists in the selected sector.',
            'sector.required' => 'Sector is required.',
            'sector.in' => 'Sector must be either manufacturing or service.',
        ];
    }
}
