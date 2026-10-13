<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Organization\OrganizationExportRequest;
use App\Http\Requests\Organization\OrganizationListRequest;
use App\Models\Application;
use App\Models\Organization;
use App\Rules\EntityName;
use App\Rules\PersonName;
use App\Services\StateFilterService;
use App\Support\Csv;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @OA\Tag(
 *     name="Organizations",
 *     description="Organization profile management endpoints for viewing and updating organization information"
 * )
 * @OA\Tag(
 *     name="System Admin - Organizations",
 *     description="System admin endpoints for managing all organizations"
 * )
 */
class OrganizationController extends Controller
{
    /**
     * Constructor to inject services.
     */
    public function __construct(
        private StateFilterService $stateFilterService
    ) {}

    /**
     * Get organization profile.
     *
     * @OA\Get(
     *     path="/api/v1/organization",
     *     summary="Get organization profile",
     *     description="Retrieves organization profile information. System admins can specify organization_id query parameter to view any organization.",
     *     tags={"Organizations", "Enterprise Admin - Organizations"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="organizationId",
     *         in="query",
     *         description="Organization ID (System Admin only)",
     *         required=false,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Organization retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="organization", type="object")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Forbidden"),
     *     @OA\Response(response=404, description="Organization not found"),
     *     @OA\Response(response=500, description="Server error")
     * )
     */

