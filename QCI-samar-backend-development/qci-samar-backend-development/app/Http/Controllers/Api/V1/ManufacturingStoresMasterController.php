<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ManufacturingStore;
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

class ManufacturingStoresMasterController extends Controller
{
    /**
     * List all manufacturing stores.
     */
    #[OA\Get(
        path: '/api/v1/master-data/manufacturing/stores',
        summary: 'List all manufacturing stores',
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
                description: 'Search by store name',
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
            new OA\Response(response: 200, description: 'List of manufacturing stores'),
            new OA\Response(response: 400, description: 'Bad request - conflicting parameters'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        try {
            Gate::authorize('viewAny', ManufacturingStore::class);

            $query = ManufacturingStore::query();

            if ($request->filled('search')) {
                $query->where('store_name', 'like', "%{$request->input('search')}%");
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $query->orderBy('store_name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'Manufacturing stores retrieved successfully',
                15,
                1000
            );
        } catch (Exception $e) {
            Log::error('Failed to retrieve manufacturing stores', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve manufacturing stores', 500);
        }
    }

    /**
     * Create a new manufacturing store.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/stores',
        summary: 'Create a new manufacturing store',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['storeName'],
                properties: [
                    new OA\Property(property: 'storeName', type: 'string', example: 'Tool Room'),
                    new OA\Property(property: 'isActive', type: 'boolean', default: true),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Store created successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        try {
            Gate::authorize('create', ManufacturingStore::class);

            $validator = Validator::make($request->all(), [
                'store_name' => 'required|string|max:255|unique:manufacturing_stores,store_name',
                'is_active' => 'sometimes|boolean',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $store = ManufacturingStore::create([
                'store_name' => $request->input('store_name'),
                'is_active' => $request->input('is_active', true),
                'created_by' => auth()->id(),
            ]);

            return $this->successResponse($store, 'Manufacturing store created successfully', 201);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A store with this name already exists', 400);
            }
            Log::error('Failed to create manufacturing store', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create manufacturing store', 500);
        } catch (Exception $e) {
            Log::error('Failed to create manufacturing store', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create manufacturing store', 500);
        }
    }

    /**
     * Get a specific manufacturing store.
     */
    #[OA\Get(
        path: '/api/v1/master-data/manufacturing/stores/{id}',
        summary: 'Get a specific manufacturing store',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Store details'),
            new OA\Response(response: 404, description: 'Store not found'),
        ],
    )]
    public function show(ManufacturingStore $manufacturingStore): JsonResponse
    {
        try {
            Gate::authorize('view', $manufacturingStore);

            return $this->successResponse($manufacturingStore, 'Manufacturing store retrieved successfully');
        } catch (Exception $e) {
            Log::error('Failed to retrieve manufacturing store', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve manufacturing store', 500);
        }
    }

    /**
     * Update a manufacturing store.
     */
    #[OA\Put(
        path: '/api/v1/master-data/manufacturing/stores/{id}',
        summary: 'Update a manufacturing store',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'storeName', type: 'string'),
                    new OA\Property(property: 'isActive', type: 'boolean'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Store updated successfully'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Store not found'),
        ],
    )]
    public function update(Request $request, ManufacturingStore $manufacturingStore): JsonResponse
    {
        try {
            Gate::authorize('update', $manufacturingStore);

            $validator = Validator::make($request->all(), [
                'store_name' => 'sometimes|string|max:255|unique:manufacturing_stores,store_name,'.$manufacturingStore->id,
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $manufacturingStore->update(array_merge(
                $request->only(['store_name']),
                ['updated_by' => auth()->id()]
            ));

            return $this->successResponse($manufacturingStore, 'Manufacturing store updated successfully');
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A store with this name already exists', 400);
            }
            Log::error('Failed to update manufacturing store', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update manufacturing store', 500);
        } catch (Exception $e) {
            Log::error('Failed to update manufacturing store', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update manufacturing store', 500);
        }
    }

    /**
     * Activate a manufacturing store.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/stores/{id}/activate',
        summary: 'Activate a manufacturing store',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Manufacturing store activated successfully'),
            new OA\Response(response: 400, description: 'Bad request - Manufacturing store is already active'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Manufacturing store not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingStore::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === true) {
                return $this->errorResponse('Manufacturing store is already active.', 400);
            }

            $entity->update(['is_active' => true]);

            Log::info('Manufacturing store activated', [
                'entity_id' => $entity->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Manufacturing store activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Manufacturing store not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to activate manufacturing store', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate manufacturing store.', 500);
        }
    }

    /**
     * Deactivate a manufacturing store.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/stores/{id}/deactivate',
        summary: 'Deactivate a manufacturing store',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Manufacturing store deactivated successfully'),
            new OA\Response(response: 400, description: 'Bad request - Manufacturing store is already inactive'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Manufacturing store not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingStore::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === false) {
                return $this->errorResponse('Manufacturing store is already inactive.', 400);
            }

            $entity->update(['is_active' => false]);

            Log::info('Manufacturing store deactivated', [
                'entity_id' => $entity->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Manufacturing store deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Manufacturing store not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to deactivate manufacturing store', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate manufacturing store.', 500);
        }
    }
}
