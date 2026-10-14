<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ThirdPartyCertification;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Third-Party Certifications',
    description: 'Third-party certification master data management endpoints',
)]
class ThirdPartyCertController extends Controller
{
    #[OA\Get(
        path: '/api/v1/third-party-certs',
        summary: 'List all third-party certifications',
        tags: ['Third-Party Certifications'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'page',
                in: 'query',
                description: 'Page number for pagination',
                required: false,
                schema: new OA\Schema(type: 'integer', minimum: 1, example: 1),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Number of items per page (max 100)',
                required: false,
                schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, example: 15),
            ),
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search term for certification name',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'ISO'),
            ),
            new OA\Parameter(
                name: 'isActive',
                in: 'query',
                description: 'Filter by active status',
                schema: new OA\Schema(type: 'boolean'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Third-party certifications retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Third-party certifications retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'id', type: 'integer', example: 1),
                                    new OA\Property(
                                        property: 'certification_name',
                                        type: 'string',
                                        example: 'ISO 9001:2015',
                                    ),
                                    new OA\Property(property: 'is_active', type: 'boolean', example: true),
                                    new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
                                    new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
                                ],
                            ),
                        ),
                        new OA\Property(
                            property: 'pagination',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'total', type: 'integer', example: 73),
                                new OA\Property(property: 'perPage', type: 'integer', example: 15),
                                new OA\Property(property: 'currentPage', type: 'integer', example: 1),
                                new OA\Property(property: 'lastPage', type: 'integer', example: 5),
                                new OA\Property(property: 'from', type: 'integer', nullable: true, example: 1),
                                new OA\Property(property: 'to', type: 'integer', nullable: true, example: 15),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Validation error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation failed'),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        try {
            // Validate request parameters
            $validator = Validator::make($request->all(), [
                'page' => 'nullable|integer|min:1',
                'per_page' => 'nullable|integer|min:1|max:100',
                'search' => 'nullable|string|max:255',
                'is_active' => 'nullable',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            // Build query
            $query = ThirdPartyCertification::ordered();

            // Apply search filter if provided
            if ($request->has('search') && ! empty($request->input('search'))) {
                $searchTerm = $request->input('search');
                $query->where('certification_name', 'like', '%'.$searchTerm.'%');
            }

            // Apply is_active filter if provided
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            // Get pagination parameters
            $perPage = $this->resolvePerPage($request, 15);

            // Paginate results
            $certifications = $query->paginate($perPage);

            // Format response with custom pagination structure
            $response = [
                'data' => $certifications->items(),
                'pagination' => [
                    'total' => $certifications->total(),
                    'per_page' => $certifications->perPage(),
                    'current_page' => $certifications->currentPage(),
                    'last_page' => $certifications->lastPage(),
                    'from' => $certifications->firstItem(),
                    'to' => $certifications->lastItem(),
                ],
            ];

            return $this->successResponse($response, 'Third-party certifications retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to retrieve third-party certifications');
        }
    }

    #[OA\Post(
        path: '/api/v1/third-party-certs',
        summary: 'Create a third-party certification',
        tags: ['Third-Party Certifications'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['certification_name'],
                properties: [
                    new OA\Property(property: 'certification_name', type: 'string', example: 'ISO 9001:2015'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Third-party certification created successfully'),
            new OA\Response(response: 400, description: 'Validation error'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            $validator = Validator::make($request->all(), [
                'certification_name' => 'required|string|max:255|unique:third_party_certifications,certification_name',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            DB::beginTransaction();

            $certification = ThirdPartyCertification::create([
                'certification_name' => $request->input('certification_name'),
                'created_by' => $user->id,
            ]);

            DB::commit();

            return $this->successResponse($certification, 'Third-party certification created successfully', 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to create third-party certification');
        }
    }

    #[OA\Get(
        path: '/api/v1/third-party-certs/{id}',
        summary: 'Get third-party certification details',
        tags: ['Third-Party Certifications'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Third-party certification retrieved successfully'),
            new OA\Response(response: 404, description: 'Certification not found'),
        ],
    )]
    public function show(int $id): JsonResponse
    {
        try {
            $certification = ThirdPartyCertification::findOrFail($id);

            return $this->successResponse($certification, 'Third-party certification retrieved successfully');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Third-party certification not found', 404);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to retrieve third-party certification');
        }
    }

    #[OA\Put(
        path: '/api/v1/third-party-certs/{id}',
        summary: 'Update third-party certification',
        tags: ['Third-Party Certifications'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'certification_name', type: 'string'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Third-party certification updated successfully'),
            new OA\Response(response: 404, description: 'Certification not found'),
        ],
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            $certification = ThirdPartyCertification::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'certification_name' => 'required|string|max:255|unique:third_party_certifications,certification_name,'.$id,
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            DB::beginTransaction();

            $updateData = [
                'certification_name' => $request->input('certification_name'),
                'updated_by' => $user->id,
            ];

            $certification->update($updateData);

            DB::commit();

            return $this->successResponse($certification, 'Third-party certification updated successfully');
        } catch (ModelNotFoundException $e) {
            DB::rollBack();

            return $this->errorResponse('Third-party certification not found', 404);
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to update third-party certification');
        }
    }

    /**
     * @OA\Delete(
     *     path="/api/v1/third-party-certs/{id}",
     *     summary="Delete third-party certification",
     *     tags={"Third-Party Certifications"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Third-party certification deleted successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Certification not found"
     *     )
     * )
     */
    #[OA\Post(
        path: '/api/v1/third-party-certs/{id}/activate',
        summary: 'Activate third-party certification',
        tags: ['Third-Party Certifications'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Third-party certification ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Third-party certification activated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Third-party certification activated successfully',
                        ),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 404, description: 'Third-party certification not found'),
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 400, description: 'Third-party certification is already active'),
        ],
    )]
    public function activate(int $id): JsonResponse
    {
        try {
            $certification = ThirdPartyCertification::findOrFail($id);
            Gate::authorize('changeStatus', $certification);

            if ($certification->is_active === true) {
                return $this->errorResponse('Third-party certification is already active.', 400);
            }

            $certification->update(['is_active' => true]);

            Log::info('Third-party certification activated', [
                'certification_id' => $certification->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($certification, 'Third-party certification activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Third-party certification not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to activate third-party certification', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'certification_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate third-party certification.', 500);
        }
    }

    #[OA\Post(
        path: '/api/v1/third-party-certs/{id}/deactivate',
        summary: 'Deactivate third-party certification',
        tags: ['Third-Party Certifications'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Third-party certification ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Third-party certification deactivated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Third-party certification deactivated successfully',
                        ),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 404, description: 'Third-party certification not found'),
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 400, description: 'Third-party certification is already inactive'),
        ],
    )]
    public function deactivate(int $id): JsonResponse
    {
        try {
            $certification = ThirdPartyCertification::findOrFail($id);
            Gate::authorize('changeStatus', $certification);

            if ($certification->is_active === false) {
                return $this->errorResponse('Third-party certification is already inactive.', 400);
            }

            $certification->update(['is_active' => false]);

            Log::info('Third-party certification deactivated', [
                'certification_id' => $certification->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($certification, 'Third-party certification deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Third-party certification not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to deactivate third-party certification', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'certification_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate third-party certification.', 500);
        }
    }
}
