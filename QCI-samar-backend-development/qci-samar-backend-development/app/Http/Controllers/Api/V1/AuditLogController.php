<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

class AuditLogController extends Controller
{
    /**
     * Auth events served by the legacy /audit-logs endpoint. Deliberately scoped
     * (TASK-05247) — kept for the Authentication tab; the full trail lives on
     * /activity-logs below.
     */
    private const AUTH_EVENTS = ['login', 'password_change', 'password_reset'];

    /** Security-relevant custom events. */
    private const SECURITY_EVENTS = ['login_failed', 'account_locked', 'logout', 'role_assigned', 'role_removed'];

    /** Standard data-change events (Eloquent lifecycle). */
    private const DATA_EVENTS = ['created', 'updated', 'deleted', 'restored'];

    /**
     * Semantic Application/Assessment status-transition events, emitted at the
     * state-machine choke point (TASK-05769). These are the workflow-level
     * business actions a person deliberately takes.
     */
    private const WORKFLOW_EVENTS = [
        'application_submitted',
        'application_drdo_approved',
        'application_drdo_rejected',
        'application_payment_completed',
        'application_in_progress',
        'application_certified',
        'assessment_scheduled',
        'assessment_in_progress',
        'assessment_mobile_complete',
        'assessment_submitted_for_qc',
        'assessment_qc_approved',
        'assessment_qc_sent_back',
        'assessment_qc_feedback_addressed',
        'assessment_committee_scheduled',
        'assessment_committee_sent_back',
        'assessment_committee_feedback_addressed',
        'assessment_certified',
        'assessment_rescheduled',
    ];

    /** Human-readable labels for the effective event name. */
    private const ACTION_LABELS = [
        'login' => 'Logged in',
        'logout' => 'Logged out',
        'login_failed' => 'Failed login',
        'account_locked' => 'Account locked',
        'password_change' => 'Changed password',
        'password_reset' => 'Reset password',
        'role_assigned' => 'Role assigned',
        'role_removed' => 'Role removed',
        'created' => 'Created',
        'updated' => 'Updated',
        'deleted' => 'Deleted',
        'restored' => 'Restored',
        'application_submitted' => 'Application submitted',
        'application_drdo_approved' => 'DRDO approved application',
        'application_drdo_rejected' => 'DRDO rejected application',
        'application_payment_completed' => 'Payment completed',
        'application_in_progress' => 'Application in progress',
        'application_certified' => 'Application certified',
        'assessment_scheduled' => 'Assessment scheduled',
        'assessment_in_progress' => 'Assessment started',
        'assessment_mobile_complete' => 'Field work completed',
        'assessment_submitted_for_qc' => 'Submitted for QC',
        'assessment_qc_approved' => 'QC approved',
        'assessment_qc_sent_back' => 'QC sent back',
        'assessment_qc_feedback_addressed' => 'QC feedback addressed',
        'assessment_committee_scheduled' => 'Committee review scheduled',
        'assessment_committee_sent_back' => 'Committee sent back',
        'assessment_committee_feedback_addressed' => 'Committee feedback addressed',
        'assessment_certified' => 'Assessment certified',
        'assessment_rescheduled' => 'Assessment rescheduled',
    ];

