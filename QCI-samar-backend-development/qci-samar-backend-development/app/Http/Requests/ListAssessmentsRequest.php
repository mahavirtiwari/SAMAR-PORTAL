<?php

namespace App\Http\Requests;

use App\Models\Assessment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ListAssessmentsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization is handled by the Gate in the controller
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Search
            'search' => 'nullable|string|max:255',

            // Status filter — accepts a single status or a comma-separated list
            // (e.g. "in_progress,mobile_complete" for the lead's in-progress tab).
            'status' => [
                'nullable',
                'string',
                function ($attribute, $value, $fail) {
                    $allowed = [
                        Assessment::STATUS_ALLOCATION_PENDING,
                        Assessment::STATUS_SCHEDULED,
                        Assessment::STATUS_IN_PROGRESS,
                        Assessment::STATUS_MOBILE_COMPLETE,
                        Assessment::STATUS_SUBMITTED_FOR_QC,
                        Assessment::STATUS_QC_FEEDBACK,
                        Assessment::STATUS_READY_FOR_COMMITTEE,
                        Assessment::STATUS_COMMITTEE_REVIEW,
                        Assessment::STATUS_COMMITTEE_FEEDBACK,
                        Assessment::STATUS_CERTIFIED,
                    ];
                    foreach (array_filter(array_map('trim', explode(',', $value))) as $status) {
                        if (! in_array($status, $allowed, true)) {
                            $fail("The selected {$attribute} is invalid: {$status}.");
                        }
                    }
                },
            ],

            // Enterprise filters (from application relationship)
            'enterprise_size' => 'nullable|string|in:startup,micro,small,medium,large',
            'vendor_category' => 'nullable|string|max:255',
            'sector' => 'nullable|string|in:manufacturing,service',
            'type' => 'nullable|string|in:new,renewal',

            // Assessor filter (from teamMembers relationship - matches both lead and co-assessor)
            // Supports both camelCase (assessorId) and snake_case (assessor_id)
            'assessorId' => 'nullable|integer|exists:users,id',
            'assessor_id' => 'nullable|integer|exists:users,id',

            // Lead and co-assessor are filtered separately so setting both narrows to
            // assessments carrying that exact pairing.
            'leadAssessorId' => 'nullable|integer|exists:users,id',
            'lead_assessor_id' => 'nullable|integer|exists:users,id',
            'coAssessorId' => 'nullable|integer|exists:users,id',
            'co_assessor_id' => 'nullable|integer|exists:users,id',

            // Date range filters (support both camelCase and snake_case)
            'startDate' => 'nullable|date_format:Y-m-d',
            'start_date' => 'nullable|date_format:Y-m-d',
            'endDate' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d',
            'dateType' => 'nullable|string|in:scheduled_start,actual_start,review,certified',
            'date_type' => 'nullable|string|in:scheduled_start,actual_start,review,certified',

            // Certification level filter
            'certification_level' => 'nullable|string',

            // Pagination (support both camelCase and snake_case)
            'perPage' => 'nullable|integer|min:1|max:100',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',

            // Existing filters (maintain backward compatibility)
            'application_id' => 'nullable|integer|exists:applications,id',

            // Mobile sync-down: drop assessments the requesting assessor has cut over on
            'exclude_mobile_completed' => 'nullable|boolean',
        ];
    }

    /**
     * Get custom attribute names for validator errors.
     */
    public function attributes(): array
    {
        return [
            'search' => 'search query',
            'status' => 'assessment status',
            'enterprise_size' => 'enterprise size',
            'vendor_category' => 'vendor category',
            'sector' => 'sector',
            'type' => 'application type',
            'assessor_id' => 'assessor',
            'lead_assessor_id' => 'lead assessor',
            'co_assessor_id' => 'co-assessor',
            'start_date' => 'start date',
            'end_date' => 'end date',
            'date_type' => 'date filter type',
            'certification_level' => 'certification level',
            'per_page' => 'items per page',
            'page' => 'page number',
            'application_id' => 'application ID',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'status.in' => 'The status must be one of: allocation_pending, scheduled, in_progress, submitted_for_qc, qc_feedback, ready_for_committee, committee_review, committee_feedback, certified.',
            'enterprise_size.in' => 'The enterprise size must be one of: startup, micro, small, medium, large.',
            'sector.in' => 'The sector must be either manufacturing or service.',
            'date_type.in' => 'The date type must be one of: scheduled_start, actual_start, review, certified.',
            'end_date.after_or_equal' => 'The end date must be on or after the start date.',
            'per_page.max' => 'Maximum items per page is 100.',
            'assessor_id.exists' => 'The selected assessor does not exist.',
            'lead_assessor_id.exists' => 'The selected lead assessor does not exist.',
            'co_assessor_id.exists' => 'The selected co-assessor does not exist.',
        ];
    }
}
