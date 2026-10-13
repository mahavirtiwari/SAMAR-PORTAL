<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ServiceKeyResource;
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

class ServiceKeyResourcesController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/v1/master-data/service/key-resources",
     *     summary="List all service key resources",
     *     tags={"Service Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="all",
     *         in="query",
     *         description="Return all records without pagination (for dropdowns). Cannot be used with page/per_page parameters.",
     *         required=false,
     *
     *         @OA\Schema(type="boolean", default=false, example=true)
     *     ),
     *
     *     @OA\Parameter(name="search", in="query", @OA\Schema(type="string")),
     *     @OA\Parameter(name="serviceProviderType", in="query", @OA\Schema(type="string", enum={"annual_maintenance_contract", "critical_service_provider", "civil_works_contractor"})),
     *     @OA\Parameter(name="isActive", in="query", @OA\Schema(type="boolean")),
     *     @OA\Parameter(name="page", in="query", @OA\Schema(type="integer", default=1)),
     *     @OA\Parameter(name="perPage", in="query", @OA\Schema(type="integer", default=15)),
     *
     *     @OA\Response(response=200, description="List of key resources"),
     *     @OA\Response(response=400, description="Bad request - conflicting parameters")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = ServiceKeyResource::query();

            if ($request->filled('search')) {
                $query->where('resource_name', 'like', "%{$request->input('search')}%");
            }

            if ($request->filled('service_provider_type')) {
                $query->where('service_provider_type', $request->input('service_provider_type'));
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $query->orderBy('resource_name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'Service key resources retrieved successfully',
                15,
                1000
            );
        } catch (Exception $e) {
            Log::error('Failed to retrieve service key resources', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve service key resources', 500);
        }
    }

    /**
     * @OA\Post(
     *     path="/api/v1/master-data/service/key-resources",
     *     summary="Create a new service key resource",
     *     tags={"Service Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"resourceName", "serviceProviderType"},
     *
     *             @OA\Property(property="resourceName", type="string"),
     *             @OA\Property(property="serviceProviderType", type="string", enum={"annual_maintenance_contract", "critical_service_provider", "civil_works_contractor"}),
     *             @OA\Property(property="isActive", type="boolean", default=true)
     *         )
     *     ),
     *
     *     @OA\Response(response=201, description="Resource created successfully")
     * )
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'resource_name' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('service_key_resources', 'resource_name')
                        ->where('service_provider_type', $request->input('service_provider_type')),
                ],
                'service_provider_type' => 'required|string|in:annual_maintenance_contract,critical_service_provider,civil_works_contractor',
                'is_active' => 'sometimes|boolean',
            ], [
                'resource_name.unique' => 'A resource with this name already exists for this service provider type.',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $resource = ServiceKeyResource::create([
                'resource_name' => $request->input('resource_name'),
                'service_provider_type' => $request->input('service_provider_type'),
                'is_active' => $request->input('is_active', true),
                'created_by' => auth()->id(),
            ]);

            return $this->successResponse($resource, 'Service key resource created successfully', 201);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A service key resource with this name already exists for this service provider type', 400);
            }
            Log::error('Failed to create service key resource', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create service key resource', 500);
        } catch (Exception $e) {
            Log::error('Failed to create service key resource', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create service key resource', 500);
        }
    }

    /**
     * @OA\Get(
     *     path="/api/v1/master-data/service/key-resources/{id}",
     *     summary="Get a specific service key resource",
     *     tags={"Service Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="Resource details")
     * )
     */
    public function show(ServiceKeyResource $serviceKeyResource): JsonResponse
    {
        return $this->successResponse($serviceKeyResource, 'Service key resource retrieved successfully');
    }

    /**
     * @OA\Put(
     *     path="/api/v1/master-data/service/key-resources/{id}",
     *     summary="Update a service key resource",
     *     tags={"Service Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="resourceName", type="string"),
     *             @OA\Property(property="serviceProviderType", type="string", enum={"annual_maintenance_contract", "critical_service_provider", "civil_works_contractor"}),
     *             @OA\Property(property="isActive", type="boolean")
     *         )
     *     ),
     *
     *     @OA\Response(response=200, description="Resource updated successfully")
     * )
     */
    public function update(Request $request, ServiceKeyResource $serviceKeyResource): JsonResponse
    {
        try {
            // Determine the service_provider_type to check against (use new value if provided, else current)
            $serviceProviderType = $request->input('service_provider_type', $serviceKeyResource->service_provider_type);

            $validator = Validator::make($request->all(), [
                'resource_name' => [
                    'sometimes',
                    'string',
                    'max:255',
                    Rule::unique('service_key_resources', 'resource_name')
                        ->where('service_provider_type', $serviceProviderType)
                        ->ignore($serviceKeyResource->id),
                ],
                'service_provider_type' => 'sometimes|string|in:annual_maintenance_contract,critical_service_provider,civil_works_contractor',
            ], [
                'resource_name.unique' => 'A resource with this name already exists for this service provider type.',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $serviceKeyResource->update(array_merge(
                $request->only(['resource_name', 'service_provider_type']),
                ['updated_by' => auth()->id()]
            ));

            return $this->successResponse($serviceKeyResource, 'Service key resource updated successfully');
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A service key resource with this name already exists for this service provider type', 400);
            }
            Log::error('Failed to update service key resource', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update service key resource', 500);
        } catch (Exception $e) {
            Log::error('Failed to update service key resource', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update service key resource', 500);
        }
    }

    /**
     * Activate a service key resource.
     *
     * @OA\Post(
     *     path="/api/v1/master-data/service/key-resources/{id}/activate",
     *     summary="Activate a service key resource",
     *     tags={"Service Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="Service key resource activated successfully"),
     *     @OA\Response(response=400, description="Bad request - Service key resource is already active"),
     *     @OA\Response(response=401, description="Unauthorized"),
     *     @OA\Response(response=403, description="Forbidden - System Admin only"),
     *     @OA\Response(response=404, description="Service key resource not found"),
     *     @OA\Response(response=500, description="Server error")
     * )
     */
    public function activate(int $id): JsonResponse
    {
        try {
            $entity = ServiceKeyResource::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === true) {
                return $this->errorResponse('Service key resource is already active.', 400);
            }

            $entity->update(['is_active' => true]);

            Log::info('Service key resource activated', [
                'entity_id' => $entity->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Service key resource activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Service key resource not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to activate service key resource', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate service key resource.', 500);
        }
    }

    /**
     * Deactivate a service key resource.
     *
     * @OA\Post(
     *     path="/api/v1/master-data/service/key-resources/{id}/deactivate",
     *     summary="Deactivate a service key resource",
     *     tags={"Service Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="Service key resource deactivated successfully"),
     *     @OA\Response(response=400, description="Bad request - Service key resource is already inactive"),
     *     @OA\Response(response=401, description="Unauthorized"),
     *     @OA\Response(response=403, description="Forbidden - System Admin only"),
     *     @OA\Response(response=404, description="Service key resource not found"),
     *     @OA\Response(response=500, description="Server error")
     * )
     */
    public function deactivate(int $id): JsonResponse
    {
        try {
            $entity = ServiceKeyResource::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === false) {
                return $this->errorResponse('Service key resource is already inactive.', 400);
            }

            $entity->update(['is_active' => false]);

            Log::info('Service key resource deactivated', [
                'entity_id' => $entity->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'Service key resource deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Service key resource not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to deactivate service key resource', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate service key resource.', 500);
        }
    }
}
