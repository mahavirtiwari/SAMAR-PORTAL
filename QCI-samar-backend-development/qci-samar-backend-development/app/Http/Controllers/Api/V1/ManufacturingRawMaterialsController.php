<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ManufacturingRawMaterial;
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

class ManufacturingRawMaterialsController extends Controller
{
    /**
     * List all manufacturing raw materials.
     */
    #[OA\Get(
        path: '/api/v1/master-data/manufacturing/raw-materials',
        summary: 'List all manufacturing raw materials',
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
                description: 'Search by material name',
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
            new OA\Response(response: 200, description: 'List of raw materials'),
            new OA\Response(response: 400, description: 'Bad request - conflicting parameters'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        try {
            Gate::authorize('viewAny', ManufacturingRawMaterial::class);

            $query = ManufacturingRawMaterial::query();

            if ($request->filled('search')) {
                $query->where('material_name', 'like', "%{$request->input('search')}%");
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $query->orderBy('material_name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'Raw materials retrieved successfully',
                15,
                1000
            );
        } catch (Exception $e) {
            Log::error('Failed to retrieve raw materials', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve raw materials', 500);
        }
    }

    /**
     * Create a new manufacturing raw material.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/raw-materials',
        summary: 'Create a new manufacturing raw material',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['materialName'],
                properties: [
                    new OA\Property(property: 'materialName', type: 'string', example: 'Steel Plates'),
                    new OA\Property(property: 'isActive', type: 'boolean', default: true),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Raw material created successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        try {
            Gate::authorize('create', ManufacturingRawMaterial::class);

            $validator = Validator::make($request->all(), [
                'material_name' => 'required|string|max:255|unique:manufacturing_raw_materials,material_name',
                'is_active' => 'sometimes|boolean',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $material = ManufacturingRawMaterial::create([
                'material_name' => $request->input('material_name'),
                'is_active' => $request->input('is_active', true),
                'created_by' => auth()->id(),
            ]);

            return $this->successResponse($material, 'Raw material created successfully', 201);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A raw material with this name already exists', 400);
            }
            Log::error('Failed to create raw material', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create raw material', 500);
        } catch (Exception $e) {
            Log::error('Failed to create raw material', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create raw material', 500);
        }
    }

    /**
     * Get a specific manufacturing raw material.
     */
    #[OA\Get(
        path: '/api/v1/master-data/manufacturing/raw-materials/{id}',
        summary: 'Get a specific manufacturing raw material',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Raw material details'),
            new OA\Response(response: 404, description: 'Raw material not found'),
        ],
    )]
    public function show(ManufacturingRawMaterial $rawMaterial): JsonResponse
    {
        try {
            Gate::authorize('view', $rawMaterial);

            return $this->successResponse($rawMaterial, 'Raw material retrieved successfully');
        } catch (Exception $e) {
            Log::error('Failed to retrieve raw material', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve raw material', 500);
        }
    }

    /**
     * Update a manufacturing raw material.
     */
    #[OA\Put(
        path: '/api/v1/master-data/manufacturing/raw-materials/{id}',
        summary: 'Update a manufacturing raw material',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'materialName', type: 'string'),
                    new OA\Property(property: 'isActive', type: 'boolean'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Raw material updated successfully'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Raw material not found'),
        ],
    )]
    public function update(Request $request, ManufacturingRawMaterial $rawMaterial): JsonResponse
    {
        try {
            Gate::authorize('update', $rawMaterial);

            $validator = Validator::make($request->all(), [
                'material_name' => 'sometimes|string|max:255|unique:manufacturing_raw_materials,material_name,'.$rawMaterial->id,
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $rawMaterial->update(array_merge(
                $request->only(['material_name']),
                ['updated_by' => auth()->id()]
            ));

            return $this->successResponse($rawMaterial, 'Raw material updated successfully');
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A raw material with this name already exists', 400);
            }
            Log::error('Failed to update raw material', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update raw material', 500);
        } catch (Exception $e) {
            Log::error('Failed to update raw material', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update raw material', 500);
        }
    }

    /**
     * Activate a manufacturing raw material.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/raw-materials/{id}/activate',
        summary: 'Activate a manufacturing raw material',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Raw material activated successfully'),
            new OA\Response(response: 400, description: 'Bad request - Raw material is already active'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Raw material not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingRawMaterial::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === true) {
                return $this->errorResponse('Raw material is already active.', 400);
            }

            $entity->update(['is_active' => true]);

            Log::info('Raw material activated', [
                'entity_id' => $entity->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Raw material activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Raw material not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to activate raw material', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate raw material.', 500);
        }
    }

    /**
     * Deactivate a manufacturing raw material.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/raw-materials/{id}/deactivate',
        summary: 'Deactivate a manufacturing raw material',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Raw material deactivated successfully'),
            new OA\Response(response: 400, description: 'Bad request - Raw material is already inactive'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Raw material not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingRawMaterial::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === false) {
                return $this->errorResponse('Raw material is already inactive.', 400);
            }

            $entity->update(['is_active' => false]);

            Log::info('Raw material deactivated', [
                'entity_id' => $entity->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Raw material deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Raw material not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to deactivate raw material', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate raw material.', 500);
        }
    }
}
