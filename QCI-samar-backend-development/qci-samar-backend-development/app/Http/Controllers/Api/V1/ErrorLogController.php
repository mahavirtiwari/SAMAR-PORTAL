<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ErrorLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Error Logs',
    description: 'Internal error logging and monitoring endpoints for system administrators',
)]
class ErrorLogController extends Controller
{
    /**
     * Get list of error logs with filters.
     */
    #[OA\Get(
        path: '/api/v1/admin/error-logs',
        summary: 'Get list of error logs',
        description: 'Retrieves paginated list of error logs with optional filters',
        tags: ['System Admin - Error Logs'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'severity',
                in: 'query',
                description: 'Filter by severity',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['error', 'critical', 'emergency']),
            ),
            new OA\Parameter(
                name: 'level',
                in: 'query',
                description: 'Alias for severity',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['error', 'critical', 'emergency']),
            ),
            new OA\Parameter(
                name: 'source',
                in: 'query',
                description: 'Filter by subsystem the failure came from',
                required: false,
                schema: new OA\Schema(
                    type: 'string',
                    enum: ['http', 'queue', 'scheduler', 'business_central', 'payment', 'email', 'database'],
                ),
            ),
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Free-text search across exception class, message and request URL',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'TimeoutException'),
            ),
            new OA\Parameter(
                name: 'status',
                in: 'query',
                description: 'Filter by status',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['new', 'investigating', 'resolved', 'ignored', 'archived']),
            ),
            new OA\Parameter(
                name: 'endpoint',
                in: 'query',
                description: 'Filter by endpoint pattern',
                required: false,
                schema: new OA\Schema(type: 'string', example: '/api/v1/users/{id}'),
            ),
            new OA\Parameter(
                name: 'exceptionClass',
                in: 'query',
                description: 'Filter by exception class',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'Illuminate\\\\Database\\\\QueryException'),
            ),
            new OA\Parameter(
                name: 'userId',
                in: 'query',
                description: 'Filter by user ID',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'startDate',
                in: 'query',
                description: 'Filter from date (Y-m-d format)',
                required: false,
                schema: new OA\Schema(type: 'string', format: 'date', example: '2025-01-01'),
            ),
            new OA\Parameter(
                name: 'endDate',
                in: 'query',
                description: 'Filter to date (Y-m-d format)',
                required: false,
                schema: new OA\Schema(type: 'string', format: 'date', example: '2025-01-31'),
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
                description: 'Error logs retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Error logs retrieved successfully',
                        ),
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(type: 'object')),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin role required'),
            new OA\Response(response: 422, description: 'Validation error - invalid filter value'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'severity' => 'nullable|in:error,critical,emergency',
            'level' => 'nullable|in:error,critical,emergency',
            'source' => 'nullable|in:http,queue,scheduler,business_central,payment,email,database',
            'status' => 'nullable|in:new,investigating,resolved,ignored,archived',
            'search' => 'nullable|string|max:255',
            'endpoint' => 'nullable|string|max:255',
            'exception_class' => 'nullable|string|max:255',
            'user_id' => 'nullable|integer',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        $perPage = $this->resolvePerPage($request, 15);

        $query = ErrorLog::with(['errorGroup', 'user:id,first_name,last_name,email', 'resolvedBy:id,first_name,last_name,email'])
            ->orderBy('occurred_at', 'desc');

        // Apply filters. `level` is an alias for `severity` (task vocabulary).
        $severity = $request->input('severity', $request->input('level'));
        if ($severity) {
            $query->where('severity', $severity);
        }

        if ($request->filled('source')) {
            $query->where('source', $request->input('source'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('exception_class', 'like', '%'.$search.'%')
                    ->orWhere('exception_message', 'like', '%'.$search.'%')
                    ->orWhere('request_url', 'like', '%'.$search.'%');
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('endpoint')) {
            $query->where('request_endpoint', 'like', '%'.$request->input('endpoint').'%');
        }

        if ($request->filled('exception_class')) {
            $query->where('exception_class', 'like', '%'.$request->input('exception_class').'%');
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->filled('start_date')) {
            $query->where('occurred_at', '>=', $request->input('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->where('occurred_at', '<=', $request->input('end_date').' 23:59:59');
        }

        $errorLogs = $query->paginate($perPage);

        return $this->paginatedResponse($errorLogs, 'Error logs retrieved successfully');
    }

    /**
     * Get single error log with full details.
     */
    #[OA\Get(
        path: '/api/v1/admin/error-logs/{id}',
        summary: 'Get error log details',
        description: 'Retrieves full details of a specific error log including context snapshot',
        tags: ['System Admin - Error Logs'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Error log ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Error log retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Error log retrieved successfully',
                        ),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 404, description: 'Error log not found'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function show(int $id): JsonResponse
    {
        $errorLog = ErrorLog::with([
            'errorGroup',
            'user:id,first_name,last_name,email',
            'resolvedBy:id,first_name,last_name,email',
            'contextSnapshot',
        ])->findOrFail($id);

        return $this->successResponse($errorLog, 'Error log retrieved successfully');
    }

    /**
     * Update error log status and resolution.
     */
    #[OA\Patch(
        path: '/api/v1/admin/error-logs/{id}',
        summary: 'Update error log',
        description: 'Updates error log status and resolution notes',
        tags: ['System Admin - Error Logs'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Error log ID',
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
                        enum: ['new', 'investigating', 'resolved', 'ignored', 'archived'],
                        example: 'resolved',
                    ),
                    new OA\Property(
                        property: 'resolutionNotes',
                        type: 'string',
                        example: 'Fixed by deploying hotfix v1.2.3',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Error log updated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Error log updated successfully',
                        ),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 422, description: 'Validation error'),
            new OA\Response(response: 404, description: 'Error log not found'),
        ],
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $errorLog = ErrorLog::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'status' => 'sometimes|in:new,investigating,resolved,ignored,archived',
            'resolutionNotes' => 'sometimes|string|max:5000',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        $updateData = [];

        if ($request->filled('status')) {
            $updateData['status'] = $request->input('status');

            // Auto-set resolved_by and resolved_at if status is resolved
            if ($request->input('status') === ErrorLog::STATUS_RESOLVED) {
                $updateData['resolved_by'] = auth()->id();
                $updateData['resolved_at'] = now();
            }
        }

        if ($request->filled('resolution_notes')) {
            $updateData['resolution_notes'] = $request->input('resolution_notes');
        }

        $errorLog->update($updateData);

        return $this->successResponse($errorLog->fresh(), 'Error log updated successfully');
    }

    /**
     * Get error statistics.
     */
    #[OA\Get(
        path: '/api/v1/admin/error-logs/stats',
        summary: 'Get error statistics',
        description: 'Retrieves comprehensive error statistics including counts, trends, and breakdowns',
        tags: ['System Admin - Error Logs'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'days',
                in: 'query',
                description: 'Number of days to analyze',
                required: false,
                schema: new OA\Schema(type: 'integer', default: 30, example: 30),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Statistics retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Statistics retrieved successfully',
                        ),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
        ],
    )]
    public function statistics(Request $request): JsonResponse
    {
        $days = $request->input('days', 30);

        $stats = [
            'total' => ErrorLog::count(),
            'unresolved' => ErrorLog::unresolved()->count(),
            'bySeverity' => ErrorLog::select('severity', DB::raw('count(*) as count'))
                ->groupBy('severity')
                ->get()
                ->keyBy('severity')
                ->map(fn ($item) => $item->count)
                ->toArray(),
            'byStatus' => ErrorLog::select('status', DB::raw('count(*) as count'))
                ->groupBy('status')
                ->get()
                ->keyBy('status')
                ->map(fn ($item) => $item->count)
                ->toArray(),
            'byEndpoint' => ErrorLog::getStatsByEndpoint($days),
            'trends' => ErrorLog::getTrends($days),
            'last24Hours' => ErrorLog::where('occurred_at', '>=', now()->subDay())->count(),
            'last7Days' => ErrorLog::where('occurred_at', '>=', now()->subDays(7))->count(),
            'last30Days' => ErrorLog::where('occurred_at', '>=', now()->subDays(30))->count(),
        ];

        return $this->successResponse($stats, 'Statistics retrieved successfully');
    }

    /**
     * Bulk archive resolved errors.
     */
    #[OA\Post(
        path: '/api/v1/admin/error-logs/archive',
        summary: 'Bulk archive errors',
        description: 'Archives resolved errors older than specified days',
        tags: ['System Admin - Error Logs'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'days',
                        type: 'integer',
                        example: 90,
                        description: 'Archive errors resolved more than X days ago',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Errors archived successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Errors archived successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'archivedCount', type: 'integer', example: 150),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 422, description: 'Validation error'),
        ],
    )]
    public function bulkArchive(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'days' => 'required|integer|min:1|max:3650',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        $days = $request->input('days');
        $cutoffDate = now()->subDays($days);

        $count = ErrorLog::where('status', ErrorLog::STATUS_RESOLVED)
            ->where('resolved_at', '<=', $cutoffDate)
            ->update(['status' => ErrorLog::STATUS_ARCHIVED]);

        return $this->successResponse(
            ['archivedCount' => $count],
            "Successfully archived {$count} resolved error(s)"
        );
    }
}
