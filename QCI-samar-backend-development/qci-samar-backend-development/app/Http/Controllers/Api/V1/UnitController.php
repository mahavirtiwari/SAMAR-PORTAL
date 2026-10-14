<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Unit\ChangeSpokeRequest;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Units', description: 'Unit management endpoints for creating and managing organizational units')]
class UnitController extends Controller
{
    /**
     * Get all units for the organization.
     */
    #[OA\Get(
        path: '/api/v1/units',
        summary: 'Get list of units',
        description: 'Retrieves all units. Enterprise Admins see their organization\'s units. Unit Admins see only assigned units. System Admins must specify organization_id.',
        tags: [
            'Unit Management',
            'System Admin - Unit Management',
            'Unit Admin - Unit Management',
            'Enterprise Admin - Unit Management',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'organizationId',
                in: 'query',
                description: 'Filter by organization (required for System Admin)',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'status',
                in: 'query',
                description: 'Filter by unit status',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'active'),
            ),
            new OA\Parameter(
                name: 'unitAdmin',
                in: 'query',
                description: 'Filter by unit admin user ID',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 2),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Items per page',
                required: false,
                schema: new OA\Schema(type: 'integer', default: 15),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Units retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Units retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'id', type: 'integer', example: 1),
                                    new OA\Property(property: 'organizationId', type: 'integer', example: 1),
                                    new OA\Property(
                                        property: 'unitType',
                                        type: 'string',
                                        example: 'manufacturing',
                                    ),
                                    new OA\Property(property: 'state', type: 'string', example: 'Maharashtra'),
                                    new OA\Property(property: 'status', type: 'string', example: 'active'),
                                    new OA\Property(
                                        property: 'unitAdmins',
                                        type: 'array',
                                        items: new OA\Items(
                                            properties: [
                                                new OA\Property(property: 'id', type: 'integer', example: 2),
                                                new OA\Property(
                                                    property: 'name',
                                                    type: 'string',
                                                    example: 'John Doe',
                                                ),
                                                new OA\Property(
                                                    property: 'email',
                                                    type: 'string',
                                                    example: 'john.doe@example.com',
                                                ),
                                                new OA\Property(
                                                    property: 'lastLoginAt',
                                                    type: 'string',
                                                    format: 'date-time',
                                                    nullable: true,
                                                    example: '2025-01-15T10:30:00+00:00',
                                                ),
                                                new OA\Property(
                                                    property: 'unitAddress',
                                                    type: 'string',
                                                    nullable: true,
                                                    example: '123 Industrial Area, Mumbai, Maharashtra, 400001',
                                                ),
                                                new OA\Property(
                                                    property: 'latestApplicationNumber',
                                                    type: 'string',
                                                    nullable: true,
                                                    example: 'APP-2025-0001-0001',
                                                ),
                                            ],
                                        ),
                                    ),
                                ],
                            ),
                        ),
                        new OA\Property(
                            property: 'pagination',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'currentPage', type: 'integer', example: 1),
                                new OA\Property(property: 'perPage', type: 'integer', example: 15),
                                new OA\Property(property: 'total', type: 'integer', example: 10),
                                new OA\Property(property: 'lastPage', type: 'integer', example: 1),
                                new OA\Property(property: 'from', type: 'integer', example: 1),
                                new OA\Property(property: 'to', type: 'integer', example: 10),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - organization_id is required for system admins',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'organization_id is required for system admins.',
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
        $user = $request->user();

        // Start query builder
        $query = Unit::query();

        // Apply role-based access control
        if ($user->hasRole(Role::ENTERPRISE_ADMIN)) {
            // EnterpriseAdmin can see all units of their organization
            $query->where('organization_id', $user->organization_id);
        } elseif ($user->hasRole(Role::UNIT_ADMIN)) {
            // UnitAdmin can only see their assigned units
            $userUnitIds = $user->roles()
                ->where('slug', Role::UNIT_ADMIN)
                ->wherePivot('is_active', true)
                ->get()
                ->pluck('pivot.unit_id')
                ->filter()
                ->toArray();

            // SECURITY: Always filter by organization_id AND unit_id to prevent cross-org access
            $query->where('organization_id', $user->organization_id)
                ->whereIn('id', $userUnitIds);
        } else {
            // System admins must specify organization_id
            $organizationId = $request->input('organization_id');
            if (! $organizationId) {
                return $this->errorResponse('organization_id is required for system admins.', 400);
            }

            $query->where('organization_id', $organizationId);
        }

        // Apply filters
        if ($request->filled('status')) {
            $query->byStatus($request->status);
        }

        if ($request->filled('unit_admin')) {
            $query->byUnitAdmin($request->unit_admin);
        }

        // Matches the columns the units list actually shows, so the search box on that screen
        // filters what the user can see rather than hidden fields.
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%")
                    ->orWhere('district', 'like', "%{$search}%")
                    ->orWhere('state', 'like', "%{$search}%");
            });
        }

        // Execute query - order by contact_person_name since name field was removed
        $perPage = $this->resolvePerPage($request, 15);
        $units = $query->orderBy('contact_person_name')->paginate($perPage);

        // Transform the paginated data
        $units->getCollection()->transform(fn ($unit) => $this->formatUnit($unit));

        return $this->paginatedResponse($units, 'Units retrieved successfully');
    }

    /**
     * Get a single unit.
     */
    #[OA\Get(
        path: '/api/v1/units/{id}',
        summary: 'Get unit details',
        description: 'Retrieves detailed information about a specific unit including organization and document counts.',
        tags: [
            'Unit Management',
            'System Admin - Unit Management',
            'Unit Admin - Unit Management',
            'Enterprise Admin - Unit Management',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Unit ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Unit retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'unit',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(
                                            property: 'name',
                                            type: 'string',
                                            example: 'Manufacturing Unit A',
                                        ),
                                        new OA\Property(
                                            property: 'email',
                                            type: 'string',
                                            example: 'unit-a@example.com',
                                        ),
                                        new OA\Property(
                                            property: 'alternate_email',
                                            type: 'string',
                                            example: 'unit-a-alt@example.com',
                                        ),
                                        new OA\Property(
                                            property: 'mobile_number',
                                            type: 'string',
                                            example: '9876543210',
                                        ),
                                        new OA\Property(
                                            property: 'landline_number',
                                            type: 'string',
                                            example: '02212345678',
                                        ),
                                        new OA\Property(
                                            property: 'address',
                                            type: 'string',
                                            example: '123 Industrial Area',
                                        ),
                                        new OA\Property(property: 'state', type: 'string', example: 'Maharashtra'),
                                        new OA\Property(
                                            property: 'unit_type',
                                            type: 'string',
                                            example: 'manufacturing',
                                        ),
                                        new OA\Property(
                                            property: 'commencement_date',
                                            type: 'string',
                                            format: 'date',
                                            example: '2020-01-15',
                                        ),
                                        new OA\Property(property: 'organization', type: 'object'),
                                        new OA\Property(
                                            property: 'applications_count',
                                            type: 'integer',
                                            example: 2,
                                        ),
                                        new OA\Property(
                                            property: 'unit_admins',
                                            type: 'array',
                                            items: new OA\Items(
                                                properties: [
                                                    new OA\Property(property: 'id', type: 'integer', example: 2),
                                                    new OA\Property(
                                                        property: 'name',
                                                        type: 'string',
                                                        example: 'John Doe',
                                                    ),
                                                    new OA\Property(
                                                        property: 'email',
                                                        type: 'string',
                                                        example: 'john.doe@example.com',
                                                    ),
                                                    new OA\Property(
                                                        property: 'last_login_at',
                                                        type: 'string',
                                                        format: 'date-time',
                                                        nullable: true,
                                                        example: '2025-01-15T10:30:00+00:00',
                                                    ),
                                                    new OA\Property(
                                                        property: 'unit_address',
                                                        type: 'string',
                                                        nullable: true,
                                                        example: '123 Industrial Area, Mumbai, Maharashtra, 400001',
                                                    ),
                                                    new OA\Property(
                                                        property: 'latest_application_number',
                                                        type: 'string',
                                                        nullable: true,
                                                        example: 'APP-2025-0001-0001',
                                                    ),
                                                ],
                                            ),
                                        ),
                                    ],
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
                            example: 'Unauthorized to view this unit.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'Unit not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Unit not found.'),
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
    public function show(Request $request, int $id): JsonResponse
    {
        $unit = Unit::with('organization')->find($id);

        if (! $unit) {
            return $this->errorResponse('Unit not found.', 404);
        }

        $user = $request->user();

        // Check access
        if ($user->hasRole(Role::UNIT_ADMIN)) {
            // SECURITY: Check both organization_id AND unit assignment
            if ($unit->organization_id !== $user->organization_id) {
                return $this->errorResponse('Unauthorized to view this unit.', 403);
            }

            $userUnitIds = $user->roles()
                ->where('slug', Role::UNIT_ADMIN)
                ->wherePivot('is_active', true)
                ->get()
                ->pluck('pivot.unit_id')
                ->filter()
                ->toArray();

            if (! in_array($unit->id, $userUnitIds)) {
                return $this->errorResponse('Unauthorized to view this unit.', 403);
            }
        } elseif ($user->hasRole(Role::ENTERPRISE_ADMIN)) {
            if ($unit->organization_id !== $user->organization_id) {
                return $this->errorResponse('Unauthorized to view this unit.', 403);
            }
        }

        return $this->successResponse([
            'unit' => $this->formatUnit($unit, true),
        ], 'Unit retrieved successfully');
    }

    /**
     * Format unit data for response.
     */
    private function formatUnit(Unit $unit, bool $detailed = false): array
    {
        $data = [
            'id' => $unit->id,
            'organization_id' => $unit->organization_id,
            'email' => $unit->email,
            'alternate_email' => $unit->alternate_email,
            'mobile_number' => $unit->mobile_number,
            'landline_number' => $unit->landline_number,

            'contact_person_name' => $unit->contact_person_name,
            'contact_person_designation' => $unit->contact_person_designation,
            'contact_person_email' => $unit->contact_person_email,
            'contact_person_mobile_number' => $unit->contact_person_mobile_number,

            'address' => $unit->address,
            'state' => $unit->state,
            'district' => $unit->district,
            'pincode' => $unit->pincode,

            'unit_type' => $unit->unit_type,
            'commencement_date' => $unit->commencement_date,

            'status' => $unit->status,
            'unit_admins' => $this->getUnitAdmins($unit),

            'created_at' => $unit->created_at->toIso8601String(),
            'updated_at' => $unit->updated_at->toIso8601String(),
        ];

        if ($detailed) {
            $data['organization'] = $unit->organization ? [
                'id' => $unit->organization->id,
                'name' => $unit->organization->name,
            ] : null;

            $data['applications_count'] = $unit->applications()->count();
        }

        return $data;
    }

    /**
     * Get assigned unit admin users for a unit.
     */
    private function getUnitAdmins(Unit $unit): array
    {
        // Get the unit admin role
        $unitAdminRole = Role::where('slug', Role::UNIT_ADMIN)->first();

        if (! $unitAdminRole) {
            return [];
        }

        // Get the latest application number for this unit
        $latestApplication = $unit->applications()
            ->orderBy('created_at', 'desc')
            ->first();
        $latestApplicationNumber = $latestApplication ? $latestApplication->application_number : null;

        // Build unit address string
        $unitAddress = collect([
            $unit->address,
            $unit->district,
            $unit->state,
            $unit->pincode,
        ])->filter()->implode(', ');

        // Get users assigned as unit admins for this unit
        $unitAdmins = User::select('users.id', 'users.first_name', 'users.last_name', 'users.email', 'users.last_login_at')
            ->join('user_role', 'users.id', '=', 'user_role.user_id')
            ->where('user_role.role_id', $unitAdminRole->id)
            ->where('user_role.unit_id', $unit->id)
            ->where('user_role.is_active', true)
            ->get()
            ->map(function ($user) use ($unitAddress, $latestApplicationNumber) {
                return [
                    'id' => $user->id,
                    'name' => $user->full_name, // This uses the getFullNameAttribute accessor
                    'email' => $user->email,
                    'last_login_at' => $user->last_login_at ? $user->last_login_at->toIso8601String() : null,
                    'unit_address' => $unitAddress ?: null,
                    'latest_application_number' => $latestApplicationNumber,
                ];
            })
            ->toArray();

        return $unitAdmins;
    }

    /**
     * Assign users as unit admins for a unit.
     *
     * @throws \Exception
     */
    private function assignUnitAdmins(Unit $unit, array $userIds): void
    {
        // Get the unit admin role
        $unitAdminRole = Role::where('slug', Role::UNIT_ADMIN)->first();

        if (! $unitAdminRole) {
            throw new \Exception('Unit admin role not found');
        }

        // Remove existing unit admin assignments for this unit
        DB::table('user_role')
            ->where('role_id', $unitAdminRole->id)
            ->where('unit_id', $unit->id)
            ->delete();

        // Validate and assign new unit admins
        $validUserIds = [];
        $invalidUsers = [];

        foreach ($userIds as $userId) {
            // Check if user exists and belongs to the same organization
            $userExists = User::where('id', $userId)
                ->where('organization_id', $unit->organization_id)
                ->where('is_active', true)
                ->exists();

            if ($userExists) {
                $validUserIds[] = $userId;
            } else {
                $invalidUsers[] = $userId;
            }
        }

        // Log invalid users for debugging
        if (! empty($invalidUsers)) {
            Log::warning('Invalid user IDs for unit admin assignment', [
                'unit_id' => $unit->id,
                'invalid_user_ids' => $invalidUsers,
                'organization_id' => $unit->organization_id,
            ]);
        }

        // Assign valid unit admins
        foreach ($validUserIds as $userId) {
            DB::table('user_role')->insert([
                'user_id' => $userId,
                'role_id' => $unitAdminRole->id,
                'unit_id' => $unit->id,
                'organization_id' => $unit->organization_id,
                'is_active' => true,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Log::info('Unit admin assignment completed', [
            'unit_id' => $unit->id,
            'assigned_user_ids' => $validUserIds,
            'total_assigned' => count($validUserIds),
        ]);
    }

    /**
     * Change the spoke (Unit Admin) for a unit.
     *
     * Enterprise Admin only, scoped to their own organization. The unit's SAMAR ID and
     * data mapping are preserved; only the contact identity + login credentials change,
     * and a credentials email is sent to the new spoke.
     */
    #[OA\Post(
        path: '/api/v1/units/{id}/change-spoke',
        summary: 'Change the spoke (Unit Admin) for a unit',
        description: 'Enterprise Admin only, scoped to their own organization. Keeps the unit\'s SAMAR ID and data mapping; updates the contact identity and login credentials and emails the new spoke.',
        operationId: 'changeUnitSpoke',
        tags: ['Units'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Unit ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email'],
                properties: [
                    new OA\Property(
                        property: 'email',
                        type: 'string',
                        format: 'email',
                        maxLength: 320,
                        example: 'new.spoke@example.com',
                    ),
                    new OA\Property(
                        property: 'name',
                        type: 'string',
                        nullable: true,
                        maxLength: 100,
                        example: 'Jane Doe',
                    ),
                    new OA\Property(
                        property: 'designation',
                        type: 'string',
                        nullable: true,
                        maxLength: 100,
                        example: 'Plant Manager',
                    ),
                    new OA\Property(
                        property: 'mobile',
                        type: 'string',
                        nullable: true,
                        example: '9876543210',
                        description: '10 digit mobile number',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Spoke changed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Spoke changed successfully. Login credentials have been emailed to the new spoke.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'unit_admin',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 42),
                                        new OA\Property(
                                            property: 'samar_id',
                                            type: 'string',
                                            example: 'SAMAR-UA-0042',
                                        ),
                                        new OA\Property(property: 'name', type: 'string', example: 'Jane Doe'),
                                        new OA\Property(
                                            property: 'email',
                                            type: 'string',
                                            example: 'new.spoke@example.com',
                                        ),
                                    ],
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
                description: 'Forbidden — outside the caller\'s organization',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'You can only change spokes for units in your organization.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'Unit not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Unit not found.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 422,
                description: 'Validation error or no active Unit Admin to replace',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'This unit has no active Unit Admin to change.',
                        ),
                    ],
                ),
            ),
        ],
    )]
    public function changeSpoke(ChangeSpokeRequest $request, int $id, UserService $userService): JsonResponse
    {
        $user = $request->user();

        $unit = Unit::find($id);
        if (! $unit) {
            return $this->errorResponse('Unit not found.', 404);
        }

        // Enterprise Admins may only change spokes within their own organization.
        if ((int) $unit->organization_id !== (int) $user->organization_id) {
            return $this->errorResponse('You can only change spokes for units in your organization.', 403);
        }

        try {
            $spoke = $userService->changeSpoke($unit, [
                'email' => $request->input('email'),
                'name' => $request->input('name'),
                'designation' => $request->input('designation'),
                'mobile' => $request->input('mobile'),
            ], $user);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to change spoke for this unit.', 422);
        }

        return $this->successResponse([
            'unit_admin' => [
                'id' => $spoke->id,
                'samar_id' => $spoke->samar_id,
                'name' => $spoke->full_name,
                'email' => $spoke->email,
            ],
        ], 'Spoke changed successfully. Login credentials have been emailed to the new spoke.');
    }
}