    /**
     * List authentication audit events (System Admin only).
     */
    #[OA\Get(
        path: '/api/v1/admin/audit-logs',
        summary: 'List authentication audit events',
        description: 'Returns login, password-change and password-reset audit entries for every user, newest first. Restricted to System Admin.',
        tags: ['System Admin - Audit Log'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                required: false,
                description: 'Match against user name or email',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'event',
                in: 'query',
                required: false,
                description: 'Filter to one event type',
                schema: new OA\Schema(type: 'string', enum: ['login', 'password_change', 'password_reset']),
            ),
            new OA\Parameter(
                name: 'dateFrom',
                in: 'query',
                required: false,
                description: 'Start date (YYYY-MM-DD, IST calendar day)',
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
            new OA\Parameter(
                name: 'dateTo',
                in: 'query',
                required: false,
                description: 'End date (YYYY-MM-DD, IST calendar day)',
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
            new OA\Parameter(
                name: 'page',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'integer', minimum: 1),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Audit entries',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Audit logs retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                type: 'object',
                                properties: [
                                    new OA\Property(property: 'id', type: 'integer', example: 42),
                                    new OA\Property(
                                        property: 'user_id',
                                        type: 'integer',
                                        nullable: true,
                                        example: 7,
                                    ),
                                    new OA\Property(
                                        property: 'user_name',
                                        type: 'string',
                                        nullable: true,
                                        example: 'John Doe',
                                    ),
                                    new OA\Property(
                                        property: 'user_email',
                                        type: 'string',
                                        nullable: true,
                                        example: 'john.doe@example.com',
                                    ),
                                    new OA\Property(
                                        property: 'user_roles',
                                        type: 'array',
                                        nullable: true,
                                        example: ['assessor'],
                                        items: new OA\Items(type: 'string'),
                                    ),
                                    new OA\Property(property: 'event', type: 'string', example: 'login'),
                                    new OA\Property(
                                        property: 'ip_address',
                                        type: 'string',
                                        nullable: true,
                                        example: '203.0.113.7',
                                    ),
                                    new OA\Property(
                                        property: 'user_agent',
                                        type: 'string',
                                        nullable: true,
                                        example: 'Mozilla/5.0 ...',
                                    ),
                                    new OA\Property(
                                        property: 'device_type',
                                        type: 'string',
                                        nullable: true,
                                        example: 'web',
                                    ),
                                    new OA\Property(
                                        property: 'device_name',
                                        type: 'string',
                                        nullable: true,
                                        example: 'Chrome on Windows',
                                    ),
                                    new OA\Property(
                                        property: 'created_at',
                                        type: 'string',
                                        format: 'date-time',
                                        example: '2026-07-16T09:30:00+00:00',
                                    ),
                                ],
                            ),
                        ),
                        new OA\Property(property: 'pagination', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 400, description: 'Validation failed'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'search' => 'nullable|string|max:255',
            'event' => 'nullable|string|in:login,password_change,password_reset',
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d|after_or_equal:date_from',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        $logs = AuditLog::query()
            ->where('event', 'custom')
            ->whereIn('custom_event', self::AUTH_EVENTS)
            ->when($request->filled('event'), fn ($q) => $q->where('custom_event', $request->input('event')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = $request->input('search');
                $q->where(function ($q) use ($search) {
                    $q->where('user_name', 'like', "%{$search}%")
                        ->orWhere('user_email', 'like', "%{$search}%");
                });
            })
            // Date filters are IST calendar days (project display timezone); rows are stored UTC.
            ->when($request->filled('date_from'), fn ($q) => $q->where('created_at', '>=',
                Carbon::parse($request->input('date_from'), 'Asia/Kolkata')->startOfDay()->utc()))
            ->when($request->filled('date_to'), fn ($q) => $q->where('created_at', '<=',
                Carbon::parse($request->input('date_to'), 'Asia/Kolkata')->endOfDay()->utc()))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($this->resolvePerPage($request, 15));

        $logs->setCollection($logs->getCollection()->map(fn (AuditLog $log) => [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'user_name' => $log->user_name,
            'user_email' => $log->user_email,
            'user_roles' => $log->user_roles,
            'event' => $log->custom_event,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'device_type' => $log->metadata['device_type'] ?? null,
            'device_name' => $log->metadata['device_name'] ?? null,
            'created_at' => $log->created_at?->toIso8601String(),
        ]));

        return $this->paginatedResponse($logs, 'Audit logs retrieved successfully');
    }

