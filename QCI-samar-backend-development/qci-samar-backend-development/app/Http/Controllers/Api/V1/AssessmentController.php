<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ListAssessmentsRequest;
use App\Models\Application;
use App\Models\ApplicationAssessmentQuestion;
use App\Models\ApplicationAssessmentQuestionFeedback;
use App\Models\ApplicationAssessmentResponse;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\CommitteeMeeting;
use App\Models\CommitteeMeetingAssessment;
use App\Models\Role;
use App\Models\User;
use App\Services\Email\EmailNotificationService;
use App\Services\MeetingSummarySheetService;
use App\Services\StateFilterService;
use App\Support\Csv;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[OA\Tag(name: 'Assessments', description: 'Assessment management endpoints')]
class AssessmentController extends Controller
{
    /**
     * Constructor to inject services.
     */
    public function __construct(
        private StateFilterService $stateFilterService
    ) {}

    /**
     * Get all assessments with filtering.
     */
    #[OA\Get(
        path: '/api/v1/assessments',
        summary: 'List all assessments',
        description: 'Retrieves a paginated list of assessments with comprehensive filtering. Results are automatically filtered based on user role (Lead Assessor, Assessor, Enterprise Admin, Unit Admin).',
        tags: [
            'Assessment',
            'System Admin - Assessment',
            'DRDO Admin - Assessment',
            'Operations Manager - Assessment',
            'Operations Admin - Assessment',
            'Assessor - Assessment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by application number or enterprise name',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'status',
                in: 'query',
                description: 'Filter by assessment status',
                schema: new OA\Schema(
                    type: 'string',
                    enum: [
                        'allocation_pending',
                        'scheduled',
                        'in_progress',
                        'mobile_complete',
                        'submitted_for_qc',
                        'qc_feedback',
                        'ready_for_committee',
                        'committee_review',
                        'committee_feedback',
                        'certified',
                    ],
                ),
            ),
            new OA\Parameter(
                name: 'enterprise_size',
                in: 'query',
                description: 'Filter by enterprise size',
                schema: new OA\Schema(type: 'string', enum: ['startup', 'micro', 'small', 'medium', 'large']),
            ),
            new OA\Parameter(
                name: 'vendor_category',
                in: 'query',
                description: 'Filter by vendor category',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'sector',
                in: 'query',
                description: 'Filter by sector',
                schema: new OA\Schema(type: 'string', enum: ['manufacturing', 'service']),
            ),
            new OA\Parameter(
                name: 'type',
                in: 'query',
                description: 'Filter by application type (Fresh = new / Renewal = renewal)',
                schema: new OA\Schema(type: 'string', enum: ['new', 'renewal']),
            ),
            new OA\Parameter(
                name: 'assessor_id',
                in: 'query',
                description: 'Filter by assessor ID (matches both lead and co-assessor roles)',
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'start_date',
                in: 'query',
                description: 'Start date for date range filter',
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
            new OA\Parameter(
                name: 'end_date',
                in: 'query',
                description: 'End date for date range filter',
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
            new OA\Parameter(
                name: 'date_type',
                in: 'query',
                description: 'Type of date to filter on (scheduled_start, actual_start, review, certified)',
                schema: new OA\Schema(type: 'string', enum: ['scheduled_start', 'actual_start', 'review', 'certified']),
            ),
            new OA\Parameter(
                name: 'certification_level',
                in: 'query',
                description: 'Filter by certification level/grade (for certified assessments)',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'application_id',
                in: 'query',
                description: 'Filter by application ID',
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'has_incomplete_steps',
                in: 'query',
                description: 'Filter assessments with at least one incomplete step',
                schema: new OA\Schema(type: 'boolean', default: false),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Items per page (max 100)',
                schema: new OA\Schema(type: 'integer', default: 15),
            ),
            new OA\Parameter(
                name: 'page',
                in: 'query',
                description: 'Page number',
                schema: new OA\Schema(type: 'integer', default: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assessments retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'assessments',
                                    type: 'array',
                                    items: new OA\Items(type: 'object'),
                                ),
                                new OA\Property(
                                    property: 'pagination',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'total', type: 'integer'),
                                        new OA\Property(property: 'per_page', type: 'integer'),
                                        new OA\Property(property: 'current_page', type: 'integer'),
                                        new OA\Property(property: 'last_page', type: 'integer'),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to view assessments'),
            new OA\Response(response: 422, description: 'Validation error'),
        ],
    )]
    public function index(ListAssessmentsRequest $request): JsonResponse
    {
        Gate::authorize('viewAny', Assessment::class);

        $user = $request->user();

        $query = $this->buildListQuery($request, $user)
            ->with(['application.organization', 'application.unit', 'application.certificate', 'teamMembers.user.assessorDomains', 'teamMembers.latestAttendance']);

        // Pagination
        $perPage = $this->resolvePerPage($request, 15);
        $assessments = $query->latest()->paginate($perPage);

        return $this->paginatedResponse(
            $assessments->setCollection(
                $assessments->getCollection()->map(fn ($assessment) => $this->formatAssessment($assessment))
            ),
            'Assessments retrieved successfully'
        );
    }

