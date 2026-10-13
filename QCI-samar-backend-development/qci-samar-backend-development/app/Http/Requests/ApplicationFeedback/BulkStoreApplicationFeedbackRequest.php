<?php

namespace App\Http\Requests\ApplicationFeedback;

use App\Models\FeedbackQuestion;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class BulkStoreApplicationFeedbackRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
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
            'feedbacks' => [
                'required',
                'array',
                'min:1',
            ],
            'feedbacks.*.feedback_question_id' => [
                'required',
                'integer',
                'exists:feedback_questions,id',
            ],
            'feedbacks.*.rating' => [
                'nullable',
                'integer',
                'min:1',
                'max:5',
            ],
            'feedbacks.*.yes_no_answer' => [
                'nullable',
                'boolean',
            ],
            'feedbacks.*.remarks' => [
                'nullable',
                'string',
                'max:2000',
            ],
            // Global remarks field (applies to all feedback)
            'remarks' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'feedbacks.required' => 'Feedbacks array is required.',
            'feedbacks.array' => 'Feedbacks must be an array.',
            'feedbacks.min' => 'At least one feedback is required.',
            'feedbacks.*.feedback_question_id.required' => 'Feedback question is required for each item.',
            'feedbacks.*.feedback_question_id.exists' => 'Selected feedback question does not exist.',
            'feedbacks.*.rating.integer' => 'Rating must be a valid number.',
            'feedbacks.*.rating.min' => 'Rating must be at least 1.',
            'feedbacks.*.rating.max' => 'Rating cannot exceed 5.',
            'feedbacks.*.remarks.max' => 'Remarks cannot exceed 2000 characters.',
        ];
    }

    /**
     * Prepare the data for validation.
     * Converts camelCase keys from frontend to snake_case for validation.
     */
    protected function prepareForValidation(): void
    {
        $feedbacks = $this->input('feedbacks', []);

        $converted = array_map(function ($item) {
            $mapped = [];
            foreach ($item as $key => $value) {
                $mapped[Str::snake($key)] = $value;
            }

            return $mapped;
        }, $feedbacks);

        $this->merge(['feedbacks' => $converted]);
    }

    /**
     * Configure the validator instance.
     *
     * @param  Validator  $validator
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $feedbacks = $this->input('feedbacks', []);

            foreach ($feedbacks as $index => $feedback) {
                $questionId = $feedback['feedback_question_id'] ?? null;

                if (! $questionId) {
                    continue;
                }

                $question = FeedbackQuestion::find($questionId);

                if (! $question) {
                    continue;
                }

                // Validate answer based on question type
                $rating = $feedback['rating'] ?? null;
                $yesNoAnswer = $feedback['yes_no_answer'] ?? null;

                if ($question->type === FeedbackQuestion::TYPE_RATING) {
                    if ($rating === null) {
                        $validator->errors()->add(
                            "feedbacks.{$index}.rating",
                            'Rating is required for this question type.'
                        );
                    }
                } elseif ($question->type === FeedbackQuestion::TYPE_YES_NO) {
                    if ($yesNoAnswer === null) {
                        $validator->errors()->add(
                            "feedbacks.{$index}.yes_no_answer",
                            'Yes/No answer is required for this question type.'
                        );
                    }
                }
            }
        });
    }
}
