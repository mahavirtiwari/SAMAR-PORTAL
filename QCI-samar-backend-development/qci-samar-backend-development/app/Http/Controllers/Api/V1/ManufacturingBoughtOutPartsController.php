<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ManufacturingBoughtOutPart;
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

#[OA\Tag(
    name: 'Manufacturing Master Data',
    description: 'Manufacturing sector master data management (System Admin only)',
)]
class ManufacturingBoughtOutPartsController extends Controller
{
    /**
     * List all manufacturing bought-out parts.
     */
    #[OA\Get(
        path: '/api/v1/master-data/manufacturing/bought-out-parts',
        summary: 'List all manufacturing bought-out parts',
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
                description: 'Search by part name',
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
            new OA\Response(
                response: 200,
                description: 'List of bought-out parts',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Bought-out parts retrieved successfully',
                        ),
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(type: 'object')),
                        new OA\Property(
                            property: 'pagination',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'currentPage', type: 'integer', example: 1),
                                new OA\Property(property: 'perPage', type: 'integer', example: 15),
                                new OA\Property(property: 'total', type: 'integer', example: 0),
                                new OA\Property(property: 'lastPage', type: 'integer', example: 1),
                                new OA\Property(property: 'from', type: 'integer', nullable: true, example: null),
                                new OA\Property(property: 'to', type: 'integer', nullable: true, example: null),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Bad request - conflicting parameters'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        try {
            Gate::authorize('viewAny', ManufacturingBoughtOutPart::class);

            $query = ManufacturingBoughtOutPart::query();

            if ($request->filled('search')) {
                $query->where('part_name', 'like', "%{$request->input('search')}%");
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $query->orderBy('part_name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'Bought-out parts retrieved successfully',
                15,
                1000
            );
        } catch (Exception $e) {
            Log::error('Failed to retrieve bought-out parts', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve bought-out parts', 500);
        }
    }

    /**
     * Create a new manufacturing bought-out part.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/bought-out-parts',
        summary: 'Create a new manufacturing bought-out part',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['part_name'],
                properties: [
                    new OA\Property(property: 'partName', type: 'string', example: 'Adaptors'),
                    new OA\Property(property: 'isActive', type: 'boolean', default: true),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Part created successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        try {
            Gate::authorize('create', ManufacturingBoughtOutPart::class);

            $validator = Validator::make($request->all(), [
                'part_name' => 'required|string|max:255|unique:manufacturing_bought_out_parts,part_name',
                'is_active' => 'sometimes|boolean',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $part = ManufacturingBoughtOutPart::create([
                'part_name' => $request->input('part_name'),
                'is_active' => $request->input('is_active', true),
                'created_by' => auth()->id(),
            ]);

            return $this->successResponse($part, 'Bought-out part created successfully', 201);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            // Handle database-specific errors
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A bought-out part with this name already exists', 400);
            }

            return $this->errorResponse('Failed to create bought-out part due to database error', 500);
        } catch (Exception $e) {
            return $this->errorResponse('Failed to create bought-out part', 500);
        }
    }

    /**
     * Get a specific manufacturing bought-out part.
     */
    #[OA\Get(
        path: '/api/v1/master-data/manufacturing/bought-out-parts/{id}',
        summary: 'Get a specific manufacturing bought-out part',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Part details'),
            new OA\Response(response: 404, description: 'Part not found'),
        ],
    )]
    public function show(ManufacturingBoughtOutPart $boughtOutPart): JsonResponse
    {
        try {
            Gate::authorize('view', $boughtOutPart);

            return $this->successResponse($boughtOutPart, 'Bought-out part retrieved successfully');
        } catch (Exception $e) {
            return $this->errorResponse('Failed to retrieve bought-out part', 500);
        }
    }

    /**
     * Update a manufacturing bought-out part.
     */
    #[OA\Put(
        path: '/api/v1/master-data/manufacturing/bought-out-parts/{id}',
        summary: 'Update a manufacturing bought-out part',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'partName', type: 'string'),
                    new OA\Property(property: 'isActive', type: 'boolean'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Part updated successfully'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Part not found'),
        ],
    )]
    public function update(Request $request, ManufacturingBoughtOutPart $boughtOutPart): JsonResponse
    {
        try {
            Gate::authorize('update', $boughtOutPart);

            $validator = Validator::make($request->all(), [
                'part_name' => 'sometimes|string|max:255|unique:manufacturing_bought_out_parts,part_name,'.$boughtOutPart->id,
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $boughtOutPart->update(array_merge(
                $request->only(['part_name']),
                ['updated_by' => auth()->id()]
            ));

            return $this->successResponse($boughtOutPart, 'Bought-out part updated successfully');
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            // Handle database-specific errors
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A bought-out part with this name already exists', 400);
            }

            return $this->errorResponse('Failed to update bought-out part due to database error', 500);
        } catch (Exception $e) {
            return $this->errorResponse('Failed to update bought-out part', 500);
        }
    }

    /**
     * Activate a manufacturing bought-out part.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/bought-out-parts/{id}/activate',
        summary: 'Activate a manufacturing bought-out part',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Bought-out part activated successfully'),
            new OA\Response(response: 400, description: 'Bad request - Bought-out part is already active'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Bought-out part not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingBoughtOutPart::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === true) {
                return $this->errorResponse('Bought-out part is already active.', 400);
            }

            $entity->update(['is_active' => true]);

            Log::info('Bought-out part activated', [
                'entity_id' => $entity->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Bought-out part activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Bought-out part not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to activate bought-out part', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate bought-out part.', 500);
        }
    }

    /**
     * Deactivate a manufacturing bought-out part.
     */
    #[OA\Post(
        path: '/api/v1/master-data/manufacturing/bought-out-parts/{id}/deactivate',
        summary: 'Deactivate a manufacturing bought-out part',
        tags: ['Manufacturing Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Bought-out part deactivated successfully'),
            new OA\Response(response: 400, description: 'Bad request - Bought-out part is already inactive'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Bought-out part not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingBoughtOutPart::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === false) {
                return $this->errorResponse('Bought-out part is already inactive.', 400);
            }

            $entity->update(['is_active' => false]);

            Log::info('Bought-out part deactivated', [
                'entity_id' => $entity->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Bought-out part deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Bought-out part not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to deactivate bought-out part', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate bought-out part.', 500);
        }
    }
}
