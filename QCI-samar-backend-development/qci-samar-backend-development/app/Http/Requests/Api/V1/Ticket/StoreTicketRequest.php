<?php

namespace App\Http\Requests\Api\V1\Ticket;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreTicketRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // All authenticated users can create tickets
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Per SAMAR-ZOHODESK documentation, NDIE Department requires:
     * - subject, description (ticket core fields)
     * - user_role, issue_category, issue_type, issue_sub_category (mandatory custom fields)
     * - udyam_number (optional custom field)
     *
     * Note: organisation_name and organisation_id are auto-populated from the
     * authenticated user's organization for proper segregation.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Ticket core fields
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'priority' => ['sometimes', 'string', 'in:low,medium,high,urgent'],

            // NDIE Department mandatory custom fields
            'user_role' => ['required', 'string', 'max:100'],
            'issue_category' => ['required', 'string', 'max:100'],
            'issue_type' => ['required', 'string', 'max:100'],
            'issue_sub_category' => ['required', 'string', 'max:100'],

            // NDIE Department optional custom fields
            // Note: organisation_name is auto-populated from user's organization
            'udyam_number' => ['nullable', 'string', 'max:50'],

            // File attachments (optional)
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => [
                'file',
                'max:10240', // 10MB in kilobytes
                'mimes:pdf,jpeg,jpg,png,gif,doc,docx,txt',
            ],
        ];
    }

    /**
     * Prepare the data for validation.
     * Convert camelCase to snake_case for custom fields in case middleware didn't catch them.
     */
    protected function prepareForValidation(): void
    {
        $data = [];

        if ($this->has('issueType')) {
            $data['issue_type'] = $this->input('issueType');
        }
        if ($this->has('userRole')) {
            $data['user_role'] = $this->input('userRole');
        }
        if ($this->has('issueCategory')) {
            $data['issue_category'] = $this->input('issueCategory');
        }
        if ($this->has('issueSubCategory')) {
            $data['issue_sub_category'] = $this->input('issueSubCategory');
        }
        if ($this->has('udyamNumber')) {
            $data['udyam_number'] = $this->input('udyamNumber');
        }

        if (! empty($data)) {
            $this->merge($data);
        }
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'subject.required' => 'Ticket subject is required.',
            'subject.max' => 'Subject cannot exceed 255 characters.',
            'description.required' => 'Ticket description is required.',
            'priority.in' => 'Priority must be one of: low, medium, high, urgent.',
            'user_role.required' => 'User role is required.',
            'user_role.max' => 'User role cannot exceed 100 characters.',
            'issue_category.required' => 'Issue category is required.',
            'issue_category.max' => 'Issue category cannot exceed 100 characters.',
            'issue_type.required' => 'Issue type is required.',
            'issue_type.max' => 'Issue type cannot exceed 100 characters.',
            'issue_sub_category.required' => 'Issue sub-category is required.',
            'issue_sub_category.max' => 'Issue sub-category cannot exceed 100 characters.',
            'udyam_number.max' => 'Udyam number cannot exceed 50 characters.',
            'attachments.max' => 'You can upload a maximum of 5 files.',
            'attachments.*.file' => 'Each attachment must be a valid file.',
            'attachments.*.max' => 'Each file must not exceed 10MB.',
            'attachments.*.mimes' => 'File must be of type: pdf, jpeg, jpg, png, gif, doc, docx, or txt.',
        ];
    }

    /**
     * Get custom attribute names for validation errors.
     */
    public function attributes(): array
    {
        return [
            'subject' => 'ticket subject',
            'description' => 'ticket description',
            'user_role' => 'user role',
            'issue_category' => 'issue category',
            'issue_type' => 'issue type',
            'issue_sub_category' => 'issue sub-category',
            'udyam_number' => 'Udyam number',
            'attachments' => 'file attachments',
        ];
    }
}
