<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AssessorDomain;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Master Data',
    description: 'Master data management for system configuration (System Admin only)',
)]
class AssessorDomainsController extends Controller
{
    /**
     * List all assessor domains.
     */
    #[OA\Get(
        path: '/api/v1/master-data/assessor-domains',
        summary: 'List all assessor domains',
        tags: ['Master Data'],
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
                description: 'Search by domain name',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'perPage', in: 'query', schema: new OA\Schema(type: 'integer', default: 15)),
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
                description: 'List of assessor domains',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string'),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                type: 'object',
                                properties: [
                                    new OA\Property(property: 'id', type: 'integer'),
                                    new OA\Property(property: 'domain_name', type: 'string'),
                                    new OA\Property(property: 'is_active', type: 'boolean'),
                                    new OA\Property(property: 'created_at', type: 'string'),
                                ],
                            ),
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Bad request - conflicting parameters'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function index(Request $request)
    {
        try {
            Gate::authorize('viewAny', AssessorDomain::class);

            $query = AssessorDomain::query();

            if ($request->filled('search')) {
                $s = $request->input('search');
                $query->where('domain_name', 'like', "%{$s}%");
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            $query->orderBy('domain_name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'Assessor domains retrieved successfully',
                15,
                1000
            );
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to retrieve assessor domains', 500);
        }
    }

    /**
     * Create a new assessor domain.
     */
    #[OA\Post(
        path: '/api/v1/master-data/assessor-domains',
        summary: 'Create a new assessor domain',
        tags: ['Master Data'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['domain_name'],
                properties: [
                    new OA\Property(
                        property: 'domain_name',
                        type: 'string',
                        example: 'Aerodynamics and Air-frame Design',
                    ),
                    new OA\Property(property: 'is_active', type: 'boolean', default: true),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Assessor domain created successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Assessor domain created successfully',
                        ),
                        new OA\Property(property: 'data', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
        ],
    )]
    public function store(Request $request)
    {
        try {
            Gate::authorize('create', AssessorDomain::class);

            $v = Validator::make($request->all(), [
                'domain_name' => 'required|string|max:1000|unique:assessor_domains,domain_name',
            ]);

            if ($v->fails()) {
                return $this->errorResponse('Validation failed', 400, $v->errors()->toArray());
            }

            $domain = AssessorDomain::create([
                'domain_name' => $request->input('domain_name'),
                'is_active' => true,
                'created_by' => $request->user()?->id,
            ]);

            return $this->successResponse($domain, 'Assessor domain created successfully', 201);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to create assessor domain', 500);
        }
    }

    /**
     * Get a specific assessor domain.
     */
    #[OA\Get(
        path: '/api/v1/master-data/assessor-domains/{id}',
        summary: 'Get a specific assessor domain',
        tags: ['Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessor Domain ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Assessor domain details'),
            new OA\Response(response: 404, description: 'Not found'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function show(AssessorDomain $assessorDomain)
    {
        try {
            Gate::authorize('view', $assessorDomain);

            return $this->successResponse($assessorDomain, 'Assessor domain retrieved successfully');
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to retrieve assessor domain', 500);
        }
    }

    /**
     * Update an assessor domain.
     */
    #[OA\Put(
        path: '/api/v1/master-data/assessor-domains/{id}',
        summary: 'Update an assessor domain',
        tags: ['Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Assessor Domain ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['domain_name'],
                properties: [
                    new OA\Property(property: 'domain_name', type: 'string'),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Updated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden - System Admin only'),
        ],
    )]
    public function update(Request $request, AssessorDomain $assessorDomain)
    {
        try {
            Gate::authorize('update', $assessorDomain);

            $v = Validator::make($request->all(), [
                'domain_name' => 'required|string|max:1000|unique:assessor_domains,domain_name,'.$assessorDomain->id,
            ]);

            if ($v->fails()) {
                return $this->errorResponse('Validation failed', 400, $v->errors()->toArray());
            }

            $assessorDomain->update([
                'domain_name' => $request->input('domain_name'),
                'updated_by' => $request->user()?->id,
            ]);

            return $this->successResponse($assessorDomain, 'Assessor domain updated successfully');
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is restricted to System Admin only', 403);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to update assessor domain', 500);
        }
    }

    #[OA\Post(
        path: '/api/v1/master-data/assessor-domains/{id}/activate',
        summary: 'Activate assessor domain',
        tags: ['Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Assessor domain activated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Assessor domain not found'),
            new OA\Response(response: 400, description: 'Assessor domain is already active'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activate(AssessorDomain $assessorDomain): JsonResponse
    {
        try {
            Gate::authorize('changeStatus', $assessorDomain);

            if ($assessorDomain->is_active === true) {
                return $this->errorResponse('Assessor domain is already active.', 400);
            }

            $assessorDomain->update(['is_active' => true]);

            Log::info('Assessor domain activated', [
                'assessor_domain_id' => $assessorDomain->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($assessorDomain, 'Assessor domain activated successfully.');
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to activate assessor domain', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'assessor_domain_id' => $assessorDomain->id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate assessor domain.', 500);
        }
    }

    #[OA\Post(
        path: '/api/v1/master-data/assessor-domains/{id}/deactivate',
        summary: 'Deactivate assessor domain',
        tags: ['Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Assessor domain deactivated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Assessor domain not found'),
            new OA\Response(response: 400, description: 'Assessor domain is already inactive'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivate(AssessorDomain $assessorDomain): JsonResponse
    {
        try {
            Gate::authorize('changeStatus', $assessorDomain);

            if ($assessorDomain->is_active === false) {
                return $this->errorResponse('Assessor domain is already inactive.', 400);
            }

            $assessorDomain->update(['is_active' => false]);

            Log::info('Assessor domain deactivated', [
                'assessor_domain_id' => $assessorDomain->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($assessorDomain, 'Assessor domain deactivated successfully.');
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to deactivate assessor domain', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'assessor_domain_id' => $assessorDomain->id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate assessor domain.', 500);
        }
    }
}