    /**
     * Update organization profile.
     *
     * @OA\Put(
     *     path="/api/v1/organization",
     *     summary="Update organization profile",
     *     description="Updates organization profile information. Automatically marks profile as complete if all required fields are filled.",
     *     tags={"Organizations", "Enterprise Admin - Organizations"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="name", type="string", maxLength=255, example="ABC Manufacturing Pvt Ltd"),
     *             @OA\Property(property="email", type="string", format="email", example="contact@abc.com"),
     *             @OA\Property(property="alternate_email", type="string", format="email", example="alternate@abc.com"),
     *             @OA\Property(property="mobile_number", type="string", example="9876543210"),
     *             @OA\Property(property="landline_number", type="string", example="02212345678"),
     *             @OA\Property(property="pan", type="string", example="ABCDE1234F"),
     *             @OA\Property(property="registered_address", type="string", example="123 Business Park"),
     *             @OA\Property(property="registered_state", type="string", example="Maharashtra"),
     *             @OA\Property(property="registered_district", type="string", example="Mumbai Suburban"),
     *             @OA\Property(property="registered_pincode", type="string", example="400001"),
     *             @OA\Property(property="owner_name", type="string", example="John Doe"),
     *             @OA\Property(property="owner_designation", type="string", example="CEO"),
     *             @OA\Property(property="owner_email", type="string", format="email", example="john.doe@abc.com"),
     *             @OA\Property(property="owner_mobile_number", type="string", example="9876543212")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Organization updated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Organization profile updated successfully."),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="organization", type="object")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Validation failed"),
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Forbidden"),
     *     @OA\Response(response=404, description="Organization not found"),
     *     @OA\Response(response=500, description="Server error")
     * )
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $organization = $user->organization;

        if (! $organization) {
            return $this->errorResponse('Organization not found.', 404);
        }

        Gate::authorize('update', $organization);

        $validator = Validator::make($request->all(), [
            // Basic Information
            'name' => ['sometimes', 'string', 'max:255', new EntityName],
            'email' => 'sometimes|email',
            'alternate_email' => 'nullable|email',
            'mobile_number' => 'sometimes|string|regex:/^[0-9]{10}$/',
            'landline_number' => 'nullable|string',

            // Legal & Registration Details
            'pan' => 'nullable|string|size:10|regex:/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/|unique:organizations,pan,'.$organization->id,

            // Registered Address
            'registered_address' => 'nullable|string',
            'registered_state' => 'nullable|string|max:100',
            'registered_district' => 'nullable|string|max:100',
            'registered_pincode' => 'nullable|digits:6',

            // Owner Details
            'owner_name' => ['nullable', 'string', 'max:100', new PersonName],
            'owner_designation' => 'nullable|string|max:100',
            'owner_email' => 'nullable|email',
            'owner_mobile_number' => 'nullable|string|regex:/^[0-9]{10}$/',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            $data = $validator->validated();

            $organization->update($data);

            // Refresh the organization to get updated data
            $organization = $organization->fresh();

            // Check if profile is complete
            if ($organization->isProfileComplete()) {
                $organization->markProfileAsComplete();
                $organization = $organization->fresh();
            }

            return $this->successResponse([
                'organization' => $this->formatOrganization($organization),
            ], 'Organization profile updated successfully.');
        } catch (\Exception $e) {
            Log::error('Failed to update organization profile', [
                'error' => $e->getMessage(),
                'organization_id' => $organization->id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to update organization profile.', 500);
        }
    }

    /**
     * Get all organizations (System Admin, DRDO Admin, Operations Admin/Manager, DRDO Lab).
     *
     * @OA\Get(
     *     path="/api/v1/organizations",
     *     summary="List all organizations",
     *     description="Retrieves a paginated list of all organizations with optional filtering and sorting. Accessible by: System Admin, Operations Admin, Operations Manager, DRDO Admin, DRDO Lab.",
     *     tags={"Organizations", "System Admin - Organizations"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search by organization name, email, or PAN",
     *         required=false,
     *
     *         @OA\Schema(type="string", minLength=2, maxLength=100, example="ABC Manufacturing")
     *     ),
     *
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         description="Filter by organization status",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"active", "inactive", "pending", "suspended"}, example="active")
     *     ),
     *
     *     @OA\Parameter(
     *         name="isVerified",
     *         in="query",
     *         description="Filter by verification status",
     *         required=false,
     *
     *         @OA\Schema(type="boolean", example=true)
     *     ),
     *
     *     @OA\Parameter(
     *         name="profileCompleted",
     *         in="query",
     *         description="Filter by profile completion status",
     *         required=false,
     *
     *         @OA\Schema(type="boolean", example=true)
     *     ),
     *
     *     @OA\Parameter(
     *         name="certificationStatus",
     *         in="query",
     *         description="Filter by certification status",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"certified", "expired", "never_certified", "suspended", "revoked"}, example="certified")
     *     ),
     *
     *     @OA\Parameter(
     *         name="state",
     *         in="query",
     *         description="Filter by registered state",
     *         required=false,
     *
     *         @OA\Schema(type="string", maxLength=100, example="Maharashtra")
     *     ),
     *
     *     @OA\Parameter(
     *         name="sortBy",
     *         in="query",
     *         description="Sort by field",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"name", "created_at", "updated_at"}, default="name")
     *     ),
     *
     *     @OA\Parameter(
     *         name="sortOrder",
     *         in="query",
     *         description="Sort order",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"asc", "desc"}, default="asc")
     *     ),
     *
     *     @OA\Parameter(
     *         name="perPage",
     *         in="query",
     *         description="Number of items per page",
     *         required=false,
     *
     *         @OA\Schema(type="integer", minimum=5, maximum=100, default=15)
     *     ),
     *
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *         required=false,
     *
     *         @OA\Schema(type="integer", minimum=1, default=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Organizations retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Organizations retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="organizations",
     *                     type="array",
     *
     *                     @OA\Items(
     *
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="name", type="string", example="ABC Manufacturing Pvt Ltd"),
     *                         @OA\Property(property="email", type="string", example="contact@abc.com"),
     *                         @OA\Property(property="enterprise_admin", type="string", example="John Doe", nullable=true),
     *                         @OA\Property(property="units_count", type="integer", example=5),
     *                         @OA\Property(property="applications_count", type="integer", example=3),
     *                         @OA\Property(property="registered_state", type="string", example="Maharashtra"),
     *                         @OA\Property(property="status", type="string", example="active"),
     *                         @OA\Property(property="is_verified", type="boolean", example=true),
     *                         @OA\Property(property="is_profile_completed", type="boolean", example=true),
     *                         @OA\Property(property="certification_status", type="string", example="certified"),
     *                         @OA\Property(property="certification_date", type="string", format="date", example="2024-01-15", nullable=true),
     *                         @OA\Property(property="expiry_date", type="string", format="date", example="2027-01-15", nullable=true),
     *                         @OA\Property(property="certification_level", type="string", example="A", nullable=true)
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="pagination",
     *                     type="object",
     *                     @OA\Property(property="total", type="integer", example=100),
     *                     @OA\Property(property="per_page", type="integer", example=15),
     *                     @OA\Property(property="current_page", type="integer", example=1),
     *                     @OA\Property(property="last_page", type="integer", example=7),
     *                     @OA\Property(property="from", type="integer", example=1),
     *                     @OA\Property(property="to", type="integer", example=15)
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden - Insufficient permissions",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="This action is unauthorized.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Bad request - Validation failed",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed."),
     *             @OA\Property(
     *                 property="errors",
     *                 type="object",
     *                 @OA\Property(property="search", type="array", @OA\Items(type="string", example="Search term must be at least 2 characters."))
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=500,
     *         description="Server error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to retrieve organizations.")
     *         )
     *     )
     * )
     */
    public function index(OrganizationListRequest $request): JsonResponse
    {
        Gate::authorize('viewAny', Organization::class);

        try {
            $query = Organization::query();

            // Eager load relationships and counts to prevent N+1 queries
            $this->applyOrganizationEagerLoading($query);

            // Apply search filter
            if ($request->filled('search')) {
                $search = trim($request->input('search'));
                // Escape LIKE wildcards to prevent SQL injection
                $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                        ->orWhere('email', 'LIKE', "%{$search}%")
                        ->orWhere('pan', 'LIKE', "%{$search}%");
                });
            }

