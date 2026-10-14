<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\RunCommitteeMeetingCloseTail;
use App\Models\Assessment;
use App\Models\CommitteeMeeting;
use App\Models\CommitteeMeetingAssessment;
use App\Models\CommitteeMember;
use App\Models\MeetingMember;
use App\Models\Role;
use App\Rules\PersonName;
use App\Services\CertificateService;
use App\Services\CommitteeMeetingAssessmentService;
use App\Services\Email\EmailNotificationService;
use App\Services\MeetingSummarySheetService;
use App\Services\Notification\CommitteeClarificationNotifier;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Committee Meetings',
    description: 'Committee meeting management endpoints - Create, update, start, and complete committee meetings',
)]
class CommitteeMeetingController extends Controller
{
    /**
     * Get all committee meetings.
     */
    #[OA\Get(
        path: '/api/v1/committee-meetings',
        summary: 'Get all committee meetings',
        description: 'Retrieves a paginated list of committee meetings. System admins and operations team see all meetings. Committee members only see meetings they\'re part of.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'status',
                in: 'query',
                description: 'Filter by meeting status',
                required: false,
                schema: new OA\Schema(
                    type: 'string',
                    enum: ['scheduled', 'rescheduled', 'in_progress', 'completed', 'cancelled'],
                    example: 'scheduled',
                ),
            ),
            new OA\Parameter(
                name: 'meetingDateFrom',
                in: 'query',
                description: 'Filter meetings from this date',
                required: false,
                schema: new OA\Schema(type: 'string', format: 'date', example: '2024-01-01'),
            ),
            new OA\Parameter(
                name: 'meetingDateTo',
                in: 'query',
                description: 'Filter meetings until this date',
                required: false,
                schema: new OA\Schema(type: 'string', format: 'date', example: '2024-12-31'),
            ),
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by meeting title or meeting number',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'Quarterly'),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Number of items per page',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 15, default: 15),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Meetings retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Committee meetings retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'id', type: 'integer', example: 1),
                                    new OA\Property(
                                        property: 'meetingNumber',
                                        type: 'string',
                                        example: 'COM-2024-0001',
                                    ),
                                    new OA\Property(
                                        property: 'title',
                                        type: 'string',
                                        example: 'Quarterly Application Review',
                                    ),
                                    new OA\Property(
                                        property: 'meetingDate',
                                        type: 'string',
                                        format: 'date',
                                        example: '2024-03-15',
                                    ),
                                    new OA\Property(property: 'meetingTime', type: 'string', example: '14:00'),
                                    new OA\Property(
                                        property: 'venue',
                                        type: 'string',
                                        example: 'Conference Room A',
                                    ),
                                    new OA\Property(property: 'status', type: 'string', example: 'scheduled'),
                                    new OA\Property(
                                        property: 'startedAt',
                                        type: 'string',
                                        format: 'date-time',
                                        nullable: true,
                                    ),
                                    new OA\Property(
                                        property: 'completedAt',
                                        type: 'string',
                                        format: 'date-time',
                                        nullable: true,
                                    ),
                                    new OA\Property(
                                        property: 'createdAt',
                                        type: 'string',
                                        format: 'date-time',
                                        example: '2024-01-01T10:00:00Z',
                                    ),
                                ],
                            ),
                        ),
                        new OA\Property(
                            property: 'pagination',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'currentPage', type: 'integer', example: 1),
                                new OA\Property(property: 'perPage', type: 'integer', example: 15),
                                new OA\Property(property: 'total', type: 'integer', example: 25),
                                new OA\Property(property: 'lastPage', type: 'integer', example: 2),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Unauthorized to view committee meetings',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Unauthorized to view committee meetings.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // View access: DRDO Admin, Operations Manager, Operations Admin.
        // System Admin is excluded here and in the route middleware.
        if (! $user->hasAnyRole([
            Role::DRDO_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
        ])) {
            return $this->errorResponse('Unauthorized to view committee meetings.', 403);
        }

        // Use withCount for list view - only load counts, not full relations (optimization)
        $query = CommitteeMeeting::with(['chair', 'convenor'])
            ->withCount(['members']);

        // Apply filters
        if ($request->filled('search')) {
            $query->search($request->input('search'));
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $meetingDateFrom = $request->input('meetingDateFrom', $request->input('meeting_date_from'));
        $meetingDateTo = $request->input('meetingDateTo', $request->input('meeting_date_to'));

        if ($meetingDateFrom) {
            $query->whereDate('scheduled_at', '>=', $meetingDateFrom);
        }

        if ($meetingDateTo) {
            $query->whereDate('scheduled_at', '<=', $meetingDateTo);
        }

        $perPage = $this->resolvePerPage($request, 15);
        $meetings = $query->latest('scheduled_at')->paginate($perPage);

        $formattedMeetings = $meetings->setCollection(
            $meetings->getCollection()->map(fn ($meeting) => $this->formatMeeting($meeting))
        );

        return $this->paginatedResponse($formattedMeetings, 'Meetings retrieved successfully');
    }

    /**
     * Get a single committee meeting.
     */
    #[OA\Get(
        path: '/api/v1/committee-meetings/{id}',
        summary: 'Get committee meeting details',
        description: 'Retrieves detailed information about a specific committee meeting including members, applications, and decisions.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Meeting retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'meeting',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(
                                            property: 'meeting_number',
                                            type: 'string',
                                            example: 'COM-2024-0001',
                                        ),
                                        new OA\Property(
                                            property: 'title',
                                            type: 'string',
                                            example: 'Quarterly Application Review',
                                        ),
                                        new OA\Property(
                                            property: 'meeting_date',
                                            type: 'string',
                                            format: 'date',
                                            example: '2024-03-15',
                                        ),
                                        new OA\Property(
                                            property: 'meeting_time',
                                            type: 'string',
                                            example: '14:00',
                                        ),
                                        new OA\Property(
                                            property: 'venue',
                                            type: 'string',
                                            example: 'Conference Room A',
                                        ),
                                        new OA\Property(property: 'status', type: 'string', example: 'scheduled'),
                                        new OA\Property(property: 'agenda', type: 'string', nullable: true),
                                        new OA\Property(property: 'minutes', type: 'string', nullable: true),
                                        new OA\Property(property: 'summary', type: 'string', nullable: true),
                                        new OA\Property(
                                            property: 'organizer',
                                            type: 'object',
                                            properties: [
                                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                                new OA\Property(
                                                    property: 'name',
                                                    type: 'string',
                                                    example: 'John Doe',
                                                ),
                                                new OA\Property(
                                                    property: 'email',
                                                    type: 'string',
                                                    example: 'john@example.com',
                                                ),
                                            ],
                                        ),
                                        new OA\Property(
                                            property: 'members',
                                            type: 'array',
                                            items: new OA\Items(
                                                properties: [
                                                    new OA\Property(property: 'id', type: 'integer', example: 2),
                                                    new OA\Property(
                                                        property: 'name',
                                                        type: 'string',
                                                        example: 'Jane Smith',
                                                    ),
                                                    new OA\Property(
                                                        property: 'email',
                                                        type: 'string',
                                                        example: 'jane@example.com',
                                                    ),
                                                    new OA\Property(
                                                        property: 'role',
                                                        type: 'string',
                                                        example: 'member',
                                                    ),
                                                    new OA\Property(
                                                        property: 'attendance_status',
                                                        type: 'string',
                                                        nullable: true,
                                                    ),
                                                    new OA\Property(
                                                        property: 'invitation_status',
                                                        type: 'string',
                                                        example: 'pending',
                                                    ),
                                                ],
                                            ),
                                        ),
                                        new OA\Property(
                                            property: 'applications',
                                            type: 'array',
                                            items: new OA\Items(
                                                properties: [
                                                    new OA\Property(property: 'id', type: 'integer', example: 1),
                                                    new OA\Property(
                                                        property: 'application_number',
                                                        type: 'string',
                                                        example: 'APP-2024-0001',
                                                    ),
                                                    new OA\Property(
                                                        property: 'organization',
                                                        type: 'object',
                                                        properties: [
                                                            new OA\Property(
                                                                property: 'id',
                                                                type: 'integer',
                                                                example: 1,
                                                            ),
                                                            new OA\Property(
                                                                property: 'name',
                                                                type: 'string',
                                                                example: 'Tech Corp',
                                                            ),
                                                        ],
                                                    ),
                                                ],
                                            ),
                                        ),
                                        new OA\Property(property: 'decisions_count', type: 'integer', example: 5),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Unauthorized to view this meeting',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Unauthorized to view this meeting.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'Meeting not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'No query results for model [App\\\\Models\\\\CommitteeMeeting].',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $meeting = CommitteeMeeting::with([
            'chair',
            'convenor',
            'members.committeeMember',
        ])->find($id);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found.', 404);
        }

        $user = $request->user();

        // View access: DRDO Admin, Operations Manager, Operations Admin, Assessor
        if (! $user->hasAnyRole([Role::DRDO_ADMIN, Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN])) {
            return $this->errorResponse('Unauthorized to view this meeting.', 403);
        }

        return $this->successResponse(
            ['meeting' => $this->formatMeeting($meeting, true)],
            'Meeting retrieved successfully'
        );
    }

    /**
     * Create a new committee meeting.
     */
    #[OA\Post(
        path: '/api/v1/committee-meetings',
        summary: 'Create a committee meeting',
        description: 'Creates a new committee meeting with members and applications. Only Operations Admins can create meetings. Requires minimum 3 committee members.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['committeeId', 'title', 'meetingDate', 'meetingTime', 'venue'],
                properties: [
                    new OA\Property(
                        property: 'committeeId',
                        type: 'integer',
                        example: 1,
                        description: 'ID of the committee this meeting belongs to',
                    ),
                    new OA\Property(
                        property: 'title',
                        type: 'string',
                        example: 'Quarterly Application Review',
                        maxLength: 255,
                    ),
                    new OA\Property(
                        property: 'meetingDate',
                        type: 'string',
                        format: 'date',
                        example: '2024-03-15',
                        description: 'Must be after today',
                    ),
                    new OA\Property(
                        property: 'meetingTime',
                        type: 'string',
                        example: '14:00',
                        description: 'Time in HH:mm format',
                    ),
                    new OA\Property(
                        property: 'venue',
                        type: 'string',
                        example: 'Conference Room A',
                        maxLength: 255,
                    ),
                    new OA\Property(
                        property: 'agenda',
                        type: 'string',
                        nullable: true,
                        example: 'Review applications for Q1 2024',
                    ),
                    new OA\Property(
                        property: 'applicationIds',
                        type: 'array',
                        nullable: true,
                        example: [1, 2, 3],
                        items: new OA\Items(type: 'integer'),
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Meeting created successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Committee meeting created successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'meeting',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(
                                            property: 'meeting_number',
                                            type: 'string',
                                            example: 'COM-2024-0001',
                                        ),
                                        new OA\Property(
                                            property: 'title',
                                            type: 'string',
                                            example: 'Quarterly Application Review',
                                        ),
                                        new OA\Property(property: 'status', type: 'string', example: 'scheduled'),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - User is not a committee member or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'User John Doe is not a committee member.',
                        ),
                        new OA\Property(property: 'errors', type: 'object', nullable: true),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Only Operations Admins can create committee meetings',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Only Operations Admins can create committee meetings.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Failed to create meeting',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to create committee meeting.',
                        ),
                        new OA\Property(property: 'error', type: 'string'),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        // Only Operations Admin can create meetings
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can create committee meetings.', 403);
        }

        // Validation - transformer converts camelCase to snake_case
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'members' => 'required|array|min:1',
            'members.*' => 'exists:committee_members,id',
            'chair' => 'required|exists:committee_members,id',
            'convenor' => 'required|exists:committee_members,id',
            'assessments' => 'nullable|array',
            'assessments.*' => 'exists:applications,id',
            'meeting_type' => 'required|in:Online,Offline',
            'meeting_link' => 'required_if:meeting_type,Online|nullable|string',
            'venue' => 'required_if:meeting_type,Offline|nullable|string|max:500',
            'date' => 'required|date_format:Y-m-d|after_or_equal:today',
            'time' => 'required|date_format:H:i',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // Parse date (could be ISO datetime or just date) and combine with time.
        $dateOnly = Carbon::parse($request->date)->format('Y-m-d');
        $scheduledAt = Carbon::parse($dateOnly.' '.$request->time);

        // A committee meeting owns its date+time slot. Reject a second active meeting
        // in the same slot; surface a clearer message when the clash is a duplicate
        // review of an application already booked at that slot.
        $activeStatuses = ['scheduled', 'in_progress', 'postponed'];

        if (! empty($request->assessments)) {
            $duplicateApplication = CommitteeMeeting::whereIn('status', $activeStatuses)
                ->where('scheduled_at', $scheduledAt)
                ->whereHas('assessments', fn ($q) => $q->whereIn('application_id', $request->assessments))
                ->exists();

            if ($duplicateApplication) {
                return $this->errorResponse('A committee meeting for one of these applications is already scheduled at this date and time.', 422);
            }
        }

        if (CommitteeMeeting::whereIn('status', $activeStatuses)->where('scheduled_at', $scheduledAt)->exists()) {
            return $this->errorResponse('A committee meeting is already scheduled at this date and time. Please choose a different slot.', 422);
        }

        try {
            DB::beginTransaction();

            // Generate meeting number
            $meetingNumber = $this->generateMeetingNumber();

            // Map frontend meeting_type to database value
            $meetingType = match ($request->meeting_type) {
                'Online' => 'virtual',
                'Offline' => 'physical',
                default => 'physical',
            };

            // Create meeting
            $meeting = CommitteeMeeting::create([
                'meeting_number' => $meetingNumber,
                'title' => $request->title,
                'scheduled_at' => $scheduledAt,
                'meeting_type' => $meetingType,
                'meeting_link' => $request->meeting_link,
                'venue' => $request->meeting_type === 'Offline' ? ($request->venue ?? 'TBD') : null,
                'remarks' => $request->remarks,
                'chair_id' => $request->chair,
                'convenor_id' => $request->convenor,
                'status' => 'scheduled',
                'created_by' => $request->user()->id,
            ]);

            // Add chair, convenor, and members separately (they are independent selections)
            $addedMemberIds = [];

            // Add chair
            if ($request->chair) {
                MeetingMember::create([
                    'committee_meeting_id' => $meeting->id,
                    'committee_member_id' => $request->chair,
                    'role' => 'chair',
                    'added_by' => $request->user()->id,
                ]);
                $addedMemberIds[] = $request->chair;
            }

            // Add convenor (if not same as chair)
            if ($request->convenor && ! in_array($request->convenor, $addedMemberIds)) {
                MeetingMember::create([
                    'committee_meeting_id' => $meeting->id,
                    'committee_member_id' => $request->convenor,
                    'role' => 'convenor',
                    'added_by' => $request->user()->id,
                ]);
                $addedMemberIds[] = $request->convenor;
            }

            // Add remaining members (if not already added as chair/convenor)
            $memberIds = $request->members ?? [];
            foreach ($memberIds as $committeeMemberId) {
                if (! in_array($committeeMemberId, $addedMemberIds)) {
                    MeetingMember::create([
                        'committee_meeting_id' => $meeting->id,
                        'committee_member_id' => $committeeMemberId,
                        'role' => 'member',
                        'added_by' => $request->user()->id,
                    ]);
                    $addedMemberIds[] = $committeeMemberId;
                }
            }

            // Add assessments via the pivot service (handles both pivot write and status transition atomically).
            if ($request->has('assessments') && ! empty($request->assessments)) {
                $pivotService = app(CommitteeMeetingAssessmentService::class);
                foreach ($request->assessments as $applicationId) {
                    $assessment = Assessment::where('application_id', $applicationId)->first();
                    if ($assessment) {
                        $pivotService->attach($meeting, $assessment, $request->user());
                    }
                }
            }

            DB::commit();

            // The summary-sheet PDF is an attachment, not a precondition for the invite.
            // Generate it in its own try/catch so a PDF failure never suppresses the
            // meeting-scheduled email — members still get the invitation, just without
            // the attachment.
            $pdfPath = null;
            try {
                $pdfResult = app(MeetingSummarySheetService::class)->generateAndStorePdf($meeting);
                $pdfPath = $pdfResult['path'];

                Log::info('Summary sheet PDF generated for meeting', [
                    'meeting_id' => $meeting->id,
                    'pdf_path' => $pdfPath,
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to generate summary sheet PDF for meeting invitation', [
                    'meeting_id' => $meeting->id,
                    'error' => $e->getMessage(),
                ]);
            }

            try {
                $this->sendMeetingScheduledEmail($meeting, $pdfPath);
            } catch (\Exception $e) {
                Log::error('Failed to send meeting invitation email', [
                    'meeting_id' => $meeting->id,
                    'error' => $e->getMessage(),
                ]);
            }

            return $this->successResponse(
                ['meeting' => $this->formatMeeting($meeting->fresh(['members.committeeMember', 'chair', 'convenor']))],
                'Committee meeting created successfully.',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to create committee meeting.');
        }
    }

    /**
     * Update committee meeting.
     */
    #[OA\Put(
        path: '/api/v1/committee-meetings/{id}',
        summary: 'Update a committee meeting',
        description: 'Updates a scheduled or rescheduled committee meeting. Operations Managers and Operations Admins can update meetings.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'title',
                        type: 'string',
                        example: 'Updated Meeting Title',
                        maxLength: 255,
                    ),
                    new OA\Property(
                        property: 'meeting_date',
                        type: 'string',
                        format: 'date',
                        example: '2024-03-20',
                    ),
                    new OA\Property(property: 'meeting_time', type: 'string', example: '15:00'),
                    new OA\Property(
                        property: 'venue',
                        type: 'string',
                        example: 'Conference Room B',
                        maxLength: 255,
                    ),
                    new OA\Property(property: 'agenda', type: 'string', nullable: true, example: 'Updated agenda'),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Meeting updated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Committee meeting updated successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'meeting',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(
                                            property: 'meeting_number',
                                            type: 'string',
                                            example: 'COM-2024-0001',
                                        ),
                                        new OA\Property(
                                            property: 'title',
                                            type: 'string',
                                            example: 'Updated Meeting Title',
                                        ),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - Can only update scheduled or rescheduled meetings or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Can only update scheduled or rescheduled meetings.',
                        ),
                        new OA\Property(property: 'errors', type: 'object', nullable: true),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Only Operations Managers can update committee meetings',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Only Operations Managers can update committee meetings.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'Meeting not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'No query results for model [App\\\\Models\\\\CommitteeMeeting].',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Failed to update meeting',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to update committee meeting.',
                        ),
                        new OA\Property(property: 'error', type: 'string'),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $meeting = CommitteeMeeting::find($id);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found.', 404);
        }

        // Only Operations Admin can update meetings
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can update committee meetings.', 403);
        }

        // Can only update scheduled meetings
        if (! in_array($meeting->status, ['scheduled', 'rescheduled'])) {
            return $this->errorResponse('Can only update scheduled or rescheduled meetings.', 400);
        }

        // Validation - transformer converts camelCase to snake_case
        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'members' => 'sometimes|array|min:1',
            'members.*' => 'exists:committee_members,id',
            'chair' => 'sometimes|exists:committee_members,id',
            'convenor' => 'sometimes|exists:committee_members,id',
            'assessments' => 'sometimes|array',
            'assessments.*' => 'exists:applications,id',
            'meeting_type' => 'sometimes|in:Online,Offline',
            'meeting_link' => 'nullable|string',
            'venue' => 'nullable|string|max:500',
            'date' => 'sometimes|date_format:Y-m-d|after_or_equal:today',
            'time' => 'sometimes|date_format:H:i',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            DB::beginTransaction();

            $updateData = [];

            if ($request->has('title')) {
                $updateData['title'] = $request->title;
            }

            // Handle date and time - combine into scheduled_at
            if ($request->has('date') || $request->has('time')) {
                $dateOnly = $request->date
                    ? Carbon::parse($request->date)->format('Y-m-d')
                    : $meeting->scheduled_at?->format('Y-m-d');
                $time = $request->time ?? $meeting->scheduled_at?->format('H:i');
                $updateData['scheduled_at'] = Carbon::parse($dateOnly.' '.$time);
            }

            if ($request->has('meeting_type')) {
                $updateData['meeting_type'] = match ($request->meeting_type) {
                    'Online' => 'virtual',
                    'Offline' => 'physical',
                    default => 'physical',
                };
            }

            if ($request->has('meeting_link')) {
                $updateData['meeting_link'] = $request->meeting_link;
            }

            if ($request->has('venue')) {
                $updateData['venue'] = $request->venue;
            }

            if ($request->has('remarks')) {
                $updateData['remarks'] = $request->remarks;
            }

            if ($request->has('chair')) {
                $updateData['chair_id'] = $request->chair;
            }

            if ($request->has('convenor')) {
                $updateData['convenor_id'] = $request->convenor;
            }

            $updateData['updated_by'] = $request->user()->id;

            $meeting->update($updateData);

            // Update members if any of chair, convenor, or members changed
            if ($request->has('members') || $request->has('chair') || $request->has('convenor')) {
                // Remove existing members and add new ones
                $meeting->members()->delete();

                $addedMemberIds = [];
                $chairId = $request->chair ?? $meeting->chair_id;
                $convenorId = $request->convenor ?? $meeting->convenor_id;
                $memberIds = $request->members ?? [];

                // Add chair
                if ($chairId) {
                    MeetingMember::create([
                        'committee_meeting_id' => $meeting->id,
                        'committee_member_id' => $chairId,
                        'role' => 'chair',
                        'added_by' => $request->user()->id,
                    ]);
                    $addedMemberIds[] = $chairId;
                }

                // Add convenor (if not same as chair)
                if ($convenorId && ! in_array($convenorId, $addedMemberIds)) {
                    MeetingMember::create([
                        'committee_meeting_id' => $meeting->id,
                        'committee_member_id' => $convenorId,
                        'role' => 'convenor',
                        'added_by' => $request->user()->id,
                    ]);
                    $addedMemberIds[] = $convenorId;
                }

                // Add remaining members (if not already added as chair/convenor)
                foreach ($memberIds as $committeeMemberId) {
                    if (! in_array($committeeMemberId, $addedMemberIds)) {
                        MeetingMember::create([
                            'committee_meeting_id' => $meeting->id,
                            'committee_member_id' => $committeeMemberId,
                            'role' => 'member',
                            'added_by' => $request->user()->id,
                        ]);
                        $addedMemberIds[] = $committeeMemberId;
                    }
                }
            }

            // Update assessments via the pivot service.
            if ($request->has('assessments')) {
                $pivotService = app(CommitteeMeetingAssessmentService::class);
                $newApplicationIds = $request->assessments ?? [];
                $newAssessmentIds = Assessment::whereIn('application_id', $newApplicationIds)->pluck('id')->toArray();
                $currentAssessmentIds = $meeting->meetingAssessments()->pluck('assessment_id')->toArray();

                // Detach pending pivots no longer in the list (rolls back assessment.status).
                $meeting->meetingAssessments()
                    ->whereNotIn('assessment_id', $newAssessmentIds)
                    ->where('decision', 'pending')
                    ->with('assessment')
                    ->get()
                    ->each(fn ($pivot) => $pivotService->detach($pivot, $request->user()));

                // Attach newly added assessments.
                foreach ($newApplicationIds as $applicationId) {
                    $assessment = Assessment::where('application_id', $applicationId)->first();
                    if ($assessment && ! in_array($assessment->id, $currentAssessmentIds)) {
                        $pivotService->attach($meeting, $assessment, $request->user());
                    }
                }
            }

            DB::commit();

            // Regenerate the summary-sheet PDF and notify members of the updated details.
            // PDF generation is separate from the notification so a PDF failure never
            // suppresses the update email — members still learn the details changed.
            $pdfPath = null;
            try {
                $pdfResult = app(MeetingSummarySheetService::class)->generateAndStorePdf($meeting);
                $pdfPath = $pdfResult['path'];

                Log::info('Summary sheet PDF regenerated for updated meeting', [
                    'meeting_id' => $meeting->id,
                    'pdf_path' => $pdfPath,
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to regenerate summary sheet PDF for updated meeting', [
                    'meeting_id' => $meeting->id,
                    'error' => $e->getMessage(),
                ]);
            }

            try {
                $this->sendMeetingUpdatedEmail($meeting, $pdfPath);
            } catch (\Exception $e) {
                Log::error('Failed to send meeting update email', [
                    'meeting_id' => $meeting->id,
                    'error' => $e->getMessage(),
                ]);
            }

            return $this->successResponse(
                ['meeting' => $this->formatMeeting($meeting->fresh(['members.committeeMember', 'chair', 'convenor']))],
                'Committee meeting updated successfully.'
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to update committee meeting.');
        }
    }

    /**
     * Start committee meeting.
     */
    #[OA\Post(
        path: '/api/v1/committee-meetings/{id}/start',
        summary: 'Start a committee meeting',
        description: 'Starts a scheduled committee meeting. Operations Managers and Operations Admins can start meetings.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Meeting started successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Meeting started successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'meeting',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(
                                            property: 'meeting_number',
                                            type: 'string',
                                            example: 'COM-2024-0001',
                                        ),
                                        new OA\Property(
                                            property: 'status',
                                            type: 'string',
                                            example: 'in_progress',
                                        ),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Meeting must be in scheduled status',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Meeting must be in scheduled status.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Only Operations Managers and Operations Admins can start meetings',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Only Operations Managers and Operations Admins can start meetings.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'Meeting not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'No query results for model [App\\\\Models\\\\CommitteeMeeting].',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Failed to start meeting',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Failed to start meeting.'),
                        new OA\Property(property: 'error', type: 'string'),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function start(Request $request, int $id): JsonResponse
    {
        $meeting = CommitteeMeeting::find($id);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found.', 404);
        }

        // Only Operations Admin can start meetings
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can start meetings.', 403);
        }

        if ($meeting->status !== 'scheduled') {
            return $this->errorResponse('Meeting must be in scheduled status.', 400);
        }

        // Ensure meeting has at least one member assigned
        if ($meeting->members()->count() === 0) {
            return $this->errorResponse('Cannot start meeting without any members assigned.', 400);
        }

        // Ensure meeting has at least one assessment to review
        if ($meeting->meetingAssessments()->count() === 0) {
            return $this->errorResponse('Cannot start meeting without any assessments to review.', 400);
        }

        try {
            DB::beginTransaction();

            // Repair any pivot↔status drift before going in_progress — otherwise
            // committee_decision will 400 mid-meeting when it can't transition the assessment.
            app(CommitteeMeetingAssessmentService::class)->ensureReadyToStart($meeting, $request->user());

            $meeting->update([
                'status' => 'in_progress',
                'started_at' => now(),
            ]);

            DB::commit();

            return $this->successResponse(
                ['meeting' => $this->formatMeeting($meeting->fresh())],
                'Meeting started successfully.'
            );
        } catch (\RuntimeException $e) {
            DB::rollBack();

            // CommitteeMeetingAssessmentService's messages name internal record
            // ids and the pivot table ("Pivot #123 has no backing assessment"),
            // so they are logged, not returned. The reference id lets support
            // find the detail.
            return $this->serverErrorResponse($e, 'The meeting could not be started in its current state.', 422);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to start meeting.');
        }
    }

    /**
     * Complete committee meeting.
     */
    #[OA\Post(
        path: '/api/v1/committee-meetings/{id}/complete',
        summary: 'Complete a committee meeting',
        description: 'Completes an in-progress committee meeting with optional minutes and summary. Operations Managers and Operations Admins can complete meetings.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'minutes',
                        type: 'string',
                        nullable: true,
                        example: 'Discussion on applications APP-2024-0001, APP-2024-0002...',
                    ),
                    new OA\Property(
                        property: 'summary',
                        type: 'string',
                        nullable: true,
                        example: '5 applications reviewed, 3 approved, 2 deferred',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Meeting completed successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Meeting completed successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'meeting',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(
                                            property: 'meeting_number',
                                            type: 'string',
                                            example: 'COM-2024-0001',
                                        ),
                                        new OA\Property(property: 'status', type: 'string', example: 'completed'),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - Meeting must be in progress or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Meeting must be in progress.',
                        ),
                        new OA\Property(property: 'errors', type: 'object', nullable: true),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Only Operations Managers and Operations Admins can complete meetings',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Only Operations Managers and Operations Admins can complete meetings.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'Meeting not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'No query results for model [App\\\\Models\\\\CommitteeMeeting].',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Failed to complete meeting',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to complete meeting.',
                        ),
                        new OA\Property(property: 'error', type: 'string'),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function complete(Request $request, int $id): JsonResponse
    {
        $meeting = CommitteeMeeting::find($id);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found.', 404);
        }

        // Only Operations Admin can complete meetings
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can complete meetings.', 403);
        }

        if ($meeting->status !== 'in_progress') {
            return $this->errorResponse('Meeting must be in progress.', 400);
        }

        if ($meeting->meetingAssessments()->count() === 0) {
            return $this->errorResponse('Cannot complete meeting with no assessments attached.', 422);
        }

        $undecidedCount = CommitteeMeetingAssessment::where('committee_meeting_id', $meeting->id)
            ->where('decision', 'pending')
            ->count();

        if ($undecidedCount > 0) {
            return $this->errorResponse(
                "Cannot complete meeting — {$undecidedCount} assessment(s) still need a committee decision.",
                422
            );
        }

        $validator = Validator::make($request->all(), [
            'minutes' => 'nullable|string',
            'summary' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            $meeting->update([
                'status' => 'completed',
                'ended_at' => now(),
                'minutes' => $request->minutes,
            ]);

            // Apply each committee decision now that the meeting has formally ended. Decisions
            // were captured (not applied) during the meeting so results stayed hidden; here we run
            // the deferred transitions — certify creates the certificate and syncs the application
            // to certified, send-back moves the assessment to committee_feedback. This must run
            // before the MoM/decision emails so the certificate exists for the certified email.
            $applyFailures = [];
            foreach ($meeting->meetingAssessments()->with('assessment.application')->get() as $pivot) {
                $assessment = $pivot->assessment;

                // Idempotency: only act on assessments still awaiting the committee result.
                if (! $assessment || $assessment->status !== Assessment::STATUS_COMMITTEE_REVIEW) {
                    continue;
                }

                $transition = match ($pivot->decision) {
                    'certified' => 'certify',
                    'feedback' => 'committee_feedback',
                    default => null,
                };

                if (! $transition) {
                    continue;
                }

                try {
                    $assessment->stateMachine($request->user())->transition(
                        $transition,
                        ['remarks' => $pivot->remarks]
                    );

                    // The certify transition creates the certificate and syncs the application in
                    // afterTransition, but that path deliberately swallows its own failures so the
                    // status change isn't lost. Verify the certificate actually exists so a silently
                    // failed certification is surfaced here instead of producing a certificate-less
                    // certified email downstream.
                    if ($transition === 'certify'
                        && ! ($assessment->application
                            && $assessment->application->certificate()
                                ->whereIn('status', ['active', 'suspended'])
                                ->exists())) {
                        $applyFailures[] = $assessment->id;
                        Log::error('Committee certification applied but no certificate was created', [
                            'meeting_id' => $meeting->id,
                            'assessment_id' => $assessment->id,
                        ]);
                    }
                } catch (\Exception $e) {
                    $applyFailures[] = $assessment->id;
                    Log::error('Failed to apply committee decision at meeting close', [
                        'meeting_id' => $meeting->id,
                        'assessment_id' => $assessment->id,
                        'decision' => $pivot->decision,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $message = empty($applyFailures)
                ? 'Meeting completed successfully.'
                : 'Meeting completed, but '.count($applyFailures).' assessment decision(s) could not be fully applied. Please review.';

            $response = $this->successResponse(
                ['meeting' => $this->formatMeeting($meeting->fresh(['members.committeeMember', 'chair', 'convenor']), true)],
                $message
            );

            // The meeting is already fully completed above (status + decision transitions committed
            // to the DB). The MoM PDF and decision emails are slow (PDF rendering + SMTP round-trips
            // per assessment) and not needed for the response: they run on the queue worker, or
            // after the response in this process when no worker is configured (sync queue).
            $tail = new RunCommitteeMeetingCloseTail($meeting->id);
            if (config('queue.default') === 'sync') {
                defer(fn () => dispatch_sync($tail))->name('committee-meeting-'.$meeting->id.'-close-tail');
            } else {
                dispatch($tail);
            }

            return $response;
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to complete meeting.');
        }
    }

    /**
     * Cancel a scheduled committee meeting.
     */
    #[OA\Post(
        path: '/api/v1/committee-meetings/{id}/cancel',
        summary: 'Cancel a committee meeting',
        description: 'Cancels a scheduled or rescheduled committee meeting. Reverts associated pending assessments from \'Committee Review Scheduled\' back to \'Ready for Committee Review\'. Only Operations Admins can cancel meetings.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['reason'],
                properties: [
                    new OA\Property(
                        property: 'reason',
                        type: 'string',
                        example: 'Unavoidable circumstances require postponement.',
                        description: 'Reason for cancelling the meeting',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Meeting cancelled successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Committee meeting cancelled successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'meeting',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(
                                            property: 'meetingNumber',
                                            type: 'string',
                                            example: 'COM-2024-0001',
                                        ),
                                        new OA\Property(property: 'status', type: 'string', example: 'cancelled'),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - Meeting is not in a cancellable state or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Only scheduled or rescheduled meetings can be cancelled.',
                        ),
                        new OA\Property(property: 'errors', type: 'object', nullable: true),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Only Operations Admins can cancel meetings',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Only Operations Admins can cancel committee meetings.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'Meeting not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Committee meeting not found.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Failed to cancel meeting',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to cancel committee meeting.',
                        ),
                        new OA\Property(property: 'error', type: 'string'),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function cancel(Request $request, int $id): JsonResponse
    {
        $meeting = CommitteeMeeting::find($id);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found.', 404);
        }

        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can cancel committee meetings.', 403);
        }

        if (! in_array($meeting->status, ['scheduled', 'rescheduled'])) {
            return $this->errorResponse('Only scheduled or rescheduled meetings can be cancelled.', 400);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        try {
            DB::beginTransaction();

            $meeting->update([
                'status' => 'cancelled',
                'cancellation_reason' => $request->reason,
                'cancelled_at' => now(),
                'cancelled_by' => $request->user()->id,
            ]);

            // Revert pending assessments from committee_review back to ready_for_committee.
            app(CommitteeMeetingAssessmentService::class)->detachAllPending($meeting, $request->user());

            DB::commit();

            // Send cancellation email to all members outside the transaction
            try {
                $this->sendMeetingCancelledEmail($meeting);
            } catch (\Exception $e) {
                Log::error('Failed to send meeting cancellation emails', [
                    'meeting_id' => $meeting->id,
                    'error' => $e->getMessage(),
                ]);
            }

            Log::info('Committee meeting cancelled', [
                'meeting_id' => $meeting->id,
                'cancelled_by' => $request->user()->id,
                'reason' => $request->reason,
            ]);

            return $this->successResponse(
                ['meeting' => $this->formatMeeting($meeting->fresh(['members.committeeMember', 'chair', 'convenor']))],
                'Committee meeting cancelled successfully.'
            );
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to cancel committee meeting', [
                'meeting_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->serverErrorResponse($e, 'Failed to cancel committee meeting.');
        }
    }

    /**
     * Delete a committee meeting.
     */
    #[OA\Delete(
        path: '/api/v1/committee-meetings/{id}',
        summary: 'Delete a committee meeting',
        description: 'Soft deletes a committee meeting. Can only delete meetings with status: scheduled, cancelled, or postponed. Cannot delete in-progress or completed meetings.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Meeting deleted successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Committee meeting deleted successfully',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Cannot delete in-progress or completed meetings',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Cannot delete in-progress or completed meetings',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Only Operations Managers and Admins can delete meetings',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Unauthorized to delete committee meetings',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'Meeting not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Committee meeting not found',
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ],
    )]
    public function destroy(Request $request, int $id): JsonResponse
    {
        $meeting = CommitteeMeeting::find($id);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found', 404);
        }

        // Only Operations Admin can delete meetings
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can delete committee meetings.', 403);
        }

        // Can only delete scheduled, cancelled, or postponed meetings
        if (in_array($meeting->status, ['in_progress', 'completed'])) {
            return $this->errorResponse('Cannot delete in-progress or completed meetings', 400);
        }

        try {
            $meeting->delete();

            return $this->successResponse(null, 'Committee meeting deleted successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to delete committee meeting');
        }
    }

    /**
     * Get members list for a meeting.
     */
    #[OA\Get(
        path: '/api/v1/committee-meetings/{meetingId}/members',
        summary: 'Get meeting members',
        description: 'Retrieves the members list for a committee meeting.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'meetingId',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Members retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Members retrieved successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'members',
                                    type: 'array',
                                    items: new OA\Items(
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer', example: 1),
                                            new OA\Property(property: 'userId', type: 'integer', example: 5),
                                            new OA\Property(property: 'name', type: 'string', example: 'John Doe'),
                                            new OA\Property(
                                                property: 'email',
                                                type: 'string',
                                                example: 'john@example.com',
                                            ),
                                            new OA\Property(
                                                property: 'phone',
                                                type: 'string',
                                                example: '9876543210',
                                            ),
                                            new OA\Property(
                                                property: 'organization',
                                                type: 'string',
                                                example: 'ABC Corp',
                                            ),
                                            new OA\Property(
                                                property: 'designation',
                                                type: 'string',
                                                example: 'Technical Lead',
                                            ),
                                            new OA\Property(property: 'role', type: 'string', example: 'member'),
                                            new OA\Property(
                                                property: 'attended',
                                                type: 'boolean',
                                                nullable: true,
                                                example: true,
                                            ),
                                        ],
                                    ),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 404, description: 'Meeting not found'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ],
    )]
    public function getMembers(Request $request, int $meetingId): JsonResponse
    {
        // View access: DRDO Admin, Operations Manager, Operations Admin, Assessor
        if (! $request->user()->hasAnyRole([Role::DRDO_ADMIN, Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN])) {
            return $this->errorResponse('Unauthorized to view meeting members.', 403);
        }

        $meeting = CommitteeMeeting::find($meetingId);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found.', 404);
        }

        $members = MeetingMember::where('committee_meeting_id', $meetingId)
            ->with('committeeMember')
            ->get();

        $formattedMembers = $members->map(fn ($record) => $this->formatMeetingMember($record));

        return $this->successResponse(
            ['members' => $formattedMembers],
            'Members retrieved successfully.'
        );
    }

    /**
     * Add a member to a meeting.
     */
    #[OA\Post(
        path: '/api/v1/committee-meetings/{meetingId}/members',
        summary: 'Add member to meeting',
        description: 'Adds a new member to a committee meeting. Creates user if not exists.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'meetingId',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['firstName', 'lastName', 'email', 'mobile', 'designation', 'organisation'],
                properties: [
                    new OA\Property(property: 'firstName', type: 'string', example: 'John'),
                    new OA\Property(property: 'lastName', type: 'string', example: 'Doe'),
                    new OA\Property(
                        property: 'email',
                        type: 'string',
                        format: 'email',
                        example: 'john@example.com',
                    ),
                    new OA\Property(property: 'mobile', type: 'string', example: '9876543210'),
                    new OA\Property(property: 'designation', type: 'string', example: 'Technical Lead'),
                    new OA\Property(property: 'organisation', type: 'string', example: 'ABC Corp'),
                    new OA\Property(
                        property: 'role',
                        type: 'string',
                        enum: ['chair', 'convenor', 'member'],
                        example: 'member',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Member added successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Member added successfully.',
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Validation failed or user already a member'),
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 404, description: 'Meeting not found'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ],
    )]
    public function addMember(Request $request, int $meetingId): JsonResponse
    {
        $meeting = CommitteeMeeting::find($meetingId);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found.', 404);
        }

        // Only Operations Admin can add members
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can add members.', 403);
        }

        // Cannot add members to completed/cancelled meetings
        if (in_array($meeting->status, ['completed', 'cancelled'])) {
            return $this->errorResponse('Cannot add members to completed or cancelled meetings.', 400);
        }

        // Accept either committee_member_id OR member details to find/create CommitteeMember
        $validator = Validator::make($request->all(), [
            'committee_member_id' => 'required_without_all:first_name,email|exists:committee_members,id',
            'first_name' => ['required_without:committee_member_id', 'string', 'max:255', new PersonName],
            'last_name' => ['required_without:committee_member_id', 'string', 'max:255', new PersonName],
            'email' => 'required_without:committee_member_id|email|max:255',
            'mobile_number' => 'sometimes|string|regex:/^[0-9]{10}$/',
            'designation' => 'sometimes|string|max:255',
            'organisation' => 'sometimes|string|max:255',
            'role' => 'sometimes|in:chair,convenor,member',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        try {
            DB::beginTransaction();

            $committeeMember = null;
            $isNewCommitteeMember = false;

            // If committee_member_id is provided, use it directly
            if ($request->has('committee_member_id')) {
                $committeeMember = CommitteeMember::find($request->committee_member_id);
            } else {
                // Find or create CommitteeMember by email
                $committeeMember = CommitteeMember::where('email', $request->email)->first();

                if (! $committeeMember) {
                    // Create new CommitteeMember
                    $committeeMember = CommitteeMember::create([
                        'first_name' => $request->first_name,
                        'last_name' => $request->last_name,
                        'email' => $request->email,
                        'mobile_number' => $request->mobile_number,
                        'designation' => $request->designation,
                        'organisation' => $request->organisation,
                        'status' => 'active',
                        'created_by' => $request->user()->id,
                    ]);
                    $isNewCommitteeMember = true;
                }
            }

            // Check if CommitteeMember is already a member of this meeting
            if (MeetingMember::where('committee_meeting_id', $meetingId)->where('committee_member_id', $committeeMember->id)->exists()) {
                DB::rollBack();

                return $this->errorResponse('This member is already part of this meeting.', 400);
            }

            $role = $request->get('role', 'member');

            $member = MeetingMember::create([
                'committee_meeting_id' => $meeting->id,
                'committee_member_id' => $committeeMember->id,
                'role' => $role,
                'added_by' => $request->user()->id,
            ]);

            DB::commit();

            // Send welcome email only if this is a newly created committee member
            if ($isNewCommitteeMember) {
                $this->sendCommitteeCreatedEmail($committeeMember);
            }

            $member->load('committeeMember');

            return $this->successResponse(
                ['member' => $this->formatMeetingMember($member)],
                'Member added successfully.',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to add member.');
        }
    }

    /**
     * Update a member in a meeting.
     */
    #[OA\Put(
        path: '/api/v1/committee-meetings/{meetingId}/members/{memberId}',
        summary: 'Update meeting member',
        description: 'Updates a member\'s details or attendance status in a meeting.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'meetingId',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'memberId',
                in: 'path',
                description: 'Member ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 5),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'role',
                        type: 'string',
                        enum: ['chair', 'convenor', 'member'],
                        example: 'convenor',
                    ),
                    new OA\Property(property: 'attended', type: 'boolean', example: true),
                    new OA\Property(
                        property: 'attendanceNotes',
                        type: 'string',
                        nullable: true,
                        example: 'Joined late',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Member updated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Member updated successfully.',
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Validation failed'),
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 404, description: 'Meeting or member not found'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ],
    )]
    public function updateMember(Request $request, int $meetingId, int $memberId): JsonResponse
    {
        $meeting = CommitteeMeeting::find($meetingId);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found.', 404);
        }

        // Only Operations Admin can update members
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can update members.', 403);
        }

        $member = MeetingMember::where('committee_meeting_id', $meetingId)
            ->where('id', $memberId)
            ->first();

        if (! $member) {
            return $this->errorResponse('Member not found in this meeting.', 404);
        }

        $validator = Validator::make($request->all(), [
            'role' => 'sometimes|in:chair,convenor,member',
            'attended' => 'sometimes|boolean',
            'attendance_notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        try {
            $updateData = [];

            if ($request->has('role')) {
                $updateData['role'] = $request->role;
            }
            if ($request->has('attended')) {
                $updateData['attended'] = $request->attended;
            }
            if ($request->has('attendance_notes')) {
                $updateData['attendance_notes'] = $request->attendance_notes;
            }

            $member->update($updateData);

            return $this->successResponse(
                ['member' => $this->formatMeetingMember($member->fresh()->load('committeeMember'))],
                'Member updated successfully.'
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to update member.');
        }
    }

    /**
     * Remove a member from a meeting.
     */
    #[OA\Delete(
        path: '/api/v1/committee-meetings/{meetingId}/members/{memberId}',
        summary: 'Remove member from meeting',
        description: 'Removes a member from a committee meeting.',
        tags: ['Committee Meetings'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'meetingId',
                in: 'path',
                description: 'Meeting ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'memberId',
                in: 'path',
                description: 'Member ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 5),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Member removed successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Member removed successfully.',
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Cannot remove from completed/cancelled meeting'),
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 404, description: 'Meeting or member not found'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ],
    )]
    public function deleteMember(Request $request, int $meetingId, int $memberId): JsonResponse
    {
        $meeting = CommitteeMeeting::find($meetingId);

        if (! $meeting) {
            return $this->errorResponse('Committee meeting not found.', 404);
        }

        // Only Operations Admin can remove members
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can remove members.', 403);
        }

        // Cannot remove members from completed/cancelled meetings
        if (in_array($meeting->status, ['completed', 'cancelled'])) {
            return $this->errorResponse('Cannot remove members from completed or cancelled meetings.', 400);
        }

        $member = MeetingMember::where('committee_meeting_id', $meetingId)
            ->where('id', $memberId)
            ->first();

        if (! $member) {
            return $this->errorResponse('Member not found in this meeting.', 404);
        }

        try {
            $member->delete();

            return $this->successResponse(null, 'Member removed successfully.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to remove member.');
        }
    }

    /**
     * Generate unique meeting number.
     */
    private function generateMeetingNumber(): string
    {
        $year = date('Y');
        $prefix = 'COM-'.$year.'-';

        // Get the highest sequence number for this year (including soft-deleted)
        // Uses pessimistic lock to prevent race conditions on concurrent requests
        $maxMeetingNumber = CommitteeMeeting::withTrashed()
            ->where('meeting_number', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING(meeting_number, -4) AS UNSIGNED) DESC')
            ->lockForUpdate()
            ->value('meeting_number');

        $sequence = $maxMeetingNumber ? intval(substr($maxMeetingNumber, -4)) + 1 : 1;

        return $prefix.str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Format meeting data for response.
     * Uses frontend field names for consistency.
     */
    private function formatMeeting(CommitteeMeeting $meeting, bool $detailed = false): array
    {
        // Map backend meeting_type to frontend meetingType
        $meetingType = match ($meeting->meeting_type) {
            'virtual' => 'Online',
            'physical' => 'Offline',
            'hybrid' => 'Offline',
            default => 'Offline',
        };

        $data = [
            'id' => $meeting->id,
            'meetingNumber' => $meeting->meeting_number,
            'title' => $meeting->title,
            // Frontend field names
            'date' => $meeting->scheduled_at?->format('Y-m-d'),
            'time' => $meeting->scheduled_at?->format('H:i'),
            'meetingType' => $meetingType,
            'venue' => $meeting->venue,
            'meetingLink' => $meeting->meeting_link,
            'remarks' => $meeting->remarks,
            'status' => $meeting->status,
            'chair' => $meeting->chair_id,
            'convenor' => $meeting->convenor_id,
            'startedAt' => $meeting->started_at?->toIso8601String(),
            'completedAt' => $meeting->ended_at?->toIso8601String(),
            'createdAt' => $meeting->created_at?->toIso8601String(),
        ];

        // Add chair details if loaded
        if ($meeting->relationLoaded('chair') && $meeting->chair) {
            $data['chairDetails'] = [
                'id' => $meeting->chair->id,
                'name' => $meeting->chair->full_name,
                'email' => $meeting->chair->email,
            ];
        }

        // Add convenor details if loaded
        if ($meeting->relationLoaded('convenor') && $meeting->convenor) {
            $data['convenorDetails'] = [
                'id' => $meeting->convenor->id,
                'name' => $meeting->convenor->full_name,
                'email' => $meeting->convenor->email,
            ];
        }

        // Add counts for list view
        if (isset($meeting->members_count)) {
            $data['membersCount'] = $meeting->members_count;
        }

        // Add assessments count from pivot table
        $data['assessmentsCount'] = $meeting->meetingAssessments()->count();

        if ($detailed) {
            $data['minutes'] = $meeting->minutes;

            // Include members array for detailed view (frontend expects this)
            // IMPORTANT: members array should ONLY contain regular members (exclude chair/convenor)
            // because chair and convenor are returned separately via chair/convenor fields
            if ($meeting->relationLoaded('members')) {
                // Filter out chair and convenor from members list
                $regularMembers = $meeting->members->filter(function ($record) use ($meeting) {
                    return $record->committee_member_id !== $meeting->chair_id
                        && $record->committee_member_id !== $meeting->convenor_id;
                });

                $data['members'] = $regularMembers->pluck('committee_member_id')->values()->toArray();
                $data['memberDetails'] = $regularMembers->map(fn ($record) => $this->formatMeetingMember($record))->values();
            }

            // Include assessments from pivot table
            $meetingAssessments = $meeting->meetingAssessments()
                ->with(['assessment.application'])
                ->get();

            $data['assessments'] = $meetingAssessments->pluck('assessment.application_id')->toArray();

            $data['assessmentDetails'] = $meetingAssessments->map(function ($record) {
                $assessment = $record->assessment;
                $application = $assessment?->application;

                return [
                    'id' => $assessment->id,
                    'applicationId' => $assessment->application_id,
                    'applicationNumber' => $application?->application_number,
                    'status' => $assessment->status,
                    'decision' => $record->decision,
                    'enterpriseName' => $application?->enterprise_name ?? 'N/A',
                    'unitName' => $application?->unit_name ?? 'N/A',
                    'unitAddress' => $application?->unit_address ?? 'N/A',
                    'sector' => $application?->sector ?? 'N/A',
                    'enterpriseClassification' => $application?->enterprise_classification,
                    'rating' => Assessment::ratingLabelFromScore($assessment->total_score, 'N/A'),
                    'score' => $assessment->total_score,
                    // total_score is the RC-effective total (uses rc_score where the committee
                    // overrode, else the assessor's selected_score). assessorScore is the
                    // assessor-only total (SA Score for manufacturing / RA Score for service).
                    // The listing shows RC + Rating once certified, else the assessor score.
                    'rcScore' => $assessment->total_score,
                    'assessorScore' => $assessment->calculateAssessorOnlyScore(),
                    'city' => $application?->unit_district ?? $application?->registered_office_district ?? 'N/A',
                    'state' => $application?->unit_state ?? $application?->registered_office_state ?? 'N/A',
                    // Model has scheduled_* / actual_* only — never start_date/end_date
                    'assessmentStartDate' => ($assessment->actual_start_date ?? $assessment->scheduled_start_date)?->format('d M Y'),
                    'assessmentEndDate' => ($assessment->actual_end_date ?? $assessment->scheduled_end_date)?->format('d M Y'),
                    'remarks' => $record->remarks,
                    'decidedAt' => $record->decided_at?->toIso8601String(),
                ];
            })->values();
        }

        return $data;
    }

    /**
     * Format meeting member data for response.
     */
    private function formatMeetingMember(MeetingMember $record): array
    {
        $member = $record->committeeMember;

        return [
            'id' => $record->id,
            'committeeMemberId' => $record->committee_member_id,
            'name' => $member?->full_name,
            'email' => $member?->email,
            'phone' => $member?->mobile_number,
            'organization' => $member?->organisation,
            'designation' => $member?->designation,
            'role' => $record->role ?? 'member',
            'attended' => $record->attended,
            'attendanceNotes' => $record->attendance_notes,
        ];
    }

    /**
     * Send meeting-scheduled invitation email with PDF attachment to all members.
     *
     * @param  string  $pdfPath  Path to the stored PDF in private disk
     */
    private function sendMeetingScheduledEmail(CommitteeMeeting $meeting, ?string $pdfPath = null): void
    {
        $meeting->load(['members.committeeMember']);

        $meetingMode = match ($meeting->meeting_type) {
            'virtual' => 'Online',
            'physical' => 'Offline',
            default => 'Offline',
        };

        $meetingLinkOrVenue = $meeting->meeting_type === 'virtual'
            ? ($meeting->meeting_link ?? 'To be shared')
            : ($meeting->venue ?? 'To be confirmed');

        $emails = $meeting->members
            ->map(fn ($mm) => $mm->committeeMember?->email)
            ->filter()
            ->values()
            ->all();

        if (empty($emails)) {
            return;
        }

        $attachments = [];
        if ($pdfPath !== null && Storage::disk('private')->exists($pdfPath)) {
            $attachments[] = Attachment::fromStorageDisk('private', $pdfPath)
                ->as('Summary-Sheet-'.($meeting->title ?? 'Meeting').'.pdf')
                ->withMime('application/pdf');
        }

        app(EmailNotificationService::class)->sendEmailToAddresses(
            'meeting-scheduled',
            $emails,
            [
                'meeting_date' => $meeting->scheduled_at?->format('d M Y'),
                'meeting_time' => $meeting->scheduled_at?->format('h:i A'),
                'meeting_mode' => $meetingMode,
                'meeting_link_or_venue' => $meetingLinkOrVenue,
                'remarks' => $meeting->remarks,
                'query_form_link' => config('app.frontend_url', '').'/support',
            ],
            ['attachments' => $attachments]
        );

        Log::info('Meeting invitation dispatched', [
            'meeting_id' => $meeting->id,
            'recipient_count' => count($emails),
        ]);
    }

    /**
     * Send meeting-updated email (same details + PDF as the invitation) to all
     * committee members after a meeting's details are changed.
     *
     * @param  string  $pdfPath  Path to the stored PDF in private disk
     */
    private function sendMeetingUpdatedEmail(CommitteeMeeting $meeting, ?string $pdfPath = null): void
    {
        $meeting->load(['members.committeeMember']);

        $meetingMode = match ($meeting->meeting_type) {
            'virtual' => 'Online',
            'physical' => 'Offline',
            default => 'Offline',
        };

        $meetingLinkOrVenue = $meeting->meeting_type === 'virtual'
            ? ($meeting->meeting_link ?? 'To be shared')
            : ($meeting->venue ?? 'To be confirmed');

        $emails = $meeting->members
            ->map(fn ($mm) => $mm->committeeMember?->email)
            ->filter()
            ->values()
            ->all();

        if (empty($emails)) {
            return;
        }

        $attachments = [];
        if ($pdfPath !== null && Storage::disk('private')->exists($pdfPath)) {
            $attachments[] = Attachment::fromStorageDisk('private', $pdfPath)
                ->as('Summary-Sheet-'.($meeting->title ?? 'Meeting').'.pdf')
                ->withMime('application/pdf');
        }

        app(EmailNotificationService::class)->sendEmailToAddresses(
            'meeting-updated',
            $emails,
            [
                'meeting_date' => $meeting->scheduled_at?->format('d M Y'),
                'meeting_time' => $meeting->scheduled_at?->format('h:i A'),
                'meeting_mode' => $meetingMode,
                'meeting_link_or_venue' => $meetingLinkOrVenue,
                'remarks' => $meeting->remarks,
                'query_form_link' => config('app.frontend_url', '').'/support',
            ],
            ['attachments' => $attachments]
        );

        Log::info('Meeting update notification dispatched', [
            'meeting_id' => $meeting->id,
            'recipient_count' => count($emails),
        ]);
    }

    /**
     * Send meeting closed email with Minutes of Meeting PDF to all committee members.
     */
    private function sendMeetingClosedEmail(CommitteeMeeting $meeting, ?string $pdfPath = null): void
    {
        $meeting->load(['members.committeeMember']);

        $emails = $meeting->members
            ->map(fn ($mm) => $mm->committeeMember?->email)
            ->filter()
            ->values()
            ->all();

        if (empty($emails)) {
            return;
        }

        $attachments = [];
        if ($pdfPath !== null && Storage::disk('private')->exists($pdfPath)) {
            $attachments[] = Attachment::fromStorageDisk('private', $pdfPath)
                ->as('Minutes-of-Meeting-'.($meeting->title ?? 'Meeting').'.pdf')
                ->withMime('application/pdf');
        }

        app(EmailNotificationService::class)->sendEmailToAddresses(
            'meeting-closed',
            $emails,
            [
                'meeting_date' => $meeting->scheduled_at?->format('d M Y') ?? 'N/A',
                'remarks' => $meeting->remarks,
                'query_form_link' => config('app.frontend_url', '').'/support',
            ],
            ['attachments' => $attachments]
        );

        Log::info('Meeting closed (MoM) dispatched', [
            'meeting_id' => $meeting->id,
            'recipient_count' => count($emails),
        ]);
    }

    /**
     * Send meeting cancellation email to all committee members.
     */
    private function sendMeetingCancelledEmail(CommitteeMeeting $meeting): void
    {
        $meeting->load(['members.committeeMember']);

        $emails = $meeting->members
            ->map(fn ($mm) => $mm->committeeMember?->email)
            ->filter()
            ->values()
            ->all();

        if (empty($emails)) {
            return;
        }

        app(EmailNotificationService::class)->sendEmailToAddresses(
            'meeting-cancelled',
            $emails,
            [
                'meeting_date' => $meeting->scheduled_at?->format('d M Y') ?? 'N/A',
                'meeting_time' => $meeting->scheduled_at?->format('h:i A') ?? 'N/A',
                'remarks' => $meeting->remarks,
            ]
        );

        Log::info('Meeting cancellation dispatched', [
            'meeting_id' => $meeting->id,
            'recipient_count' => count($emails),
        ]);
    }

    /**
     * Send decision-specific emails after meeting is closed.
     * - Certified: Certificate PDF + Assessment Report PDF to Owner, Enterprise Admin, Unit Admin
     * - Feedback/Clarification: closure email to Lead Assessor + Co-Assessors
     */
    private function sendDecisionEmails(CommitteeMeeting $meeting): void
    {
        $meeting->load([
            'meetingAssessments.assessment.application.organization.users.roles',
            'meetingAssessments.assessment.application.certificate',
            'meetingAssessments.assessment.teamMembers.user',
            'meetingAssessments.assessment.parameters.questions',
            'meetingAssessments.assessment.responses',
        ]);

        Log::info('Processing decision emails for meeting', [
            'meeting_id' => $meeting->id,
            'meeting_assessments_count' => $meeting->meetingAssessments->count(),
            'decisions' => $meeting->meetingAssessments->map(fn ($ma) => [
                'id' => $ma->id,
                'assessment_id' => $ma->assessment_id,
                'decision' => $ma->decision,
            ])->toArray(),
        ]);

        foreach ($meeting->meetingAssessments as $ma) {
            $assessment = $ma->assessment;
            if (! $assessment) {
                Log::warning('No assessment found for meeting assessment', [
                    'meeting_assessment_id' => $ma->id,
                    'meeting_id' => $meeting->id,
                ]);

                continue;
            }

            $application = $assessment->application;
            if (! $application) {
                Log::warning('No application found for assessment in meeting', [
                    'assessment_id' => $assessment->id,
                    'meeting_id' => $meeting->id,
                ]);

                continue;
            }

            try {
                if ($ma->decision === 'certified') {
                    $this->sendCertifiedEmail($application, $assessment);
                    $this->sendAssessmentFeedbackRequestEmail($assessment);
                } elseif ($ma->decision === 'feedback') {
                    app(CommitteeClarificationNotifier::class)->notify($application, $assessment);
                } else {
                    Log::warning('Unexpected decision for meeting assessment', [
                        'meeting_assessment_id' => $ma->id,
                        'decision' => $ma->decision,
                        'assessment_id' => $assessment->id,
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('Failed to send decision email for assessment', [
                    'meeting_id' => $meeting->id,
                    'assessment_id' => $assessment->id,
                    'decision' => $ma->decision,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }
    }

    /**
     * Send certificate issued email with Certificate PDF and Assessment Report
     * PDF attached. Recipients (enterprise + unit admins) are resolved by the
     * notification service from the certificate-issued template's recipient_roles.
     */
    private function sendCertifiedEmail($application, $assessment): void
    {
        Log::info('Starting certificate email preparation', [
            'application_id' => $application->id,
            'assessment_id' => $assessment->id,
        ]);

        $attachments = [];

        $certificate = $application->certificate;
        $certPdfGenerated = false;
        if ($certificate) {
            try {
                $certificateService = app(CertificateService::class);
                $certificatePdfContent = $certificateService->generateCertificatePdf($certificate);
                $certFilename = 'Certificate-'.($certificate->certificate_number ?? $application->application_number ?? 'Cert').'.pdf';
                $attachments[] = Attachment::fromData(fn () => $certificatePdfContent, $certFilename)
                    ->withMime('application/pdf');
                $certPdfGenerated = true;
            } catch (\Exception $e) {
                Log::error('Failed to generate Certificate PDF for email attachment', [
                    'certificate_id' => $certificate->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // The certificate PDF is the payload of a certificate-issued email; delivering it
        // without the certificate would mislead the enterprise. If the certificate exists
        // but its PDF could not be generated, withhold the email and record a failed event
        // so it surfaces for a manual/ops resend instead of shipping a certificate-less mail.
        if ($certificate && ! $certPdfGenerated) {
            Log::error('Certificate-issued email withheld: certificate PDF generation failed', [
                'application_id' => $application->id,
                'assessment_id' => $assessment->id,
                'certificate_id' => $certificate->id,
            ]);

            app(EmailNotificationService::class)->recordEventFailure(
                'certificate.issued',
                [
                    'application' => $application,
                    'assessment' => $assessment,
                    'organization_name' => $application->enterprise_name ?? 'N/A',
                    'application_number' => $application->application_number ?? 'N/A',
                ],
                'Certificate PDF generation failed; certificate-issued email withheld to avoid sending without the certificate.'
            );

            return;
        }

        try {
            $summaryService = app(MeetingSummarySheetService::class);
            $assessmentReportContent = $summaryService->generateAssessmentReportPdf($assessment, Assessment::STATUS_CERTIFIED);
            $arFilename = 'Assessment-Report-'.($application->application_number ?? 'Report').'.pdf';
            $attachments[] = Attachment::fromData(fn () => $assessmentReportContent, $arFilename)
                ->withMime('application/pdf');
        } catch (\Exception $e) {
            Log::error('Failed to generate Assessment Report PDF for email attachment', [
                'assessment_id' => $assessment->id,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            $emailService = app(EmailNotificationService::class);
            $sent = $emailService->sendEmailForEvent('certificate.issued', [
                'application' => $application,
                'assessment' => $assessment,
                'organization_name' => $application->enterprise_name ?? 'N/A',
                'application_number' => $application->application_number ?? 'N/A',
                'samar_id' => $application->application_number ?? 'N/A',
                'certification_level' => Assessment::ratingLabelFromScore($assessment->total_score, 'N/A'),
                'login_url' => config('app.frontend_url', '').'/login',
                'query_form_link' => config('app.frontend_url', '').'/support',
            ], ['attachments' => $attachments]);

            Log::info('Certificate and Assessment Report email dispatched', [
                'application_id' => $application->id,
                'assessment_id' => $assessment->id,
                'sent_count' => count($sent),
                'attachments_count' => count($attachments),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send certificate and assessment report email', [
                'application_id' => $application->id,
                'assessment_id' => $assessment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send welcome email to newly created committee member.
     */
    private function sendCommitteeCreatedEmail(CommitteeMember $member): void
    {
        if (empty($member->email)) {
            return;
        }

        app(EmailNotificationService::class)->sendEmailToAddresses(
            'committee-created',
            [$member->email],
            [
                'query_form_link' => config('app.frontend_url', '').'/support',
            ]
        );

        Log::info('Committee member welcome dispatched', [
            'committee_member_id' => $member->id,
            'email' => $member->email,
        ]);
    }

    /**
     * Send assessment feedback request email to enterprise/unit/contact person.
     */
    private function sendAssessmentFeedbackRequestEmail(Assessment $assessment): void
    {
        try {
            $emailService = app(EmailNotificationService::class);
            $application = $assessment->application;

            $emailService->sendEmailForEvent('assessment.feedback_request', [
                'assessment' => $assessment,
                'application' => $application,
                'application_number' => $application->application_number,
                'samar_id' => $application->application_number,
                'feedback_link' => config('app.feedback_form_url', '#'),
                'query_form_link' => config('app.support_url'),
            ]);

            Log::info('Assessment feedback request email sent', [
                'assessment_id' => $assessment->id,
                'application_id' => $application->id,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send assessment feedback request email', [
                'assessment_id' => $assessment->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * MoM PDF, meeting-closed email and decision emails for a completed meeting.
     * Run by RunCommitteeMeetingCloseTail; each step is isolated so one failure
     * does not stop the others.
     */
    public function runCloseTail(CommitteeMeeting $meeting): void
    {
        // The MoM PDF is an attachment, not a precondition for the close email.
        // Generate it separately so a PDF failure never suppresses the
        // meeting-closed email — members still get it, just without the MoM.
        $pdfPath = null;
        try {
            $pdfResult = app(MeetingSummarySheetService::class)->generateAndStoreMoMPdf($meeting);
            $pdfPath = $pdfResult['path'];
        } catch (\Exception $e) {
            Log::error('Failed to generate MoM PDF', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            $this->sendMeetingClosedEmail($meeting, $pdfPath);
        } catch (\Exception $e) {
            Log::error('Failed to send MoM email', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Send decision-specific emails independently of MoM PDF
        try {
            Log::info('Starting decision emails for meeting', ['meeting_id' => $meeting->id]);
            $this->sendDecisionEmails($meeting);
            Log::info('Decision emails completed for meeting', ['meeting_id' => $meeting->id]);
        } catch (\Exception $e) {
            Log::error('Failed to send decision emails', [
                'meeting_id' => $meeting->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
