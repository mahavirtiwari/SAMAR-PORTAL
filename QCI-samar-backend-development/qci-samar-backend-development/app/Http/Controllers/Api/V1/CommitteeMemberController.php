<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CommitteeMember;
use App\Models\Role;
use App\Rules\PersonName;
use App\Services\Email\EmailNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Committee Members',
    description: 'Manage committee members - the pool of members available for meetings',
)]
class CommitteeMemberController extends Controller
{
    #[OA\Get(
        path: '/api/v1/committee-members',
        summary: 'List all committee members',
        tags: ['Committee Members', 'Operations Admin - Rating Committee'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by name, email or contact number',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Items per page',
                schema: new OA\Schema(type: 'integer', default: 15),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Committee members retrieved successfully'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        // View access: DRDO Admin, Operations Manager, Operations Admin, Assessor
        if (! $request->user()->hasAnyRole([Role::DRDO_ADMIN, Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN, Role::ASSESSOR])) {
            return $this->errorResponse('Unauthorized to view committee members.', 403);
        }

        $perPage = $this->resolvePerPage($request, 15);
        $search = $request->get('search');

        $query = CommitteeMember::query()
            ->select(['id', 'first_name', 'last_name', 'email', 'mobile_number', 'designation', 'organisation', 'status', 'created_at']);

        // Search by name, email or contact number
        if ($search) {
            $query->search($search);
        }

        $members = $query->orderBy('created_at', 'desc')->paginate($perPage);

        $formattedMembers = collect($members->items())->map(fn ($member) => $this->formatMember($member));

        return response()->json([
            'success' => true,
            'message' => 'Committee members retrieved successfully.',
            'data' => $formattedMembers,
            'pagination' => [
                'total' => $members->total(),
                'perPage' => $members->perPage(),
                'currentPage' => $members->currentPage(),
                'lastPage' => $members->lastPage(),
                'from' => $members->firstItem(),
                'to' => $members->lastItem(),
            ],
        ]);
    }

    #[OA\Get(
        path: '/api/v1/committee-members/{id}',
        summary: 'Get a single committee member',
        tags: ['Committee Members', 'Operations Admin - Rating Committee'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Committee member retrieved successfully'),
            new OA\Response(response: 404, description: 'Committee member not found'),
        ],
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        // View access: DRDO Admin, Operations Manager, Operations Admin, Assessor
        if (! $request->user()->hasAnyRole([Role::DRDO_ADMIN, Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN, Role::ASSESSOR])) {
            return $this->errorResponse('Unauthorized to view committee member.', 403);
        }

        $member = CommitteeMember::find($id);

        if (! $member) {
            return $this->errorResponse('Committee member not found.', 404);
        }

