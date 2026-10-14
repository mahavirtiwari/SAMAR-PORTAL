<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ServiceVendorCategory;
use Exception;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Service Master Data', description: 'Service sector master data management (System Admin only)')]
class ServiceVendorCategoriesController extends Controller
{
    /**
     * List all service DRDO vendor categories.
     */
    #[OA\Get(
        path: '/api/v1/master-data/service/vendor-categories',
        summary: 'List all service DRDO vendor categories',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'all',
                in: 'query',
                description: 'Return all records without pagination (for dropdowns). Cannot be used with page/per_page parameters.',
                required: false,
                schema: new OA\Schema(type: 'boolean', default: false, example: true),
            ),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(
                name: 'serviceProviderType',
                in: 'query',
                schema: new OA\Schema(
                    type: 'string',
                    enum: ['annual_maintenance_contract', 'critical_service_provider', 'civil_works_contractor'],
                ),
            ),
            new OA\Parameter(name: 'isActive', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'perPage', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'List of DRDO vendor categories'),
            new OA\Response(response: 400, description: 'Bad request - conflicting parameters'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        try {
            $query = ServiceVendorCategory::query();

            if ($request->filled('search')) {
                $query->where('category_name', 'like', "%{$request->input('search')}%");
            }

            if ($request->filled('service_provider_type')) {
                $query->where('service_provider_type', $request->input('service_provider_type'));
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $query->orderBy('is_active', 'desc')->orderBy('category_name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'Service DRDO vendor categories retrieved successfully',
                15,
                1000
            );
        } catch (Exception $e) {
            Log::error('Failed to retrieve service DRDO vendor categories', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve service DRDO vendor categories', 500);
        }
    }

    #[OA\Post(
        path: '/api/v1/master-data/service/vendor-categories',
        summary: 'Create a new service DRDO vendor category',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['categoryName', 'serviceProviderType'],
                properties: [
                    new OA\Property(property: 'categoryName', type: 'string'),
                    new OA\Property(
                        property: 'serviceProviderType',
                        type: 'string',
                        enum: ['annual_maintenance_contract', 'critical_service_provider', 'civil_works_contractor'],
                    ),
                    new OA\Property(property: 'isActive', type: 'boolean', default: true),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Category created successfully'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'category_name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('service_vendor_categories', 'category_name')
                        ->where('service_provider_type', $request->input('service_provider_type')),
                ],
                'service_provider_type' => 'required|string|in:annual_maintenance_contract,critical_service_provider,civil_works_contractor',
                'is_active' => 'sometimes|boolean',
            ], [
                'category_name.unique' => 'A category with this name already exists for this service provider type.',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $category = ServiceVendorCategory::create([
                'category_name' => $request->input('category_name'),
                'service_provider_type' => $request->input('service_provider_type'),
                'is_active' => $request->input('is_active', true),
                'created_by' => auth()->id(),
            ]);

            return $this->successResponse($category, 'Service DRDO vendor category created successfully', 201);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A service DRDO vendor category with this name already exists', 400);
            }
            Log::error('Failed to create service DRDO vendor category', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create service DRDO vendor category', 500);
        } catch (Exception $e) {
            Log::error('Failed to create service DRDO vendor category', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create service DRDO vendor category', 500);
        }
    }

    #[OA\Get(
        path: '/api/v1/master-data/service/vendor-categories/{id}',
        summary: 'Get a specific service DRDO vendor category',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Category details'),
            new OA\Response(response: 404, description: 'Category not found'),
        ],
    )]
    public function show(ServiceVendorCategory $serviceVendorCategory): JsonResponse
    {
        return $this->successResponse($serviceVendorCategory, 'Service DRDO vendor category retrieved successfully');
    }

    #[OA\Put(
        path: '/api/v1/master-data/service/vendor-categories/{id}',
        summary: 'Update a service DRDO vendor category',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'categoryName', type: 'string'),
                    new OA\Property(
                        property: 'serviceProviderType',
                        type: 'string',
                        enum: ['annual_maintenance_contract', 'critical_service_provider', 'civil_works_contractor'],
                    ),
                    new OA\Property(property: 'isActive', type: 'boolean'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Category updated successfully'),
        ],
    )]
    public function update(Request $request, ServiceVendorCategory $serviceVendorCategory): JsonResponse
    {
        try {
            // Determine the service_provider_type to check against (use new value if provided, else current)
            $serviceProviderType = $request->input('service_provider_type', $serviceVendorCategory->service_provider_type);

            $validator = Validator::make($request->all(), [
                'category_name' => [
                    'sometimes',
                    'string',
                    'max:255',
                    Rule::unique('service_vendor_categories', 'category_name')
                        ->where('service_provider_type', $serviceProviderType)
                        ->ignore($serviceVendorCategory->id),
                ],
                'service_provider_type' => 'sometimes|string|in:annual_maintenance_contract,critical_service_provider,civil_works_contractor',
            ], [
                'category_name.unique' => 'A category with this name already exists for this service provider type.',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $serviceVendorCategory->update(array_merge(
                $request->only(['category_name', 'service_provider_type']),
                ['updated_by' => auth()->id()]
            ));

            return $this->successResponse($serviceVendorCategory, 'Service DRDO vendor category updated successfully');
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A service DRDO vendor category with this name already exists', 400);
            }
            Log::error('Failed to update service DRDO vendor category', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update service DRDO vendor category', 500);
        } catch (Exception $e) {
            Log::error('Failed to update service DRDO vendor category', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update service DRDO vendor category', 500);
        }
    }

    /**
     * Activate a service DRDO vendor category.
     */
    #[OA\Post(
        path: '/api/v1/master-data/service/vendor-categories/{id}/activate',
        summary: 'Activate a service DRDO vendor category',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Service DRDO vendor category activated successfully'),
            new OA\Response(
                response: 400,
                description: 'Bad request - Service DRDO vendor category is already active',
            ),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Service DRDO vendor category not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activate(int $id): JsonResponse
    {
        try {
            $entity = ServiceVendorCategory::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === true) {
                return $this->errorResponse('Service DRDO vendor category is already active.', 400);
            }

            $entity->update(['is_active' => true]);

            Log::info('Service DRDO vendor category activated', [
                'entity_id' => $entity->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Service DRDO vendor category activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Service DRDO vendor category not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to activate service DRDO vendor category', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate service DRDO vendor category.', 500);
        }
    }

    /**
     * Deactivate a service DRDO vendor category.
     */
    #[OA\Post(
        path: '/api/v1/master-data/service/vendor-categories/{id}/deactivate',
        summary: 'Deactivate a service DRDO vendor category',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Service DRDO vendor category deactivated successfully'),
            new OA\Response(
                response: 400,
                description: 'Bad request - Service DRDO vendor category is already inactive',
            ),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Service DRDO vendor category not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivate(int $id): JsonResponse
    {
        try {
            $entity = ServiceVendorCategory::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === false) {
                return $this->errorResponse('Service DRDO vendor category is already inactive.', 400);
            }

            $entity->update(['is_active' => false]);

            Log::info('Service DRDO vendor category deactivated', [
                'entity_id' => $entity->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Service DRDO vendor category deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Service DRDO vendor category not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to deactivate service DRDO vendor category', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate service DRDO vendor category.', 500);
        }
    }
}
