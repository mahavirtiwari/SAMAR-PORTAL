<?php

namespace App\Contracts;

interface SupportPlatformInterface
{
    /**
     * Create a new ticket in the external platform.
     *
     * @param  array  $data  Ticket data (subject, description, priority, category, user info, etc.)
     * @return string|null External ticket ID on success, null on failure
     */
    public function createTicket(array $data): ?string;

    /**
     * Update an existing ticket in the external platform.
     *
     * @param  string  $externalId  External ticket ID
     * @param  array  $data  Updated ticket data
     * @return bool Success status
     */
    public function updateTicket(string $externalId, array $data): bool;

    /**
     * Add a comment to a ticket in the external platform.
     *
     * @param  string  $externalId  External ticket ID
     * @param  string  $comment  Comment text
     * @param  bool  $isInternal  Whether the comment is internal
     * @return string|null External comment ID on success, null on failure
     */
    public function addComment(string $externalId, string $comment, bool $isInternal = false): ?string;

    /**
     * Get ticket status from the external platform.
     *
     * @param  string  $externalId  External ticket ID
     * @return array Ticket status data (status, priority, assigned_to, etc.)
     */
    public function getTicketStatus(string $externalId): array;

    /**
     * Sync ticket data from the external platform.
     *
     * @param  string  $externalId  External ticket ID
     * @return array Complete ticket data from external platform
     */
    public function syncTicket(string $externalId): array;

    /**
     * Close a ticket in the external platform.
     *
     * @param  string  $externalId  External ticket ID
     * @param  string|null  $resolution  Resolution text
     * @return bool Success status
     */
    public function closeTicket(string $externalId, ?string $resolution = null): bool;

    /**
     * Assign a ticket to a user in the external platform.
     *
     * @param  string  $externalId  External ticket ID
     * @param  string  $agentEmail  Agent email address
     * @return bool Success status
     */
    public function assignTicket(string $externalId, string $agentEmail): bool;

    /**
     * Get the platform name.
     *
     * @return string Platform name (e.g., 'zoho_desk', 'zendesk', etc.)
     */
    public function getPlatformName(): string;

    /**
     * Check if the platform integration is enabled.
     */
    public function isEnabled(): bool;

    /**
     * Get a single ticket from the external platform.
     *
     * @param  string  $externalId  External ticket ID
     * @return array|null Ticket data or null if not found
     */
    public function getTicket(string $externalId): ?array;

    /**
     * List tickets from the external platform with optional filters.
     *
     * @param  array  $filters  Filter parameters (status, priority, category, search, pagination, etc.)
     * @return array List of tickets with pagination metadata
     */
    public function listTickets(array $filters = []): array;

    /**
     * Get comments/threads for a ticket from the external platform.
     *
     * @param  string  $externalId  External ticket ID
     * @return array List of comments
     */
    public function getTicketComments(string $externalId): array;

    /**
     * Add an attachment to a ticket in the external platform.
     *
     * @param  string  $externalId  External ticket ID
     * @param  string  $filePath  Local file path
     * @param  string  $filename  Display filename
     * @return bool Success status
     */
    public function addAttachment(string $externalId, string $filePath, string $filename): bool;

    /**
     * Test connection to the external platform.
     *
     * @return bool Connection success status
     */
    public function testConnection(): bool;
}
