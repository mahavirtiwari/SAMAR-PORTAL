<?php

namespace App\Http\Requests\AssessmentQuestion;

use App\Models\AssessmentQuestion;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreAssessmentQuestionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        return $user && $user->hasAnyRole(['system_admin', 'drdo_admin']);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'parameter_id' => ['required', 'integer', 'exists:assessment_parameters,id'],
            'question_text' => ['required', 'string', 'max:1000'],
            'category' => ['nullable', 'string', 'in:planning,deployment,monitoring'],
            'weightage' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->validateUniqueQuestion($validator);
            $this->validateTotalWeightage($validator);
        });
    }

    /**
     * Validate that the assessment question is unique for the parameter and category combination.
     *
     * Uniqueness rule:
     * - An Assessment Question must be unique for the combination of:
     *   - Assessment Parameter (parent parameter)
     *   - Question text (case insensitive, trimmed)
     *   - Category (planning, deployment, monitoring)
     */
    protected function validateUniqueQuestion(Validator $validator): void
    {
        $parameterId = $this->input('parameter_id');
        $questionText = trim($this->input('question_text'));
        $category = $this->input('category');

        $query = AssessmentQuestion::query()
            ->where('parameter_id', $parameterId)
            ->whereRaw('LOWER(TRIM(question_text)) = ?', [strtolower($questionText)]);

        // Handle nullable category
        if ($category === null) {
            $query->whereNull('category');
        } else {
            $query->where('category', $category);
        }

        if ($query->exists()) {
            $validator->errors()->add(
                'question_text',
                'This question already exists under the selected category for this parameter.'
            );
        }
    }

    /**
     * Validate that the total weightage for all questions in a parameter does not exceed 100%.
     */
    protected function validateTotalWeightage(Validator $validator): void
    {
        $parameterId = $this->input('parameter_id');
        $newWeightage = (int) ($this->input('weightage') ?? 0);

        if ($newWeightage <= 0) {
            return;
        }

        // Get sum of existing weightages for this parameter (active questions only)
        $existingTotal = (int) AssessmentQuestion::where('parameter_id', $parameterId)
            ->where('is_active', true)
            ->sum('weightage');

        $totalAfterAdd = $existingTotal + $newWeightage;

        if ($totalAfterAdd > 100) {
            $remaining = max(0, 100 - $existingTotal);
            $validator->errors()->add(
                'weightage',
                "Total weightage cannot exceed 100%. Current total is {$existingTotal}%, remaining available is {$remaining}%."
            );
        }
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'parameter_id.required' => 'Assessment parameter is required.',
            'parameter_id.exists' => 'Selected assessment parameter does not exist.',
            'question_text.required' => 'Question text is required.',
            'question_text.max' => 'Question text must not exceed 1000 characters.',
            'category.in' => 'Category must be planning, deployment, or monitoring.',
            'weightage.integer' => 'Weightage must be a whole number.',
            'weightage.min' => 'Weightage must be at least 1%.',
            'weightage.max' => 'Weightage cannot exceed 100%.',
        ];
    }
}