    /**
     * List the full audit/activity trail — data changes, authentication, and
     * security events (System Admin only).
     */
    #[OA\Get(
        path: '/api/v1/admin/activity-logs',
        summary: 'List the full audit/activity trail',
        description: 'Returns every audit entry — data changes (created/updated/deleted), authentication, and security events — newest first. Restricted to System Admin.',
        tags: ['System Admin - Audit Log'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                required: false,
                description: 'Match against user name or email',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'category',
                in: 'query',
                required: false,
                description: 'Event category',
                schema: new OA\Schema(type: 'string', enum: ['all', 'data', 'security', 'authentication', 'workflow']),
            ),
            new OA\Parameter(
                name: 'event',
                in: 'query',
                required: false,
                description: 'Filter to one effective event name (e.g. updated, login_failed)',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'entity_type',
                in: 'query',
                required: false,
                description: 'Model short name, e.g. User, Application, Assessment',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'dateFrom',
                in: 'query',
                required: false,
                description: 'Start date (YYYY-MM-DD, IST calendar day)',
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
            new OA\Parameter(
                name: 'dateTo',
                in: 'query',
                required: false,
                description: 'End date (YYYY-MM-DD, IST calendar day)',
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
            new OA\Parameter(
                name: 'page',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'integer', minimum: 1),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Activity entries'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 400, description: 'Validation failed'),
        ],
    )]
    public function activity(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'search' => 'nullable|string|max:255',
            'category' => 'nullable|string|in:all,data,security,authentication,workflow',
            'event' => 'nullable|string|max:50',
            'entity_type' => 'nullable|string|max:100',
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d|after_or_equal:date_from',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        $logs = AuditLog::query()
            ->when($request->filled('category') && $request->input('category') !== 'all',
                fn ($q) => $this->applyCategory($q, $request->input('category')))
            ->when($request->filled('event'), function ($q) use ($request) {
                $event = $request->input('event');
                // Effective event lives in custom_event for custom rows, else in event.
                $q->where(fn ($q) => $q->where('custom_event', $event)
                    ->orWhere(fn ($q) => $q->whereNull('custom_event')->where('event', $event)));
            })
            ->when($request->filled('entity_type'), fn ($q) => $q->where('auditable_type', 'App\\Models\\'.$request->input('entity_type')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = $request->input('search');
                $q->where(function ($q) use ($search) {
                    $q->where('user_name', 'like', "%{$search}%")
                        ->orWhere('user_email', 'like', "%{$search}%");
                });
            })
            // Date filters are IST calendar days (project display timezone); rows are stored UTC.
            ->when($request->filled('date_from'), fn ($q) => $q->where('created_at', '>=',
                Carbon::parse($request->input('date_from'), 'Asia/Kolkata')->startOfDay()->utc()))
            ->when($request->filled('date_to'), fn ($q) => $q->where('created_at', '<=',
                Carbon::parse($request->input('date_to'), 'Asia/Kolkata')->endOfDay()->utc()))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($this->resolvePerPage($request, 15));

        $logs->setCollection($logs->getCollection()->map(fn (AuditLog $log) => $this->transformActivity($log)));

        return $this->paginatedResponse($logs, 'Activity logs retrieved successfully');
    }

    /**
     * Constrain the query to one event category.
     *
     * @param  Builder  $query
     * @return Builder
     */
    private function applyCategory($query, string $category)
    {
        return match ($category) {
            'data' => $query->where('event', '!=', 'custom')->whereIn('event', self::DATA_EVENTS),
            'security' => $query->where('event', 'custom')->whereIn('custom_event', self::SECURITY_EVENTS),
            'authentication' => $query->where('event', 'custom')->whereIn('custom_event', self::AUTH_EVENTS),
            'workflow' => $query->where('event', 'custom')->whereIn('custom_event', self::WORKFLOW_EVENTS),
            default => $query,
        };
    }

    /**
     * Shape one audit row for the activity feed, with a human-readable action.
     */
    private function transformActivity(AuditLog $log): array
    {
        $effectiveEvent = $log->custom_event ?? $log->event;
        $entityType = $log->auditable_type ? class_basename($log->auditable_type) : null;

        return [
            'id' => $log->id,
            'category' => $this->categoryFor($effectiveEvent),
            'event' => $effectiveEvent,
            'action' => self::ACTION_LABELS[$effectiveEvent] ?? ucfirst(str_replace('_', ' ', (string) $effectiveEvent)),
            'entity_type' => $entityType,
            'entity_id' => $log->auditable_id,
            'description' => $log->getDescription(),
            'changed_fields' => $log->changed_fields,
            'user_id' => $log->user_id,
            'user_name' => $log->user_name,
            'user_email' => $log->user_email,
            'user_roles' => $log->user_roles,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }

    private function categoryFor(?string $effectiveEvent): string
    {
        if (in_array($effectiveEvent, self::AUTH_EVENTS, true)) {
            return 'authentication';
        }

        if (in_array($effectiveEvent, self::SECURITY_EVENTS, true)) {
            return 'security';
        }

        if (in_array($effectiveEvent, self::WORKFLOW_EVENTS, true)) {
            return 'workflow';
        }

        return 'data';
    }
}
