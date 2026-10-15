<?php

namespace App\Http\Requests\Discipline;

use App\Models\Discipline;
use App\Rules\EntityName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDisciplineRequest extends FormRequest
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
        $disciplineId = $this->route('id');

        // Get existing discipline to determine current sector if not provided in request
        $discipline = Discipline::find($disciplineId);
        $sector = $this->input('sector') ?? ($discipline->sector ?? null);

        return [
            'name' => [
                'sometimes',
                'string',
                'max:100',
                new EntityName,
                Rule::unique('disciplines', 'name')
                    ->ignore($disciplineId)
                    ->where('sector', $sector),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'sector' => ['sometimes', 'string', 'in:manufacturing,service'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'name.max' => 'Discipline name cannot exceed 100 characters.',
            'name.unique' => 'A discipline with this name already exists in the selected sector.',
            'description.max' => 'Description cannot exceed 1000 characters.',
            'sector.in' => 'Sector must be either manufacturing or service.',
        ];
    }
}
