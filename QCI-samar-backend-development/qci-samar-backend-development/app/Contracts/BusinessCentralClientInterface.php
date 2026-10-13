<?php

namespace App\Contracts;

interface BusinessCentralClientInterface
{
    /**
     * Whether the BC integration is enabled and has valid credentials.
     */
    public function isEnabled(): bool;

    /**
     * List companies in the configured BC environment.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getCompanies(): array;

    /**
     * Validate end-to-end connectivity: acquire a token and reach the configured
     * company. Deliberately independent of the cache store so it can run before
     * the app's DB/cache is provisioned.
     *
     * @return array{success: bool, message: string, company?: string, token_preview?: string}
     */
    public function testConnection(): array;

    /**
     * Insert into the BC staging tables. Each returns the created entity
     * (including the ERP-assigned Entry_No) and throws \RuntimeException on
     * any non-2xx response, carrying BC's error body.
     *
     * @return array<string, mixed>
     */
    public function processCustomer(array $payload): array;

    /**
     * @return array<string, mixed>
     */
    public function processInvoice(array $payload): array;

    /**
     * @return array<string, mixed>
     */
    public function processReceipt(array $payload): array;

    /**
     * Lookups by the portal-side key — the duplicate guards. BC does not
     * de-duplicate inserts, so a push must adopt/patch an existing staging row
     * instead of posting again.
     *
     * @return array<string, mixed>|null
     */
    public function findProcessCustomerByReference(string $referenceNo): ?array;

    /**
     * @return array<string, mixed>|null
     */
    public function findProcessInvoiceByTadaReference(string $tadaInvoiceNo): ?array;

    /**
     * Receipts de-duplicate on Order_ID (unique per payment); UTR_No is the
     * gateway reference and may be blank or non-unique, so it is not a safe key.
     *
     * @return array<string, mixed>|null
     */
    public function findProcessReceiptByOrderId(string $orderId): ?array;

    /**
     * Read a staging row by Entry_No. Returns null on 404 (row consumed by the
     * ERP after processing); throws on other failures.
     *
     * @return array<string, mixed>|null
     */
    public function getProcessRecord(string $entity, int $entryNo): ?array;

    /**
     * Update an existing staging row (verified supported: PATCH returns 200).
     *
     * @return array<string, mixed>
     */
    public function patchProcessRecord(string $entity, int $entryNo, array $payload): array;
}
