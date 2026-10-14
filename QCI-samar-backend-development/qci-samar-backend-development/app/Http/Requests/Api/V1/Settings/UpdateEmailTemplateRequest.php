<?php

namespace App\Http\Requests\Api\V1\Settings;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Settings → Email Templates: edits a transactional email. `body` is HTML
 * (sanitised before storage); omit it, or send null, to keep the current one.
 */
class UpdateEmailTemplateRequest extends FormRequest
{
    /** Roles the event-based recipient resolution understands. */
    public const RECIPIENT_ROLES = [
        'enterprise_admin', 'unit_admin', 'assessor', 'operations_admin',
        'operations_manager', 'drdo_admin', 'drdo_lab',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['sometimes', 'required', 'string', 'max:500'],
            'title' => ['sometimes', 'nullable', 'string', 'max:500'],
            'body' => ['sometimes', 'nullable', 'string', 'max:200000'],
            'cc' => ['sometimes', 'nullable', 'array'],
            'cc.*' => ['email'],
            'bcc' => ['sometimes', 'nullable', 'array'],
            'bcc.*' => ['email'],
            'recipient_roles' => ['sometimes', 'nullable', 'array'],
            'recipient_roles.*' => ['string', 'in:'.implode(',', self::RECIPIENT_ROLES)],
            'send_to_creator' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
