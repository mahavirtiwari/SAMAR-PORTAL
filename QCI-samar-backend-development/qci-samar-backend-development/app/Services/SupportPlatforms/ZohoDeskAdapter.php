<?php

namespace App\Services\SupportPlatforms;

use App\Contracts\SupportPlatformInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ZohoDeskAdapter implements SupportPlatformInterface
{
    private string $baseUrl;

    private string $orgId;

    private ?string $departmentId;

    private ?string $ownerId;

    private bool $enabled;

    private int $maxRetries = 3;

    private ZohoOAuthService $oauthService;

    public function __construct(?ZohoOAuthService $oauthService = null)
    {
        $this->enabled = config('services.zoho_desk.enabled', false);
        $this->baseUrl = config('services.zoho_desk.base_url', 'https://desk.zoho.in/api/v1');
        $this->orgId = config('services.zoho_desk.org_id', '60037449308');
        $this->departmentId = config('services.zoho_desk.department_id', '185393000001510116');
        $this->ownerId = config('services.zoho_desk.owner_id', '185393000000278043');
        $this->oauthService = $oauthService ?? new ZohoOAuthService;
    }

    /**
     * Create a new ticket in Zoho Desk.
     *
     * Per SAMAR-ZOHODESK documentation, ticket creation requires:
     * 1. First create/get a Contact (mandatory)
     * 2. Then create the ticket with contactId, departmentId, channel, and custom fields
     */
    public function createTicket(array $data): ?string
    {
        if (! $this->isEnabled()) {
            Log::warning('Zoho Desk integration is disabled');

            return null;
        }

        try {
            // Step 1: Create or get contact (mandatory per documentation)
            $contactId = $this->resolveContactId($data);

            if (! $contactId) {
                Log::error('Failed to create/get contact for Zoho Desk ticket', [
                    'email' => $data['user_email'] ?? 'N/A',
                ]);

                return null;
            }

            // Step 2: Build ticket payload with mandatory fields
            $payload = [
                // Mandatory fields per SAMAR-ZOHODESK documentation
                'contactId' => $contactId,
                'subject' => strip_tags($data['subject'] ?? ''),
                'departmentId' => $this->departmentId,
                'channel' => 'Web', // Always "Web" for API-created tickets

                // Optional fields
                'description' => strip_tags($data['description'] ?? ''),
                'priority' => $this->mapPriorityToZohoHelp($data['priority'] ?? 'medium'),
            ];

            // Add email and phone (mandatory per documentation)
            if (isset($data['user_email'])) {
                $payload['email'] = $data['user_email'];
            }
            if (isset($data['user_phone'])) {
                $payload['phone'] = $data['user_phone'];
            }

            // Step 3: Add NDIE Department custom fields
            $this->addCustomFields($payload, $data);

            $response = $this->makeRequest('POST', '/tickets', $payload);

            if ($response && isset($response['id'])) {
                Log::info('Zoho Desk ticket created', [
                    'ticket_id' => $response['id'],
                    'ticket_number' => $response['ticketNumber'] ?? 'N/A',
                    'contact_id' => $contactId,
                    'subject' => $data['subject'] ?? 'N/A',
                ]);

                return (string) $response['id'];
            }

            Log::error('Failed to create Zoho Desk ticket: Invalid response', [
                'response' => $response,
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('Exception creating Zoho Desk ticket', [
                'error' => $e->getMessage(),
                'subject' => $data['subject'] ?? 'N/A',
                'category' => $data['category'] ?? 'N/A',
            ]);

            return null;
        }
    }

    /**
     * Resolve contact ID - either use provided ID or create/get contact by email.
     */
    private function resolveContactId(array $data): ?string
    {
        // Use provided contact ID if available
        if (isset($data['contact_id']) && ! empty($data['contact_id'])) {
            return (string) $data['contact_id'];
        }

        // Create/get contact by email
        if (isset($data['user_email'])) {
            $contactData = [
                'email' => $data['user_email'],
                'first_name' => $data['user_first_name'] ?? '',
                'last_name' => $data['user_last_name'] ?? ($data['user_name'] ?? ''),
                'phone' => $data['user_phone'] ?? null,
                'mobile' => $data['user_mobile'] ?? null,
            ];

            return $this->createOrGetContact($contactData);
        }

        Log::error('Missing contact information for Zoho Desk ticket creation');

        return null;
    }

    /**
     * Create or get a contact in Zoho Desk.
     *
     * Per SAMAR-ZOHODESK documentation:
     * - First search for existing contact by email
     * - If not found, create new contact with required fields
     */
    private function createOrGetContact(array $contactData): ?string
    {
        try {
            // First, search for existing contact by email
            $existingContactId = $this->searchContactByEmail($contactData['email']);

            if ($existingContactId) {
                Log::info('Found existing Zoho Desk contact', [
                    'email' => $contactData['email'],
                    'contact_id' => $existingContactId,
                ]);

                return $existingContactId;
            }

            // Create new contact if not found
            // Per documentation: lastName is required, firstName/phone/mobile are optional
            $payload = [
                'email' => $contactData['email'],
                'lastName' => ! empty($contactData['last_name']) ? $contactData['last_name'] : 'User',
            ];

            // Add optional fields if provided
            if (! empty($contactData['first_name'])) {
                $payload['firstName'] = $contactData['first_name'];
            }
            if (! empty($contactData['phone'])) {
                $payload['phone'] = $contactData['phone'];
            }
            if (! empty($contactData['mobile'])) {
                $payload['mobile'] = $contactData['mobile'];
            }

            // Add ownerId from configuration (per documentation)
            if ($this->ownerId) {
                $payload['ownerId'] = $this->ownerId;
            }

            $response = $this->makeRequest('POST', '/contacts', $payload);

            if ($response && isset($response['id'])) {
                Log::info('Created new Zoho Desk contact', [
                    'email' => $contactData['email'],
                    'contact_id' => $response['id'],
                ]);

                return (string) $response['id'];
            }

            Log::error('Failed to create Zoho Desk contact', [
                'email' => $contactData['email'],
                'response' => $response,
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('Exception creating/getting Zoho Desk contact', [
                'email' => $contactData['email'],
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Search for a contact by email address.
     */
    private function searchContactByEmail(string $email): ?string
    {
        try {
            // Zoho Desk search API: GET /contacts?email={email}
            $response = $this->makeRequest('GET', '/contacts', null, [
                'email' => $email,
                'limit' => 1,
            ]);

            if ($response && isset($response['data']) && count($response['data']) > 0) {
                return (string) $response['data'][0]['id'];
            }

            return null;
        } catch (\Exception $e) {
            Log::warning('Exception searching for Zoho Desk contact', [
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Add NDIE Department custom fields to ticket payload.
     *
     * Per SAMAR-ZOHODESK documentation, NDIE department requires:
     * - cf_user_role (mandatory)
     * - cf_organisation_name (optional, auto-populated from user's org)
     * - cf_organisation_id (for segregation - stores SAMAR organization ID)
     * - cf_issue_category (mandatory)
     * - cf_issue_type (mandatory)
     * - cf_udyam_number (optional)
     * - cf_issue_sub_category (mandatory)
     */
    private function addCustomFields(array &$payload, array $data): void
    {
        // Build cf (custom fields) object as per documentation structure
        $cf = [
            // Mandatory custom fields
            'cf_user_role' => $data['user_role'],
            'cf_issue_category' => $data['issue_category'],
            'cf_issue_type' => $data['issue_type'],
            'cf_issue_sub_category' => $data['issue_sub_category'],
        ];

        // Organization segregation fields (auto-populated from user's organization)
        if (! empty($data['organisation_id'])) {
            $cf['cf_organisation_id'] = (string) $data['organisation_id'];
        }
        if (! empty($data['organisation_name'])) {
            $cf['cf_organisation_name'] = $data['organisation_name'];
        }

        // Other optional custom fields
        if (! empty($data['udyam_number'])) {
            $cf['cf_udyam_number'] = $data['udyam_number'];
        }

        $payload['cf'] = $cf;
    }

    /**
     * Update an existing ticket in Zoho Help.
     */
    public function updateTicket(string $externalId, array $data): bool
    {
        if (! $this->isEnabled()) {
            Log::warning('Zoho Help integration is disabled');

            return false;
        }

        try {
            $payload = [];

            if (isset($data['status'])) {
                $payload['status'] = $this->mapStatusToZohoHelp($data['status']);
            }

            if (isset($data['priority'])) {
                $payload['priority'] = $this->mapPriorityToZohoHelp($data['priority']);
            }

            if (isset($data['assigned_to_email'])) {
                $payload['assigneeEmail'] = $data['assigned_to_email'];
            }

            if (empty($payload)) {
                Log::warning('No data to update in Zoho Help ticket', ['ticket_id' => $externalId]);

                return false;
            }

            $response = $this->makeRequest('PATCH', "/tickets/{$externalId}", $payload);

            if ($response !== null) {
                Log::info('Zoho Help ticket updated', [
                    'ticket_id' => $externalId,
                    'updated_fields' => array_keys($payload),
                ]);

                return true;
            }

            return false;
        } catch (\Exception $e) {
            Log::error('Exception updating Zoho Help ticket', [
                'ticket_id' => $externalId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Add a comment to a ticket in Zoho Help.
     */
    public function addComment(string $externalId, string $comment, bool $isInternal = false): ?string
    {
        if (! $this->isEnabled()) {
            Log::warning('Zoho Help integration is disabled');

            return null;
        }

        try {
            $payload = [
                'content' => $comment,
                'isPublic' => ! $isInternal,
            ];

            $response = $this->makeRequest('POST', "/tickets/{$externalId}/threads", $payload);

            if ($response && isset($response['id'])) {
                Log::info('Comment added to Zoho Help ticket', [
                    'ticket_id' => $externalId,
                    'comment_id' => $response['id'],
                    'is_internal' => $isInternal,
                ]);

                return (string) $response['id'];
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Exception adding comment to Zoho Help ticket', [
                'ticket_id' => $externalId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Get ticket status from Zoho Help.
     */
    public function getTicketStatus(string $externalId): array
    {
        $ticket = $this->getTicket($externalId);

        if (! $ticket) {
            return [];
        }

        return [
            'status' => $this->mapStatusFromZohoHelp($ticket['status'] ?? ''),
            'priority' => $this->mapPriorityFromZohoHelp($ticket['priority'] ?? ''),
            'assigned_to' => $ticket['assignee']['email'] ?? null,
            'updated_at' => $ticket['modifiedTime'] ?? null,
        ];
    }

    /**
     * Sync ticket data from Zoho Help (alias for getTicket).
     */
    public function syncTicket(string $externalId): array
    {
        return $this->getTicket($externalId) ?? [];
    }

    /**
     * Close a ticket in Zoho Help.
     */
    public function closeTicket(string $externalId, ?string $resolution = null): bool
    {
        if (! $this->isEnabled()) {
            Log::warning('Zoho Help integration is disabled');

            return false;
        }

        try {
            $payload = [
                'status' => 'Closed',
            ];

            if ($resolution) {
                // Add resolution as a final comment
                $this->addComment($externalId, "Resolution: {$resolution}", false);
            }

            $response = $this->makeRequest('PATCH', "/tickets/{$externalId}", $payload);

            if ($response !== null) {
                Log::info('Zoho Help ticket closed', [
                    'ticket_id' => $externalId,
                    'resolution_provided' => ! empty($resolution),
                ]);

                return true;
            }

            return false;
        } catch (\Exception $e) {
            Log::error('Exception closing Zoho Help ticket', [
                'ticket_id' => $externalId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Assign a ticket to a user in Zoho Help.
     */
    public function assignTicket(string $externalId, string $agentEmail): bool
    {
        if (! $this->isEnabled()) {
            Log::warning('Zoho Help integration is disabled');

            return false;
        }

        try {
            $payload = [
                'assigneeEmail' => $agentEmail,
            ];

            $response = $this->makeRequest('PATCH', "/tickets/{$externalId}", $payload);

            if ($response !== null) {
                Log::info('Zoho Help ticket assigned', [
                    'ticket_id' => $externalId,
                    'assignee_email' => $agentEmail,
                ]);

                return true;
            }

            return false;
        } catch (\Exception $e) {
            Log::error('Exception assigning Zoho Help ticket', [
                'ticket_id' => $externalId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Get the platform name.
     */
    public function getPlatformName(): string
    {
        return 'zoho_desk';
    }

    /**
     * Check if the platform integration is enabled.
     */
    public function isEnabled(): bool
    {
        return $this->enabled
            && ! empty($this->orgId)
            && $this->oauthService->hasValidCredentials();
    }

    /**
     * Get a single ticket from Zoho Help.
     */
    public function getTicket(string $externalId): ?array
    {
        if (! $this->isEnabled()) {
            Log::warning('Zoho Help integration is disabled');

            return null;
        }

        try {
            $response = $this->makeRequest('GET', "/tickets/{$externalId}");

            if ($response) {
                return $this->formatTicketResponse($response);
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Exception fetching Zoho Help ticket', [
                'ticket_id' => $externalId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * List tickets from Zoho Help with filters.
     */
    public function listTickets(array $filters = []): array
    {
        if (! $this->isEnabled()) {
            Log::warning('Zoho Help integration is disabled');

            return ['data' => [], 'pagination' => []];
        }

        try {
            $queryParams = [];

            // Apply filters
            if (isset($filters['status'])) {
                $queryParams['status'] = $this->mapStatusToZohoHelp($filters['status']);
            }

            if (isset($filters['priority'])) {
                $queryParams['priority'] = $this->mapPriorityToZohoHelp($filters['priority']);
            }

            if (isset($filters['category'])) {
                $queryParams['category'] = $this->mapCategoryToZohoHelp($filters['category']);
            }

            if (isset($filters['email'])) {
                $queryParams['email'] = $filters['email'];
            }

            if (isset($filters['search'])) {
                $queryParams['searchStr'] = $filters['search'];
            }

            // Pagination
            $queryParams['from'] = $filters['from'] ?? 0;
            $queryParams['limit'] = $filters['limit'] ?? 15;

            // Sort
            if (isset($filters['sort_by'])) {
                $queryParams['sortBy'] = $filters['sort_by'];
            }

            $response = $this->makeRequest('GET', '/tickets', null, $queryParams);

            if ($response && isset($response['data'])) {
                $tickets = array_map([$this, 'formatTicketResponse'], $response['data']);

                return [
                    'data' => $tickets,
                    'pagination' => [
                        'total' => $response['total'] ?? count($tickets),
                        'from' => $queryParams['from'],
                        'limit' => $queryParams['limit'],
                        'hasMore' => $response['hasMore'] ?? false,
                    ],
                ];
            }

            return ['data' => [], 'pagination' => []];
        } catch (\Exception $e) {
            Log::error('Exception listing Zoho Help tickets', [
                'error' => $e->getMessage(),
                'filters' => $filters,
            ]);

            return ['data' => [], 'pagination' => []];
        }
    }

    /**
     * Get comments for a ticket from Zoho Help.
     */
    public function getTicketComments(string $externalId): array
    {
        if (! $this->isEnabled()) {
            Log::warning('Zoho Help integration is disabled');

            return [];
        }

        try {
            $response = $this->makeRequest('GET', "/tickets/{$externalId}/threads");

            if ($response && isset($response['data'])) {
                return array_map(function ($thread) {
                    return [
                        'id' => $thread['id'] ?? null,
                        'content' => $thread['content'] ?? '',
                        'is_internal' => ! ($thread['isPublic'] ?? true),
                        'author_email' => $thread['author']['email'] ?? null,
                        'author_name' => $thread['author']['name'] ?? null,
                        'created_at' => $thread['createdTime'] ?? null,
                    ];
                }, $response['data']);
            }

            return [];
        } catch (\Exception $e) {
            Log::error('Exception fetching Zoho Help ticket comments', [
                'ticket_id' => $externalId,
                'error' => $e->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * Add an attachment to a ticket in Zoho Help.
     */
    public function addAttachment(string $externalId, string $filePath, string $filename): bool
    {
        if (! $this->isEnabled()) {
            Log::warning('Zoho Help integration is disabled');

            return false;
        }

        try {
            if (! file_exists($filePath)) {
                Log::error('File not found for Zoho Help attachment', [
                    'file_path' => $filePath,
                ]);

                return false;
            }

            $response = Http::withHeaders($this->getHeaders())
                ->attach('file', fopen($filePath, 'r'), $filename)
                ->post("{$this->baseUrl}/tickets/{$externalId}/attachments");

            if ($response->successful()) {
                Log::info('Attachment added to Zoho Help ticket', [
                    'ticket_id' => $externalId,
                    'filename' => $filename,
                ]);

                return true;
            }

            Log::error('Failed to add attachment to Zoho Help ticket', [
                'ticket_id' => $externalId,
                'error_code' => $response->json('errorCode') ?? null,
                'status_code' => $response->status(),
            ]);

            return false;
        } catch (\Exception $e) {
            Log::error('Exception adding attachment to Zoho Help ticket', [
                'ticket_id' => $externalId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Test connection to Zoho Desk API.
     *
     * Tests both OAuth authentication and API connectivity.
     */
    public function testConnection(): bool
    {
        if (! $this->enabled || empty($this->orgId)) {
            Log::warning('Zoho Desk integration is disabled or org_id is missing');

            return false;
        }

        // First test OAuth
        $oauthTest = $this->oauthService->testConnection();
        if (! $oauthTest['success']) {
            Log::error('Zoho Desk OAuth test failed', ['message' => $oauthTest['message']]);

            return false;
        }

        try {
            // Then test API connectivity
            $response = $this->makeRequest('GET', '/tickets', null, ['limit' => 1]);

            if ($response !== null) {
                Log::info('Zoho Desk connection test successful');

                return true;
            }

            return false;
        } catch (\Exception $e) {
            Log::error('Zoho Desk API connection test failed', [
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Get the OAuth service for direct access (useful for testing/debugging).
     */
    public function getOAuthService(): ZohoOAuthService
    {
        return $this->oauthService;
    }

    /**
     * Make an HTTP request to Zoho Help API with retry logic.
     */
    private function makeRequest(string $method, string $endpoint, ?array $data = null, ?array $queryParams = null): ?array
    {
        $url = $this->baseUrl.$endpoint;
        $attempt = 0;

        while ($attempt < $this->maxRetries) {
            try {
                $request = Http::withHeaders($this->getHeaders())
                    ->timeout(30)
                    ->connectTimeout(10)
                    ->retry(3, 200, function ($exception) {
                        return $exception instanceof ConnectionException;
                    });

                // Disable SSL verification in local development (Laragan SSL certificate issue)
                if (app()->environment('local', 'development')) {
                    $request = $request->withOptions(['verify' => false]);
                }

                // Add query parameters if provided
                if ($queryParams) {
                    $request = $request->withQueryParameters($queryParams);
                }

                $response = match (strtoupper($method)) {
                    'GET' => $request->get($url),
                    'POST' => $request->post($url, $data),
                    'PATCH' => $request->patch($url, $data),
                    'PUT' => $request->put($url, $data),
                    'DELETE' => $request->delete($url),
                    default => throw new \InvalidArgumentException("Unsupported HTTP method: {$method}"),
                };

                // Success
                if ($response->successful()) {
                    return $response->json();
                }

                // Client errors (4xx) - don't retry
                if ($response->clientError()) {
                    Log::error('Zoho Help API client error', [
                        'method' => $method,
                        'endpoint' => $endpoint,
                        'error_code' => $response->json('errorCode') ?? null,
                        'status_code' => $response->status(),
                    ]);

                    return null;
                }

                // Server errors (5xx) - retry with exponential backoff
                if ($response->serverError()) {
                    $attempt++;
                    if ($attempt < $this->maxRetries) {
                        $delay = pow(2, $attempt) * 100000; // 200ms, 400ms, 800ms
                        usleep($delay);

                        Log::warning('Zoho Help API server error, retrying', [
                            'method' => $method,
                            'endpoint' => $endpoint,
                            'attempt' => $attempt,
                            'status' => $response->status(),
                        ]);

                        continue;
                    }

                    Log::error('Zoho Help API server error - max retries exceeded', [
                        'method' => $method,
                        'endpoint' => $endpoint,
                        'error_code' => $response->json('errorCode') ?? null,
                        'status_code' => $response->status(),
                    ]);

                    return null;
                }

                // Unknown error
                Log::error('Zoho Help API unknown error', [
                    'method' => $method,
                    'endpoint' => $endpoint,
                    'error_code' => $response->json('errorCode') ?? null,
                    'status_code' => $response->status(),
                ]);

                return null;
            } catch (\Exception $e) {
                $attempt++;
                if ($attempt < $this->maxRetries) {
                    $delay = pow(2, $attempt) * 100000;
                    usleep($delay);

                    Log::warning('Zoho Help API request exception, retrying', [
                        'method' => $method,
                        'endpoint' => $endpoint,
                        'attempt' => $attempt,
                        'error' => $e->getMessage(),
                    ]);

                    continue;
                }

                throw $e;
            }
        }

        return null;
    }

    /**
     * Get HTTP headers for Zoho Desk API requests.
     *
     * @throws \RuntimeException If unable to obtain access token
     */
    private function getHeaders(): array
    {
        $accessToken = $this->oauthService->getAccessToken();

        if (! $accessToken) {
            throw new \RuntimeException('Unable to obtain Zoho Desk access token');
        }

        return [
            'Authorization' => "Zoho-oauthtoken {$accessToken}",
            'orgId' => $this->orgId,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }

    /**
     * Map internal status to Zoho Help status.
     */
    private function mapStatusToZohoHelp(string $status): string
    {
        return match ($status) {
            'open' => 'Open',
            'in_progress' => 'In Progress',
            'waiting_for_response' => 'Waiting on Customer',
            'resolved' => 'Resolved',
            'closed' => 'Closed',
            default => 'Open',
        };
    }

    /**
     * Map Zoho Help status to internal status.
     */
    private function mapStatusFromZohoHelp(string $status): string
    {
        return match ($status) {
            'Open' => 'open',
            'In Progress' => 'in_progress',
            'Waiting on Customer' => 'waiting_for_response',
            'Resolved' => 'resolved',
            'Closed' => 'closed',
            default => 'open',
        };
    }

    /**
     * Map internal priority to Zoho Help priority.
     */
    private function mapPriorityToZohoHelp(string $priority): string
    {
        return match ($priority) {
            'low' => 'Low',
            'medium' => 'Medium',
            'high' => 'High',
            'urgent' => 'Critical',
            default => 'Medium',
        };
    }

    /**
     * Map Zoho Help priority to internal priority.
     */
    private function mapPriorityFromZohoHelp(string $priority): string
    {
        return match ($priority) {
            'Low' => 'low',
            'Medium' => 'medium',
            'High' => 'high',
            'Critical' => 'urgent',
            default => 'medium',
        };
    }

    /**
     * Map internal category to Zoho Help category.
     */
    private function mapCategoryToZohoHelp(string $category): string
    {
        return match ($category) {
            'technical' => 'Technical Issue',
            'billing' => 'Billing Query',
            'general' => 'General Inquiry',
            'application_query' => 'Application Support',
            default => 'General Inquiry',
        };
    }

    /**
     * Format ticket response from Zoho Desk to internal format.
     *
     * Per SAMAR-ZOHODESK documentation, custom fields are returned in the 'cf' object.
     */
    private function formatTicketResponse(array $ticket): array
    {
        // Extract custom fields from 'cf' object (Zoho Desk response format)
        $cf = $ticket['cf'] ?? [];

        return [
            'id' => $ticket['id'] ?? null,
            'ticket_number' => $ticket['ticketNumber'] ?? null,
            'subject' => $ticket['subject'] ?? '',
            'description' => $ticket['description'] ?? '',
            'status' => $this->mapStatusFromZohoHelp($ticket['status'] ?? 'Open'),
            'priority' => $this->mapPriorityFromZohoHelp($ticket['priority'] ?? 'Medium'),
            'channel' => $ticket['channel'] ?? null,
            'department_id' => $ticket['departmentId'] ?? null,
            'created_at' => $ticket['createdTime'] ?? null,
            'updated_at' => $ticket['modifiedTime'] ?? null,
            'closed_at' => $ticket['closedTime'] ?? null,
            'due_date' => $ticket['dueDate'] ?? null,
            'contact' => [
                'id' => $ticket['contactId'] ?? null,
                'email' => $ticket['email'] ?? null,
                'phone' => $ticket['phone'] ?? null,
            ],
            'assignee' => [
                'id' => $ticket['assigneeId'] ?? null,
                'email' => $ticket['assignee']['email'] ?? null,
                'name' => $ticket['assignee']['name'] ?? null,
            ],
            // NDIE Department custom fields (per SAMAR-ZOHODESK documentation)
            'custom_fields' => [
                'user_role' => $cf['cf_user_role'] ?? null,
                'organisation_id' => $cf['cf_organisation_id'] ?? null,
                'organisation_name' => $cf['cf_organisation_name'] ?? null,
                'issue_category' => $cf['cf_issue_category'] ?? null,
                'issue_type' => $cf['cf_issue_type'] ?? null,
                'issue_sub_category' => $cf['cf_issue_sub_category'] ?? null,
                'udyam_number' => $cf['cf_udyam_number'] ?? null,
            ],
            'web_url' => $ticket['webUrl'] ?? null,
        ];
    }
}
