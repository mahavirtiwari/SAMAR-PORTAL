<?php

namespace App\Http\Requests\Api\V1;

use App\Rules\PersonName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateApplicationContactPersonRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by controller/policy
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation()
    {
        $input = $this->all();
        $transformedInput = $this->transformKeys($input);

        $this->replace($transformedInput);
    }

    /**
     * Transform camelCase keys to snake_case recursively and handle form data.
     */
    private function transformKeys(array $data): array
    {
        $transformed = [];

        foreach ($data as $key => $value) {
            $snakeKey = $this->camelToSnake($key);

            if (is_array($value)) {
                $transformed[$snakeKey] = $this->transformKeys($value);
            } else {
                // normalize string values by trimming whitespace
                if (is_string($value)) {
                    $trimmedValue = trim($value);
                } else {
                    $trimmedValue = $value;
                }

                $transformed[$snakeKey] = $trimmedValue;
            }
        }

        return $transformed;
    }

    /**
     * Convert camelCase string to snake_case.
     */
    private function camelToSnake(string $input): string
    {
        return strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', $input));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'contact_person_name' => ['nullable', 'string', 'max:255', new PersonName],
            'contact_person_designation' => 'nullable|string|max:255',
            'contact_person_mobile' => 'nullable|string|max:10|regex:/^[0-9]{10}$/',
            'contact_person_email' => 'nullable|email|max:320',
        ];
    }

    /**
     * Get custom validation messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'contact_person_mobile.regex' => 'The contact person mobile must be exactly 10 digits.',
            'contact_person_mobile.max' => 'The contact person mobile must not exceed 10 characters.',
            'contact_person_email.email' => 'The contact person email must be a valid email address.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            // At least one contact person field must be provided
            $fields = [
                'contact_person_name',
                'contact_person_designation',
                'contact_person_mobile',
                'contact_person_email',
            ];

            $hasAtLeastOneField = false;
            foreach ($fields as $field) {
                if (! empty($this->input($field))) {
                    $hasAtLeastOneField = true;
                    break;
                }
            }

            if (! $hasAtLeastOneField) {
                $validator->errors()->add(
                    'contact_person',
                    'At least one contact person field must be provided.'
                );
            }
        });
    }
}