    /**
     * Export assessments to CSV.
     */
    #[OA\Get(
        path: '/api/v1/assessments/export',
        summary: 'Export assessments',
        description: 'Exports assessments to CSV using the same filters as the assessment list, so the file matches what the screen shows. Omit status to export every stage the caller may see. Results are automatically filtered based on user role.',
        tags: [
            'Assessment',
            'System Admin - Assessment',
            'DRDO Admin - Assessment',
            'Operations Manager - Assessment',
            'Operations Admin - Assessment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by application number or organization name',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'status',
                in: 'query',
                description: 'Assessment status, or a comma-separated list of them. Omit to export every stage.',
                schema: new OA\Schema(type: 'string', example: 'certified'),
            ),
            new OA\Parameter(
                name: 'enterprise_size',
                in: 'query',
                description: 'Filter by enterprise classification',
                schema: new OA\Schema(type: 'string', enum: ['startup', 'micro', 'small', 'medium', 'large']),
            ),
            new OA\Parameter(
                name: 'vendor_category',
                in: 'query',
                description: 'Filter by vendor category name',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'sector',
                in: 'query',
                description: 'Filter by sector',
                schema: new OA\Schema(type: 'string', enum: ['manufacturing', 'service']),
            ),
            new OA\Parameter(
                name: 'type',
                in: 'query',
                description: 'Filter by application type',
                schema: new OA\Schema(type: 'string', enum: ['new', 'renewal']),
            ),
            new OA\Parameter(
                name: 'assessor_id',
                in: 'query',
                description: 'Filter by assessor on the assessment team',
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'start_date',
                in: 'query',
                description: 'Start of the date range, interpreted per date_type',
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
            new OA\Parameter(
                name: 'end_date',
                in: 'query',
                description: 'End of the date range, interpreted per date_type',
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
            new OA\Parameter(
                name: 'date_type',
                in: 'query',
                description: 'Which date the range applies to',
                schema: new OA\Schema(type: 'string', enum: ['scheduled_start', 'actual_start', 'review', 'certified']),
            ),
            new OA\Parameter(
                name: 'certification_level',
                in: 'query',
                description: 'Filter by certificate grade',
                schema: new OA\Schema(type: 'string'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'CSV file download',
                content: [
                    new OA\MediaType(
                        mediaType: 'text/csv',
                        schema: new OA\Schema(type: 'string', format: 'binary'),
                    ),
                ],
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to export assessments'),
            new OA\Response(
                response: 500,
                description: 'Export failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to export assessments.',
                        ),
                    ],
                ),
            ),
        ],
    )]
    public function export(ListAssessmentsRequest $request): StreamedResponse|JsonResponse
    {
        Gate::authorize('viewAny', Assessment::class);

        try {
            // Same query the list screen runs, so the CSV holds exactly the rows on screen.
            $query = $this->buildListQuery($request, $request->user())
                ->with(['application.organization', 'application.unit', 'application.certificate', 'teamMembers.user']);

            // Generate CSV using chunking for memory efficiency
            $filename = 'assessments_export_'.now()->format('Y-m-d_His').'.csv';

            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ];

            // Store query for use in callback (clone to preserve original)
            $exportQuery = clone $query;

            $callback = function () use ($exportQuery) {
                $file = fopen('php://output', 'w');

                // Add BOM for UTF-8 Excel compatibility
                fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

                // CSV Headers
                fputcsv($file, [
                    'Application Number',
                    'Status',
                    'Sector',
                    'Enterprise Classification',
                    'Organization Name',
                    'Unit Name',
                    'Unit Address',
                    'Vendor Category',
                    'Lead Assessor',
                    'Scheduled Start Date',
                    'Scheduled End Date',
                    'Certification Date',
                    'Total Score',
                    'Certificate Level',
                    'Certificate Number',
                    'Certificate Grade',
                    'Certificate Valid Until',
                ]);

                // Use chunking to process large datasets efficiently (500 records at a time)
                $exportQuery->chunkById(500, function ($assessments) use ($file) {
                    foreach ($assessments as $assessment) {
                        $application = $assessment->application;
                        $certificate = $application?->certificate;

                        Csv::putRow($file, [
                            $application?->application_number ?? '',
                            $assessment->status ?? '',
                            $application?->sector ?? '',
                            $application?->enterprise_classification ?? '',
                            $application?->organization?->name ?? '',
                            $application?->unit_name ?? '',
                            $application?->unit_address ?? '',
                            $application?->vendor_category ?? '',
                            // Read from the eager-loaded collection; getLeadAssessor() would
                            // re-query per row.
                            $assessment->teamMembers->firstWhere('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)?->user?->full_name ?? '',
                            $assessment->scheduled_start_date?->toDateString() ?? '',
                            $assessment->scheduled_end_date?->toDateString() ?? '',
                            $assessment->completed_at?->toDateString() ?? '',
                            $assessment->total_score ?? '',
                            Assessment::ratingLabelFromScore($assessment->total_score, 'N/A'),
                            $certificate?->certificate_number ?? '',
                            $certificate?->grade ?? '',
                            $certificate?->valid_until?->toDateString() ?? '',
                        ]);
                    }
                });

                fclose($file);
            };

            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            Log::error('Failed to export assessments', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to export assessments.', 500);
        }
    }

    /**
     * Get a single assessment.
     */
    #[OA\Get(
        path: '/api/v1/assessments/{id}',
        summary: 'Get assessment details',
        description: 'Retrieves detailed information about a specific assessment including application, assessors, and scorecards.',
        tags: [
            'Assessment',
            'System Admin - Assessment',
            'DRDO Admin - Assessment',
            'Operations Manager - Assessment',
            'Operations Admin - Assessment',
            'Assessor - Assessment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assessment details retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'assessment', type: 'object'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to view this assessment'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('view', $assessment);

        $assessment->load([
            'application.organization',
            'application.unit',
            'application.certificate',
            'teamMembers.user.assessorDomains',
            'responses.question',
            'parameters',
            'questions',
        ]);

        return $this->successResponse(
            ['assessment' => $this->formatAssessment($assessment, true)],
            'Assessment retrieved successfully'
        );
    }

    /**
     * Allocate assessors to an assessment.
     */
    #[OA\Post(
        path: '/api/v1/assessments/{id}/schedule',
        summary: 'Allocate or update assessors for assessment',
        description: 'Assigns or updates lead assessor and team assessors for an assessment. Can be used for initial allocation (allocation_pending status) or to update existing allocation (scheduled status). Requires QCI Admin role.',
        tags: [
            'Assessment',
            'System Admin - Assessment',
            'DRDO Admin - Assessment',
            'Operations Manager - Assessment',
            'Operations Admin - Assessment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['lead_assessor_id', 'scheduled_start_date', 'scheduled_end_date'],
                properties: [
                    new OA\Property(
                        property: 'lead_assessor_id',
                        type: 'integer',
                        example: 5,
                        description: 'User ID with Lead Assessor role',
                    ),
                    new OA\Property(
                        property: 'team_assessor_ids',
                        type: 'array',
                        example: [6, 7],
                        description: 'Array of user IDs with Assessor role',
                        items: new OA\Items(type: 'integer'),
                    ),
                    new OA\Property(
                        property: 'scheduled_start_date',
                        type: 'string',
                        format: 'date',
                        example: '2024-02-15',
                        description: 'Assessment scheduled start date (must be today or later)',
                    ),
                    new OA\Property(
                        property: 'scheduled_end_date',
                        type: 'string',
                        format: 'date',
                        example: '2024-02-20',
                        description: 'Assessment scheduled end date (must be after start date)',
                    ),
                    new OA\Property(
                        property: 'meeting_link',
                        type: 'string',
                        format: 'uri',
                        example: 'https://meet.google.com/abc-defg-hij',
                        description: 'Online meeting link shown to operations manager, assessors and applicant users (service-sector assessments)',
                    ),
                    new OA\Property(
                        property: 'remarks',
                        type: 'string',
                        example: 'Allocated based on expertise in ISO 9001',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assessment allocated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Assessment allocated successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'assessment', type: 'object'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - assessment status invalid, user not assessor, or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Assessment must be in allocation_pending or scheduled status.',
                        ),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to allocate assessments'),
            new OA\Response(response: 404, description: 'Assessment not found'),
            new OA\Response(response: 500, description: 'Failed to allocate assessment'),
        ],
    )]
    public function allocate(Request $request, int $id): JsonResponse
    {
        Gate::authorize('allocate', Assessment::class);

        $assessment = Assessment::findOrFail($id);

        // Allow allocation for both allocation_pending (initial) and scheduled (update) statuses
        if (! in_array($assessment->status, [Assessment::STATUS_ALLOCATION_PENDING, Assessment::STATUS_SCHEDULED])) {
            return $this->errorResponse('Assessment must be in allocation_pending or scheduled status.', 400);
        }

        // Prevent reassignment once any assessment work has begun
        // Note: 'in_progress' and 'completed' here refer to STEP_STATUS_*, not assessment status
        $stepProgress = $assessment->step_progress ?? [];
        $hasStartedWork = collect($stepProgress)->contains(fn ($status) => in_array($status, [Assessment::STEP_STATUS_IN_PROGRESS, Assessment::STEP_STATUS_COMPLETED]));
        if ($hasStartedWork) {
            return $this->errorResponse('Cannot reassign assessors after assessment work has begun.', 422);
        }

        $validator = Validator::make($request->all(), [
            'lead_assessor_id' => 'required|exists:users,id',
            'team_assessor_ids' => 'nullable|array',
            'team_assessor_ids.*' => 'exists:users,id',
            'scheduled_start_date' => 'required|date_format:Y-m-d|after_or_equal:today',
            'scheduled_end_date' => 'required|date_format:Y-m-d|after_or_equal:scheduled_start_date',
            // Service-sector assessments are conducted online, so the meeting link
            // is mandatory there; manufacturing has no meeting and omits it.
            'meeting_link' => [$assessment->isServiceSector() ? 'required' : 'nullable', 'url', 'max:2048'],
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // Collect all user IDs that need to be validated as assessors
        $allAssessorIds = [$request->lead_assessor_id];
        if ($request->has('team_assessor_ids') && is_array($request->team_assessor_ids)) {
            $allAssessorIds = array_merge($allAssessorIds, $request->team_assessor_ids);
        }
        $allAssessorIds = array_unique($allAssessorIds);

        // Single query to get all users who have the assessor role (avoids N+1)
        $validAssessorIds = User::whereIn('id', $allAssessorIds)
            ->whereHas('roles', function ($q) {
                $q->where('slug', Role::ASSESSOR);
            })
            ->pluck('id')
            ->toArray();

        // Check if all provided users are valid assessors
        $invalidAssessorIds = array_diff($allAssessorIds, $validAssessorIds);
        if (! empty($invalidAssessorIds)) {
            $invalidUser = User::find(reset($invalidAssessorIds));
            $isLeadAssessor = reset($invalidAssessorIds) == $request->lead_assessor_id;
            $message = $isLeadAssessor
                ? 'Selected user is not an Assessor.'
                : "User {$invalidUser->full_name} is not an Assessor.";

            return $this->errorResponse($message, 400);
        }

        // The unit's state is the sole assessor-eligibility gate: an assessor may only
        // be assigned to an application in a state they cover. This mirrors the assessor
        // list filter so the rule cannot be bypassed by posting an out-of-state assessor
        // id directly. A missing unit state leaves nothing to gate on, so it blocks
        // scheduling outright rather than silently allowing any assessor through.
        $applicationState = $assessment->application?->unit_state;
        if (! $applicationState) {
            return $this->errorResponse('Cannot schedule: the application has no unit state on record.', 422);
        }

        $outOfStateAssessors = User::whereIn('id', $allAssessorIds)
            ->get()
            ->reject(fn (User $assessor) => in_array($applicationState, $assessor->getAssignedStatesArray(), true));

        if ($outOfStateAssessors->isNotEmpty()) {
            $names = $outOfStateAssessors->pluck('full_name')->implode(', ');

            return $this->errorResponse(
                "The following assessors are not assigned to the application's state ({$applicationState}): {$names}.",
                422
            );
        }

        // Prevent scheduling an assessor onto another assessment whose SCHEDULED
        // window overlaps this one. Runtime execution may still overlap (an
        // assessor can run assessments in parallel on the device) — this guards
        // only the planned calendar so one person isn't booked to two sites for
        // the same day. Only live commitments count (scheduled / in_progress);
        // boundary days are treated as a conflict (inclusive overlap).
        $conflictingAssessments = Assessment::query()
            ->where('id', '!=', $assessment->id)
            ->whereIn('status', [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS])
            ->whereNotNull('scheduled_start_date')
            ->whereNotNull('scheduled_end_date')
            ->whereDate('scheduled_start_date', '<=', $request->scheduled_end_date)
            ->whereDate('scheduled_end_date', '>=', $request->scheduled_start_date)
            ->whereHas('teamMembers', fn ($q) => $q->whereIn('user_id', $allAssessorIds))
            ->with([
                'application:id,application_number',
                'teamMembers' => fn ($q) => $q->whereIn('user_id', $allAssessorIds),
            ])
            ->get();

        if ($conflictingAssessments->isNotEmpty()) {
            $assessorsById = User::whereIn('id', $allAssessorIds)->get()->keyBy('id');
            $conflicts = [];
            foreach ($conflictingAssessments as $conflict) {
                $reference = $conflict->application?->application_number
                    ? "Application #{$conflict->application->application_number}"
                    : "Assessment #{$conflict->id}";
                $range = $conflict->scheduled_start_date->format('d M Y')
                    .' – '.$conflict->scheduled_end_date->format('d M Y');
                foreach ($conflict->teamMembers as $teamMember) {
                    $name = $assessorsById[$teamMember->user_id]?->full_name ?? "User #{$teamMember->user_id}";
                    $conflicts[] = "{$name} is already scheduled on {$reference} ({$range}).";
                }
            }

            return $this->errorResponse(
                'One or more assessors have a scheduling conflict on these dates.',
                422,
                ['scheduling_conflicts' => array_values(array_unique($conflicts))]
            );
        }

        try {
            DB::beginTransaction();

            // Capture the current assessor set before clearing it so we can detect an
            // assessor swap on an already-scheduled assessment and re-notify the unit side.
            $previousAssessorIds = $assessment->teamMembers()
                ->pluck('user_id')
                ->map(fn ($id) => (int) $id)
                ->sort()
                ->values()
                ->all();

            // Clear existing team members
            $assessment->teamMembers()->delete();

            // Add lead assessor to team
            $assessment->addTeamMember($request->lead_assessor_id, AssessmentTeamMember::ROLE_LEAD_ASSESSOR);

            // Add team assessors (co-assessors)
            if ($request->has('team_assessor_ids')) {
                foreach ($request->team_assessor_ids as $assessorId) {
                    $assessment->addTeamMember($assessorId, AssessmentTeamMember::ROLE_CO_ASSESSOR);
                }
            }

            // Detect a date change so assessor devices know to wipe local state on next sync.
            // Only count it as a reschedule once the assessment has been scheduled before;
            // moving from allocation_pending -> scheduled is initial scheduling, not a reschedule.
            $datesChanged =
                $assessment->status === Assessment::STATUS_SCHEDULED &&
                ((string) $assessment->scheduled_start_date?->format('Y-m-d') !== (string) $request->scheduled_start_date
                    || (string) $assessment->scheduled_end_date?->format('Y-m-d') !== (string) $request->scheduled_end_date);

            // Detect an assessor change (lead or co-assessors) on an already-scheduled
            // assessment, gated the same way as dates: an allocation_pending -> scheduled
            // move is the first allocation, not a change. Order-independent comparison.
            $newAssessorIds = collect([$request->lead_assessor_id])
                ->merge($request->team_assessor_ids ?? [])
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->sort()
                ->values()
                ->all();
            $assessorsChanged =
                $assessment->status === Assessment::STATUS_SCHEDULED &&
                $previousAssessorIds !== $newAssessorIds;

            // Any change to the schedule (dates or assessor team) re-notifies all four
            // parties: lead + co-assessors via sendAssessmentAllocationEmails, and Unit
            // Admin + Enterprise Admin via the re-emitted schedule event.
            $scheduleChanged = $datesChanged || $assessorsChanged;

            $updates = [
                'scheduled_start_date' => $request->scheduled_start_date,
                'scheduled_end_date' => $request->scheduled_end_date,
                'meeting_link' => $request->meeting_link,
            ];
            if ($datesChanged) {
                $updates['reschedule_version'] = ($assessment->reschedule_version ?? 0) + 1;
                $updates['rescheduled_at'] = now();
            }
            $assessment->update($updates);

            // Transition to scheduled state only when currently in allocation_pending
            // (the initial allocation). When already scheduled, a change to the dates
            // or assessor team is a reschedule: fire the self-loop 'reschedule'
            // transition so it records an 'assessment_rescheduled' entry in the audit
            // log. Assessment opts out of generic update audits and the status stays
            // 'scheduled', so without this the reschedule would leave no audit trail.
            if ($assessment->status === Assessment::STATUS_ALLOCATION_PENDING) {
                $assessment->stateMachine($request->user())->transition('schedule', [
                    'remarks' => $request->remarks,
                    'scheduled_start_date' => $request->scheduled_start_date,
                    'scheduled_end_date' => $request->scheduled_end_date,
                ]);
            } elseif ($scheduleChanged) {
                $assessment->stateMachine($request->user())->transition('reschedule', [
                    'remarks' => $request->remarks,
                ]);
            }

            // Send email notifications
            try {
                $assessment->refresh();
                $this->sendAssessmentAllocationEmails($assessment);

                // A reschedule/assessor-change keeps the assessment in the 'scheduled'
                // state, so the state machine's schedule transition — which notifies Unit
                // Admin and Enterprise Admin — never fires. Re-emit that event on any
                // schedule change so they receive the updated schedule email.
                if ($scheduleChanged) {
                    event('assessment.status.changed', [
                        'assessment' => $assessment,
                        'event' => 'assessment.'.$assessment->status,
                        'transition' => 'schedule',
                        'user' => $request->user(),
                    ]);
                }
            } catch (\Exception $e) {
                \Log::error('Failed to send assessment allocation emails', [
                    'assessment_id' => $assessment->id,
                    'error' => $e->getMessage(),
                ]);
            }

            DB::commit();

            return $this->successResponse(
                ['assessment' => $this->formatAssessment($assessment->fresh())],
                'Assessment allocated successfully.'
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to allocate assessment');
        }
    }

    /**
     * Start the assessment.
     */
    #[OA\Post(
        path: '/api/v1/assessments/{id}/start',
        summary: 'Start an assessment',
        description: 'Marks a scheduled assessment as started. Only lead assessors or team assessors can start their assigned assessments.',
        tags: [
            'Assessment',
            'System Admin - Assessment',
            'DRDO Admin - Assessment',
            'Operations Manager - Assessment',
            'Operations Admin - Assessment',
            'Assessor - Assessment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assessment started successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Assessment started successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'assessment', type: 'object'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Assessment must be in scheduled status to start',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Assessment must be in scheduled status to start.',
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to conduct this assessment'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function start(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('conduct', $assessment);

        // Starting is no longer an explicit action: the assessment moves to
        // in_progress when the opening meeting is saved for the first time
        // (see ApplicationAssessmentMeetingController::store). This endpoint is
        // kept as an idempotent no-op so existing clients calling it don't break.
        return $this->successResponse(
            ['assessment' => $this->formatAssessment($assessment)],
            'Assessment start is driven by the opening meeting.'
        );
    }

    /**
     * Validate if assessment can be submitted for QC.
     */
    #[OA\Get(
        path: '/api/v1/assessments/{id}/can-submit-for-qc',
        summary: 'Validate assessment readiness for QC submission',
        description: 'Checks if an assessment can be submitted for QC review. Returns validation status, list of unanswered questions, and completion progress. Use this endpoint before attempting submission to provide user feedback.',
        tags: [
            'Assessment',
            'System Admin - Assessment',
            'DRDO Admin - Assessment',
            'Operations Manager - Assessment',
            'Operations Admin - Assessment',
            'Assessor - Assessment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Validation check completed successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Validation check completed.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'can_submit',
                                    type: 'boolean',
                                    example: false,
                                    description: 'Whether the assessment can be submitted for QC',
                                ),
                                new OA\Property(
                                    property: 'errors',
                                    type: 'array',
                                    description: 'List of validation errors (empty if can_submit is true)',
                                    items: new OA\Items(
                                        type: 'string',
                                        example: 'Question \'Q-00123\' has not been answered',
                                    ),
                                ),
                                new OA\Property(
                                    property: 'progress',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'total_questions', type: 'integer', example: 50),
                                        new OA\Property(
                                            property: 'answered_questions',
                                            type: 'integer',
                                            example: 48,
                                        ),
                                        new OA\Property(
                                            property: 'unanswered_questions',
                                            type: 'integer',
                                            example: 2,
                                        ),
                                        new OA\Property(
                                            property: 'completion_percentage',
                                            type: 'number',
                                            format: 'float',
                                            example: 96.0,
                                        ),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to access this assessment'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function canSubmitForQc(int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('view', $assessment);

        // Delegate to the authoritative model method which checks all assigned-parameter questions
        $result = $assessment->canSubmitForQC();

        // Additionally verify that required assessment steps are complete.
        // Steps are defined in Assessment::STEPS; the minimum required for QC submission are:
        // opening_meeting, assessment_parameters (responses), and closing_meeting.
        $stepProgress = $assessment->step_progress ?? [];
        $requiredSteps = [
            Assessment::STEP_OPENING_MEETING,
            Assessment::STEP_ASSESSMENT_PARAMETERS,
            Assessment::STEP_CLOSING_MEETING,
        ];
        $incompleteSteps = [];
        foreach ($requiredSteps as $step) {
            if (($stepProgress[$step] ?? Assessment::STEP_STATUS_PENDING) !== Assessment::STEP_STATUS_COMPLETED) {
                $incompleteSteps[] = $step;
            }
        }

        if (! empty($incompleteSteps)) {
            return $this->successResponse([
                'can_submit' => false,
                'errors' => array_merge(
                    $result['errors'],
                    ['Required steps are incomplete: '.implode(', ', $incompleteSteps)]
                ),
                'incomplete_steps' => $incompleteSteps,
            ], 'Validation check completed.');
        }

        return $this->successResponse([
            'can_submit' => $result['can_submit'],
            'errors' => $result['errors'],
        ], 'Validation check completed.');
    }

    /**
     * Submit assessment for QC.
     */
    #[OA\Post(
        path: '/api/v1/assessments/{id}/submit-for-qc',
        summary: 'Submit assessment for QC review',
        description: 'Submits a started assessment for quality control review. All mandatory scorecards must be completed. Only lead assessors can submit.',
        tags: [
            'Assessment',
            'System Admin - Assessment',
            'DRDO Admin - Assessment',
            'Operations Manager - Assessment',
            'Operations Admin - Assessment',
            'Assessor - Assessment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'remarks',
                        type: 'string',
                        example: 'Assessment completed as per schedule',
                    ),
                    new OA\Property(
                        property: 'recommendations',
                        type: 'string',
                        example: 'Organization demonstrates strong quality management practices',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assessment submitted for QC successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Assessment submitted for QC successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'assessment', type: 'object'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - assessment not started, incomplete mandatory questions, or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'There are 5 incomplete mandatory questions.',
                        ),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to submit this assessment'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function submitForQc(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('submit', $assessment);

        $validator = Validator::make($request->all(), [
            'remarks' => 'nullable|string',
            'recommendations' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            // Delegate to the model method which uses the authoritative validateResponsesForSubmission()
            // check (all assigned-parameter questions, not just mandatory-parameter questions).
            // Assessment::submitForQC() also handles score calculation and state transition internally.
            $assessment->stateMachine($request->user()); // bind user for guard checks
            $assessment->submitForQC();

            return $this->successResponse(
                ['assessment' => $this->formatAssessment($assessment->fresh())],
                'Assessment submitted for QC successfully.'
            );
        } catch (BusinessException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to submit assessment for QC', 400);
        }
    }

    /**
     * Record the requesting co-assessor's web submission.
     */
    #[OA\Post(
        path: '/api/v1/assessments/{id}/co-assessor-submit',
        summary: 'Co-assessor web submit',
        description: 'A co-assessor signs off their portion on the web after the assessment is mobile-complete. The lead assessor can only submit for QC once every co-assessor has web-submitted. Idempotent.',
        tags: ['Assessment', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'device_metadata',
                        type: 'object',
                        description: 'Optional device/client info',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Web submission recorded'),
            new OA\Response(response: 400, description: 'Assessment not mobile-complete'),
            new OA\Response(response: 403, description: 'Not a co-assessor of this assessment'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function coAssessorSubmit(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        if (! $teamMember->isCoAssessor()) {
            return $this->errorResponse('Only co-assessors can submit on web', 403);
        }

        $validator = Validator::make($request->all(), [
            'device_metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        try {
            $assessment->markMemberWebSubmitted($teamMember, $request->input('device_metadata', []) ?? []);

            return $this->successResponse(
                ['assessment' => $this->formatAssessment($assessment->fresh())],
                'Web submission recorded successfully.'
            );
        } catch (BusinessException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Perform QC review.
     */
    #[OA\Post(
        path: '/api/v1/assessments/{id}/qc-decision',
        summary: 'Perform QC review on assessment',
        description: 'Quality control review of a submitted assessment. Only Operations Manager can perform QC review. Can either approve for committee or provide feedback.',
        tags: [
            'Assessment',
            'System Admin - Assessment',
            'DRDO Admin - Assessment',
            'Operations Manager - Assessment',
            'Operations Admin - Assessment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['action'],
                properties: [
                    new OA\Property(
                        property: 'action',
                        type: 'string',
                        enum: ['approve_for_committee', 'provide_feedback'],
                        example: 'approve_for_committee',
                        description: 'QC action to take',
                    ),
                    new OA\Property(
                        property: 'feedback',
                        type: 'array',
                        description: 'Optional feedback for assessor if action is provide_feedback',
                        items: new OA\Items(type: 'object'),
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'QC review completed successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'QC review completed successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'assessment', type: 'object'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - QC review failed or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation failed.'),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(
                response: 403,
                description: 'Unauthorized to perform QC review (requires Operations Manager role)',
            ),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function qcDecision(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('qcReview', $assessment);

        $validator = Validator::make($request->all(), [
            'action' => 'required|in:approve_for_committee,provide_feedback',
            'feedback' => 'required_if:action,provide_feedback|array|min:1',
            'feedback.*.question_id' => 'required|integer|exists:application_assessment_questions,id',
            'feedback.*.comment' => 'required|string|max:2000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // Validate all feedback question IDs belong to this assessment
        if ($request->action === 'provide_feedback' && $request->feedback) {
            $submittedQuestionIds = collect($request->feedback)->pluck('question_id')->filter();
            $validCount = ApplicationAssessmentQuestion::where('assessment_id', $assessment->id)
                ->whereIn('id', $submittedQuestionIds)
                ->count();

            if ($submittedQuestionIds->count() !== $validCount) {
                return $this->errorResponse('One or more question IDs do not belong to this assessment.', 400);
            }
        }

        try {
            DB::beginTransaction();

            $assessment->update([
                'qc_reviewed_by' => $request->user()->id,
                'qc_reviewed_at' => now(),
                'qc_feedback' => $request->feedback,
            ]);

            // Create per-question feedback records for feedback history
            if ($request->feedback && is_array($request->feedback)) {
                foreach ($request->feedback as $feedbackItem) {
                    ApplicationAssessmentQuestionFeedback::create([
                        'application_assessment_question_id' => $feedbackItem['question_id'],
                        'user_id' => $request->user()->id,
                        'feedback_type' => ApplicationAssessmentQuestionFeedback::QC_FEEDBACK,
                        'comment' => $feedbackItem['comment'] ?? null,
                    ]);
                }
            }

            // Mark flagged questions with review status
            if ($request->action === 'provide_feedback' && $request->feedback && is_array($request->feedback)) {
                foreach ($request->feedback as $feedbackItem) {
                    $question = ApplicationAssessmentQuestion::where('id', $feedbackItem['question_id'])
                        ->where('assessment_id', $assessment->id)
                        ->first();
                    if ($question) {
                        $question->markReviewed(
                            ApplicationAssessmentQuestion::REVIEW_STATUS_FLAGGED,
                            ApplicationAssessmentQuestion::REVIEW_TYPE_QC,
                            $request->user()->id
                        );
                    }
                }
            }

            // Map UI actions to state-machine transition names (transition names, not assessment statuses)
            $transitionMap = [
                'approve_for_committee' => 'qc_approve',
                'provide_feedback' => 'qc_feedback',
            ];

            $assessment->stateMachine($request->user())->transition(
                $transitionMap[$request->action]
            );

            DB::commit();

            return $this->successResponse(
                ['assessment' => $this->formatAssessment($assessment->fresh())],
                'QC review completed successfully.'
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to process QC decision', 400);
        }
    }

    /**
     * Address QC feedback and move assessment to committee review.
     */
    #[OA\Post(
        path: '/api/v1/assessments/{id}/address-qc-feedback',
        summary: 'Address QC feedback',
        description: 'Lead assessor addresses QC feedback and assessment moves to ready for committee review.',
        tags: ['Assessment', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'remarks',
                        type: 'string',
                        example: 'Addressed all QC feedback points',
                    ),
                    new OA\Property(
                        property: 'changes_made',
                        type: 'string',
                        example: 'Updated responses for Q-123, Q-456',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assessment resubmitted for QC successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string'),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Assessment not in qc_feedback status'),
            new OA\Response(response: 403, description: 'Unauthorized - not lead assessor'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function addressQcFeedback(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('submit', $assessment);

        if ($assessment->status !== Assessment::STATUS_QC_FEEDBACK) {
            return $this->errorResponse('Assessment must be in QC feedback status to resubmit.', 400);
        }

        $validator = Validator::make($request->all(), [
            'remarks' => 'nullable|string|max:5000',
            'changes_made' => 'nullable|string|max:10000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            DB::beginTransaction();

            // Reset all question review statuses - reviewer sees a clean slate
            $assessment->questions()->update([
                'review_status' => 'pending',
                'review_type' => null,
                'reviewed_by' => null,
                'reviewed_at' => null,
            ]);

            // Use model method for score calculation
            $assessment->calculateScore();

            $assessment->stateMachine($request->user())->transition('address_qc_feedback', [
                'remarks' => $request->remarks,
                'changes_made' => $request->changes_made,
            ]);

            DB::commit();

            return $this->successResponse(
                ['assessment' => $this->formatAssessment($assessment->fresh())],
                'QC feedback addressed successfully. Assessment moved to ready for committee review.'
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to address QC feedback', 400);
        }
    }

    /**
     * Schedule assessment for committee review.
     */
    #[OA\Post(
        path: '/api/v1/assessments/{id}/schedule-committee',
        summary: 'Schedule assessment for committee review',
        description: 'Schedule an approved assessment for committee review meeting. Only Operations Manager or Operations Admin can perform this action.',
        tags: ['Assessment', 'Operations Manager - Assessment', 'Operations Admin - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['committee_meeting_id'],
                properties: [
                    new OA\Property(
                        property: 'committee_meeting_id',
                        type: 'integer',
                        example: 42,
                        description: 'Committee meeting ID to schedule this assessment for',
                    ),
                    new OA\Property(
                        property: 'remarks',
                        type: 'string',
                        example: 'Scheduled for March 2024 committee meeting',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assessment scheduled for committee review successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string'),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Assessment not in ready_for_committee status or validation failed',
            ),
            new OA\Response(
                response: 403,
                description: 'Unauthorized - requires Operations Manager or Operations Admin role',
            ),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function scheduleCommittee(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('scheduleCommittee', $assessment);

        if ($assessment->status !== Assessment::STATUS_READY_FOR_COMMITTEE) {
            return $this->errorResponse('Assessment must be in ready_for_committee status.', 400);
        }

        $validator = Validator::make($request->all(), [
            'committee_meeting_id' => 'required|exists:committee_meetings,id',
            'remarks' => 'nullable|string|max:5000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // Validate committee meeting is scheduled and not in the past
        $meeting = CommitteeMeeting::findOrFail($request->committee_meeting_id);
        if ($meeting->status !== 'scheduled') {
            return $this->errorResponse('Committee meeting must be in scheduled status to add assessments.', 400);
        }
        if ($meeting->scheduled_at && $meeting->scheduled_at < now()) {
            return $this->errorResponse('Cannot schedule assessment for a past meeting.', 400);
        }

        try {
            DB::beginTransaction();

            // Link assessment to committee meeting
            CommitteeMeetingAssessment::updateOrCreate(
                [
                    'committee_meeting_id' => $request->committee_meeting_id,
                    'assessment_id' => $assessment->id,
                ],
                ['status' => 'scheduled']
            );

            $assessment->stateMachine($request->user())->transition('schedule_committee', [
                'committee_meeting_id' => $request->committee_meeting_id,
                'remarks' => $request->remarks,
            ]);

            DB::commit();

            return $this->successResponse(
                ['assessment' => $this->formatAssessment($assessment->fresh())],
                'Assessment scheduled for committee review successfully.'
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to schedule assessment for committee', 400);
        }
    }

    /**
     * Perform committee decision on assessment.
     */
    #[OA\Post(
        path: '/api/v1/assessments/{id}/committee-decision',
        summary: 'Record committee decision on assessment',
        description: 'Record the committee\'s decision on an assessment. Only Operations Admin can perform this action. Can either certify the assessment or provide feedback for revision.',
        tags: ['Assessment', 'Operations Admin - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['action'],
                properties: [
                    new OA\Property(
                        property: 'action',
                        type: 'string',
                        enum: ['certify', 'provide_feedback'],
                        example: 'certify',
                        description: 'Committee decision action',
                    ),
                    new OA\Property(
                        property: 'remarks',
                        type: 'string',
                        example: 'Assessment meets all criteria for certification',
                        description: 'Optional remarks for the decision',
                    ),
                    new OA\Property(
                        property: 'feedback',
                        type: 'array',
                        description: 'Feedback details if action is provide_feedback',
                        items: new OA\Items(type: 'object'),
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Committee decision recorded successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Committee decision recorded successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'assessment', type: 'object'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - Decision failed or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'No active committee meeting is awaiting a decision on this assessment.',
                        ),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(
                response: 403,
                description: 'Unauthorized to perform committee decision (requires Operations Admin role)',
            ),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function committeeDecision(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('committeeDecision', $assessment);

        $pendingPivot = CommitteeMeetingAssessment::where('assessment_id', $assessment->id)
            ->where('decision', 'pending')
            ->whereHas('meeting', fn ($q) => $q->where('status', 'in_progress'))
            ->first();

        if (! $pendingPivot) {
            return $this->errorResponse(
                'No active committee meeting is awaiting a decision on this assessment.',
                422
            );
        }

        $validator = Validator::make($request->all(), [
            'action' => 'required|in:certify,provide_feedback',
            'remarks' => 'nullable|string|max:5000',
            'feedback' => 'required_if:action,provide_feedback|array|min:1',
            'feedback.*.question_id' => 'required|integer|exists:application_assessment_questions,id',
            'feedback.*.comment' => 'required|string|max:2000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // Validate all feedback question IDs belong to this assessment
        if ($request->action === 'provide_feedback' && $request->feedback) {
            $submittedQuestionIds = collect($request->feedback)->pluck('question_id')->filter();
            $validCount = ApplicationAssessmentQuestion::where('assessment_id', $assessment->id)
                ->whereIn('id', $submittedQuestionIds)
                ->count();

            if ($submittedQuestionIds->count() !== $validCount) {
                return $this->errorResponse('One or more question IDs do not belong to this assessment.', 400);
            }
        }

        // Validate the decision is allowed WITHOUT performing it. The transition itself
        // (certify/send-back, with its status change and emails) is deferred to meeting close
        // so results stay hidden until the meeting is ended. Validating here still gives the
        // operator immediate rejection, e.g. when the send-back limit is reached.
        $transition = $request->action === 'certify' ? 'certify' : 'committee_feedback';
        $blockedReason = $assessment->stateMachine($request->user())->getTransitionBlockedReason($transition);
        if ($blockedReason !== null) {
            return $this->errorResponse($blockedReason, 422);
        }

        try {
            DB::beginTransaction();

            $updates = [
                'committee_remarks' => $request->remarks,
                'committee_reviewed_by' => $request->user()->id,
                'committee_reviewed_at' => now(),
            ];

            if ($request->action === 'provide_feedback') {
                $updates['committee_feedback'] = $request->feedback;
            }

            $assessment->update($updates);

            // Create per-question feedback records for feedback history
            if ($request->action === 'provide_feedback' && $request->feedback && is_array($request->feedback)) {
                foreach ($request->feedback as $feedbackItem) {
                    ApplicationAssessmentQuestionFeedback::create([
                        'application_assessment_question_id' => $feedbackItem['question_id'],
                        'user_id' => $request->user()->id,
                        'feedback_type' => ApplicationAssessmentQuestionFeedback::COMMITTEE_FEEDBACK,
                        'comment' => $feedbackItem['comment'] ?? null,
                    ]);
                }
            }

            // Mark question review statuses based on action
            if ($request->action === 'provide_feedback' && $request->feedback && is_array($request->feedback)) {
                foreach ($request->feedback as $feedbackItem) {
                    $question = ApplicationAssessmentQuestion::where('id', $feedbackItem['question_id'])
                        ->where('assessment_id', $assessment->id)
                        ->first();
                    if ($question) {
                        $question->markReviewed(
                            ApplicationAssessmentQuestion::REVIEW_STATUS_FLAGGED,
                            ApplicationAssessmentQuestion::REVIEW_TYPE_COMMITTEE,
                            $request->user()->id
                        );
                    }
                }
            } elseif ($request->action === 'certify') {
                // Mark all questions as approved by committee
                $assessment->questions()->each(function ($question) use ($request) {
                    $question->markReviewed(
                        ApplicationAssessmentQuestion::REVIEW_STATUS_APPROVED,
                        ApplicationAssessmentQuestion::REVIEW_TYPE_COMMITTEE,
                        $request->user()->id
                    );
                });
            }

            // Update the CommitteeMeetingAssessment decision so sendDecisionEmails can match it
            // Note: 'certified'/'feedback' here are CommitteeMeetingAssessment.decision values, not Assessment.status
            $decisionMap = [
                'certify' => 'certified',
                'provide_feedback' => 'feedback',
            ];

            CommitteeMeetingAssessment::where('id', $pendingPivot->id)
                ->update([
                    'decision' => $decisionMap[$request->action],
                    'remarks' => $request->remarks,
                    'decided_by' => $request->user()->id,
                    'decided_at' => now(),
                ]);

            DB::commit();

            // The decision is recorded but not applied: the status change and emails fire when
            // the meeting is ended (CommitteeMeetingController::complete), keeping results hidden
            // until then. The assessment stays in "Committee Review Scheduled" meanwhile.
            $message = $request->action === 'certify'
                ? 'Certification decision recorded. It will be applied when the meeting is ended.'
                : 'Committee feedback recorded. It will be applied when the meeting is ended.';

            return $this->successResponse(
                ['assessment' => $this->formatAssessment($assessment->fresh())],
                $message
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to record committee decision', 400);
        }
    }

    /**
     * Bulk update RC scores for assessment responses.
     */
    #[OA\Put(
        path: '/api/v1/assessments/{id}/rc-scores',
        summary: 'Bulk update RC scores for assessment responses',
        description: 'Operations Admin can update Rating Committee scores for multiple questions at once. Automatically recalculates weighted_score per response and assessment total score. Assessment must be in committee_review status.',
        tags: ['Assessment', 'Operations Admin - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['scores'],
                properties: [
                    new OA\Property(
                        property: 'scores',
                        type: 'array',
                        description: 'Array of RC score updates',
                        items: new OA\Items(
                            required: ['question_id', 'rc_score'],
                            properties: [
                                new OA\Property(
                                    property: 'question_id',
                                    type: 'integer',
                                    description: 'ApplicationAssessmentQuestion ID',
                                ),
                                new OA\Property(
                                    property: 'rc_score',
                                    type: 'number',
                                    format: 'float',
                                    description: 'Rating Committee score (0-5)',
                                    example: 3.5,
                                ),
                            ],
                        ),
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'RC scores updated successfully'),
            new OA\Response(response: 400, description: 'Validation error or assessment not in correct status'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized (requires Operations Admin role)'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function updateRcScores(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('committeeDecision', $assessment);

        if ($assessment->status !== Assessment::STATUS_COMMITTEE_REVIEW) {
            return $this->errorResponse('Assessment must be in committee_review status.', 400);
        }

        $validator = Validator::make($request->all(), [
            'scores' => 'required|array|min:1',
            'scores.*.question_id' => 'required|integer',
            'scores.*.rc_score' => 'required|integer|min:1|max:5',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            DB::beginTransaction();

            $updated = [];
            $errors = [];

            foreach ($request->scores as $index => $scoreItem) {
                $response = ApplicationAssessmentResponse::where('assessment_id', $assessment->id)
                    ->where('question_id', $scoreItem['question_id'])
                    ->first();

                if (! $response) {
                    $errors[] = "scores.{$index}: No response found for question_id {$scoreItem['question_id']}.";

                    continue;
                }

                $response->rc_score = $scoreItem['rc_score'];
                $response->calculateScores();
                $response->save();

                $updated[] = [
                    'question_id' => $scoreItem['question_id'],
                    'rc_score' => $response->rc_score,
                    'weighted_score' => $response->weighted_score,
                ];
            }

            if (! empty($errors) && empty($updated)) {
                DB::rollBack();

                return $this->errorResponse('No valid responses found to update.', 400, ['errors' => $errors]);
            }

            // Recalculate assessment total score
            $assessment->calculateScore();

            DB::commit();

            $responseData = [
                'updated_count' => count($updated),
                'updated' => $updated,
                'total_score' => $assessment->fresh()->total_score,
            ];

            if (! empty($errors)) {
                $responseData['warnings'] = $errors;
            }

            return $this->successResponse($responseData, 'RC scores updated successfully.');
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to update RC scores');
        }
    }

    /**
     * Address committee feedback and resubmit assessment for QC review.
     */
    #[OA\Post(
        path: '/api/v1/assessments/{id}/address-committee-feedback',
        summary: 'Address committee feedback',
        description: 'Lead assessor addresses committee feedback. Assessment is resubmitted for QC review before going back to committee.',
        tags: ['Assessment', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['remarks'],
                properties: [
                    new OA\Property(
                        property: 'remarks',
                        type: 'string',
                        example: 'Addressed all committee feedback',
                    ),
                    new OA\Property(
                        property: 'changes_summary',
                        type: 'string',
                        example: 'Added requested documentation for parameters X, Y, Z',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assessment resubmitted for QC review successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string'),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Assessment not in committee_feedback status'),
            new OA\Response(response: 403, description: 'Unauthorized - not lead assessor'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function addressCommitteeFeedback(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('submit', $assessment);

        if ($assessment->status !== Assessment::STATUS_COMMITTEE_FEEDBACK) {
            return $this->errorResponse('Assessment must be in committee feedback status to resubmit.', 400);
        }

        $validator = Validator::make($request->all(), [
            'remarks' => 'nullable|string|max:5000',
            'changes_summary' => 'nullable|string|max:10000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            DB::beginTransaction();

            // Reset all question review statuses - reviewer sees a clean slate
            $assessment->questions()->update([
                'review_status' => 'pending',
                'review_type' => null,
                'reviewed_by' => null,
                'reviewed_at' => null,
            ]);

            // Use model method for score calculation
            $assessment->calculateScore();

            $assessment->stateMachine($request->user())->transition('address_committee_feedback', [
                'remarks' => $request->remarks,
                'changes_summary' => $request->changes_summary,
            ]);

            DB::commit();

            // Send clarification submitted email to operations admin
            $this->sendAssessorClarificationSubmittedEmail($assessment);

            return $this->successResponse(
                ['assessment' => $this->formatAssessment($assessment->fresh())],
                'Committee feedback addressed successfully. Assessment submitted for QC review.'
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to address committee feedback', 400);
        }
    }

    /**
     * Get available transitions for an assessment.
     */
    #[OA\Get(
        path: '/api/v1/assessments/{id}/available-transitions',
        summary: 'Get available status transitions',
        description: 'Retrieves the list of available status transitions for the assessment based on current status and user permissions.',
        tags: [
            'Assessment',
            'System Admin - Assessment',
            'DRDO Admin - Assessment',
            'Operations Manager - Assessment',
            'Operations Admin - Assessment',
            'Assessor - Assessment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Available transitions retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'current_status', type: 'string', example: 'scheduled'),
                                new OA\Property(
                                    property: 'current_status_label',
                                    type: 'string',
                                    example: 'Scheduled',
                                ),
                                new OA\Property(
                                    property: 'available_transitions',
                                    type: 'array',
                                    items: new OA\Items(
                                        type: 'object',
                                        properties: [
                                            new OA\Property(property: 'name', type: 'string'),
                                            new OA\Property(property: 'label', type: 'string'),
                                            new OA\Property(property: 'to_state', type: 'string'),
                                            new OA\Property(property: 'can_execute', type: 'boolean'),
                                        ],
                                    ),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to view this assessment'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function availableTransitions(Request $request, int $id): JsonResponse
    {
        $assessment = Assessment::findOrFail($id);

        Gate::authorize('view', $assessment);

        $stateMachine = $assessment->stateMachine($request->user());

        $config = $stateMachine->getStateConfig();
        $currentStatus = $assessment->status;
        $currentStateConfig = $config[$currentStatus] ?? [];
        $transitions = $currentStateConfig['transitions'] ?? [];

        $formattedTransitions = [];
        foreach ($transitions as $transitionName => $toState) {
            $formattedTransitions[] = [
                'name' => $transitionName,
                'label' => $this->getTransitionLabel($transitionName),
                'to_state' => $toState,
                'can_execute' => $stateMachine->canTransition($transitionName),
            ];
        }

        return $this->successResponse([
            'current_status' => $currentStatus,
            'current_status_label' => $currentStateConfig['label'] ?? ucwords(str_replace('_', ' ', $currentStatus)),
            'available_transitions' => $formattedTransitions,
        ], 'Available transitions retrieved successfully.');
    }

    /**
     * Get human-readable label for transition.
     */
    private function getTransitionLabel(string $transition): string
    {
        return match ($transition) {
            'schedule' => 'Schedule Assessment',
            'reschedule' => 'Reschedule Assessment',
            'start' => 'Start Assessment',
            'submit_for_qc' => 'Submit for QC',
            'qc_approve' => 'Approve for Committee',
            'qc_feedback' => 'Provide QC Feedback',
            'address_qc_feedback' => 'Address QC Feedback',
            'schedule_committee' => 'Schedule Committee Review',
            'certify' => 'Certify Assessment',
            'committee_feedback' => 'Provide Committee Feedback',
            'address_committee_feedback' => 'Address Committee Feedback',
            default => ucwords(str_replace('_', ' ', $transition)),
        };
    }

    /**
     * Get timeline event title for a status.
     */
    private function getTimelineEventTitle(string $status): string
    {
        return match ($status) {
            Assessment::STATUS_ALLOCATION_PENDING => 'Assessment Created',
            Assessment::STATUS_SCHEDULED => 'Assessor Allocated',
            Assessment::STATUS_IN_PROGRESS => 'Assessment Started',
            Assessment::STATUS_MOBILE_COMPLETE => 'Field Work Complete',
            Assessment::STATUS_SUBMITTED_FOR_QC => 'Submitted for QC Review',
            Assessment::STATUS_QC_FEEDBACK => 'QC Feedback Provided',
            Assessment::STATUS_READY_FOR_COMMITTEE => 'Ready for Committee',
            Assessment::STATUS_COMMITTEE_REVIEW => 'Committee Review Scheduled',
            Assessment::STATUS_COMMITTEE_FEEDBACK => 'Committee Feedback Provided',
            Assessment::STATUS_CERTIFIED => 'Assessment Certified',
            default => ucwords(str_replace('_', ' ', $status)),
        };
    }

    /**
     * Get timeline icon for a status.
     */
    private function getTimelineIcon(string $status): string
    {
        return match ($status) {
            Assessment::STATUS_ALLOCATION_PENDING => 'plus-circle',
            Assessment::STATUS_SCHEDULED => 'user-check',
            Assessment::STATUS_IN_PROGRESS => 'play-circle',
            Assessment::STATUS_MOBILE_COMPLETE => 'smartphone',
            Assessment::STATUS_SUBMITTED_FOR_QC => 'upload',
            Assessment::STATUS_QC_FEEDBACK => 'message-square',
            Assessment::STATUS_READY_FOR_COMMITTEE => 'clipboard-check',
            Assessment::STATUS_COMMITTEE_REVIEW => 'calendar',
            Assessment::STATUS_COMMITTEE_FEEDBACK => 'message-square',
            Assessment::STATUS_CERTIFIED => 'award',
            default => 'circle',
        };
    }

    /**
     * Get timeline color for a status.
     */
    private function getTimelineColor(string $status): string
    {
        return match ($status) {
            Assessment::STATUS_ALLOCATION_PENDING => 'gray',
            Assessment::STATUS_SCHEDULED => 'blue',
            Assessment::STATUS_IN_PROGRESS => 'indigo',
            Assessment::STATUS_MOBILE_COMPLETE => 'blue',
            Assessment::STATUS_SUBMITTED_FOR_QC => 'purple',
            Assessment::STATUS_QC_FEEDBACK => 'orange',
            Assessment::STATUS_READY_FOR_COMMITTEE => 'teal',
            Assessment::STATUS_COMMITTEE_REVIEW => 'cyan',
            Assessment::STATUS_COMMITTEE_FEEDBACK => 'orange',
            Assessment::STATUS_CERTIFIED => 'green',
            default => 'gray',
        };
    }

    /**
     * Apply enterprise-related filters (via application relationship).
     */
    /**
     * Build the assessment list query: role scoping plus every list filter.
     *
     * Shared by index() and export() so a CSV always contains exactly the rows
     * the screen shows. Callers add their own eager loads and ordering.
     */
    private function buildListQuery(ListAssessmentsRequest $request, $user): Builder
    {
        $query = Assessment::query();

        // Filter by role
        if ($user->hasRole(Role::DRDO_LAB)) {
            // DRDO Lab can only view certified assessments
            $query->where('status', Assessment::STATUS_CERTIFIED);
        } elseif ($user->hasRole(Role::ASSESSOR)) {
            // Filter assessments where user is a team member
            $query->forAssessor($user->id);

            // Mobile sync-down: once this assessor has cut over on mobile, stop
            // returning the assessment to their device. The web (lead's submit
            // list) omits this flag so a completed lead still sees it.
            if ($request->boolean('exclude_mobile_completed')) {
                $query->notMobileCompletedBy($user->id);
            }
        } elseif ($user->hasRole(Role::ENTERPRISE_ADMIN)) {
            $query->whereHas('application', function ($q) use ($user) {
                $q->where('organization_id', $user->organization_id);
            });
        } elseif ($user->hasRole(Role::UNIT_ADMIN)) {
            $userUnitIds = $user->assignedUnitIds();

            // SECURITY: Always filter by organization_id AND unit_id to prevent cross-org access
            $query->whereHas('application', function ($q) use ($userUnitIds, $user) {
                $q->where('organization_id', $user->organization_id)
                    ->whereIn('unit_id', $userUnitIds);
            });
        }

        // Apply state-based filtering for Operations Manager
        $this->stateFilterService->applyToAssessmentQuery($query, $user);

        // Apply search filter
        if ($request->filled('search')) {
            $query->search($request->search);
        }

        // Apply status filter (single value or comma-separated list)
        if ($request->filled('status')) {
            $statuses = array_filter(array_map('trim', explode(',', $request->status)));
            $query->whereIn('status', $statuses);

            // An assessment that drifted back to ready_for_committee while still attached to an
            // in-progress meeting (via a pending pivot row) must not appear as available — it would
            // let two meetings claim the same assessment.
            if (in_array(Assessment::STATUS_READY_FOR_COMMITTEE, $statuses, true)) {
                $query->whereDoesntHave('meetingAssessments', function ($q) {
                    $q->where('decision', 'pending')
                        ->whereHas('meeting', fn ($m) => $m->whereIn('status', ['scheduled', 'in_progress']));
                });
            }
        }

        // Apply enterprise filters (via application relationship)
        $this->applyEnterpriseFilters($query, $request);

        // Apply assessor filters (via teamMembers relationship)
        $this->applyAssessorFilters($query, $request);

        // Apply date filters
        $this->applyDateFilters($query, $request);

        // Apply certification level filter
        if ($request->filled('certification_level')) {
            $this->applyCertificationFilter($query, $request->certification_level);
        }

        // Apply existing filters (backward compatibility)
        if ($request->filled('application_id')) {
            $query->where('application_id', $request->application_id);
        }

        // Filter for incomplete steps (at least one step not completed)
        if ($request->boolean('has_incomplete_steps')) {
            $query->hasIncompleteSteps();
        }

        return $query;
    }

    private function applyEnterpriseFilters(Builder $query, ListAssessmentsRequest $request): void
    {
        if ($request->filled('enterprise_size')) {
            $query->whereHas('application', function ($q) use ($request) {
                $q->byEnterpriseSize($request->enterprise_size);
            });
        }

        if ($request->filled('vendor_category')) {
            $query->whereHas('application', function ($q) use ($request) {
                $q->byVendorCategory($request->vendor_category);
            });
        }

        if ($request->filled('sector')) {
            $query->whereHas('application', function ($q) use ($request) {
                $q->bySector($request->sector);
            });
        }

        if ($request->filled('type')) {
            $query->whereHas('application', function ($q) use ($request) {
                $q->byType($request->type);
            });
        }
    }

    /**
     * Apply assessor-related filters (via teamMembers relationship).
     */
    private function applyAssessorFilters(Builder $query, ListAssessmentsRequest $request): void
    {
        // Lead and co-assessor are separate filters and combine, so narrowing by both
        // means "this lead AND that co-assessor". They shared one parameter until
        // [TASK-07970], which silently dropped the lead whenever both were set.
        $leadAssessorId = $request->input('leadAssessorId', $request->input('lead_assessor_id'));
        if ($leadAssessorId) {
            $query->forLeadAssessor($leadAssessorId);
        }

        $coAssessorId = $request->input('coAssessorId', $request->input('co_assessor_id'));
        if ($coAssessorId) {
            $query->forCoAssessor($coAssessorId);
        }

        // Role-agnostic filter, kept for callers that only care that a user is on the team.
        $assessorId = $request->input('assessorId', $request->input('assessor_id'));
        if ($assessorId) {
            $query->forAssessor($assessorId);
        }
    }

    /**
     * Apply date range filters based on date_type parameter.
     */
    private function applyDateFilters(Builder $query, ListAssessmentsRequest $request): void
    {
        $startDate = $request->input('startDate', $request->input('start_date'));
        $endDate = $request->input('endDate', $request->input('end_date'));

        if (! $startDate && ! $endDate) {
            return;
        }

        $dateType = $request->input('dateType', $request->input('date_type', 'scheduled_start'));

        // Map date types to database fields
        $dateFieldMap = [
            'scheduled_start' => 'scheduled_start_date',
            'actual_start' => 'actual_start_date',
            'review' => 'submitted_at', // Committee review date
            'certified' => 'completed_at', // dateType key from request, not assessment status
        ];

        $field = $dateFieldMap[$dateType] ?? 'scheduled_start_date';

        $query->dateRange($field, $startDate, $endDate);
    }

    /**
     * Apply certification level filter (via application.certificate relationship).
     */
    private function applyCertificationFilter(Builder $query, string $level): void
    {
        $query->whereHas('application.certificate', function ($q) use ($level) {
            $q->where('grade', $level);
        });
    }

    /**
     * Format assessment data for response.
     */
    private function formatAssessment(Assessment $assessment, bool $detailed = false): array
    {
        // Use already-loaded team members to find lead assessor (avoids N+1 query)
        $leadAssessor = null;
        $coAssessors = collect();
        if ($assessment->relationLoaded('teamMembers')) {
            $leadMember = $assessment->teamMembers
                ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
                ->first();
            $leadAssessor = $leadMember?->user;

            // Extract co-assessors from team members
            $coAssessors = $assessment->teamMembers
                ->where('role', AssessmentTeamMember::ROLE_CO_ASSESSOR)
                ->map(fn ($member) => $member->user)
                ->filter();
        } else {
            // Fallback to the method if relationship not loaded (e.g., for single assessment view)
            $leadAssessor = $assessment->getLeadAssessor();
            $coAssessors = $assessment->getCoAssessors();
        }

        // The team member viewing this assessment, if any — drives the
        // per-member step view below so each assessor sees only their own
        // progress on the steps they own.
        $viewerId = auth()->id();
        $viewerMember = $viewerId
            ? ($assessment->relationLoaded('teamMembers')
                ? $assessment->teamMembers->firstWhere('user_id', $viewerId)
                : $assessment->teamMembers()->where('user_id', $viewerId)->first())
            : null;

        $data = [
            'id' => $assessment->id,
            'application_id' => $assessment->application_id,
            'status' => $assessment->status,

            'lead_assessor' => $leadAssessor ? [
                'id' => $leadAssessor->id,
                'name' => $leadAssessor->full_name,
                'email' => $leadAssessor->email,
            ] : null,

            'co_assessors' => $coAssessors->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->full_name,
                'email' => $user->email,
            ])->values()->all(),

            'scheduled_start_date' => $assessment->scheduled_start_date?->format('Y-m-d'),
            'scheduled_end_date' => $assessment->scheduled_end_date?->format('Y-m-d'),
            'meeting_link' => $assessment->meeting_link,
            'reschedule_version' => (int) ($assessment->reschedule_version ?? 0),
            'rescheduled_at' => $assessment->rescheduled_at?->toIso8601String(),
            'actual_start_date' => $assessment->actual_start_date?->format('Y-m-d'),
            'actual_end_date' => $assessment->actual_end_date?->format('Y-m-d'),
            'completed_at' => $assessment->completed_at?->toIso8601String(),

            'total_score' => $assessment->total_score,
            'rating' => Assessment::ratingLabelFromScore($assessment->total_score, 'N/A'),

            // Per-member view of progress: site_pictures, site_tour and
            // assessment_parameters reflect only the viewing assessor's own
            // captures, so a co-assessor's card never inherits the lead's
            // ticks. Non-member viewers (admin/QC) keep the whole-team map.
            // all_steps_completed stays global — QC submission needs everyone.
            'steps' => $viewerMember
                ? $assessment->getStepProgressForMember($viewerMember)
                : ($assessment->step_progress ?? array_combine(
                    Assessment::STEPS,
                    array_fill(0, count(Assessment::STEPS), Assessment::STEP_STATUS_PENDING)
                )),
            'all_steps_completed' => $assessment->areAllStepsCompleted(),
            'allocation_locked' => $assessment->isAllocationLocked(),
            'all_team_members_punched_out' => $assessment->areAllTeamMembersPunchedOut(useLoaded: true),
            'all_team_members_mobile_complete' => $assessment->areAllTeamMembersMobileComplete(useLoaded: true),
            'my_mobile_completed_at' => $viewerMember?->mobile_completed_at?->toIso8601String(),
            'all_co_assessors_web_submitted' => $assessment->areAllCoAssessorsWebSubmitted(useLoaded: true),
            'my_web_submitted_at' => $viewerMember?->web_submitted_at?->toIso8601String(),

            'parameters_summary' => $assessment->relationLoaded('parameters') ? [
                'mandatory' => $assessment->parameters->where('is_mandatory', true)->count(),
                'optional' => $assessment->parameters->where('is_mandatory', false)->count(),
                'total' => $assessment->parameters->count(),
            ] : null,

            'created_at' => $assessment->created_at->toIso8601String(),
            'updated_at' => $assessment->updated_at->toIso8601String(),
        ];

        // Always include basic application info for list views (needed by frontend)
        if ($assessment->relationLoaded('application') && $assessment->application) {
            $app = $assessment->application;

            // Basic application data for list views
            $applicationData = [
                'id' => $app->id,
                'application_number' => $app->application_number,
                'application_type' => $app->application_type,
                'previous_application_id' => $app->previous_application_id,
                'status' => $app->status,
                'sector' => $app->sector,
                'enterprise_classification' => $app->enterprise_classification,
                'cin' => $app->cin,
                'payment_date' => $app->payment_completed_at?->format('Y-m-d'),
                'preferred_assessment_date' => $app->preferred_assessment_date?->format('Y-m-d'),
                'organization_id' => $app->organization_id,
                'organization_name' => $app->organization_name,
                'unit_id' => $app->unit_id,
                'unit_name' => $app->unit_name,
                'unit_address' => $app->unit_address,
                'full_unit_address' => $app->full_unit_address,
                'unit_commencement_date' => $app->unit_commencement_date?->format('Y-m-d'),
            ];

            // Include full application data for detailed views
            if ($detailed) {
                $applicationData = array_merge($applicationData, [
                    // DRDO Information
                    'udyam_registration_number' => $app->udyam_registration_number,
                    'drdo_registration_number' => $app->drdo_registration_number,
                    'dpiit_registration_number' => $app->dpiit_registration_number,
                    'is_existing_drdo_vendor' => $app->is_existing_drdo_vendor,
                    'vendor_category_name' => $app->vendor_category_name,

                    // Unit/Plant Address & Contact (unit_id, unit_name, unit_address, unit_commencement_date already in base response)
                    'unit_state' => $app->unit_state,
                    'unit_district' => $app->unit_district,
                    'unit_pincode' => $app->unit_pincode,
                    'unit_mobile' => $app->unit_mobile,
                    'unit_landline' => $app->unit_landline,
                    'unit_email' => $app->unit_email,
                    'unit_alternate_email' => $app->unit_alternate_email,

                    // Registered Office Address & Contact
                    'registered_office_address' => $app->registered_office_address,
                    'registered_office_state' => $app->registered_office_state,
                    'registered_office_district' => $app->registered_office_district,
                    'registered_office_pincode' => $app->registered_office_pincode,
                    'registered_office_mobile' => $app->registered_office_mobile,
                    'registered_office_landline' => $app->registered_office_landline,
                    'registered_office_email' => $app->registered_office_email,
                    'registered_office_alternate_email' => $app->registered_office_alternate_email,

                    // Contact Person
                    'contact_person_name' => $app->contact_person_name,
                    'contact_person_designation' => $app->contact_person_designation,
                    'contact_person_mobile' => $app->contact_person_mobile,
                    'contact_person_email' => $app->contact_person_email,

                    // Operational Details
                    'ownership_type' => $app->ownership_type,
                    'total_employees' => ($app->male_employees_count ?? 0) + ($app->female_employees_count ?? 0) + ($app->other_employees_count ?? 0),
                    'male_employees_count' => $app->male_employees_count,
                    'female_employees_count' => $app->female_employees_count,
                    'other_employees_count' => $app->other_employees_count,
                    'gst_number' => $app->gst_number,
                    'has_gst' => $app->has_gst,
                    'govt_organisation_name' => $app->govt_organisation_name,
                    'has_govt_registration' => $app->has_govt_registration,

                    // Export Information
                    'is_exporting' => $app->is_exporting,
                    'export_countries' => $app->export_countries,
                    'export_percentage' => $app->export_percentage,

                    // Manufacturing-specific fields
                    'mfg_products' => $app->mfg_products,
                    'mfg_raw_materials' => $app->mfg_raw_materials,
                    'mfg_bought_out_parts' => $app->mfg_bought_out_parts,
                    'mfg_key_processes' => $app->mfg_key_processes,
                    'mfg_outsourced_processes' => $app->mfg_outsourced_processes,
                    'mfg_drdo_vendor_stores' => $app->mfg_drdo_vendor_stores,
                    'mfg_production_capacity' => $app->mfg_production_capacity,
                    'mfg_capacity_unit' => $app->mfg_capacity_unit,

                    // Services-specific fields
                    'svc_provider_type' => $app->svc_provider_type,
                    'svc_services' => $app->svc_services,
                    'svc_key_resources' => $app->svc_key_resources,
                    'svc_outsourced_components' => $app->svc_outsourced_components,
                    'svc_key_processes' => $app->svc_key_processes,
                    'svc_outsourced_processes' => $app->svc_outsourced_processes,
                    'svc_drdo_vendor_labs' => $app->svc_drdo_vendor_labs,

                    // Common fields
                    'customers' => $app->customers,

                    // Declarations & Certifications
                    'third_party_certification_names' => $app->third_party_certification_names,
                    'is_blacklisted' => $app->is_blacklisted,
                    'blacklisted_organizations' => $app->blacklisted_organizations,
                    'has_ongoing_enquiry' => $app->has_ongoing_enquiry,

                    // File URLs
                    'gst_certificate_file_url' => $app->gst_certificate_file_url,
                    'govt_registration_certificate_url' => $app->govt_registration_certificate_url,
                    'drdo_certificate_file_url' => $app->drdo_certificate_file_url,
                    'dpiit_certificate_file_url' => $app->dpiit_certificate_file_url,
                    'udyam_certificate_file_url' => $app->udyam_certificate_file_url,
                    'incorporation_certificate_file_url' => $app->incorporation_certificate_file_url,
                    'site_exterior_photo_url' => $app->site_exterior_photo_url,

                    // Timestamps
                    'created_at' => $app->created_at?->toIso8601String(),
                    'submitted_at' => $app->submitted_at?->toIso8601String(),
                    'drdo_approved_at' => $app->drdo_approved_at?->toIso8601String(),

                    // Rejection (populated when the application was rejected)
                    'rejected_at' => $app->rejected_at?->toIso8601String(),
                    'rejection_reason' => $app->rejection_reason,
                ]);
            }

            $data['application'] = $applicationData;
        }

        // Always include team members for list views (needed by frontend for assessor display)
        if ($assessment->relationLoaded('teamMembers')) {
            $data['team_members'] = $assessment->teamMembers->map(fn ($member) => [
                'id' => $member->id,
                'user_id' => $member->user_id,
                'samar_id' => $member->user->samar_id ?? null,
                'name' => $member->user->full_name ?? 'Unknown',
                'email' => $member->user->email ?? null,
                'role' => $member->role,
                'designation' => $member->user->designation ?? null,
                'location' => $this->formatAssessorLocation($member->user),
                'department' => $member->user->assessorDomains->pluck('domain_name')->implode(', ') ?: null,
                'mobile_completed_at' => $member->mobile_completed_at?->toIso8601String(),
                'web_submitted_at' => $member->web_submitted_at?->toIso8601String(),
                'created_at' => $member->created_at?->toIso8601String(),
            ]);
        }

        // Additional timestamp fields needed by frontend list views
        $data['allocated_at'] = $assessment->allocated_at?->toIso8601String();
        $data['started_at'] = $assessment->started_at?->toIso8601String();
        $data['submitted_at'] = $assessment->submitted_at?->toIso8601String();
        $data['submitted_for_qc_at'] = $assessment->submitted_at?->toIso8601String(); // Alias for frontend compatibility

        // Certificate info for certified assessments
        if ($assessment->relationLoaded('application') && $assessment->application?->relationLoaded('certificate') && $assessment->application->certificate) {
            $certificate = $assessment->application->certificate;
            $data['certified_at'] = $certificate->issued_at?->toIso8601String();
            $data['certificate_expiry_date'] = $certificate->valid_until?->format('Y-m-d');
            $data['certificate_number'] = $certificate->certificate_number;
            $data['certificate_download_url'] = url("/api/v1/certificates/{$certificate->certificate_number}/download");
        }

        // Fallback for certified assessments when the certificate relation wasn't eager-loaded above.
        // Always source expiry from the stored certificate — never recompute from the current system setting,
        // otherwise old certs would silently shift when the validity setting changes.
        if ($assessment->status === Assessment::STATUS_CERTIFIED) {
            if (! isset($data['certificate_expiry_date'])) {
                $certificate = $assessment->application?->certificate;
                if ($certificate) {
                    $data['certificate_expiry_date'] = $certificate->valid_until?->format('Y-m-d');
                    $data['certificate_number'] = $data['certificate_number'] ?? $certificate->certificate_number;
                    $data['certificate_download_url'] = $data['certificate_download_url']
                        ?? url("/api/v1/certificates/{$certificate->certificate_number}/download");
                    $data['certified_at'] = $data['certified_at'] ?? $certificate->issued_at?->toIso8601String();
                }
            }
            if (! isset($data['certified_at']) && $assessment->completed_at) {
                $data['certified_at'] = $assessment->completed_at->toIso8601String();
            }
        }

        if ($detailed) {
            // Note: application and team_members are already included above for all responses
            // Here we add additional detailed fields

            $data['qc_feedback'] = $assessment->qc_feedback;
            $data['remarks'] = $assessment->remarks;
            $data['recommendations'] = $assessment->recommendations;

            // Assessor-only total (SA/RA Score) alongside total_score (the RC-effective
            // score): the committee-review header shows both, and the assessor total is
            // what non-certified/sent-back states display. Guarded by $detailed so list
            // endpoints don't pay the per-row response query.
            $data['assessor_score'] = $assessment->calculateAssessorOnlyScore();

            if ($assessment->relationLoaded('questions')) {
                $data['questions_count'] = $assessment->questions->count();
            }

            if ($assessment->relationLoaded('responses')) {
                $data['responses_count'] = $assessment->responses->count();
                $data['completed_responses_count'] = $assessment->responses->whereNotNull('selected_option')->count();
            }
        }

        return $data;
    }

    /**
     * Format assessor location from user fields.
     *
     * @param  User|null  $user
     */
    private function formatAssessorLocation($user): ?string
    {
        if (! $user) {
            return null;
        }

        $parts = array_filter([
            $user->city,
            $user->district,
            $user->state,
        ]);

        return ! empty($parts) ? implode(', ', $parts) : null;
    }

    /**
     * Send per-assessor allocation emails. Applicant-facing assessment.scheduled
     * email is dispatched by AssessmentStatusChangedListener on state transition.
     */
    private function sendAssessmentAllocationEmails(Assessment $assessment): void
    {
        $emailService = app(EmailNotificationService::class);
        $dateRange = $assessment->scheduled_start_date->format('F d, Y').' - '.$assessment->scheduled_end_date->format('F d, Y');

        if ($leadAssessor = $assessment->getLeadAssessor()) {
            $emailService->sendEmailForEvent('assessment.assessor_assigned', array_merge(
                $this->getAssessorEmailData($assessment, $leadAssessor, $dateRange),
                ['assessor' => $leadAssessor]
            ));
        }

        foreach ($assessment->getCoAssessors() as $coAssessor) {
            $emailService->sendEmailForEvent('assessment.co_assessor_assigned', array_merge(
                $this->getAssessorEmailData($assessment, $coAssessor, $dateRange),
                ['assessor' => $coAssessor]
            ));
        }
    }

    /**
     * Get common assessor email data.
     *
     * @param  User  $assessor
     */
    private function getAssessorEmailData(Assessment $assessment, $assessor, string $dateRange): array
    {
        $application = $assessment->application;

        return [
            'application' => $application,
            'assessment' => $assessment,
            'assessor_name' => $assessor->full_name,
            'application_number' => $application->application_number,
            'organization_name' => $application->organization->name ?? 'N/A',
            'unit_name' => $application->unit_name ?? 'N/A',
            'unit_address' => $application->full_unit_address ?? 'N/A',
            'unit_spoc_contact' => $application->contact_person_mobile ?? 'N/A',
            'assessment_date_range' => $dateRange,
            'assessment_mode' => $assessment->modeLabel(),
            'meeting_link' => $assessment->meeting_link,
        ];
    }

    /**
     * Send assessor clarification submitted email to operations admin.
     */
    private function sendAssessorClarificationSubmittedEmail(Assessment $assessment): void
    {
        try {
            $emailService = app(EmailNotificationService::class);
            $application = $assessment->application;
            $leadAssessor = $assessment->getLeadAssessor();

            $emailService->sendEmailForEvent('assessment.assessor_clarification_submitted', [
                'assessment' => $assessment,
                'application' => $application,
                'application_number' => $application->application_number,
                'organization_name' => $application->organization->name ?? 'N/A',
                'assessor_name' => $leadAssessor?->full_name ?? 'N/A',
                'clarification_submission_date' => now()->format('d M Y'),
                'samar_id' => $leadAssessor?->samar_id ?? 'N/A',
                'query_form_link' => config('app.support_url'),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send assessor clarification submitted email', [
                'assessment_id' => $assessment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Download Assessment Report PDF.
     */
    #[OA\Get(
        path: '/api/v1/assessments/{identifier}/assessment-report/download',
        summary: 'Download Assessment Report PDF',
        description: 'Generate and download the Assessment Report PDF for a certified assessment. Accessible by Enterprise Admin, Unit Admin, Operations Manager, Operations Admin, System Admin, and DRDO Admin. Lookup by assessment ID.',
        tags: ['Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'identifier',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'string'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assessment Report PDF file',
                content: [
                    new OA\MediaType(mediaType: 'application/pdf'),
                ],
            ),
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function downloadAssessmentReport(Request $request, string $identifier): mixed
    {
        $assessment = Assessment::with('application')
            ->where('id', $identifier)
            ->first();

        if (! $assessment) {
            return $this->errorResponse('Assessment not found.', 404);
        }

        if ($assessment->status !== Assessment::STATUS_CERTIFIED) {
            return $this->errorResponse('Assessment report is only available for certified assessments.', 400);
        }

        $user = $request->user();

        // Admin roles can download any assessment report
        $adminRoles = [
            Role::SYSTEM_ADMIN,
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ];

        if (! $user->hasAnyRole($adminRoles)) {
            // Enterprise Admin and Unit Admin can only download their own organization's reports
            $application = $assessment->application;

            if (! $application) {
                return $this->errorResponse('Application not found.', 404);
            }

            $isEnterpriseAdmin = $user->hasRole(Role::ENTERPRISE_ADMIN)
                && $user->organization_id === $application->organization_id;

            $isUnitAdmin = $user->hasRole(Role::UNIT_ADMIN)
                && in_array($application->unit_id, $user->assignedUnitIds(), true);

            if (! $isEnterpriseAdmin && ! $isUnitAdmin) {
                return $this->errorResponse('Unauthorized to download this assessment report.', 403);
            }
        }

        try {
            $summaryService = app(MeetingSummarySheetService::class);
            $pdfContent = $summaryService->generateAssessmentReportPdf($assessment, Assessment::STATUS_CERTIFIED);

            $filename = 'Assessment-Report-'.($assessment->application->application_number ?? $assessment->id).'.pdf';

            return response($pdfContent, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Content-Length' => strlen($pdfContent),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to generate assessment report PDF', [
                'assessment_id' => $assessment->id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Failed to generate assessment report.', 500);
        }
    }
}