        return $this->successResponse(
            ['member' => $this->formatMember($member)],
            'Committee member retrieved successfully.'
        );
    }

    #[OA\Post(
        path: '/api/v1/committee-members',
        summary: 'Create a new committee member',
        tags: ['Committee Members', 'Operations Admin - Rating Committee'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['first_name', 'last_name', 'email', 'mobile_number', 'designation', 'organisation'],
                properties: [
                    new OA\Property(property: 'first_name', type: 'string', example: 'John'),
                    new OA\Property(property: 'last_name', type: 'string', example: 'Doe'),
                    new OA\Property(
                        property: 'email',
                        type: 'string',
                        format: 'email',
                        example: 'john@example.com',
                    ),
                    new OA\Property(property: 'mobile_number', type: 'string', example: '9876543210'),
                    new OA\Property(property: 'designation', type: 'string', example: 'Technical Expert'),
                    new OA\Property(property: 'organisation', type: 'string', example: 'DRDO'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Committee member added successfully'),
            new OA\Response(response: 400, description: 'Email already exists'),
            new OA\Response(response: 422, description: 'Validation failed'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        // Only Operations Admin can add committee members
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can add committee members.', 403);
        }

        $validator = Validator::make($request->all(), [
            'first_name' => ['required', 'string', 'max:255', new PersonName],
            'last_name' => ['required', 'string', 'max:255', new PersonName],
            'email' => 'required|email|max:320|unique:committee_members,email',
            'mobile_number' => 'required|string|regex:/^[0-9]{10}$/',
            'designation' => 'required|string|max:255',
            'organisation' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        try {
            $member = CommitteeMember::create([
                'first_name' => $request->first_name,
                'last_name' => $request->last_name,
                'email' => $request->email,
                'mobile_number' => $request->mobile_number,
                'designation' => $request->designation,
                'organisation' => $request->organisation,
                'status' => 'active',
                'created_by' => $request->user()->id,
            ]);

            // Send welcome email to new committee member
            $this->sendCommitteeCreatedEmail($member);

            return $this->successResponse(
                ['member' => $this->formatMember($member)],
                'Committee member added successfully.',
                201
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to add committee member.');
        }
    }

    #[OA\Put(
        path: '/api/v1/committee-members/{id}',
        summary: 'Update a committee member',
        tags: ['Committee Members', 'Operations Admin - Rating Committee'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'first_name', type: 'string'),
                    new OA\Property(property: 'last_name', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'mobile_number', type: 'string'),
                    new OA\Property(property: 'designation', type: 'string'),
                    new OA\Property(property: 'organisation', type: 'string'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Committee member updated successfully'),
            new OA\Response(response: 404, description: 'Committee member not found'),
        ],
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        // Only Operations Admin can update committee members
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can update committee members.', 403);
        }

        $member = CommitteeMember::find($id);

        if (! $member) {
            return $this->errorResponse('Committee member not found.', 404);
        }

        $validator = Validator::make($request->all(), [
            'first_name' => ['sometimes', 'string', 'max:255', new PersonName],
            'last_name' => ['sometimes', 'string', 'max:255', new PersonName],
            'email' => 'sometimes|email|max:320|unique:committee_members,email,'.$id,
            'mobile_number' => 'sometimes|string|regex:/^[0-9]{10}$/',
            'designation' => 'sometimes|string|max:255',
            'organisation' => 'sometimes|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        try {
            $updateData = ['updated_by' => $request->user()->id];

            if ($request->has('first_name')) {
                $updateData['first_name'] = $request->first_name;
            }
            if ($request->has('last_name')) {
                $updateData['last_name'] = $request->last_name;
            }
            if ($request->has('email')) {
                $updateData['email'] = $request->email;
            }
            if ($request->has('mobile_number')) {
                $updateData['mobile_number'] = $request->mobile_number;
            }
            if ($request->has('designation')) {
                $updateData['designation'] = $request->designation;
            }
            if ($request->has('organisation')) {
                $updateData['organisation'] = $request->organisation;
            }

            $member->update($updateData);

            return $this->successResponse(
                ['member' => $this->formatMember($member->fresh())],
                'Committee member updated successfully.'
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to update committee member.');
        }
    }

    #[OA\Delete(
        path: '/api/v1/committee-members/{id}',
        summary: 'Delete a committee member',
        tags: ['Committee Members', 'Operations Admin - Rating Committee'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Committee member removed successfully'),
            new OA\Response(response: 404, description: 'Committee member not found'),
        ],
    )]
    public function destroy(Request $request, int $id): JsonResponse
    {
        // Only Operations Admin can remove committee members
        if (! $request->user()->hasRole(Role::OPERATIONS_ADMIN)) {
            return $this->errorResponse('Only Operations Admins can remove committee members.', 403);
        }

        $member = CommitteeMember::find($id);

        if (! $member) {
            return $this->errorResponse('Committee member not found.', 404);
        }

        try {
            $member->deleted_by = $request->user()->id;
            $member->save();
            $member->delete();

            return $this->successResponse(null, 'Committee member removed successfully.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to remove committee member.');
        }
    }

    /**
     * Format member data for response.
     */
    private function formatMember(CommitteeMember $member): array
    {
        return [
            'id' => $member->id,
            'first_name' => $member->first_name,
            'last_name' => $member->last_name,
            'name' => $member->full_name,
            'email' => $member->email,
            'mobile_number' => $member->mobile_number,
            'designation' => $member->designation,
            'organisation' => $member->organisation,
            'status' => $member->status,
            'created_at' => $member->created_at?->toIso8601String(),
        ];
    }

    /**
     * Send welcome email to newly created committee member.
     */
    private function sendCommitteeCreatedEmail(CommitteeMember $member): void
    {
        if (empty($member->email)) {
            return;
        }

        app(EmailNotificationService::class)->sendEmailToAddresses(
            'committee-created',
            [$member->email],
            [
                'query_form_link' => config('app.frontend_url', '').'/support',
            ]
        );

        Log::info('Committee member welcome dispatched', [
            'committee_member_id' => $member->id,
            'email' => $member->email,
        ]);
    }
}
