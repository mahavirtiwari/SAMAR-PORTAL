<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ErrorGroup;
use App\Models\ErrorLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Error Groups', description: 'Error grouping and management endpoints for system administrators')]
class ErrorGroupController extends Controller
{
    /**
     * Get list of error groups with statistics.
     */
    #[OA\Get(
        path: '/api/v1/admin/error-groups',
        summary: 'Get list of error groups',
        description: 'Retrieves paginated list of error groups with occurrence statistics',
        tags: ['System Admin - Error Groups'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'status',
                in: 'query',
                description: 'Filter by status',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['active', 'resolved', 'ignored', 'archived']),
            ),
            new OA\Parameter(
                name: 'severity',
                in: 'query',
                description: 'Filter by severity',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['emergency', 'critical', 'error', 'warning', 'notice']),
            ),
            new OA\Parameter(
                name: 'exceptionClass',
                in: 'query',
                description: 'Filter by exception class',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'Illuminate\\\\Database\\\\QueryException'),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Items per page',
                required: false,
                schema: new OA\Schema(type: 'integer', default: 15, example: 15),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Error groups retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Error groups retrieved successfully',
                        ),
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(type: 'object')),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        $perPage = $this->resolvePerPage($request, 15);

        $query = ErrorGroup::with(['assignedUser:id,first_name,last_name,email'])
            ->orderBy('last_seen_at', 'desc');

        // Apply filters
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('severity')) {
            $query->where('severity', $request->input('severity'));
        }

        if ($request->filled('exception_class')) {
            $query->where('exception_class', 'like', '%'.$request->input('exception_class').'%');
        }

        $errorGroups = $query->paginate($perPage);

        return $this->paginatedResponse($errorGroups, 'Error groups retrieved successfully');
    }

    /**
     * Get error group with recent error logs.
     */
    #[OA\Get(
        path: '/api/v1/admin/error-groups/{id}',
        summary: 'Get error group details',
        description: 'Retrieves error group with recent error logs',
        tags: ['System Admin - Error Groups'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Error group ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'recentLogsLimit',
                in: 'query',
                description: 'Number of recent error logs to include',
                required: false,
                schema: new OA\Schema(type: 'integer', default: 10, example: 10),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Error group retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Error group retrieved successfully',
                        ),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 404, description: 'Error group not found'),
        ],
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $recentLogsLimit = $request->input('recent_logs_limit', 10);

        $errorGroup = ErrorGroup::with([
            'assignedUser:id,first_name,last_name,email',
            'errorLogs' => function ($query) use ($recentLogsLimit) {
                $query->with(['user:id,first_name,last_name,email'])
                    ->orderBy('occurred_at', 'desc')
                    ->limit($recentLogsLimit);
            },
        ])->findOrFail($id);

        return $this->successResponse($errorGroup, 'Error group retrieved successfully');
    }

    /**
     * Update error group status and assignment.
     */
    #[OA\Patch(
        path: '/api/v1/admin/error-groups/{id}',
        summary: 'Update error group',
        description: 'Updates error group status, assignment, and notes. If status is resolved, all related error logs are also updated.',
        tags: ['System Admin - Error Groups'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Error group ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'status',
                        type: 'string',
                        enum: ['active', 'resolved', 'ignored', 'archived'],
                        example: 'resolved',
                    ),
                    new OA\Property(
                        property: 'assignedTo',
                        type: 'integer',
                        example: 5,
                        description: 'User ID to assign this error group to',
                    ),
                    new OA\Property(
                        property: 'notes',
                        type: 'string',
                        example: 'Fixed in v1.2.3 by updating database query',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Error group updated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Error group updated successfully',
                        ),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 422, description: 'Validation error'),
            new OA\Response(response: 404, description: 'Error group not found'),
        ],
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $errorGroup = ErrorGroup::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'status' => 'sometimes|in:active,resolved,ignored,archived',
            'assignedTo' => 'sometimes|nullable|exists:users,id',
            'notes' => 'sometimes|nullable|string|max:10000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        DB::transaction(function () use ($request, $errorGroup) {
            $updateData = [];

            if ($request->filled('status')) {
                $updateData['status'] = $request->input('status');

                // If error group is being resolved, update all related error logs
                if ($request->input('status') === ErrorGroup::STATUS_RESOLVED) {
                    $errorGroup->errorLogs()
                        ->whereIn('status', [ErrorLog::STATUS_NEW, ErrorLog::STATUS_INVESTIGATING])
                        ->update([
                            'status' => ErrorLog::STATUS_RESOLVED,
                            'resolved_by' => auth()->id(),
                            'resolved_at' => now(),
                            'resolution_notes' => $request->input('notes') ?? 'Resolved via error group update',
                        ]);
                }
            }

            if ($request->has('assigned_to')) {
                $updateData['assigned_to'] = $request->input('assigned_to');
            }

            if ($request->has('notes')) {
                $updateData['notes'] = $request->input('notes');
            }

            $errorGroup->update($updateData);
        });

        return $this->successResponse(
            $errorGroup->fresh(['assignedUser', 'errorLogs']),
            'Error group updated successfully'
        );
    }
}
