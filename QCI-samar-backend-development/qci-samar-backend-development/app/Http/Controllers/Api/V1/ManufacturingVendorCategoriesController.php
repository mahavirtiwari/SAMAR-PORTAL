<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ManufacturingVendorCategory;
use Exception;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ManufacturingVendorCategoriesController extends Controller
{
    /**
     * List all manufacturing DRDO vendor categories.
     *
     * @OA\Get(
     *     path="/api/v1/master-data/manufacturing/vendor-categories",
     *     summary="List all manufacturing DRDO vendor categories",
     *     tags={"Manufacturing Master Data"},
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
     *     @OA\Parameter(name="isActive", in="query", @OA\Schema(type="boolean")),
     *     @OA\Parameter(name="page", in="query", @OA\Schema(type="integer", default=1)),
     *     @OA\Parameter(name="perPage", in="query", @OA\Schema(type="integer", default=15)),
     *
     *     @OA\Response(response=200, description="List of DRDO vendor categories"),
     *     @OA\Response(response=400, description="Bad request - conflicting parameters"),
     *     @OA\Response(response=401, description="Unauthorized")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        try {
            Gate::authorize('viewAny', ManufacturingVendorCategory::class);

            $query = ManufacturingVendorCategory::query();

            if ($request->filled('search')) {
                $query->where('category_name', 'like', "%{$request->input('search')}%");
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $query->orderBy('is_active', 'desc')->orderBy('category_name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'DRDO vendor categories retrieved successfully',
                15,
                1000
            );
        } catch (Exception $e) {
            Log::error('Failed to retrieve DRDO vendor categories', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve DRDO vendor categories', 500);
        }
    }

    /**
     * Create a new manufacturing DRDO vendor category.
     *
     * @OA\Post(
     *     path="/api/v1/master-data/manufacturing/vendor-categories",
     *     summary="Create a new manufacturing DRDO vendor category",
     *     tags={"Manufacturing Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"categoryName"},
     *
     *             @OA\Property(property="categoryName", type="string", example="Fabrication / Production Agency (FPA)"),
     *             @OA\Property(property="isActive", type="boolean", default=true)
     *         )
     *     ),
     *
     *     @OA\Response(response=201, description="Category created successfully"),
     *     @OA\Response(response=401, description="Unauthorized"),
     *     @OA\Response(response=403, description="Forbidden"),
     * )
     */
    public function store(Request $request): JsonResponse
    {
        try {
            Gate::authorize('create', ManufacturingVendorCategory::class);

            $validator = Validator::make($request->all(), [
                'category_name' => 'required|string|max:255|unique:manufacturing_vendor_categories,category_name',
                'is_active' => 'sometimes|boolean',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $category = ManufacturingVendorCategory::create([
                'category_name' => $request->input('category_name'),
                'is_active' => $request->input('is_active', true),
                'created_by' => auth()->id(),
            ]);

            return $this->successResponse($category, 'DRDO vendor category created successfully', 201);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A DRDO vendor category with this name already exists', 400);
            }
            Log::error('Failed to create DRDO vendor category', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create DRDO vendor category', 500);
        } catch (Exception $e) {
            Log::error('Failed to create DRDO vendor category', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to create DRDO vendor category', 500);
        }
    }

    /**
     * Get a specific manufacturing DRDO vendor category.
     *
     * @OA\Get(
     *     path="/api/v1/master-data/manufacturing/vendor-categories/{id}",
     *     summary="Get a specific manufacturing DRDO vendor category",
     *     tags={"Manufacturing Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="Category details"),
     *     @OA\Response(response=404, description="Category not found")
     * )
     */
    public function show(ManufacturingVendorCategory $vendorCategory): JsonResponse
    {
        try {
            Gate::authorize('view', $vendorCategory);

            return $this->successResponse($vendorCategory, 'DRDO vendor category retrieved successfully');
        } catch (Exception $e) {
            Log::error('Failed to retrieve DRDO vendor category', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to retrieve DRDO vendor category', 500);
        }
    }

    /**
     * Update a manufacturing DRDO vendor category.
     *
     * @OA\Put(
     *     path="/api/v1/master-data/manufacturing/vendor-categories/{id}",
     *     summary="Update a manufacturing DRDO vendor category",
     *     tags={"Manufacturing Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="categoryName", type="string"),
     *             @OA\Property(property="isActive", type="boolean")
     *         )
     *     ),
     *
     *     @OA\Response(response=200, description="Category updated successfully"),
     *     @OA\Response(response=403, description="Forbidden"),
     *     @OA\Response(response=404, description="Category not found")
     * )
     */
    public function update(Request $request, ManufacturingVendorCategory $vendorCategory): JsonResponse
    {
        try {
            Gate::authorize('update', $vendorCategory);

            $validator = Validator::make($request->all(), [
                'category_name' => 'sometimes|string|max:255|unique:manufacturing_vendor_categories,category_name,'.$vendorCategory->id,
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            $vendorCategory->update(array_merge(
                $request->only(['category_name']),
                ['updated_by' => auth()->id()]
            ));

            return $this->successResponse($vendorCategory, 'DRDO vendor category updated successfully');
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return $this->errorResponse('A DRDO vendor category with this name already exists', 400);
            }
            Log::error('Failed to update DRDO vendor category', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update DRDO vendor category', 500);
        } catch (Exception $e) {
            Log::error('Failed to update DRDO vendor category', ['error' => $e->getMessage()]);

            return $this->errorResponse('Failed to update DRDO vendor category', 500);
        }
    }

    /**
     * Activate a manufacturing DRDO vendor category.
     *
     * @OA\Post(
     *     path="/api/v1/master-data/manufacturing/vendor-categories/{id}/activate",
     *     summary="Activate a manufacturing DRDO vendor category",
     *     tags={"Manufacturing Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="DRDO vendor category activated successfully"),
     *     @OA\Response(response=400, description="Bad request - DRDO vendor category is already active"),
     *     @OA\Response(response=401, description="Unauthorized"),
     *     @OA\Response(response=403, description="Forbidden - System Admin only"),
     *     @OA\Response(response=404, description="DRDO vendor category not found"),
     *     @OA\Response(response=500, description="Server error")
     * )
     */
    public function activate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingVendorCategory::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === true) {
                return $this->errorResponse('DRDO vendor category is already active.', 400);
            }

            $entity->update(['is_active' => true]);

            Log::info('DRDO vendor category activated', [
                'entity_id' => $entity->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'DRDO vendor category activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('DRDO vendor category not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to activate DRDO vendor category', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate DRDO vendor category.', 500);
        }
    }

    /**
     * Deactivate a manufacturing DRDO vendor category.
     *
     * @OA\Post(
     *     path="/api/v1/master-data/manufacturing/vendor-categories/{id}/deactivate",
     *     summary="Deactivate a manufacturing DRDO vendor category",
     *     tags={"Manufacturing Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="DRDO vendor category deactivated successfully"),
     *     @OA\Response(response=400, description="Bad request - DRDO vendor category is already inactive"),
     *     @OA\Response(response=401, description="Unauthorized"),
     *     @OA\Response(response=403, description="Forbidden - System Admin only"),
     *     @OA\Response(response=404, description="DRDO vendor category not found"),
     *     @OA\Response(response=500, description="Server error")
     * )
     */
    public function deactivate(int $id): JsonResponse
    {
        try {
            $entity = ManufacturingVendorCategory::findOrFail($id);
            Gate::authorize('changeStatus', $entity);

            if ($entity->is_active === false) {
                return $this->errorResponse('DRDO vendor category is already inactive.', 400);
            }

            $entity->update(['is_active' => false]);

            Log::info('DRDO vendor category deactivated', [
                'entity_id' => $entity->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($entity, 'DRDO vendor category deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('DRDO vendor category not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (Exception $e) {
            Log::error('Failed to deactivate DRDO vendor category', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'entity_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate DRDO vendor category.', 500);
        }
    }
}
