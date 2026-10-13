<?php

namespace App\Http\Requests\FeedbackQuestion;

use App\Models\FeedbackQuestion;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFeedbackQuestionRequest extends FormRequest
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
        $feedbackQuestionId = $this->route('id');

        return [
            'question_text' => [
                'sometimes',
                'required',
                'string',
                'max:500',
                Rule::unique('feedback_questions', 'question_text')->ignore($feedbackQuestionId),
            ],
            'type' => [
                'sometimes',
                'required',
                'string',
                Rule::in(FeedbackQuestion::getTypes()),
            ],
            'display_order' => [
                'sometimes',
                'integer',
                'min:0',
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
            'question_text.max' => 'Question text cannot exceed 500 characters.',
            'question_text.unique' => 'A feedback question with this text already exists.',
            'type.in' => 'Question type must be either rating or yes_no.',
            'display_order.integer' => 'Display order must be a valid number.',
            'display_order.min' => 'Display order cannot be negative.',
        ];
    }
}
