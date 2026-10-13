<?php

namespace App\Http\Requests\ApplicationFeedback;

use App\Models\FeedbackQuestion;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreApplicationFeedbackRequest extends FormRequest
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
            'feedback_question_id' => [
                'required',
                'integer',
                'exists:feedback_questions,id',
            ],
            'rating' => [
                'nullable',
                'integer',
                'min:1',
                'max:5',
            ],
            'yes_no_answer' => [
                'nullable',
                'boolean',
            ],
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
            'feedback_question_id.required' => 'Feedback question is required.',
            'feedback_question_id.exists' => 'Selected feedback question does not exist.',
            'rating.integer' => 'Rating must be a valid number.',
            'rating.min' => 'Rating must be at least 1.',
            'rating.max' => 'Rating cannot exceed 5.',
            'remarks.max' => 'Remarks cannot exceed 2000 characters.',
        ];
    }

    /**
     * Configure the validator instance.
     *
     * @param  Validator  $validator
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($validator->errors()->has('feedback_question_id')) {
                return;
            }

            $question = FeedbackQuestion::find($this->feedback_question_id);

            if (! $question) {
                return;
            }

            // Validate answer based on question type
            if ($question->type === FeedbackQuestion::TYPE_RATING) {
                if ($this->rating === null && $this->yes_no_answer !== null) {
                    $validator->errors()->add('rating', 'Rating is required for this question type.');
                }
            } elseif ($question->type === FeedbackQuestion::TYPE_YES_NO) {
                if ($this->yes_no_answer === null && $this->rating !== null) {
                    $validator->errors()->add('yes_no_answer', 'Yes/No answer is required for this question type.');
                }
            }
        });
    }
}