            // Apply status filter
            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            // Apply is_verified filter
            if ($request->has('is_verified')) {
                $query->where('is_verified', $request->boolean('is_verified'));
            }

            // Apply profile_completed filter
            if ($request->has('is_profile_completed')) {
                $query->where('is_profile_completed', $request->boolean('is_profile_completed'));
            }

            // Apply state filter
            if ($request->filled('state')) {
                $query->where('registered_state', $request->input('state'));
            }

            // Apply certification_status filter
            if ($request->filled('certification_status')) {
                $certificationStatus = $request->input('certification_status');

                switch ($certificationStatus) {
                    case 'certified':
                        $query->whereHas('certificates', function ($q) {
                            $q->where('status', 'active')
                                ->where('valid_until', '>=', now());
                        });
                        break;
                    case 'expired':
                        $query->whereHas('certificates', function ($q) {
                            $q->where('valid_until', '<', now());
                        })->whereDoesntHave('certificates', function ($q) {
                            $q->where('status', 'active')
                                ->where('valid_until', '>=', now());
                        });
                        break;
                    case 'never_certified':
                        $query->whereDoesntHave('certificates');
                        break;
                    case 'suspended':
                        $query->whereHas('certificates', function ($q) {
                            $q->where('status', 'suspended');
                        });
                        break;
                    case 'revoked':
                        $query->whereHas('certificates', function ($q) {
                            $q->where('status', 'revoked');
                        });
                        break;
                }
            }

            // Apply state-based filtering for Operations Manager
            $this->stateFilterService->applyToOrganizationQuery($query, $request->user());

            // Apply sorting
            $sortBy = $request->input('sort_by', 'latest_application_date');
            $sortOrder = $request->input('sort_order', 'desc');

            if ($sortBy === 'latest_application_date') {
                $query->addSelect(['latest_application_date' => Application::select('created_at')
                    ->whereColumn('organization_id', 'organizations.id')
                    ->orderByDesc('created_at')
                    ->limit(1),
                ])->orderBy('latest_application_date', $sortOrder);
            } else {
                $query->orderBy($sortBy, $sortOrder);
            }

            // Paginate results
            $perPage = $this->resolvePerPage($request, 15);
            $organizations = $query->paginate($perPage);

