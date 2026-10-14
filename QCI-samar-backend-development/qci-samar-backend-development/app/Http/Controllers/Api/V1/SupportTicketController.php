<?php

namespace App\Http\Controllers\Api\V1;

use App\Contracts\SupportPlatformInterface;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Ticket\StoreTicketRequest;
use App\Http\Requests\Api\V1\Ticket\UpdateTicketRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Support Tickets', description: 'Support ticket management endpoints (Zoho Help integration)')]
class SupportTicketController extends Controller
{
    private SupportPlatformInterface $platform;

    public function __construct(SupportPlatformInterface $platform)
    {
        $this->platform = $platform;
    }

    /**
     * Check if user has access to a ticket based on email AND organization.
     *
     * For proper segregation, a user must match BOTH:
     * - Contact email (ownership)
     * - Organization ID (segregation)
     *
     * Legacy tickets without organisation_id still allow email-only access.
     */
    private function userCanAccessTicket(array $ticket, $user): bool
    {
        // Admin users can access all tickets
        if ($user->hasAnyRole(['system_admin', 'operations_manager', 'operations_admin'])) {
            return true;
        }

        // Check contact email ownership
        $contactEmail = $ticket['contact']['email'] ?? null;
        $isOwner = $contactEmail && $contactEmail === $user->email;

        if (! $isOwner) {
            return false;
        }

        // Check organization segregation
        $ticketOrgId = $ticket['custom_fields']['organisation_id'] ?? null;
        $userOrgId = $user->organization_id;

        // Legacy tickets (without org_id) are accessible if email matches
        if ($ticketOrgId === null) {
            return true;
        }

        // New tickets require organization match
        return $ticketOrgId === (string) $userOrgId;
    }

