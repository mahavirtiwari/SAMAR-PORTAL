<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApplicationAssessmentMeeting;
use App\Models\ApplicationAssessmentMeetingComment;
use App\Models\ApplicationAssessmentMeetingParticipant;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Rules\PersonName;
use App\Services\FileStorageService;
use App\Traits\AuthorizesAssessmentAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Application Assessment Meetings',
    description: 'Steps 3 & 7: Opening and Closing meeting management. Lead assessor creates meetings with a photo. All team members must add mandatory comments. External participants can be added.',
)]
class ApplicationAssessmentMeetingController extends Controller
{
    use AuthorizesAssessmentAccess;

    protected FileStorageService $fileStorage;

    public function __construct(FileStorageService $fileStorage)
    {
        $this->fileStorage = $fileStorage;
    }

    /**
     * Get meeting details.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/meetings/{type}',
        summary: 'Get meeting details',
        description: 'Returns meeting details including participants, comments, and pending comment status. Shows which team members still need to comment.',
        tags: ['Application Assessment Meetings', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'type',
                in: 'path',
                required: true,
                description: 'Meeting type',
                schema: new OA\Schema(type: 'string', enum: ['opening', 'closing'], example: 'opening'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Meeting details retrieved successfully',
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
                                    nullable: true,
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(property: 'type', type: 'string', example: 'opening'),
                                        new OA\Property(
                                            property: 'image_path',
                                            type: 'string',
                                            example: 'assessments/1/meetings/abc123.jpg',
                                        ),
                                        new OA\Property(
                                            property: 'latitude',
                                            type: 'number',
                                            format: 'float',
                                            example: 28.6139,
                                        ),
                                        new OA\Property(
                                            property: 'longitude',
                                            type: 'number',
                                            format: 'float',
                                            example: 77.2090,
                                        ),
                                        new OA\Property(
                                            property: 'conducted_at',
                                            type: 'string',
                                            format: 'date-time',
                                        ),
                                        new OA\Property(
                                            property: 'participants',
                                            type: 'array',
                                            items: new OA\Items(type: 'object'),
                                        ),
                                        new OA\Property(
                                            property: 'comments',
                                            type: 'array',
                                            items: new OA\Items(type: 'object'),
                                        ),
                                    ],
                                ),
                                new OA\Property(
                                    property: 'team_members',
                                    type: 'array',
                                    items: new OA\Items(type: 'object'),
                                ),
                                new OA\Property(
                                    property: 'pending_comments_from',
                                    type: 'array',
                                    description: 'Team members who haven\'t commented yet',
                                    items: new OA\Items(type: 'object'),
                                ),
                                new OA\Property(property: 'step_completed', type: 'boolean', example: false),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Invalid meeting type'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function show(Request $request, int $assessmentId, string $type): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);

        if ($denied = $this->denyUnlessAssessmentVisible($request, $assessment)) {
            return $denied;
        }

        if (! in_array($type, ['opening', 'closing'])) {
            return $this->errorResponse('Invalid meeting type. Must be "opening" or "closing"', 400);
        }

        $meeting = $assessment->meetings()
            ->where('type', $type)
            ->with(['participants.teamMember.user', 'comments.teamMember.user', 'creator'])
            ->first();

        // Recording links are a service-sector-only feature; never expose them for
        // manufacturing assessments.
        if ($meeting && ! $assessment->isServiceSector()) {
            $meeting->makeHidden('recording_links');
        }

        $teamMembers = $assessment->teamMembers()->with('user')->get();

        // Check which team members have commented
        $commentedMemberIds = $meeting ? $meeting->comments->pluck('team_member_id')->toArray() : [];
        $pendingComments = $teamMembers->filter(function ($member) use ($commentedMemberIds) {
            return ! in_array($member->id, $commentedMemberIds);
        });

        return $this->successResponse([
            'meeting' => $meeting,
            'team_members' => $teamMembers,
            'pending_comments_from' => $pendingComments->values(),
            'step_completed' => $type === 'opening'
                ? $assessment->isOpeningMeetingComplete()
                : $assessment->isClosingMeetingComplete(),
        ], 'Meeting details retrieved successfully');
    }

    /**
     * Create or update a meeting (Lead Assessor only for creation).
     */
    #[OA\Post(
        path: '/api/v1/application-assessments/{assessmentId}/meetings/{type}',
        summary: 'Create or update meeting',
        description: 'Create or update an opening/closing meeting. Only the lead assessor can perform this action. Image is required for creation. All team members are automatically added as default participants.',
        tags: ['Application Assessment Meetings', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'type',
                in: 'path',
                required: true,
                description: 'Meeting type',
                schema: new OA\Schema(type: 'string', enum: ['opening', 'closing'], example: 'opening'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: [
                new OA\MediaType(
                    mediaType: 'multipart/form-data',
                    schema: new OA\Schema(
                        required: ['image'],
                        properties: [
                            new OA\Property(
                                property: 'image',
                                type: 'string',
                                format: 'binary',
                                description: 'Meeting photo (required for creation, optional for update). Max 10MB',
                            ),
                            new OA\Property(
                                property: 'latitude',
                                type: 'number',
                                format: 'float',
                                description: 'GPS latitude',
                                example: 28.6139,
                            ),
                            new OA\Property(
                                property: 'longitude',
                                type: 'number',
                                format: 'float',
                                description: 'GPS longitude',
                                example: 77.2090,
                            ),
                            new OA\Property(
                                property: 'conducted_at',
                                type: 'string',
                                format: 'date-time',
                                description: 'When the meeting was conducted',
                            ),
                        ],
                    ),
                ),
            ],
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
                            example: 'Meeting created successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'meeting', type: 'object'),
                                new OA\Property(property: 'step_completed', type: 'boolean', example: false),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 200,
                description: 'Meeting updated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Meeting updated successfully',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Assessment not in progress, invalid meeting type, or validation error',
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Only the lead assessor can create/update meetings'),
        ],
    )]
    public function store(Request $request, int $assessmentId, string $type): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        if (! in_array($type, ['opening', 'closing'])) {
            return $this->errorResponse('Invalid meeting type', 400);
        }

        // Only lead assessor can create/update meeting
        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('Only the lead assessor can create or update meetings', 403);
        }

        // The opening meeting's first save is what starts the assessment
        // (scheduled -> in_progress), so it must be allowed while still scheduled.
        // The closing meeting still requires an already in-progress assessment.
        $allowedStatuses = $type === 'opening'
            ? [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS]
            : [Assessment::STATUS_IN_PROGRESS];

        if (! in_array($assessment->status, $allowedStatuses, true)) {
            return $this->errorResponse('Meetings can only be managed when assessment is in progress', 400);
        }

        $meetingExists = $assessment->meetings()->where('type', $type)->exists();

        // Meeting recording links are a service-sector-only feature; manufacturing
        // assessments no longer capture or store them.
        $isServiceSector = $assessment->isServiceSector();

        // Mobile sends camelCase conductedAt / recordingLinks; accept both.
        if ($request->has('conductedAt') && ! $request->has('conducted_at')) {
            $request->merge(['conducted_at' => $request->input('conductedAt')]);
        }
        if ($request->has('recordingLinks') && ! $request->has('recording_links')) {
            $request->merge(['recording_links' => $request->input('recordingLinks')]);
        }

        $rules = [
            'image' => [$meetingExists ? 'nullable' : 'required', 'image', 'max:10240'],
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'conducted_at' => 'nullable|date',
        ];

        if ($isServiceSector) {
            $rules['recording_links'] = 'nullable|array|max:5';
            // nullable so a client can send a single empty entry as a "clear all"
            // sentinel (multipart can't express an empty array); empties are
            // filtered out to [] on persist below.
            $rules['recording_links.*'] = 'nullable|url|max:2048';
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        $newlyStoredPath = null;

        DB::beginTransaction();
        try {
            $meeting = $assessment->meetings()->where('type', $type)->first();
            $isNew = ! $meeting;

            // Only persist fields the client actually sent, so a partial save — e.g.
            // the lead editing recording links without re-capturing the photo — can't
            // null the stored coordinates or reset conducted_at.
            $data = [];
            if ($request->has('latitude')) {
                $data['latitude'] = $request->latitude;
            }
            if ($request->has('longitude')) {
                $data['longitude'] = $request->longitude;
            }
            if ($request->has('conducted_at')) {
                $data['conducted_at'] = $request->conducted_at;
            } elseif ($isNew) {
                $data['conducted_at'] = now();
            }

            // Recording links live on the closing meeting (service sector only); only
            // touch them when the client actually sends the field, so an image-only
            // re-save keeps the existing links.
            if ($type === 'closing' && $isServiceSector && $request->has('recording_links')) {
                $data['recording_links'] = array_values(array_filter(
                    (array) $request->input('recording_links', []),
                    fn ($link) => filled($link)
                ));
            }

            $previousImagePath = $meeting?->image_path;

            if ($request->hasFile('image')) {
                // Store new file first; old one is deleted only after the DB commit
                // so a failed save doesn't leave the meeting pointing at a missing file.
                $fileData = $this->fileStorage->storeAssessmentFile(
                    $request->file('image'),
                    $assessmentId,
                    FileStorageService::ASSESSMENT_MEETINGS
                );
                $data['image_path'] = $fileData['path'];
                $data['disk'] = $fileData['disk'];
                $newlyStoredPath = $fileData['path'];
            }

            if ($isNew) {
                $data['assessment_id'] = $assessmentId;
                $data['type'] = $type;
                $data['created_by'] = $user->id;

                $meeting = ApplicationAssessmentMeeting::create($data);

                // Add default participants (all team members)
                $allTeamMembers = $assessment->teamMembers()->get();
                foreach ($allTeamMembers as $member) {
                    // Map role to human-readable designation
                    $designation = match ($member->role) {
                        AssessmentTeamMember::ROLE_LEAD_ASSESSOR => 'Lead Assessor',
                        AssessmentTeamMember::ROLE_CO_ASSESSOR => 'Co-Assessor',
                        default => null,
                    };

                    ApplicationAssessmentMeetingParticipant::create([
                        'meeting_id' => $meeting->id,
                        'team_member_id' => $member->id,
                        'designation' => $designation,
                        'is_default' => true,
                    ]);
                }
            } else {
                $meeting->update($data);
            }

            // Saving the opening meeting for the first time is what starts the
            // assessment; flip scheduled -> in_progress before recalculating steps
            // (the transition resets step progress, which the recalculate below corrects).
            if ($type === 'opening' && $assessment->status === Assessment::STATUS_SCHEDULED) {
                $assessment->stateMachine($user)->transition('start', [
                    'started_by' => $user->id,
                ]);
            }

            // Refresh the meetings relationship cache before recalculating step progress
            $assessment->load('meetings.participants', 'meetings.comments');

            // Update step progress
            $assessment->recalculateStepProgress();

            DB::commit();

            // Post-commit cleanup: drop the previous image only now that the new
            // row is durable. Failures here are non-fatal — log and move on.
            if ($newlyStoredPath && $previousImagePath && $previousImagePath !== $newlyStoredPath) {
                try {
                    $this->fileStorage->delete($previousImagePath);
                } catch (\Throwable $t) {
                    Log::warning('Failed to delete previous meeting image', [
                        'path' => $previousImagePath,
                        'error' => $t->getMessage(),
                    ]);
                }
            }

            $meeting->load(['participants.teamMember.user', 'comments.teamMember.user']);

            if (! $isServiceSector) {
                $meeting->makeHidden('recording_links');
            }

            return $this->successResponse([
                'meeting' => $meeting,
                'step_completed' => $type === 'opening'
                    ? $assessment->isOpeningMeetingComplete()
                    : $assessment->isClosingMeetingComplete(),
            ], $isNew ? 'Meeting created successfully' : 'Meeting updated successfully', $isNew ? 201 : 200);
        } catch (\Exception $e) {
            DB::rollBack();

            // Clean up the just-uploaded file so it doesn't leak when the DB write failed.
            if ($newlyStoredPath) {
                try {
                    $this->fileStorage->delete($newlyStoredPath);
                } catch (\Throwable $t) {
                    Log::warning('Failed to delete orphan meeting image after rollback', [
                        'path' => $newlyStoredPath,
                        'error' => $t->getMessage(),
                    ]);
                }
            }

            return $this->serverErrorResponse($e, 'Failed to save meeting');
        }
    }

    /**
     * Add an external participant to meeting.
     */
    #[OA\Post(
        path: '/api/v1/application-assessments/{assessmentId}/meetings/{type}/participants',
        summary: 'Add external participant',
        description: 'Add an external participant (non-team member) to the meeting. Only the lead assessor can add external participants. Team members are automatically added when the meeting is created.',
        tags: ['Application Assessment Meetings', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'type',
                in: 'path',
                required: true,
                description: 'Meeting type',
                schema: new OA\Schema(type: 'string', enum: ['opening', 'closing'], example: 'opening'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'designation'],
                properties: [
                    new OA\Property(
                        property: 'name',
                        type: 'string',
                        description: 'Participant name',
                        example: 'John Smith',
                    ),
                    new OA\Property(
                        property: 'designation',
                        type: 'string',
                        description: 'Participant designation/role',
                        example: 'Quality Manager',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Participant added successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Participant added successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 5),
                                new OA\Property(property: 'meeting_id', type: 'integer', example: 1),
                                new OA\Property(property: 'name', type: 'string', example: 'John Smith'),
                                new OA\Property(
                                    property: 'designation',
                                    type: 'string',
                                    example: 'Quality Manager',
                                ),
                                new OA\Property(property: 'is_default', type: 'boolean', example: false),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Only the lead assessor can add participants'),
            new OA\Response(response: 404, description: 'Meeting not found'),
        ],
    )]
    public function addParticipant(Request $request, int $assessmentId, string $type): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        // Only lead assessor can add participants
        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('Only the lead assessor can add participants', 403);
        }

        $meeting = $assessment->meetings()->where('type', $type)->first();

        if (! $meeting) {
            return $this->errorResponse('Meeting has not been created yet. Lead assessor must create the meeting first.', 400);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255', new PersonName],
            'designation' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        // Idempotent for offline sync replays: same (meeting, name, designation)
        // from an external participant returns the existing row instead of duplicating.
        $participant = ApplicationAssessmentMeetingParticipant::firstOrCreate(
            [
                'meeting_id' => $meeting->id,
                'name' => $request->name,
                'designation' => $request->designation,
                'is_default' => false,
            ]
        );
        $wasNew = $participant->wasRecentlyCreated;

        return $this->successResponse(
            $participant,
            $wasNew ? 'Participant added successfully' : 'Participant already added',
            $wasNew ? 201 : 200
        );
    }

    /**
     * Remove an external participant from meeting.
     */
    #[OA\Delete(
        path: '/api/v1/application-assessments/{assessmentId}/meetings/{type}/participants/{participantId}',
        summary: 'Remove external participant',
        description: 'Remove an external participant from the meeting. Only the lead assessor can remove participants. Default participants (team members) cannot be removed.',
        tags: ['Application Assessment Meetings', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'type',
                in: 'path',
                required: true,
                description: 'Meeting type',
                schema: new OA\Schema(type: 'string', enum: ['opening', 'closing'], example: 'opening'),
            ),
            new OA\Parameter(
                name: 'participantId',
                in: 'path',
                required: true,
                description: 'Participant ID to remove',
                schema: new OA\Schema(type: 'integer', example: 5),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Participant removed successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Participant removed successfully',
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Cannot remove default participants (assessors)'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Only the lead assessor can remove participants'),
            new OA\Response(response: 404, description: 'Meeting or participant not found'),
        ],
    )]
    public function removeParticipant(Request $request, int $assessmentId, string $type, int $participantId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        // Only lead assessor can remove participants
        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('Only the lead assessor can remove participants', 403);
        }

        $meeting = $assessment->meetings()->where('type', $type)->first();

        if (! $meeting) {
            return $this->errorResponse('Meeting has not been created yet.', 404);
        }

        $participant = ApplicationAssessmentMeetingParticipant::where('id', $participantId)
            ->where('meeting_id', $meeting->id)
            ->first();

        if (! $participant) {
            return $this->errorResponse('Participant not found.', 404);
        }

        // Cannot remove default participants (assessors)
        if ($participant->is_default) {
            return $this->errorResponse('Cannot remove default participants (assessors)', 400);
        }

        $participant->delete();

        return $this->successResponse(null, 'Participant removed successfully');
    }

    /**
     * Add a comment to meeting.
     */
    #[OA\Post(
        path: '/api/v1/application-assessments/{assessmentId}/meetings/{type}/comments',
        summary: 'Add comment to meeting',
        description: 'Add a comment to the meeting. Each team member has one comment per meeting; re-posting from the same member updates the existing comment (idempotent for offline sync). Minimum 10 characters required.',
        tags: ['Application Assessment Meetings', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'type',
                in: 'path',
                required: true,
                description: 'Meeting type',
                schema: new OA\Schema(type: 'string', enum: ['opening', 'closing'], example: 'opening'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['comment'],
                properties: [
                    new OA\Property(
                        property: 'comment',
                        type: 'string',
                        minLength: 10,
                        description: 'Mandatory comment text (min 10 characters)',
                        example: 'Meeting conducted successfully with all stakeholders present.',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Comment added successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Comment added successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'comment', type: 'object'),
                                new OA\Property(
                                    property: 'step_completed',
                                    type: 'boolean',
                                    example: true,
                                    description: 'Whether all team members have commented',
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Assessment not in progress, meeting not created yet, or validation error',
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Not a team member of this assessment'),
        ],
    )]
    public function addComment(Request $request, int $assessmentId, string $type): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        if (! in_array($assessment->status, [Assessment::STATUS_IN_PROGRESS, Assessment::STATUS_MOBILE_COMPLETE], true)) {
            return $this->errorResponse('Comments can only be added while the assessment is in progress or field work is complete', 400);
        }

        $meeting = $assessment->meetings()->where('type', $type)->first();

        if (! $meeting) {
            return $this->errorResponse('Meeting has not been created yet. Lead assessor must create the meeting first.', 400);
        }

        $validator = Validator::make($request->all(), [
            'comment' => 'required|string|min:1|max:5000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        // Idempotent for offline sync replays: if this team member already
        // commented, treat as update of the existing comment rather than 400.
        $existingComment = $meeting->comments()
            ->where('team_member_id', $teamMember->id)
            ->first();

        DB::beginTransaction();
        try {
            if ($existingComment) {
                $existingComment->update(['comment' => $request->comment]);
                $comment = $existingComment;
                $wasNew = false;
            } else {
                $comment = ApplicationAssessmentMeetingComment::create([
                    'meeting_id' => $meeting->id,
                    'team_member_id' => $teamMember->id,
                    'comment' => $request->comment,
                ]);
                $wasNew = true;
            }

            // Refresh the meetings relationship cache before recalculating step progress
            $assessment->load('meetings.comments');

            // Update step progress
            $assessment->recalculateStepProgress();

            DB::commit();

            return $this->successResponse([
                'comment' => $comment->load('teamMember.user'),
                'step_completed' => $type === 'opening'
                    ? $assessment->isOpeningMeetingComplete()
                    : $assessment->isClosingMeetingComplete(),
            ], $wasNew ? 'Comment added successfully' : 'Comment updated successfully', $wasNew ? 201 : 200);
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to add comment');
        }
    }

    /**
     * Stream or download the meeting image.
     */
    public function image(Request $request, int $assessmentId, string $type)
    {
        $assessment = Assessment::findOrFail($assessmentId);

        if ($denied = $this->denyUnlessAssessmentVisible($request, $assessment)) {
            return $denied;
        }

        $meeting = $assessment->meetings()
            ->where('type', $type)
            ->first();

        if (! $meeting) {
            return $this->errorResponse('Meeting not found.', 404);
        }

        if (! $meeting->image_path || ! $this->fileStorage->exists($meeting->image_path)) {
            return $this->errorResponse('Meeting image not found in storage.', 404);
        }

        $forceDownload = $request->boolean('download', false);

        if ($forceDownload) {
            return $this->fileStorage->download($meeting->image_path, basename($meeting->image_path));
        }

        return $this->fileStorage->stream($meeting->image_path, basename($meeting->image_path));
    }
}