            // Format organizations
            $formattedOrganizations = $organizations->map(function ($organization) {
                return $this->formatOrganization($organization);
            });

            // Create custom paginated response
            return $this->successResponse([
                'organizations' => $formattedOrganizations,
                'pagination' => [
                    'total' => $organizations->total(),
                    'per_page' => $organizations->perPage(),
                    'current_page' => $organizations->currentPage(),
                    'last_page' => $organizations->lastPage(),
                    'from' => $organizations->firstItem(),
                    'to' => $organizations->lastItem(),
                ],
            ], 'Organizations retrieved successfully');
        } catch (\Exception $e) {
            Log::error('Failed to retrieve organizations', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to retrieve organizations.', 500);
        }
    }

    /**
     * Get organization by ID (System Admin, DRDO Admin, Operations Admin/Manager, DRDO Lab).
     *
     * @OA\Get(
     *     path="/api/v1/organizations/{id}",
     *     summary="Get organization by ID",
     *     description="Retrieves a single organization by its ID. Accessible by: System Admin, Operations Admin, Operations Manager, DRDO Admin, DRDO Lab.",
     *     tags={"Organizations", "System Admin - Organizations"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Organization ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Organization retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Organization retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="organization",
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="name", type="string", example="ABC Manufacturing Pvt Ltd"),
     *                     @OA\Property(property="email", type="string", example="contact@abc.com"),
     *                     @OA\Property(property="alternate_email", type="string", example="alternate@abc.com"),
     *                     @OA\Property(property="mobile_number", type="string", example="9876543210"),
     *                     @OA\Property(property="landline_number", type="string", example="02212345678"),
     *                     @OA\Property(property="pan", type="string", example="ABCDE1234F"),
     *                     @OA\Property(property="registered_address", type="string", example="123 Business Park"),
     *                     @OA\Property(property="registered_state", type="string", example="Maharashtra"),
     *                     @OA\Property(property="registered_district", type="string", example="Mumbai Suburban"),
     *                     @OA\Property(property="registered_pincode", type="string", example="400001"),
     *                     @OA\Property(property="owner_name", type="string", example="John Doe"),
     *                     @OA\Property(property="owner_designation", type="string", example="CEO"),
     *                     @OA\Property(property="owner_email", type="string", example="john@abc.com"),
     *                     @OA\Property(property="owner_mobile_number", type="string", example="9876543212"),
     *                     @OA\Property(property="enterprise_admin", type="string", example="John Doe", nullable=true),
     *                     @OA\Property(property="units_count", type="integer", example=5),
     *                     @OA\Property(property="applications_count", type="integer", example=3),
     *                     @OA\Property(property="status", type="string", example="active"),
     *                     @OA\Property(property="is_verified", type="boolean", example=true),
     *                     @OA\Property(property="is_profile_completed", type="boolean", example=true),
     *                     @OA\Property(property="certification_status", type="string", example="certified"),
     *                     @OA\Property(property="certification_date", type="string", format="date", example="2024-01-15", nullable=true),
     *                     @OA\Property(property="expiry_date", type="string", format="date", example="2027-01-15", nullable=true),
     *                     @OA\Property(property="certification_level", type="string", example="A", nullable=true)
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden - Insufficient permissions",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="This action is unauthorized.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Organization not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Organization not found.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=500,
     *         description="Server error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to retrieve organization.")
     *         )
     *     )
     * )
     */
    public function showById(int $id): JsonResponse
    {
        try {
            $organization = Organization::with([
                'users' => function ($q) {
                    $q->whereHas('roles', function ($r) {
                        $r->where('slug', 'enterprise_admin');
                    })->limit(1);
                },
                'certificates' => function ($q) {
                    $q->where('status', 'active')
                        ->where('valid_until', '>=', now())
                        ->latest('issue_date')
                        ->limit(1);
                },
            ])
                ->withCount(['units', 'applications'])
                ->findOrFail($id);

            Gate::authorize('view', $organization);

            return $this->successResponse([
                'organization' => $this->formatOrganization($organization),
            ], 'Organization retrieved successfully');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Organization not found.', 404);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve organization', [
                'error' => $e->getMessage(),
                'organization_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to retrieve organization.', 500);
        }
    }

    /**
     * Format organization data for response.
     *
     * @param  Organization  $organization
     * @return array
     */
    /**
     * Apply standard eager loading for organization queries.
     * Reusable method to avoid duplicate code across index() and export().
     *
     * @param  Builder  $query
     * @return Builder
     */
    private function applyOrganizationEagerLoading($query)
    {
        return $query->with([
            'users' => function ($q) {
                $q->whereHas('roles', function ($r) {
                    $r->where('slug', 'enterprise_admin');
                })->limit(1);
            },
            // Load all certificates for certification status calculation (avoids N+1 queries)
            'certificates' => function ($q) {
                $q->select('id', 'organization_id', 'status', 'valid_until', 'issue_date', 'grade')
                    ->latest('issue_date');
            },
        ])->withCount(['units', 'applications']);
    }

    private function formatOrganization(Organization $organization): array
    {
        // Get enterprise admin name
        $enterpriseAdmin = $organization->users->first();
        $enterpriseAdminName = $enterpriseAdmin
            ? trim($enterpriseAdmin->first_name.' '.$enterpriseAdmin->last_name)
            : null;

        // Get active certificate if exists (filter from loaded certificates)
        $activeCertificate = $organization->certificates
            ->where('status', 'active')
            ->where('valid_until', '>=', now())
            ->first();

        $data = [
            'id' => $organization->id,
            'name' => $organization->name,
            'email' => $organization->email,
            'alternate_email' => $organization->alternate_email,
            'mobile_number' => $organization->mobile_number,
            'landline_number' => $organization->landline_number,

            'pan' => $organization->pan,

            'registered_address' => $organization->registered_address,
            'registered_state' => $organization->registered_state,
            'registered_district' => $organization->registered_district,
            'registered_pincode' => $organization->registered_pincode,

            'owner_name' => $organization->owner_name,
            'owner_designation' => $organization->owner_designation,
            'owner_email' => $organization->owner_email,
            'owner_mobile_number' => $organization->owner_mobile_number,

            'samar_id' => $enterpriseAdmin?->samar_id,
            'enterprise_admin' => $enterpriseAdminName,
            'units_count' => $organization->units_count ?? 0,
            'applications_count' => $organization->applications_count ?? 0,

            'status' => $organization->status,
            'is_verified' => $organization->is_verified,
            'verified_at' => $organization->verified_at?->toIso8601String(),
            'is_profile_completed' => $organization->is_profile_completed,
            'profile_completed_at' => $organization->profile_completed_at?->toIso8601String(),
            'certification_status' => $this->getCertificationStatus($organization),
        ];

        // Add certificate details if organization is certified
        if ($activeCertificate) {
            $data['certification_date'] = $activeCertificate->issue_date?->toDateString();
            $data['expiry_date'] = $activeCertificate->valid_until?->toDateString();
            $data['certification_level'] = $activeCertificate->grade;
        }

        $data['created_at'] = $organization->created_at->toIso8601String();
        $data['updated_at'] = $organization->updated_at->toIso8601String();

        return $data;
    }

    /**
     * Get organization certification status.
     * Uses already-loaded certificates collection if available to avoid N+1 queries.
     */
    private function getCertificationStatus(Organization $organization): string
    {
        // Priority: certified > suspended > revoked > expired > never_certified

        // If certificates are already loaded, use the collection (avoids N+1 queries)
        if ($organization->relationLoaded('certificates')) {
            $certificates = $organization->certificates;

            if ($certificates->isEmpty()) {
                return 'never_certified';
            }

            // Check for active certificate
            $hasCertified = $certificates
                ->where('status', 'active')
                ->where('valid_until', '>=', now())
                ->isNotEmpty();

            if ($hasCertified) {
                return 'certified';
            }

            // Check for suspended
            if ($certificates->where('status', 'suspended')->isNotEmpty()) {
                return 'suspended';
            }

            // Check for revoked
            if ($certificates->where('status', 'revoked')->isNotEmpty()) {
                return 'revoked';
            }

            // Check for expired
            if ($certificates->where('valid_until', '<', now())->isNotEmpty()) {
                return 'expired';
            }

            return 'never_certified';
        }

        // Fallback to database queries if certificates not pre-loaded
        // Check for active certificate
        $hasCertified = $organization->certificates()
            ->where('status', 'active')
            ->where('valid_until', '>=', now())
            ->exists();

        if ($hasCertified) {
            return 'certified';
        }

        // Check for suspended
        $hasSuspended = $organization->certificates()
            ->where('status', 'suspended')
            ->exists();

        if ($hasSuspended) {
            return 'suspended';
        }

        // Check for revoked
        $hasRevoked = $organization->certificates()
            ->where('status', 'revoked')
            ->exists();

        if ($hasRevoked) {
            return 'revoked';
        }

        // Check for expired certificates
        $hasExpired = $organization->certificates()
            ->where('valid_until', '<', now())
            ->exists();

        if ($hasExpired) {
            return 'expired';
        }

        return 'never_certified';
    }

    /**
     * Export organizations data.
     *
     * @OA\Get(
     *     path="/api/v1/organizations/export",
     *     summary="Export organizations data",
     *     description="Exports organizations data as CSV. Supports the same filters as the list endpoint. Accessible by: System Admin, Operations Admin, Operations Manager, DRDO Admin, DRDO Lab.",
     *     tags={"Organizations", "System Admin - Organizations"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search by organization name, email, or PAN",
     *         required=false,
     *
     *         @OA\Schema(type="string", minLength=2, maxLength=100, example="ABC Manufacturing")
     *     ),
     *
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         description="Filter by organization status",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"active", "inactive", "pending", "suspended"}, example="active")
     *     ),
     *
     *     @OA\Parameter(
     *         name="isVerified",
     *         in="query",
     *         description="Filter by verification status",
     *         required=false,
     *
     *         @OA\Schema(type="boolean", example=true)
     *     ),
     *
     *     @OA\Parameter(
     *         name="profileCompleted",
     *         in="query",
     *         description="Filter by profile completion status",
     *         required=false,
     *
     *         @OA\Schema(type="boolean", example=true)
     *     ),
     *
     *     @OA\Parameter(
     *         name="certificationStatus",
     *         in="query",
     *         description="Filter by certification status",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"certified", "expired", "never_certified", "suspended", "revoked"}, example="certified")
     *     ),
     *
     *     @OA\Parameter(
     *         name="state",
     *         in="query",
     *         description="Filter by registered state",
     *         required=false,
     *
     *         @OA\Schema(type="string", maxLength=100, example="Maharashtra")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="CSV file download",
     *
     *         @OA\MediaType(
     *             mediaType="text/csv",
     *
     *             @OA\Schema(type="string", format="binary")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden - Insufficient permissions",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="This action is unauthorized.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=500,
     *         description="Server error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to export organizations.")
     *         )
     *     )
     * )
     */
    public function export(OrganizationExportRequest $request): StreamedResponse|JsonResponse
    {
        Gate::authorize('viewAny', Organization::class);

        try {
            $query = Organization::query();

            // Eager load relationships for export (reuse standard loading method)
            $this->applyOrganizationEagerLoading($query);

            // Apply search filter
            if ($request->filled('search')) {
                $search = trim($request->input('search'));
                $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                        ->orWhere('email', 'LIKE', "%{$search}%")
                        ->orWhere('pan', 'LIKE', "%{$search}%");
                });
            }

            // Apply status filter
            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            // Apply is_verified filter
            if ($request->has('is_verified')) {
                $query->where('is_verified', $request->boolean('is_verified'));
            }

            // Apply profile_completed filter
            if ($request->has('is_profile_completed')) {
                $query->where('is_profile_completed', $request->boolean('is_profile_completed'));
            }

            // Apply state filter
            if ($request->filled('state')) {
                $query->where('registered_state', $request->input('state'));
            }

            // Apply certification_status filter
            if ($request->filled('certification_status')) {
                $certificationStatus = $request->input('certification_status');

                switch ($certificationStatus) {
                    case 'certified':
                        $query->whereHas('certificates', function ($q) {
                            $q->where('status', 'active')
                                ->where('valid_until', '>=', now());
                        });
                        break;
                    case 'expired':
                        $query->whereHas('certificates', function ($q) {
                            $q->where('valid_until', '<', now());
                        })->whereDoesntHave('certificates', function ($q) {
                            $q->where('status', 'active')
                                ->where('valid_until', '>=', now());
                        });
                        break;
                    case 'never_certified':
                        $query->whereDoesntHave('certificates');
                        break;
                    case 'suspended':
                        $query->whereHas('certificates', function ($q) {
                            $q->where('status', 'suspended');
                        });
                        break;
                    case 'revoked':
                        $query->whereHas('certificates', function ($q) {
                            $q->where('status', 'revoked');
                        });
                        break;
                }
            }

            // Apply state-based filtering for Operations Manager
            $this->stateFilterService->applyToOrganizationQuery($query, $request->user());

            // Order by name
            $query->orderBy('name', 'asc');

            // Generate CSV using chunking for memory efficiency
            $filename = 'organizations_export_'.now()->format('Y-m-d_His').'.csv';

            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ];

            // Store query for use in callback (clone to preserve original)
            $exportQuery = clone $query;

            $callback = function () use ($exportQuery) {
                $file = fopen('php://output', 'w');

                // Add BOM for UTF-8 Excel compatibility
                fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

                // CSV Headers
                fputcsv($file, [
                    'ID',
                    'Organization Name',
                    'Email',
                    'Mobile Number',
                    'PAN',
                    'Enterprise Admin',
                    'Registered State',
                    'Registered District',
                    'Registered Pincode',
                    'Registered Address',
                    'Owner Name',
                    'Owner Designation',
                    'Owner Email',
                    'Owner Mobile',
                    'Units Count',
                    'Applications Count',
                    'Status',
                    'Is Verified',
                    'Profile Completed',
                    'Certification Status',
                    'Certification Date',
                    'Expiry Date',
                    'Certification Level',
                    'Created At',
                ]);

                // Use chunking to process large datasets efficiently (500 records at a time)
                $exportQuery->chunk(500, function ($organizations) use ($file) {
                    foreach ($organizations as $organization) {
                        // Get enterprise admin name
                        $enterpriseAdmin = $organization->users->first();
                        $enterpriseAdminName = $enterpriseAdmin
                            ? trim($enterpriseAdmin->first_name.' '.$enterpriseAdmin->last_name)
                            : '';

                        // Get active certificate from loaded certificates
                        $activeCertificate = $organization->certificates
                            ->where('status', 'active')
                            ->where('valid_until', '>=', now())
                            ->first();

                        Csv::putRow($file, [
                            $organization->id,
                            $organization->name,
                            $organization->email,
                            $organization->mobile_number,
                            $organization->pan,
                            $enterpriseAdminName,
                            $organization->registered_state,
                            $organization->registered_district,
                            $organization->registered_pincode,
                            $organization->registered_address,
                            $organization->owner_name,
                            $organization->owner_designation,
                            $organization->owner_email,
                            $organization->owner_mobile_number,
                            $organization->units_count ?? 0,
                            $organization->applications_count ?? 0,
                            $organization->status,
                            $organization->is_verified ? 'Yes' : 'No',
                            $organization->is_profile_completed ? 'Yes' : 'No',
                            $this->getCertificationStatus($organization),
                            $activeCertificate?->issue_date?->toDateString() ?? '',
                            $activeCertificate?->valid_until?->toDateString() ?? '',
                            $activeCertificate?->grade ?? '',
                            $organization->created_at->toDateString(),
                        ]);
                    }
                });

                fclose($file);
            };

            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            Log::error('Failed to export organizations', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to export organizations.', 500);
        }
    }

    /**
     * Activate an organization.
     *
     * @OA\Post(
     *     path="/api/v1/organizations/{id}/activate",
     *     summary="Activate organization",
     *     description="Activates an organization by setting its status to 'active'. Only System Admin and Operations Admin can activate organizations.",
     *     tags={"Organizations", "System Admin - Organizations"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Organization ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Organization activated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Organization activated successfully."),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="organization",
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="name", type="string", example="ABC Manufacturing Pvt Ltd"),
     *                     @OA\Property(property="status", type="string", example="active")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden - Only System Admin and Operations Admin can activate organizations",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="This action is unauthorized.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Organization not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Organization not found.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Bad request - Organization is already active",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Organization is already active.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=500,
     *         description="Server error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to activate organization.")
     *         )
     *     )
     * )
     */
    public function activate(int $id): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($id);

            Gate::authorize('changeStatus', $organization);

            // Check if already active
            if ($organization->status === 'active') {
                return $this->errorResponse('Organization is already active.', 400);
            }

            $previousStatus = $organization->status;
            $organization->update(['status' => 'active']);

            // Load relationships for response
            $organization->load([
                'users' => function ($q) {
                    $q->whereHas('roles', function ($r) {
                        $r->where('slug', 'enterprise_admin');
                    })->limit(1);
                },
                'certificates' => function ($q) {
                    $q->where('status', 'active')
                        ->where('valid_until', '>=', now())
                        ->latest('issue_date')
                        ->limit(1);
                },
            ])->loadCount(['units', 'applications']);

            Log::info('Organization activated', [
                'organization_id' => $organization->id,
                'organization_name' => $organization->name,
                'previous_status' => $previousStatus,
                'new_status' => 'active',
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse(
                ['organization' => $this->formatOrganization($organization)],
                'Organization activated successfully.'
            );
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Organization not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to activate organization', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'organization_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate organization.', 500);
        }
    }

    /**
     * Deactivate an organization.
     *
     * @OA\Post(
     *     path="/api/v1/organizations/{id}/deactivate",
     *     summary="Deactivate organization",
     *     description="Deactivates an organization by setting its status to 'inactive'. Only System Admin and Operations Admin can deactivate organizations.",
     *     tags={"Organizations", "System Admin - Organizations"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Organization ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Organization deactivated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Organization deactivated successfully."),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="organization",
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="name", type="string", example="ABC Manufacturing Pvt Ltd"),
     *                     @OA\Property(property="status", type="string", example="inactive")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden - Only System Admin and Operations Admin can deactivate organizations",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="This action is unauthorized.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Organization not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Organization not found.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Bad request - Organization is already inactive",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Organization is already inactive.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=500,
     *         description="Server error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to deactivate organization.")
     *         )
     *     )
     * )
     */
    public function deactivate(int $id): JsonResponse
    {
        try {
            $organization = Organization::findOrFail($id);

            Gate::authorize('changeStatus', $organization);

            // Check if already inactive
            if ($organization->status === 'inactive') {
                return $this->errorResponse('Organization is already inactive.', 400);
            }

            $previousStatus = $organization->status;
            $organization->update(['status' => 'inactive']);

            // Load relationships for response
            $organization->load([
                'users' => function ($q) {
                    $q->whereHas('roles', function ($r) {
                        $r->where('slug', 'enterprise_admin');
                    })->limit(1);
                },
                'certificates' => function ($q) {
                    $q->where('status', 'active')
                        ->where('valid_until', '>=', now())
                        ->latest('issue_date')
                        ->limit(1);
                },
            ])->loadCount(['units', 'applications']);

            Log::info('Organization deactivated', [
                'organization_id' => $organization->id,
                'organization_name' => $organization->name,
                'previous_status' => $previousStatus,
                'new_status' => 'inactive',
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse(
                ['organization' => $this->formatOrganization($organization)],
                'Organization deactivated successfully.'
            );
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Organization not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to deactivate organization', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'organization_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate organization.', 500);
        }
    }
}