    /**
     * Display a listing of support tickets.
     */
    #[OA\Get(
        path: '/api/v1/support/tickets',
        summary: 'Get all support tickets',
        tags: [
            'Support Tickets',
            'System Admin - Support Tickets',
            'DRDO Admin - Support Tickets',
            'Operations Manager - Support Tickets',
            'Operations Admin - Support Tickets',
            'Assessor - Support Tickets',
            'Unit Admin - Support Tickets',
            'Enterprise Admin - Support Tickets',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'status',
                in: 'query',
                description: 'Filter by status',
                schema: new OA\Schema(
                    type: 'string',
                    enum: ['open', 'in_progress', 'waiting_for_response', 'resolved', 'closed'],
                ),
            ),
            new OA\Parameter(
                name: 'priority',
                in: 'query',
                description: 'Filter by priority',
                schema: new OA\Schema(type: 'string', enum: ['low', 'medium', 'high', 'urgent']),
            ),
            new OA\Parameter(
                name: 'category',
                in: 'query',
                description: 'Filter by category',
                schema: new OA\Schema(type: 'string', enum: ['technical', 'billing', 'general', 'application_query']),
            ),
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search in ticket subject and description',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Number of items per page',
                schema: new OA\Schema(type: 'integer', default: 15),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Success'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        if (! $this->platform->isEnabled()) {
            return $this->errorResponse('Support ticket system is currently unavailable', 503);
        }

        try {
            $user = $request->user();
            $filters = [];
            $isAdmin = $user->hasAnyRole(['system_admin', 'operations_manager', 'operations_admin']);

            // Authorization: Non-admin users can only see tickets from their organization
            if (! $isAdmin) {
                // Filter by email (contact ownership) AND organization
                $filters['email'] = $user->email;
                $filters['organisation_id'] = $user->organization_id;
            }

            // Apply filters from request
            if ($request->has('status')) {
                $filters['status'] = $request->status;
            }

            if ($request->has('priority')) {
                $filters['priority'] = $request->priority;
            }

            if ($request->has('category')) {
                $filters['category'] = $request->category;
            }

            if ($request->has('search')) {
                $filters['search'] = $request->search;
            }

            // Pagination
            $perPage = $this->resolvePerPage($request, 15);
            $page = $request->get('page', 1);
            $filters['from'] = ($page - 1) * $perPage;
            $filters['limit'] = $perPage;

            // Sorting
            if ($request->has('sort_by')) {
                $filters['sort_by'] = $request->sort_by;
            }

            $result = $this->platform->listTickets($filters);

            // Client-side filter by organization_id (Zoho doesn't support custom field filtering in list API)
            $organisationId = $filters['organisation_id'] ?? null;
            if ($organisationId !== null) {
                $result['data'] = array_values(array_filter($result['data'], function ($ticket) use ($organisationId) {
                    $ticketOrgId = $ticket['custom_fields']['organisation_id'] ?? null;

                    // Allow tickets without org_id (legacy) if email matches, or tickets with matching org_id
                    return $ticketOrgId === null || $ticketOrgId === (string) $organisationId;
                }));
                // Update pagination total after filtering
                $result['pagination']['total'] = count($result['data']);
            }

            Log::info('Support tickets retrieved', [
                'user_id' => $user->id,
                'organisation_id' => $user->organization_id,
                'filters' => $filters,
                'total_results' => $result['pagination']['total'] ?? 0,
            ]);

            return $this->successResponse([
                'data' => $result['data'],
                'pagination' => [
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'total' => $result['pagination']['total'] ?? 0,
                    'from' => $result['pagination']['from'] ?? 0,
                    'has_more' => $result['pagination']['hasMore'] ?? false,
                ],
            ], 'Support tickets retrieved successfully');
        } catch (\Exception $e) {
            Log::error('Failed to retrieve support tickets', [
                'error' => $e->getMessage(),
                'user_id' => $request->user()->id,
            ]);

            return $this->errorResponse('Failed to retrieve support tickets', 500);
        }
    }

    /**
     * Store a newly created support ticket.
     *
     * Creates a ticket in Zoho Desk NDIE Department. Per SAMAR-ZOHODESK documentation,
     * this endpoint first creates/retrieves a Contact, then creates the ticket with
     * all mandatory custom fields for the NDIE department.
     *
     * Organization data is auto-populated from the authenticated user's organization
     * for proper segregation (tickets from one org cannot be accessed by another).
     */
    #[OA\Post(
        path: '/api/v1/support/tickets',
        summary: 'Create a new support ticket',
        description: 'Creates a support ticket in Zoho Desk NDIE Department. Organization is auto-populated from user\'s profile for segregation. Supports optional file attachments (max 5 files, 10MB each).',
        tags: [
            'Support Tickets',
            'System Admin - Support Tickets',
            'DRDO Admin - Support Tickets',
            'Operations Manager - Support Tickets',
            'Operations Admin - Support Tickets',
            'Assessor - Support Tickets',
            'Unit Admin - Support Tickets',
            'Enterprise Admin - Support Tickets',
        ],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: [
                new OA\MediaType(
                    mediaType: 'multipart/form-data',
                    schema: new OA\Schema(
                        required: ['subject', 'description', 'user_role', 'issue_category', 'issue_type', 'issue_sub_category'],
                        properties: [
                            new OA\Property(
                                property: 'subject',
                                type: 'string',
                                description: 'Ticket subject',
                                example: 'Issue with certification process',
                            ),
                            new OA\Property(
                                property: 'description',
                                type: 'string',
                                description: 'Detailed description of the issue',
                            ),
                            new OA\Property(
                                property: 'priority',
                                type: 'string',
                                enum: ['low', 'medium', 'high', 'urgent'],
                                description: 'Priority level',
                                example: 'medium',
                            ),
                            new OA\Property(
                                property: 'user_role',
                                type: 'string',
                                description: 'User role (mandatory)',
                                example: 'MSME',
                            ),
                            new OA\Property(
                                property: 'issue_category',
                                type: 'string',
                                description: 'Issue category (mandatory)',
                                example: 'Against Consultant Organisations',
                            ),
                            new OA\Property(
                                property: 'issue_type',
                                type: 'string',
                                description: 'Issue type (mandatory)',
                                example: 'Complaint',
                            ),
                            new OA\Property(
                                property: 'issue_sub_category',
                                type: 'string',
                                description: 'Issue sub-category (mandatory)',
                                example: 'Lack of systems',
                            ),
                            new OA\Property(
                                property: 'udyam_number',
                                type: 'string',
                                description: 'Udyam registration number (optional)',
                            ),
                            new OA\Property(
                                property: 'attachments[]',
                                type: 'array',
                                description: 'File attachments (optional, max 5 files, 10MB each)',
                                items: new OA\Items(type: 'string', format: 'binary'),
                            ),
                        ],
                    ),
                ),
            ],
        ),
        responses: [
            new OA\Response(response: 201, description: 'Ticket created successfully'),
            new OA\Response(response: 400, description: 'Validation error'),
            new OA\Response(response: 503, description: 'Service unavailable'),
        ],
    )]
    public function store(StoreTicketRequest $request): JsonResponse
    {
        if (! $this->platform->isEnabled()) {
            return $this->errorResponse('Support ticket system is currently unavailable', 503);
        }

        try {
            $user = $request->user();

            // Auto-populate organization data from user's organization for segregation
            $organisation = $user->organization;
            $organisationId = $user->organization_id;
            $organisationName = $organisation?->name;

            // Build ticket data per SAMAR-ZOHODESK documentation
            $ticketData = [
                // Core ticket fields
                'subject' => $request->subject,
                'description' => $request->description,
                'priority' => $request->get('priority', 'medium'),

                // User information for contact creation
                'user_email' => $user->email,
                'user_first_name' => $user->first_name ?? '',
                'user_last_name' => $user->last_name ?? $user->name ?? '',
                'user_phone' => $user->phone ?? $user->mobile_number ?? null,
                'user_mobile' => $user->mobile_number ?? null,

                // NDIE Department mandatory custom fields
                'user_role' => $request->user_role,
                'issue_category' => $request->issue_category,
                'issue_type' => $request->issue_type,
                'issue_sub_category' => $request->issue_sub_category,

                // Organization fields (auto-populated for segregation - NOT from request)
                'organisation_id' => $organisationId,
                'organisation_name' => $organisationName,

                // NDIE Department optional custom fields
                'udyam_number' => $request->udyam_number,
            ];

            Log::info('Attempting to create support ticket', [
                'user_id' => $user->id,
                'organisation_id' => $organisationId,
                'subject' => $request->subject,
                'ticket_data' => $ticketData,
            ]);

            $ticketId = $this->platform->createTicket($ticketData);

            if (! $ticketId) {
                Log::error('Platform returned null ticket ID', [
                    'user_id' => $user->id,
                    'organisation_id' => $organisationId,
                    'ticket_data' => $ticketData,
                ]);

                return $this->errorResponse('Failed to create support ticket', 500);
            }

            // Fetch the created ticket to return full details
            $ticket = $this->platform->getTicket($ticketId);

            // Handle file attachments if provided
            $attachmentResults = [
                'uploaded' => [],
                'failed' => [],
            ];

            if ($request->hasFile('attachments')) {
                $attachmentResults = $this->handleTicketAttachments($ticketId, $request->file('attachments'));
            }

            Log::info('Support ticket created', [
                'ticket_id' => $ticketId,
                'user_id' => $user->id,
                'organisation_id' => $organisationId,
                'subject' => $request->subject,
                'user_role' => $request->user_role,
                'issue_category' => $request->issue_category,
                'attachments_uploaded' => count($attachmentResults['uploaded']),
                'attachments_failed' => count($attachmentResults['failed']),
            ]);

            // Add attachment results to ticket response
            $ticket['attachments'] = $attachmentResults;

            return $this->successResponse($ticket, 'Support ticket created successfully', 201);
        } catch (\Exception $e) {
            Log::error('Failed to create support ticket', [
                'error' => $e->getMessage(),
                'user_id' => $request->user()->id,
            ]);

            return $this->errorResponse('Failed to create support ticket', 500);
        }
    }

    /**
     * Handle file attachments for a ticket.
     *
     * Uploads files to temporary storage, sends them to Zoho Desk, and cleans up.
     *
     * @param  string  $ticketId  Zoho Desk ticket ID
     * @param  array  $files  Array of UploadedFile instances
     * @return array Results with 'uploaded' and 'failed' arrays containing filenames
     */
    private function handleTicketAttachments(string $ticketId, array $files): array
    {
        $results = [
            'uploaded' => [],
            'failed' => [],
        ];

        foreach ($files as $file) {
            $filename = $file->getClientOriginalName();
            $tempPath = null;

            try {
                // Store file temporarily
                $tempPath = $file->storeAs('temp/ticket-attachments', uniqid().'_'.$filename, 'local');
                $fullPath = Storage::disk('local')->path($tempPath);

                // Upload to Zoho Desk
                $success = $this->platform->addAttachment($ticketId, $fullPath, $filename);

                if ($success) {
                    $results['uploaded'][] = $filename;
                    Log::info('Attachment uploaded to ticket', [
                        'ticket_id' => $ticketId,
                        'filename' => $filename,
                    ]);
                } else {
                    $results['failed'][] = $filename;
                    Log::warning('Failed to upload attachment to Zoho Desk', [
                        'ticket_id' => $ticketId,
                        'filename' => $filename,
                    ]);
                }
            } catch (\Exception $e) {
                $results['failed'][] = $filename;
                Log::error('Exception uploading attachment', [
                    'ticket_id' => $ticketId,
                    'filename' => $filename,
                    'error' => $e->getMessage(),
                ]);
            } finally {
                // Clean up temporary file
                if ($tempPath && Storage::disk('local')->exists($tempPath)) {
                    Storage::disk('local')->delete($tempPath);
                }
            }
        }

        return $results;
    }

    /**
     * Display the specified support ticket.
     */
    #[OA\Get(
        path: '/api/v1/support/tickets/{id}',
        summary: 'Get support ticket details',
        tags: [
            'Support Tickets',
            'System Admin - Support Tickets',
            'DRDO Admin - Support Tickets',
            'Operations Manager - Support Tickets',
            'Operations Admin - Support Tickets',
            'Assessor - Support Tickets',
            'Unit Admin - Support Tickets',
            'Enterprise Admin - Support Tickets',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Zoho Help ticket ID',
                schema: new OA\Schema(type: 'string'),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Success'),
            new OA\Response(response: 400, description: 'Bad request - Invalid ticket ID format'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Ticket not found'),
        ],
    )]
    public function show(Request $request, string $id): JsonResponse
    {
        // Validate ticket ID format
        if (! is_numeric($id) || $id <= 0) {
            return $this->errorResponse('Invalid ticket ID format', 400);
        }

        if (! $this->platform->isEnabled()) {
            return $this->errorResponse('Support ticket system is currently unavailable', 503);
        }

        try {
            $ticket = $this->platform->getTicket($id);

            if (! $ticket) {
                return $this->errorResponse('Support ticket not found', 404);
            }

            // Authorization check: User must own the ticket AND belong to same organization
            $user = $request->user();

            if (! $this->userCanAccessTicket($ticket, $user)) {
                return $this->errorResponse('Unauthorized to view this ticket', 403);
            }

            // Fetch comments
            $comments = $this->platform->getTicketComments($id);

            // Filter internal comments for non-admin users
            $isAdmin = $user->hasAnyRole(['system_admin', 'operations_manager', 'operations_admin']);
            if (! $isAdmin) {
                $comments = array_filter($comments, fn ($comment) => ! $comment['is_internal']);
            }

            $ticket['comments'] = array_values($comments);

            Log::info('Support ticket retrieved', [
                'ticket_id' => $id,
                'user_id' => $user->id,
            ]);

            return $this->successResponse($ticket, 'Support ticket retrieved successfully');
        } catch (\Exception $e) {
            Log::error('Failed to retrieve support ticket', [
                'ticket_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Failed to retrieve support ticket', 500);
        }
    }

    /**
     * Update the specified support ticket.
     */
    #[OA\Put(
        path: '/api/v1/support/tickets/{id}',
        summary: 'Update support ticket (Admin only)',
        tags: [
            'Support Tickets',
            'System Admin - Support Tickets',
            'Operations Manager - Support Tickets',
            'Operations Admin - Support Tickets',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Zoho Help ticket ID',
                schema: new OA\Schema(type: 'string'),
            ),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'status',
                        type: 'string',
                        enum: ['open', 'in_progress', 'waiting_for_response', 'resolved', 'closed'],
                    ),
                    new OA\Property(
                        property: 'priority',
                        type: 'string',
                        enum: ['low', 'medium', 'high', 'urgent'],
                    ),
                    new OA\Property(property: 'assigned_to_email', type: 'string', format: 'email'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Success'),
            new OA\Response(response: 400, description: 'Bad request - Invalid ticket ID format'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Ticket not found'),
        ],
    )]
    public function update(UpdateTicketRequest $request, string $id): JsonResponse
    {
        // Validate ticket ID format
        if (! is_numeric($id) || $id <= 0) {
            return $this->errorResponse('Invalid ticket ID format', 400);
        }

        if (! $this->platform->isEnabled()) {
            return $this->errorResponse('Support ticket system is currently unavailable', 503);
        }

        try {
            $user = $request->user();

            // Check if ticket exists
            $ticket = $this->platform->getTicket($id);
            if (! $ticket) {
                return $this->errorResponse('Support ticket not found', 404);
            }

            $updateData = $request->only(['status', 'priority', 'assigned_to_email']);

            $success = $this->platform->updateTicket($id, $updateData);

            if (! $success) {
                return $this->errorResponse('Failed to update support ticket', 500);
            }

            // Fetch updated ticket
            $updatedTicket = $this->platform->getTicket($id);

            Log::info('Support ticket updated', [
                'ticket_id' => $id,
                'updated_by' => $user->id,
                'updates' => $updateData,
            ]);

            return $this->successResponse($updatedTicket, 'Support ticket updated successfully');
        } catch (\Exception $e) {
            Log::error('Failed to update support ticket', [
                'ticket_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Failed to update support ticket', 500);
        }
    }
}
