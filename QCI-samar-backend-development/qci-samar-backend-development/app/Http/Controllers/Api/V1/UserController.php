<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\StateFilterService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Users',
    description: 'User management endpoints for creating, updating, and managing user accounts',
)]
class UserController extends Controller
{
    /**
     * UserController constructor.
     */
    public function __construct(
        protected UserService $userService,
        protected StateFilterService $stateFilterService,
    ) {}

    /**
     * Display a listing of users.
     */
    #[OA\Get(
        path: '/api/v1/users',
        summary: 'Get list of users',
        description: 'Retrieves a paginated list of users. Enterprise Admins see users in their organization only. System Admins can filter by organization.',
        tags: [
            'User Management',
            'System Admin - User Management',
            'Operations Manager - User Management',
            'Operations Admin - User Management',
            'Unit Admin - User Management',
            'Enterprise Admin - User Management',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by name, email, or mobile_number',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'John'),
            ),
            new OA\Parameter(
                name: 'role',
                in: 'query',
                description: 'Filter by role slug',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'unit-admin'),
            ),
            new OA\Parameter(
                name: 'status',
                in: 'query',
                description: 'Filter by user status',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['active', 'inactive', 'suspended'], example: 'active'),
            ),
            new OA\Parameter(
                name: 'samarId',
                in: 'query',
                description: 'Filter assessors by SAMAR ID (partial match)',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'SAMAR-010226-1'),
            ),
            new OA\Parameter(
                name: 'domainId',
                in: 'query',
                description: 'Filter assessors by assigned assessor-domain id',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'organizationId',
                in: 'query',
                description: 'Filter by organization (System Admin only)',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Number of items per page',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 15),
            ),
            new OA\Parameter(
                name: 'page',
                in: 'query',
                description: 'Page number',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Users retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Users retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'id', type: 'integer', example: 1),
                                    new OA\Property(property: 'first_name', type: 'string', example: 'John'),
                                    new OA\Property(property: 'last_name', type: 'string', example: 'Doe'),
                                    new OA\Property(
                                        property: 'email',
                                        type: 'string',
                                        example: 'john.doe@example.com',
                                    ),
                                    new OA\Property(
                                        property: 'mobile_number',
                                        type: 'string',
                                        example: '9876543210',
                                    ),
                                    new OA\Property(
                                        property: 'address',
                                        type: 'string',
                                        nullable: true,
                                        example: '123 Main Street, Building A',
                                    ),
                                    new OA\Property(
                                        property: 'city',
                                        type: 'string',
                                        nullable: true,
                                        example: 'Mumbai',
                                    ),
                                    new OA\Property(
                                        property: 'pincode',
                                        type: 'string',
                                        nullable: true,
                                        example: '400001',
                                    ),
                                    new OA\Property(property: 'status', type: 'string', example: 'active'),
                                    new OA\Property(
                                        property: 'assessor_domains',
                                        type: 'array',
                                        description: 'Assessor domains (only for users with assessor role)',
                                        items: new OA\Items(
                                            properties: [
                                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                                new OA\Property(
                                                    property: 'domain_name',
                                                    type: 'string',
                                                    example: 'Aerodynamics',
                                                ),
                                                new OA\Property(
                                                    property: 'is_active',
                                                    type: 'boolean',
                                                    example: true,
                                                ),
                                            ],
                                        ),
                                    ),
                                    new OA\Property(
                                        property: 'assessor_districts',
                                        type: 'array',
                                        description: 'Assessor districts (only for users with assessor role)',
                                        items: new OA\Items(
                                            properties: [
                                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                                new OA\Property(
                                                    property: 'name',
                                                    type: 'string',
                                                    example: 'Mumbai',
                                                ),
                                                new OA\Property(
                                                    property: 'state',
                                                    type: 'string',
                                                    example: 'Maharashtra',
                                                ),
                                            ],
                                        ),
                                    ),
                                ],
                            ),
                        ),
                        new OA\Property(
                            property: 'meta',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'total', type: 'integer', example: 100),
                                new OA\Property(property: 'per_page', type: 'integer', example: 15),
                                new OA\Property(property: 'current_page', type: 'integer', example: 1),
                                new OA\Property(property: 'last_page', type: 'integer', example: 7),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Forbidden',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'This action is unauthorized.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Server error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Server error occurred.'),
                    ],
                ),
            ),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', User::class);

        $currentUser = $request->user();

        // Build filters
        $filters = [
            'search' => $request->input('search'),
            'role' => $request->input('role'),
            'status' => $request->input('status'),
            'samar_id' => $request->input('samar_id'),
            'domain_id' => $request->input('domain_id'),
        ];

        // Apply assigned_state filter (for fetching assessors by state)
        if ($request->has('assigned_state')) {
            $filters['assigned_state'] = $request->input('assigned_state');
        }

        // Apply organization scoping for Enterprise Admin
        if ($currentUser->hasRole(Role::ENTERPRISE_ADMIN)) {
            $filters['organization_id'] = $currentUser->organization_id;
        } elseif ($request->has('organization_id') && $currentUser->hasRole(Role::SYSTEM_ADMIN)) {
            // System Admin can filter by organization
            $filters['organization_id'] = $request->input('organization_id');
        }

        // State scoping for Operations Manager.
        // When the caller requests assessors for a specific unit (assigned_state present,
        // e.g. scheduling), eligibility is gated solely by that unit's state — see
        // AssessmentController::allocate(). The OM-overlap scope applies only to general
        // assessor listings, where there is no unit context to gate on.
        if ($this->stateFilterService->shouldFilter($currentUser) && ! $request->filled('assigned_state')) {
            $filters['om_assigned_states'] = $currentUser->getAssignedStatesArray();
        }

        // Get paginated users
        $perPage = $this->resolvePerPage($request, 15);
        $users = $this->userService->getPaginatedUsers($filters, $perPage);

        return $this->paginatedResponse(
            $users->setCollection(
                $users->getCollection()->map(fn ($user) => new UserResource($user))
            ),
            'Users retrieved successfully'
        );
    }

    /**
     * Store a newly created user.
     */
    #[OA\Post(
        path: '/api/v1/users',
        summary: 'Create a new user',
        description: 'Creates a new user account. Generates temporary password if not provided. Enterprise Admins can only create users in their organization.',
        tags: [
            'User Management',
            'System Admin - User Management',
            'Operations Manager - User Management',
            'Operations Admin - User Management',
            'Unit Admin - User Management',
            'Enterprise Admin - User Management',
        ],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['first_name', 'last_name', 'email', 'mobile_number', 'organization_id'],
                properties: [
                    new OA\Property(property: 'first_name', type: 'string', maxLength: 100, example: 'John'),
                    new OA\Property(property: 'last_name', type: 'string', maxLength: 100, example: 'Doe'),
                    new OA\Property(
                        property: 'email',
                        type: 'string',
                        format: 'email',
                        maxLength: 255,
                        example: 'john.doe@example.com',
                    ),
                    new OA\Property(
                        property: 'mobile_number',
                        type: 'string',
                        pattern: '^[0-9]{10}$',
                        example: '9876543210',
                    ),
                    new OA\Property(property: 'organization_id', type: 'integer', example: 1),
                    new OA\Property(property: 'designation', type: 'string', maxLength: 100, example: 'Manager'),
                    new OA\Property(property: 'district', type: 'string', maxLength: 100, example: 'Mumbai'),
                    new OA\Property(property: 'state', type: 'string', maxLength: 100, example: 'Maharashtra'),
                    new OA\Property(
                        property: 'address',
                        type: 'string',
                        maxLength: 500,
                        nullable: true,
                        example: '123 Main Street, Building A',
                        description: 'Full street address',
                    ),
                    new OA\Property(
                        property: 'city',
                        type: 'string',
                        maxLength: 100,
                        nullable: true,
                        example: 'Mumbai',
                        description: 'City name',
                    ),
                    new OA\Property(
                        property: 'pincode',
                        type: 'string',
                        pattern: '^[0-9]{6}$',
                        nullable: true,
                        example: '400001',
                        description: '6-digit Indian PIN code',
                    ),
                    new OA\Property(property: 'password', type: 'string', minLength: 7, example: 'password123'),
                    new OA\Property(property: 'password_confirmation', type: 'string', example: 'password123'),
                    new OA\Property(
                        property: 'status',
                        type: 'string',
                        enum: ['invited', 'pending_verification', 'active', 'inactive', 'suspended'],
                        example: 'invited',
                    ),
                    new OA\Property(
                        property: 'roles',
                        type: 'array',
                        description: 'Array of role assignments. A single user can be assigned to multiple units by providing multiple role objects.',
                        example: [
                            ['slug' => 'unit-admin', 'organization_id' => 1, 'unit_id' => 1],
                            ['slug' => 'unit-admin', 'organization_id' => 1, 'unit_id' => 2],
                        ],
                        items: new OA\Items(
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'slug', type: 'string', example: 'unit-admin'),
                                new OA\Property(property: 'organization_id', type: 'integer', example: 1),
                                new OA\Property(property: 'unit_id', type: 'integer', example: 1),
                            ],
                        ),
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'User created successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'User created successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(property: 'first_name', type: 'string', example: 'John'),
                                new OA\Property(property: 'last_name', type: 'string', example: 'Doe'),
                                new OA\Property(
                                    property: 'email',
                                    type: 'string',
                                    example: 'john.doe@example.com',
                                ),
                                new OA\Property(property: 'mobile_number', type: 'string', example: '9876543210'),
                                new OA\Property(
                                    property: 'address',
                                    type: 'string',
                                    nullable: true,
                                    example: '123 Main Street, Building A',
                                ),
                                new OA\Property(
                                    property: 'city',
                                    type: 'string',
                                    nullable: true,
                                    example: 'Mumbai',
                                ),
                                new OA\Property(
                                    property: 'pincode',
                                    type: 'string',
                                    nullable: true,
                                    example: '400001',
                                ),
                                new OA\Property(property: 'status', type: 'string', example: 'active'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Forbidden',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'You can only create users in your organization.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to create user: Validation error',
                        ),
                        new OA\Property(
                            property: 'errors',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'email',
                                    type: 'array',
                                    items: new OA\Items(type: 'string', example: 'The email has already been taken.'),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Server error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Server error occurred.'),
                    ],
                ),
            ),
        ],
    )]
    public function store(StoreUserRequest $request): JsonResponse
    {
        Gate::authorize('create', User::class);

        $currentUser = $request->user();

        // Validate organization scoping for Enterprise Admin
        if ($currentUser->hasRole(Role::ENTERPRISE_ADMIN)) {
            if ((int) $request->input('organization_id') !== (int) $currentUser->organization_id) {
                return $this->errorResponse(
                    'You can only create users in your organization.',
                    403
                );
            }
        }

        try {
            $user = $this->userService->createUser(
                $request->validated(),
                $currentUser
            );

            return $this->successResponse(
                new UserResource($user),
                'User created successfully.',
                201
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to create user.', 400);
        }
    }

    /**
     * Display the specified user.
     */
    #[OA\Get(
        path: '/api/v1/users/{id}',
        summary: 'Get user details',
        description: 'Retrieves detailed information about a specific user including roles and permissions.',
        tags: [
            'User Management',
            'System Admin - User Management',
            'Operations Manager - User Management',
            'Operations Admin - User Management',
            'Unit Admin - User Management',
            'Enterprise Admin - User Management',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'User ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'User retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'User retrieved successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(property: 'first_name', type: 'string', example: 'John'),
                                new OA\Property(property: 'last_name', type: 'string', example: 'Doe'),
                                new OA\Property(property: 'full_name', type: 'string', example: 'John Doe'),
                                new OA\Property(
                                    property: 'email',
                                    type: 'string',
                                    example: 'john.doe@example.com',
                                ),
                                new OA\Property(property: 'mobile_number', type: 'string', example: '9876543210'),
                                new OA\Property(property: 'designation', type: 'string', example: 'Manager'),
                                new OA\Property(property: 'district', type: 'string', example: 'Mumbai'),
                                new OA\Property(property: 'state', type: 'string', example: 'Maharashtra'),
                                new OA\Property(
                                    property: 'address',
                                    type: 'string',
                                    nullable: true,
                                    example: '123 Main Street, Building A',
                                ),
                                new OA\Property(
                                    property: 'city',
                                    type: 'string',
                                    nullable: true,
                                    example: 'Mumbai',
                                ),
                                new OA\Property(
                                    property: 'pincode',
                                    type: 'string',
                                    nullable: true,
                                    example: '400001',
                                ),
                                new OA\Property(property: 'status', type: 'string', example: 'active'),
                                new OA\Property(
                                    property: 'roles',
                                    type: 'array',
                                    items: new OA\Items(type: 'object'),
                                ),
                                new OA\Property(
                                    property: 'permissions',
                                    type: 'array',
                                    items: new OA\Items(type: 'string'),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Forbidden',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'This action is unauthorized.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'User not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'User not found.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Server error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Server error occurred.'),
                    ],
                ),
            ),
        ],
    )]
    public function show(int $id, Request $request): JsonResponse
    {
        try {
            $user = $this->userService->getUserById($id);

            Gate::authorize('view', $user);

            return $this->successResponse(
                new UserResource($user),
                'User retrieved successfully.'
            );
        } catch (\Exception $e) {
            return $this->errorResponse(
                'User not found.',
                404
            );
        }
    }

    /**
     * Update the specified user.
     */
    #[OA\Put(
        path: '/api/v1/users/{id}',
        summary: 'Update user',
        description: 'Updates user information. Users can update their own profile with limited fields. Admins can update more fields including status.',
        tags: [
            'User Management',
            'System Admin - User Management',
            'Operations Manager - User Management',
            'Operations Admin - User Management',
            'Unit Admin - User Management',
            'Enterprise Admin - User Management',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'User ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'first_name', type: 'string', maxLength: 100, example: 'John'),
                    new OA\Property(property: 'last_name', type: 'string', maxLength: 100, example: 'Doe'),
                    new OA\Property(
                        property: 'email',
                        type: 'string',
                        format: 'email',
                        maxLength: 255,
                        example: 'john.doe@example.com',
                    ),
                    new OA\Property(
                        property: 'mobile_number',
                        type: 'string',
                        pattern: '^[0-9]{10}$',
                        example: '9876543210',
                    ),
                    new OA\Property(
                        property: 'designation',
                        type: 'string',
                        maxLength: 100,
                        example: 'Senior Manager',
                    ),
                    new OA\Property(property: 'district', type: 'string', maxLength: 100, example: 'Mumbai'),
                    new OA\Property(property: 'state', type: 'string', maxLength: 100, example: 'Maharashtra'),
                    new OA\Property(
                        property: 'address',
                        type: 'string',
                        maxLength: 500,
                        nullable: true,
                        example: '123 Main Street, Building A',
                        description: 'Full street address',
                    ),
                    new OA\Property(
                        property: 'city',
                        type: 'string',
                        maxLength: 100,
                        nullable: true,
                        example: 'Mumbai',
                        description: 'City name',
                    ),
                    new OA\Property(
                        property: 'pincode',
                        type: 'string',
                        pattern: '^[0-9]{6}$',
                        nullable: true,
                        example: '400001',
                        description: '6-digit Indian PIN code',
                    ),
                    new OA\Property(
                        property: 'password',
                        type: 'string',
                        minLength: 7,
                        example: 'newPassword123',
                        description: 'Only for self-update or admin',
                    ),
                    new OA\Property(property: 'password_confirmation', type: 'string', example: 'newPassword123'),
                    new OA\Property(
                        property: 'current_password',
                        type: 'string',
                        example: 'oldPassword123',
                        description: 'Required when changing own password',
                    ),
                    new OA\Property(
                        property: 'status',
                        type: 'string',
                        enum: ['active', 'inactive', 'suspended'],
                        example: 'active',
                        description: 'Admin only',
                    ),
                    new OA\Property(
                        property: 'organization_id',
                        type: 'integer',
                        example: 1,
                        description: 'Admin only',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'User updated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'User updated successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(property: 'first_name', type: 'string', example: 'John'),
                                new OA\Property(property: 'last_name', type: 'string', example: 'Doe'),
                                new OA\Property(
                                    property: 'email',
                                    type: 'string',
                                    example: 'john.doe@example.com',
                                ),
                                new OA\Property(
                                    property: 'address',
                                    type: 'string',
                                    nullable: true,
                                    example: '123 Main Street, Building A',
                                ),
                                new OA\Property(
                                    property: 'city',
                                    type: 'string',
                                    nullable: true,
                                    example: 'Mumbai',
                                ),
                                new OA\Property(
                                    property: 'pincode',
                                    type: 'string',
                                    nullable: true,
                                    example: '400001',
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Forbidden',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'This action is unauthorized.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'User not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'User not found.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to update user: Validation error',
                        ),
                        new OA\Property(
                            property: 'errors',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'current_password',
                                    type: 'array',
                                    items: new OA\Items(type: 'string', example: 'The provided password is incorrect.'),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Server error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Server error occurred.'),
                    ],
                ),
            ),
        ],
    )]
    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        try {
            $targetUser = $this->userService->getUserById($id);

            Gate::authorize('update', $targetUser);

            $currentUser = $request->user();
            $validated = $request->validated();

            // If updating self, only allow certain fields
            if ($currentUser->id === $targetUser->id) {
                $allowedFields = [
                    'first_name', 'last_name', 'mobile_number',
                    'designation', 'district', 'state',
                    'address', 'city', 'pincode',
                ];

                $validated = array_intersect_key($validated, array_flip($allowedFields));

                // Handle password change for self
                if ($request->has('password')) {
                    // Verify current password
                    if (! Hash::check($request->input('current_password'), $currentUser->password)) {
                        return $this->errorResponse(
                            'Current password is incorrect.',
                            400,
                            ['current_password' => ['The provided password is incorrect.']]
                        );
                    }
                    $validated['password'] = $request->input('password');
                }
            } else {
                // Admin updating another user
                // Check if admin can update restricted fields
                if (! Gate::allows('updateRestricted', [User::class, $targetUser])) {
                    // Remove restricted fields
                    $restrictedFields = ['status', 'organization_id'];
                    $validated = array_diff_key($validated, array_flip($restrictedFields));
                }

                // Allow system admin to update password for other users
                if ($request->has('password') && $currentUser->hasRole('system_admin')) {
                    $validated['password'] = $request->input('password');
                }
            }

            $user = $this->userService->updateUser(
                $targetUser,
                $validated,
                $currentUser
            );

            return $this->successResponse(
                new UserResource($user),
                'User updated successfully.'
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to update user.', 400);
        }
    }

    /**
     * Activate a user account.
     */
    #[OA\Post(
        path: '/api/v1/users/{id}/activate',
        summary: 'Activate user account',
        description: 'Activates a user account. Sets status to active.',
        tags: [
            'User Management',
            'System Admin - User Management',
            'Operations Manager - User Management',
            'Operations Admin - User Management',
            'Unit Admin - User Management',
            'Enterprise Admin - User Management',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'User ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'User activated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'User activated successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(property: 'first_name', type: 'string', example: 'John'),
                                new OA\Property(property: 'last_name', type: 'string', example: 'Doe'),
                                new OA\Property(property: 'status', type: 'string', example: 'active'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Forbidden',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'This action is unauthorized.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'User not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'User not found.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Failed to activate user',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to activate user: Error message',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Server error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Server error occurred.'),
                    ],
                ),
            ),
        ],
    )]
    public function activate(int $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:1000',
        ]);

        try {
            $user = $this->userService->getUserById($id);

            Gate::authorize('changeStatus', $user);

            $user = $this->userService->activateUser($user, null, $validated['reason'] ?? null);

            return $this->successResponse(
                new UserResource($user),
                'User activated successfully.'
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to activate user.', 400);
        }
    }

    /**
     * Deactivate a user account.
     */
    #[OA\Post(
        path: '/api/v1/users/{id}/deactivate',
        summary: 'Deactivate user account',
        description: 'Deactivates a user account. Sets status to inactive.',
        tags: [
            'User Management',
            'System Admin - User Management',
            'Operations Manager - User Management',
            'Operations Admin - User Management',
            'Unit Admin - User Management',
            'Enterprise Admin - User Management',
        ],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['reason'],
                properties: [
                    new OA\Property(property: 'reason', type: 'string', minLength: 5, maxLength: 1000, example: 'Duplicate registration'),
                ],
            ),
        ),
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'User ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'User deactivated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'User deactivated successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(property: 'first_name', type: 'string', example: 'John'),
                                new OA\Property(property: 'last_name', type: 'string', example: 'Doe'),
                                new OA\Property(property: 'status', type: 'string', example: 'inactive'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Forbidden',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'This action is unauthorized.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'User not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'User not found.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Failed to deactivate user',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to deactivate user: Error message',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Server error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Server error occurred.'),
                    ],
                ),
            ),
        ],
    )]
    public function deactivate(int $id, Request $request): JsonResponse
    {
        // The reason is kept in the account's status history.
        $validated = $request->validate([
            'reason' => 'required|string|min:5|max:1000',
        ], [
            'reason.required' => 'Please give the reason for deactivating this user.',
            'reason.min' => 'The reason must be at least 5 characters.',
        ]);

        try {
            $user = $this->userService->getUserById($id);

            Gate::authorize('changeStatus', $user);

            $user = $this->userService->deactivateUser($user, null, $validated['reason']);

            return $this->successResponse(
                new UserResource($user),
                'User deactivated successfully.'
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to deactivate user.', 400);
        }
    }

    #[OA\Post(
        path: '/api/v1/users/{id}/resend-credentials',
        summary: 'Email the user a new temporary password',
        description: 'Generates a new temporary password, signs the user out of every session and emails it with the role invitation. Allowed for active or invited accounts, by anyone allowed to change the user status.',
        tags: ['Users', 'System Admin - User Management'],
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'A new password has been emailed'),
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 422, description: 'Account is not active or invited'),
        ],
    )]
    public function resendCredentials(int $id, Request $request): JsonResponse
    {
        $user = User::find($id);
        if (! $user) {
            return $this->errorResponse('User not found.', 404);
        }
        if (Gate::denies('changeStatus', $user)) {
            return $this->errorResponse('This action is unauthorized.', 403);
        }

        // A BusinessException (account not active or invited) becomes a 422 with its message.
        $this->userService->resendCredentials($user, $request->user());

        return $this->successResponse(
            ['email' => $user->email],
            'A new password has been emailed to '.$user->email.'.'
        );
    }

    /**
     * Get assessor's assigned districts.
     */
    #[OA\Get(
        path: '/api/v1/users/{user}/assessor-districts',
        summary: 'Get assessor\'s assigned districts',
        description: 'Retrieves all districts assigned to an assessor user',
        tags: ['Users', 'System Admin - User Management'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'user',
                in: 'path',
                description: 'User ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Districts retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Assessor districts retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'id', type: 'integer', example: 1),
                                    new OA\Property(property: 'name', type: 'string', example: 'Mumbai'),
                                    new OA\Property(property: 'code', type: 'string', example: 'MH-MUM'),
                                    new OA\Property(property: 'state_id', type: 'integer', example: 1),
                                    new OA\Property(
                                        property: 'state',
                                        type: 'object',
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer', example: 1),
                                            new OA\Property(
                                                property: 'name',
                                                type: 'string',
                                                example: 'Maharashtra',
                                            ),
                                            new OA\Property(property: 'code', type: 'string', example: 'MH'),
                                        ],
                                    ),
                                    new OA\Property(
                                        property: 'assigned_by',
                                        type: 'integer',
                                        nullable: true,
                                        example: 1,
                                    ),
                                    new OA\Property(
                                        property: 'assigned_at',
                                        type: 'string',
                                        format: 'date-time',
                                        example: '2025-12-10T12:00:00Z',
                                    ),
                                ],
                            ),
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 404, description: 'User not found'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function getAssessorDistricts(string $userId): JsonResponse
    {
        $user = User::find($userId);

        if (! $user) {
            return $this->errorResponse('User not found', 404);
        }

        // Use select() to only load needed columns (optimization)
        $districts = $user->assessorDistricts()
            ->select('districts.id', 'districts.name', 'districts.code', 'districts.state_id')
            ->with('state:id,name,code')
            ->get()
            ->map(function ($district) {
                return [
                    'id' => $district->id,
                    'name' => $district->name,
                    'code' => $district->code,
                    'state_id' => $district->state_id,
                    'state' => $district->state ? [
                        'id' => $district->state->id,
                        'name' => $district->state->name,
                        'code' => $district->state->code,
                    ] : null,
                    'assigned_by' => $district->pivot->assigned_by,
                    'assigned_at' => $district->pivot->created_at,
                ];
            });

        return $this->successResponse(
            $districts,
            'Assessor districts retrieved successfully'
        );
    }
}
