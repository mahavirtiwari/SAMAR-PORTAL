<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Application Assessment Step 1 - Parameter Allocation',
    description: 'Step 1: Lead assessor assigns parameters to team members. Each parameter must be assigned to exactly one assessor. All mandatory parameters must be assigned before proceeding.',
)]
class ApplicationAssessmentParameterAllocationController extends Controller
{
    /**
     * Get all parameters for an assessment with their assignments.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/parameters',
        summary: 'List all parameters with assignments',
        description: 'Returns all parameters for the assessment, grouped by mandatory and optional, including current assignments and team members available for assignment.',
        tags: ['Application Assessment Step 1 - Parameter Allocation', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Parameters retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'mandatory_parameters',
                                    type: 'array',
                                    description: 'Parameters that must be assigned',
                                    items: new OA\Items(
                                        type: 'object',
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer', example: 1),
                                            new OA\Property(
                                                property: 'code',
                                                type: 'string',
                                                example: 'PARAM-001',
                                            ),
                                            new OA\Property(
                                                property: 'name',
                                                type: 'string',
                                                example: 'Quality Management',
                                            ),
                                            new OA\Property(
                                                property: 'is_mandatory',
                                                type: 'boolean',
                                                example: true,
                                            ),
                                            new OA\Property(
                                                property: 'assigned_to_team_member_id',
                                                type: 'integer',
                                                nullable: true,
                                            ),
                                            new OA\Property(
                                                property: 'assigned_team_member',
                                                type: 'object',
                                                nullable: true,
                                            ),
                                        ],
                                    ),
                                ),
                                new OA\Property(
                                    property: 'optional_parameters',
                                    type: 'array',
                                    description: 'Parameters that can be selected or skipped',
                                    items: new OA\Items(type: 'object'),
                                ),
                                new OA\Property(
                                    property: 'summary',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'total', type: 'integer', example: 10),
                                        new OA\Property(property: 'mandatory_count', type: 'integer', example: 7),
                                        new OA\Property(property: 'optional_count', type: 'integer', example: 3),
                                        new OA\Property(property: 'assigned_count', type: 'integer', example: 5),
                                        new OA\Property(property: 'unassigned_count', type: 'integer', example: 5),
                                    ],
                                ),
                                new OA\Property(
                                    property: 'team_members',
                                    type: 'array',
                                    description: 'Available team members for assignment',
                                    items: new OA\Items(
                                        type: 'object',
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer'),
                                            new OA\Property(property: 'user_id', type: 'integer'),
                                            new OA\Property(
                                                property: 'role',
                                                type: 'string',
                                                enum: ['lead_assessor', 'co_assessor'],
                                            ),
                                        ],
                                    ),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function index(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        // Authorize: user must be a team member of this assessment, or have an admin/operations role
        $adminRoles = [Role::SYSTEM_ADMIN, Role::DRDO_ADMIN, Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN];
        $isAdminOrOps = $user->hasAnyRole($adminRoles);
        $isTeamMember = $assessment->teamMembers()->where('user_id', $user->id)->exists();

        if (! $isAdminOrOps && ! $isTeamMember) {
            return $this->errorResponse('You are not authorized to view parameters for this assessment.', 403);
        }

        $parameters = $assessment->parameters()
            ->with(['assignedTeamMember.user', 'questions'])
            ->get();

        $mandatory = $parameters->where('is_mandatory', true);
        $optional = $parameters->where('is_mandatory', false);

        return $this->successResponse([
            'mandatory_parameters' => $mandatory->values(),
            'optional_parameters' => $optional->values(),
            'summary' => [
                'total' => $parameters->count(),
                'mandatory_count' => $mandatory->count(),
                'optional_count' => $optional->count(),
                'assigned_count' => $parameters->whereNotNull('assigned_to_team_member_id')->count(),
                'unassigned_count' => $parameters->whereNull('assigned_to_team_member_id')->count(),
            ],
            'team_members' => $assessment->teamMembers()->with('user')->get(),
            'allocation_locked' => $assessment->isAllocationLocked(),
        ], 'Parameters retrieved successfully');
    }

    /**
     * Get parameters assigned to the current user.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/parameters/my-assignments',
        summary: 'Get my assigned parameters',
        description: 'Returns all parameters assigned to the current user, including questions for each parameter.',
        tags: ['Application Assessment Step 1 - Parameter Allocation', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Assigned parameters retrieved',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'parameters',
                                    type: 'array',
                                    items: new OA\Items(type: 'object'),
                                ),
                                new OA\Property(property: 'count', type: 'integer', example: 5),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 403, description: 'Not a team member'),
        ],
    )]
    public function myAssignments(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        $assignedParameters = $assessment->parameters()
            ->where('assigned_to_team_member_id', $teamMember->id)
            ->with(['questions'])
            ->get();

        return $this->successResponse([
            'parameters' => $assignedParameters,
            'count' => $assignedParameters->count(),
        ], 'Assigned parameters retrieved successfully');
    }

    /**
     * Bulk assign all parameters at once.
     */
    #[OA\Post(
        path: '/api/v1/application-assessments/{assessmentId}/parameters/bulk-assign',
        summary: 'Bulk assign all parameters',
        description: 'Assigns all parameters at once. Supports two formats: (1) Object format: {parameterId: teamMemberId} or (2) Array format: [{parameterId, teamMemberId}, ...]. Useful for saving all assignments in one API call.',
        tags: ['Application Assessment Step 1 - Parameter Allocation', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['assignments'],
                properties: [
                    new OA\Property(
                        property: 'assignments',
                        type: 'array',
                        description: 'Array of parameter assignments',
                        example: [['parameterId' => 1, 'teamMemberId' => 5], ['parameterId' => 2, 'teamMemberId' => 6]],
                        items: new OA\Items(
                            type: 'object',
                            required: ['parameterId', 'teamMemberId'],
                            properties: [
                                new OA\Property(property: 'parameterId', type: 'integer', example: 1),
                                new OA\Property(property: 'teamMemberId', type: 'integer', example: 5),
                            ],
                        ),
                    ),
                    new OA\Property(
                        property: 'skipOptionalUnassigned',
                        type: 'boolean',
                        description: 'If true, optional parameters without assignments are skipped (not set to null)',
                        example: false,
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Parameters assigned successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: '8 parameters assigned successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'assigned_count', type: 'integer', example: 8),
                                new OA\Property(
                                    property: 'warnings',
                                    type: 'array',
                                    items: new OA\Items(type: 'string'),
                                ),
                                new OA\Property(property: 'step_completed', type: 'boolean', example: true),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Assessment not in correct status or mandatory parameters not assigned',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'All mandatory parameters must be assigned',
                        ),
                        new OA\Property(property: 'errors', type: 'array', items: new OA\Items(type: 'string')),
                    ],
                ),
            ),
            new OA\Response(response: 403, description: 'Not the lead assessor'),
        ],
    )]
    public function bulkAssign(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('Only the lead assessor can assign parameters', 403);
        }

        // Allocation precedes the opening meeting (which is what starts the
        // assessment), so it is allowed while the assessment is still scheduled.
        if (! in_array($assessment->status, [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS], true)) {
            return $this->errorResponse('Parameters can only be assigned before the assessment is completed', 400);
        }

        if ($assessment->isAllocationLocked()) {
            return $this->errorResponse(
                'Parameter allocation is locked after the Opening Meeting is completed.',
                409,
                ['error_code' => 'ALLOCATION_LOCKED']
            );
        }

        $validator = Validator::make($request->all(), [
            'assignments' => 'required|array',
            'skip_optional_unassigned' => 'boolean',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        $skipOptionalUnassigned = $request->boolean('skip_optional_unassigned', false);
        $rawAssignments = $request->input('assignments');

        // Normalize assignments to associative array {parameter_id => team_member_id}
        // Supports both formats:
        // 1. Object format: {"1": 5, "2": 6}
        // 2. Array format: [{"parameterId": 1, "teamMemberId": 5}, ...]
        $assignments = $this->normalizeAssignments($rawAssignments);

        if ($assignments === null) {
            return $this->errorResponse(
                'Invalid assignments format. Expected array: [{parameterId, teamMemberId}, ...]',
                422
            );
        }

        DB::beginTransaction();
        try {
            $parameters = $assessment->parameters()->get();
            $teamMembers = $assessment->teamMembers()->get(['id', 'user_id']);
            $validTeamMemberIds = $teamMembers->pluck('id')->map(fn ($id) => (int) $id)->all();

            // The offline mobile roster carries no membership id (the server's
            // surrogate key), so the app may submit the assessor's stable user id
            // instead. Resolve an incoming user id back to its membership id rather
            // than rejecting an otherwise valid assignment. A value is only treated
            // as a user id when it is not already a valid membership id, so existing
            // membership-id callers (web) are unaffected.
            $userIdToTeamMemberId = $teamMembers
                ->pluck('id', 'user_id')
                ->mapWithKeys(fn ($membershipId, $userId) => [(int) $userId => (int) $membershipId])
                ->all();

            $errors = [];
            $assignedCount = 0;

            foreach ($parameters as $parameter) {
                $parameterId = (int) $parameter->id;

                if (isset($assignments[$parameterId])) {
                    $incomingId = (int) $assignments[$parameterId];
                    $teamMemberId = in_array($incomingId, $validTeamMemberIds, true)
                        ? $incomingId
                        : ($userIdToTeamMemberId[$incomingId] ?? null);

                    if ($teamMemberId === null) {
                        $errors[] = "Invalid team member ID {$incomingId} for parameter {$parameter->code}";

                        continue;
                    }

                    $parameter->update(['assigned_to_team_member_id' => $teamMemberId]);
                    $assignedCount++;
                } elseif ($parameter->is_mandatory) {
                    $errors[] = "Mandatory parameter {$parameter->code} must be assigned";
                } elseif (! $skipOptionalUnassigned) {
                    $parameter->update(['assigned_to_team_member_id' => null]);
                }
            }

            $membersWithParameters = $assessment->parameters()
                ->whereNotNull('assigned_to_team_member_id')
                ->distinct()
                ->pluck('assigned_to_team_member_id')
                ->map(fn ($id) => (int) $id)
                ->all();

            $membersWithoutParameters = array_diff($validTeamMemberIds, $membersWithParameters);

            if (! empty($membersWithoutParameters)) {
                $names = $assessment->teamMembers()
                    ->whereIn('id', $membersWithoutParameters)
                    ->with('user:id,first_name,last_name')
                    ->get()
                    ->map(fn ($member) => optional($member->user)->full_name ?: "Team member #{$member->id}");

                foreach ($names as $name) {
                    $errors[] = "{$name} must be assigned at least one parameter";
                }
            }

            if (! empty($errors)) {
                DB::rollBack();

                return $this->errorResponse('Failed to assign one or more parameters', 400, $errors);
            }

            // Hard-lock the allocation the moment it is saved: the lead has
            // explicitly completed allocation and it can no longer be edited.
            // Server-enforced (this method now 409s on any later save) so the
            // web portal and every device honour the same lock.
            $assessment->allocation_locked_at = now();
            $assessment->save();

            // Refresh the parameters relationship cache before recalculating step progress
            $assessment->load('parameters');
            $assessment->recalculateStepProgress();

            DB::commit();

            return $this->successResponse([
                'assigned_count' => $assignedCount,
                'warnings' => $errors,
                'step_completed' => $assessment->isParameterAllocationComplete(),
            ], "{$assignedCount} parameters assigned successfully");
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to assign parameters');
        }
    }

    /**
     * Normalize assignments array to associative array format.
     *
     * Frontend sends camelCase, middleware converts to snake_case.
     * Expected format: [{"parameterId": 1, "teamMemberId": 5}, ...]
     * After middleware: [{"parameter_id": 1, "team_member_id": 5}, ...]
     *
     * @param  mixed  $rawAssignments
     * @return array|null Returns normalized array or null if invalid format
     */
    private function normalizeAssignments($rawAssignments): ?array
    {
        if (! is_array($rawAssignments)) {
            return null;
        }

        // Empty array is valid
        if (empty($rawAssignments)) {
            return [];
        }

        $normalized = [];
        foreach ($rawAssignments as $item) {
            if (! is_array($item)) {
                return null;
            }

            // Middleware converts camelCase to snake_case
            $paramId = $item['parameter_id'] ?? null;
            $teamMemberId = $item['team_member_id'] ?? null;

            if ($paramId === null || $teamMemberId === null) {
                return null;
            }

            $normalized[(int) $paramId] = (int) $teamMemberId;
        }

        return $normalized;
    }
}
