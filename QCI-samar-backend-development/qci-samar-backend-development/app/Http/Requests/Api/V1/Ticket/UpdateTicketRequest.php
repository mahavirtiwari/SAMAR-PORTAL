<?php

namespace App\Http\Requests\Api\V1\Ticket;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTicketRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Only admin users can update tickets
        $user = $this->user();

        return $user && $user->hasAnyRole(['system_admin', 'operations_manager', 'operations_admin']);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'string', 'in:open,in_progress,pending_customer,pending_internal,resolved,closed'],
            'priority' => ['sometimes', 'string', 'in:low,medium,high,urgent'],
            'assigned_to_email' => ['nullable', 'email', 'exists:users,email'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'status.in' => 'Status must be one of: open, in_progress, pending_customer, pending_internal, resolved, closed.',
            'priority.in' => 'Priority must be one of: low, medium, high, urgent.',
            'assigned_to_email.email' => 'Please provide a valid email address for assignment.',
            'assigned_to_email.exists' => 'The specified user does not exist in the system.',
        ];
    }

    /**
     * Get custom attribute names for validation errors.
     */
    public function attributes(): array
    {
        return [
            'assigned_to_email' => 'assignee email',
        ];
    }
}
