<?php

namespace App\Services\BusinessCentral;

use App\Contracts\BusinessCentralClientInterface;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * HTTP client for Microsoft Dynamics 365 Business Central OData v4 endpoints.
 *
 * Endpoint shape:
 *   {base_url}/{tenant_id}/{environment}/ODataV4/Company('{company}')/{action}
 */
class BusinessCentralClient implements BusinessCentralClientInterface
{
    private bool $enabled;

    private string $baseUrl;

    private string $tenantId;

    private string $environment;

    private string $company;

    public function __construct(private BusinessCentralOAuthService $oauth)
    {
        $config = config('services.business_central', []);

        $this->enabled = (bool) ($config['enabled'] ?? false);
        $this->baseUrl = rtrim($config['base_url'] ?? 'https://api.businesscentral.dynamics.com/v2.0', '/');
        $this->tenantId = $config['tenant_id'] ?? '';
        $this->environment = $config['environment'] ?? '';
        $this->company = $config['company'] ?? '';
    }

    public function isEnabled(): bool
    {
        return $this->enabled && $this->oauth->hasValidCredentials();
    }

    public function getCompanies(): array
    {
        return $this->request('get', $this->environmentUrl().'/Company')['value'] ?? [];
    }

    public function testConnection(): array
    {
        $token = $this->oauth->requestNewToken();
        if ($token === null) {
            return [
                'success' => false,
                'message' => 'Failed to obtain access token. Check BC_TENANT_ID / BC_CLIENT_ID / BC_CLIENT_SECRET.',
            ];
        }

        try {
            $response = $this->httpWithToken($token['access_token'])
                ->get($this->environmentUrl().'/Company');

            if (! $response->successful()) {
                return [
                    'success' => false,
                    'message' => "Token acquired, but company list failed (HTTP {$response->status()}).",
                    'token_preview' => substr($token['access_token'], 0, 20).'...',
                ];
            }

            $companies = $response->json()['value'] ?? [];
            $names = array_map(static fn ($c) => $c['Name'] ?? '', $companies);
            $found = in_array($this->company, $names, true);

            return [
                'success' => true,
                'message' => $found
                    ? "Connected. Company '{$this->company}' found in environment '{$this->environment}'."
                    : "Connected, but configured company '{$this->company}' was not found. Available: ".implode(', ', $names),
                'company' => $this->company,
                'token_preview' => substr($token['access_token'], 0, 20).'...',
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'Exception reaching Business Central: '.$e->getMessage(),
            ];
        }
    }

    public function processCustomer(array $payload): array
    {
        return $this->postEntity('ProcessCustomer', $payload);
    }

    public function processInvoice(array $payload): array
    {
        return $this->postEntity('ProcessInvoice', $payload);
    }

    public function processReceipt(array $payload): array
    {
        return $this->postEntity('ProcessReceipt', $payload);
    }

    public function findProcessCustomerByReference(string $referenceNo): ?array
    {
        return $this->findFirst('ProcessCustomer', "Reference_No eq '".$this->escapeODataString($referenceNo)."'");
    }

    public function findProcessInvoiceByTadaReference(string $tadaInvoiceNo): ?array
    {
        return $this->findFirst('ProcessInvoice', "TADA_Invoice_No eq '".$this->escapeODataString($tadaInvoiceNo)."'");
    }

    public function findProcessReceiptByOrderId(string $orderId): ?array
    {
        return $this->findFirst('ProcessReceipt', "Order_ID eq '".$this->escapeODataString($orderId)."'");
    }

    public function getProcessRecord(string $entity, int $entryNo): ?array
    {
        $response = $this->httpWithToken($this->requireToken())
            ->get($this->companyUrl()."/{$entity}({$entryNo})");

        if ($response->status() === 404) {
            return null;
        }

        if (! $response->successful()) {
            $this->failed('read', $entity, $response, $entryNo);
        }

        return $response->json();
    }

    public function patchProcessRecord(string $entity, int $entryNo, array $payload): array
    {
        $response = $this->httpWithToken($this->requireToken())
            ->withHeaders(['If-Match' => '*'])
            ->patch($this->companyUrl()."/{$entity}({$entryNo})", $payload);

        if (! $response->successful()) {
            $this->failed('patch', $entity, $response, $entryNo);
        }

        return $response->json();
    }

    private function postEntity(string $entity, array $payload): array
    {
        $response = $this->httpWithToken($this->requireToken())
            ->post($this->companyUrl().'/'.$entity, $payload);

        if (! $response->successful()) {
            $this->failed('insert', $entity, $response);
        }

        return $response->json();
    }

    private function findFirst(string $entity, string $filter): ?array
    {
        $response = $this->httpWithToken($this->requireToken())
            ->get($this->companyUrl().'/'.$entity, ['$filter' => $filter, '$top' => 1]);

        if (! $response->successful()) {
            $this->failed('lookup', $entity, $response);
        }

        return $response->json()['value'][0] ?? null;
    }

    /**
     * Log a Business Central failure and throw with a message safe to propagate.
     *
     * The response body used to be interpolated into the exception message. That
     * message travels further than it looks: into the logs, the DB error-log table,
     * and the production email alert. A BC error body can carry customer records
     * and ERP internals, so it stays in the log context here and never rides the
     * exception.
     */
    private function failed(string $operation, string $entity, Response $response, ?int $entryNo = null): never
    {
        $target = $entryNo === null ? $entity : "{$entity}({$entryNo})";

        Log::error('Business Central request failed', [
            'operation' => $operation,
            'entity' => $target,
            'status' => $response->status(),
            'body' => mb_substr($response->body(), 0, 300),
        ]);

        throw new \RuntimeException("BC {$target} {$operation} failed (HTTP {$response->status()}).");
    }

    private function requireToken(): string
    {
        $token = $this->oauth->getAccessToken();
        if ($token === null) {
            throw new \RuntimeException('Business Central access token could not be acquired.');
        }

        return $token;
    }

    private function escapeODataString(string $value): string
    {
        return str_replace("'", "''", $value);
    }

    private function companyUrl(): string
    {
        return $this->environmentUrl()."/Company('".rawurlencode($this->company)."')";
    }

    private function environmentUrl(): string
    {
        return "{$this->baseUrl}/{$this->tenantId}/{$this->environment}/ODataV4";
    }

    /**
     * Pending HTTP request pre-authenticated with the given bearer token.
     */
    private function httpWithToken(string $token): PendingRequest
    {
        $http = Http::withToken($token)->timeout(30);

        // Local Windows PHP often lacks a configured CA bundle; deployed
        // (Azure/Linux) environments verify TLS normally.
        if (app()->environment('local')) {
            $http = $http->withOptions(['verify' => false]);
        }

        return $http;
    }

    /**
     * Authenticated OData request using the cached token. Returns decoded JSON,
     * or an empty array on failure (details are logged).
     *
     * @return array<string, mixed>
     */
    private function request(string $method, string $url, array $payload = []): array
    {
        $token = $this->oauth->getAccessToken();
        if ($token === null) {
            Log::error('Business Central request aborted: no access token');

            return [];
        }

        $http = $this->httpWithToken($token);

        $response = strtolower($method) === 'get'
            ? $http->get($url)
            : $http->send(strtoupper($method), $url, ['json' => $payload]);

        if (! $response->successful()) {
            Log::error('Business Central request failed', [
                'method' => $method,
                'url' => $url,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [];
        }

        return $response->json() ?? [];
    }
}
