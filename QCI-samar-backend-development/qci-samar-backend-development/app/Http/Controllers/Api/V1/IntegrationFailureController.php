<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\IntegrationFailureResource;
use App\Models\ErrorLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Integration Failures',
    description: 'Read-only operations monitor of third-party API and system-job failures for System Administrators',
)]
class IntegrationFailureController extends Controller
{
    /**
     * Paginated feed of integration and system-job failures.
     */
    #[OA\Get(
        path: '/api/v1/admin/integration-failures',
        summary: 'List integration failures',
        description: 'Read-only feed of non-HTTP failures (payment gateway, ERP, email, system jobs) captured to error_logs. Internal HTTP page errors are excluded.',
        tags: ['Integration Failures'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'category',
                in: 'query',
                description: 'Filter by category key',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['payment', 'erp', 'email', 'system_job']),
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
            new OA\Response(response: 200, description: 'Integration failures retrieved successfully'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin role required'),
            new OA\Response(response: 422, description: 'Validation error - unknown category'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        $categories = config('integration_failures.categories');

        $validator = Validator::make($request->all(), [
            'category' => ['nullable', Rule::in(array_keys($categories))],
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        $sources = $request->filled('category')
            ? $categories[$request->input('category')]['sources']
            : collect($categories)->pluck('sources')->flatten()->all();

        $query = ErrorLog::query()
            ->whereIn('source', $sources)
            ->orderBy('occurred_at', 'desc');

        $perPage = $this->resolvePerPage($request, 15);

        return $this->paginatedResponse(
            $query->paginate($perPage),
            'Integration failures retrieved successfully',
            IntegrationFailureResource::class
        );
    }

    /**
     * The category filter options (friendly labels).
     */
    #[OA\Get(
        path: '/api/v1/admin/integration-failures/categories',
        summary: 'List integration-failure categories',
        description: 'Category keys and friendly labels for the monitor\'s filter dropdown.',
        tags: ['Integration Failures'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Categories retrieved successfully'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin role required'),
        ],
    )]
    public function categories(): JsonResponse
    {
        $categories = collect(config('integration_failures.categories'))
            ->map(fn (array $category, string $key) => [
                'key' => $key,
                'label' => $category['label'],
            ])
            ->values()
            ->all();

        return $this->successResponse($categories, 'Integration failure categories retrieved successfully');
    }
}
