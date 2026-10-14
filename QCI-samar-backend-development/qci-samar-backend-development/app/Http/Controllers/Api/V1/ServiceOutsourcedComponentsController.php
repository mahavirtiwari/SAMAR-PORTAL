<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ServiceOutsourcedComponent;
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

class ServiceOutsourcedComponentsController extends Controller
{
    #[OA\Get(
        path: '/api/v1/master-data/service/outsourced-components',
        summary: 'List all service outsourced components',
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
            new OA\Response(response: 200, description: 'List of outsourced components'),
            new OA\Response(response: 400, description: 'Bad request - conflicting parameters'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        try {
            $query = ServiceOutsourcedComponent::query();

            if ($request->filled('search')) {
                $query->where('component_name', 'like', "%{$request->input('search')}%");
            }

            if ($request->filled('service_provider_type')) {
                $query->where('service_provider_type', $request->input('service_provider_type'));
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $query->orderBy('component_name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'Service outsourced components retrieved successfully',
                15,
                1000
            );
        } catch (Exception $e) {
            Log::error('Failed to retrieve service outsourced components', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve service outsourced components', 500);
        }
    }

    #[OA\Post(
        path: '/api/v1/master-data/service/outsourced-components',
        summary: 'Create a new service outsourced component',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['componentName', 'serviceProviderType'],
                properties: [
                    new OA\Property(property: 'componentName', type: 'string'),
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
            new OA\Response(response: 201, description: 'Component created successfully'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'component_name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('service_outsourced_components', 'component_name')
                        ->where('service_provider_type', $request->input('service_provider_type')),
                ],
                'service_provider_type' => 'required|string|in:annual_maintenance_contract,critical_service_provider,civil_works_contractor',
                'is_active' => 'sometimes|boolean',
            ], [
                'component_name.unique' => 'A component with this name already exists for this service provider type.',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $component = ServiceOutsourcedComponent::create([
                'component_name' => $request->input('component_name'),
                'service_provider_type' => $request->input('service_provider_type'),
                'is_active' => $request->input('is_active', true),
                'created_by' => auth()->id(),
            ]);

            return $this->successResponse($component, 'Service outsourced component created successfully', 201);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A service outsourced component with this name already exists for this service provider type', 400);
            }
            Log::error('Failed to create service outsourced component', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create service outsourced component', 500);
        } catch (Exception $e) {
            Log::error('Failed to create service outsourced component', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create service outsourced component', 500);
        }
    }

    #[OA\Get(
        path: '/api/v1/master-data/service/outsourced-components/{id}',
        summary: 'Get a specific service outsourced component',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Component details'),
        ],
    )]
    public function show(ServiceOutsourcedComponent $serviceOutsourcedComponent): JsonResponse
    {
        return $this->successResponse($serviceOutsourcedComponent, 'Service outsourced component retrieved successfully');
    }

    #[OA\Put(
        path: '/api/v1/master-data/service/outsourced-components/{id}',
        summary: 'Update a service outsourced component',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'componentName', type: 'string'),
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
            new OA\Response(response: 200, description: 'Component updated successfully'),
        ],
    )]
    public function update(Request $request, ServiceOutsourcedComponent $serviceOutsourcedComponent): JsonResponse
    {
        try {
            // Determine the service_provider_type to check against (use new value if provided, else current)
            $serviceProviderType = $request->input('service_provider_type', $serviceOutsourcedComponent->service_provider_type);

            $validator = Validator::make($request->all(), [
                'component_name' => [
                    'sometimes',
                    'string',
                    'max:255',
                    Rule::unique('service_outsourced_components', 'component_name')
                        ->where('service_provider_type', $serviceProviderType)
                        ->ignore($serviceOutsourcedComponent->id),
                ],
                'service_provider_type' => 'sometimes|string|in:annual_maintenance_contract,critical_service_provider,civil_works_contractor',
            ], [
                'component_name.unique' => 'A component with this name already exists for this service provider type.',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $serviceOutsourcedComponent->update(array_merge(
                $request->only(['component_name', 'service_provider_type']),
                ['updated_by' => auth()->id()]
            ));

            return $this->successResponse($serviceOutsourcedComponent, 'Service outsourced component updated successfully');
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A service outsourced component with this name already exists for this service provider type', 400);
            }
            Log::error('Failed to update service outsourced component', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update service outsourced component', 500);
        } catch (Exception $e) {
            Log::error('Failed to update service outsourced component', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update service outsourced component', 500);
        }
    }

    /**
     * Activate a service outsourced component.
     */
    #[OA\Post(
        path: '/api/v1/master-data/service/outsourced-components/{id}/activate',
        summary: 'Activate a service outsourced component',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Service outsourced component activated successfully'),
            new OA\Response(
                response: 400,
                description: 'Bad request - Service outsourced component is already active',
            ),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Service outsourced component not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activate(int $id): JsonResponse
    {
        try {
            $entity = ServiceOutsourcedComponent::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === true) {
                return $this->errorResponse('Service outsourced component is already active.', 400);
            }

            $entity->update(['is_active' => true]);

            Log::info('Service outsourced component activated', [
                'entity_id' => $entity->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Service outsourced component activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Service outsourced component not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to activate service outsourced component', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate service outsourced component.', 500);
        }
    }

    /**
     * Deactivate a service outsourced component.
     */
    #[OA\Post(
        path: '/api/v1/master-data/service/outsourced-components/{id}/deactivate',
        summary: 'Deactivate a service outsourced component',
        tags: ['Service Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Service outsourced component deactivated successfully'),
            new OA\Response(
                response: 400,
                description: 'Bad request - Service outsourced component is already inactive',
            ),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
            new OA\Response(response: 404, description: 'Service outsourced component not found'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivate(int $id): JsonResponse
    {
        try {
            $entity = ServiceOutsourcedComponent::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === false) {
                return $this->errorResponse('Service outsourced component is already inactive.', 400);
            }

            $entity->update(['is_active' => false]);

            Log::info('Service outsourced component deactivated', [
                'entity_id' => $entity->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Service outsourced component deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Service outsourced component not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to deactivate service outsourced component', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate service outsourced component.', 500);
        }
    }
}
