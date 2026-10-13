<?php

namespace App\Http\Requests\AssessmentQuestion;

use App\Models\AssessmentQuestion;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateAssessmentQuestionRequest extends FormRequest
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
            'question_text' => ['sometimes', 'string', 'max:1000'],
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
     *
     * For updates, we only validate if question_text or category is being changed.
     */
    protected function validateUniqueQuestion(Validator $validator): void
    {
        // Get the question being updated from the route parameter
        $questionId = $this->route('id');
        $question = AssessmentQuestion::find($questionId);

        if (! $question) {
            return;
        }

        // Determine the values to check (use existing values if not provided in request)
        $questionText = $this->has('question_text')
            ? trim($this->input('question_text'))
            : trim($question->question_text);

        $category = $this->has('category')
            ? $this->input('category')
            : $question->category;

        // Only validate if question_text or category is actually being changed
        $questionTextChanged = $this->has('question_text') &&
            strtolower(trim($this->input('question_text'))) !== strtolower(trim($question->question_text));
        $categoryChanged = $this->has('category') &&
            $this->input('category') !== $question->category;

        if (! $questionTextChanged && ! $categoryChanged) {
            return;
        }

        $query = AssessmentQuestion::query()
            ->where('parameter_id', $question->parameter_id)
            ->whereRaw('LOWER(TRIM(question_text)) = ?', [strtolower($questionText)])
            ->where('id', '!=', $questionId);

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
     *
     * For updates, we exclude the current question's weightage from the total before adding the new value.
     */
    protected function validateTotalWeightage(Validator $validator): void
    {
        // Only validate if weightage is being updated
        if (! $this->has('weightage')) {
            return;
        }

        $questionId = $this->route('id');
        $question = AssessmentQuestion::find($questionId);

        if (! $question) {
            return;
        }

        $newWeightage = (int) ($this->input('weightage') ?? 0);

        if ($newWeightage <= 0) {
            return;
        }

        // Get sum of existing weightages for this parameter, excluding the current question (active questions only)
        $existingTotal = (int) AssessmentQuestion::where('parameter_id', $question->parameter_id)
            ->where('is_active', true)
            ->where('id', '!=', $questionId)
            ->sum('weightage');

        $totalAfterUpdate = $existingTotal + $newWeightage;

        if ($totalAfterUpdate > 100) {
            $remaining = max(0, 100 - $existingTotal);
            $validator->errors()->add(
                'weightage',
                "Total weightage cannot exceed 100%. Other questions total {$existingTotal}%, maximum allowed for this question is {$remaining}%."
            );
        }
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'question_text.max' => 'Question text must not exceed 1000 characters.',
            'category.in' => 'Category must be planning, deployment, or monitoring.',
            'weightage.integer' => 'Weightage must be a whole number.',
            'weightage.min' => 'Weightage must be at least 1%.',
            'weightage.max' => 'Weightage cannot exceed 100%.',
        ];
    }
}
