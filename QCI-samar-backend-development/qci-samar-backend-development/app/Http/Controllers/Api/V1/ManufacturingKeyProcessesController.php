<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ManufacturingKeyProcess;
use Exception;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

class ManufacturingKeyProcessesController extends Controller
{
    /**
     * List all manufacturing key processes.
     */
    #[OA\Get(
        path: '/api/v1/master-data/manufacturing/key-processes',
        summary: 'List all manufacturing key processes',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'all',
                in: 'query',
                description: 'Return all records without pagination (for dropdowns). Cannot be used with page/per_page parameters.',
                required: false,
                schema: new OA\Schema(type: 'boolean', default: false, example: true),
            ),
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by process name',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'isActive',
                in: 'query',
                description: 'Filter by active status',
                schema: new OA\Schema(type: 'boolean'),
            ),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'perPage', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'List of key processes'),
            new OA\Response(response: 400, description: 'Bad request - conflicting parameters'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        try {
            Gate::authorize('viewAny', ManufacturingKeyProcess::class);

            $query = ManufacturingKeyProcess::query();

            if ($request->filled('search')) {
                $query->where('process_name', 'like', "%{$request->input('search')}%");
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $query->orderBy('process_name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'Key processes retrieved successfully',
                15,
                1000
            );
        } catch (Exception $e) {
            Log::error('Failed to retrieve key processes', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve key processes', 500);
        }
    }

    /**
     * Create a new manufacturing key process.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/key-processes',
        summary: 'Create a new manufacturing key process',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['processName'],
                properties: [
                    new OA\Property(property: 'processName', type: 'string', example: 'Welding'),
                    new OA\Property(property: 'isActive', type: 'boolean', default: true),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Process created successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        try {
            Gate::authorize('create', ManufacturingKeyProcess::class);

            $validator = Validator::make($request->all(), [
                'process_name' => 'required|string|max:255|unique:manufacturing_key_processes,process_name',
                'is_active' => 'sometimes|boolean',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $process = ManufacturingKeyProcess::create([
                'process_name' => $request->input('process_name'),
                'is_active' => $request->input('is_active', true),
                'created_by' => auth()->id(),
            ]);

            return $this->successResponse($process, 'Key process created successfully', 201);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A key process with this name already exists', 400);
            }
            Log::error('Failed to create key process', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create key process', 500);
        } catch (Exception $e) {
            Log::error('Failed to create key process', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create key process', 500);
        }
    }

    /**
     * Get a specific manufacturing key process.
     */
    #[OA\Get(
        path: '/api/v1/master-data/manufacturing/key-processes/{id}',
        summary: 'Get a specific manufacturing key process',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Process details'),
            new OA\Response(response: 404, description: 'Process not found'),
        ],
    )]
    public function show(ManufacturingKeyProcess $keyProcess): JsonResponse
    {
        try {
            Gate::authorize('view', $keyProcess);

            return $this->successResponse($keyProcess, 'Key process retrieved successfully');
        } catch (Exception $e) {
            Log::error('Failed to retrieve key process', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve key process', 500);
        }
    }

    /**
     * Update a manufacturing key process.
     */
    #[OA\Put(
        path: '/api/v1/master-data/manufacturing/key-processes/{id}',
        summary: 'Update a manufacturing key process',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'processName', type: 'string'),
                    new OA\Property(property: 'isActive', type: 'boolean'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Process updated successfully'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Process not found'),
        ],
    )]
    public function update(Request $request, ManufacturingKeyProcess $keyProcess): JsonResponse
    {
        try {
            Gate::authorize('update', $keyProcess);

            $validator = Validator::make($request->all(), [
                'process_name' => 'sometimes|string|max:255|unique:manufacturing_key_processes,process_name,'.$keyProcess->id,
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $keyProcess->update(array_merge(
                $request->only(['process_name']),
                ['updated_by' => auth()->id()]
            ));

            return $this->successResponse($keyProcess, 'Key process updated successfully');
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A key process with this name already exists', 400);
            }
            Log::error('Failed to update key process', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update key process', 500);
        } catch (Exception $e) {
            Log::error('Failed to update key process', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update key process', 500);
        }
    }

    /**
     * Activate a manufacturing key process.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/key-processes/{id}/activate',
        summary: 'Activate a manufacturing key process',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Key process activated successfully'),
            new OA\Response(response: 400, description: 'Bad request - Key process is already active'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Key process not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingKeyProcess::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === true) {
                return $this->errorResponse('Key process is already active.', 400);
            }

            $entity->update(['is_active' => true]);

            Log::info('Key process activated', [
                'entity_id' => $entity->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Key process activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Key process not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to activate key process', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate key process.', 500);
        }
    }

    /**
     * Deactivate a manufacturing key process.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/key-processes/{id}/deactivate',
        summary: 'Deactivate a manufacturing key process',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Key process deactivated successfully'),
            new OA\Response(response: 400, description: 'Bad request - Key process is already inactive'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Key process not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingKeyProcess::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === false) {
                return $this->errorResponse('Key process is already inactive.', 400);
            }

            $entity->update(['is_active' => false]);

            Log::info('Key process deactivated', [
                'entity_id' => $entity->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Key process deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Key process not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to deactivate key process', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate key process.', 500);
        }
    }
}
