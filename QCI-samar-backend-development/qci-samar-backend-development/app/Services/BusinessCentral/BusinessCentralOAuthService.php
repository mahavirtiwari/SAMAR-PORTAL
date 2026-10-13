<?php

namespace App\Services\BusinessCentral;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Azure AD OAuth 2.0 (client-credentials) token service for Microsoft
 * Dynamics 365 Business Central.
 *
 * Access tokens are cached to minimise calls to the Azure AD token endpoint,
 * refreshed a short buffer before expiry.
 */
class BusinessCentralOAuthService
{
    private const CACHE_KEY = 'business_central_access_token';

    private const TOKEN_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry

    private string $tenantId;

    private string $clientId;

    private string $clientSecret;

    private string $tokenUrl;

    private string $scope;

    public function __construct()
    {
        $config = config('services.business_central', []);

        $this->tenantId = $config['tenant_id'] ?? '';
        $this->clientId = $config['client_id'] ?? '';
        $this->clientSecret = $config['client_secret'] ?? '';
        $this->scope = $config['scope'] ?? 'https://api.businesscentral.dynamics.com/.default';
        $this->tokenUrl = ($config['token_url'] ?? null)
            ?: ($this->tenantId !== ''
                ? "https://login.microsoftonline.com/{$this->tenantId}/oauth2/v2.0/token"
                : '');
    }

    /**
     * Get a valid access token, using the cache and refreshing when needed.
     */
    public function getAccessToken(): ?string
    {
        if (! $this->hasValidCredentials()) {
            Log::warning('Business Central OAuth credentials not configured');

            return null;
        }

        $cached = Cache::get(self::CACHE_KEY);
        if ($cached) {
            return $cached;
        }

        $token = $this->requestNewToken();
        if ($token === null) {
            return null;
        }

        $cacheDuration = max(60, $token['expires_in'] - self::TOKEN_BUFFER_SECONDS);
        Cache::put(self::CACHE_KEY, $token['access_token'], $cacheDuration);

        Log::info('Business Central access token obtained', [
            'expires_in' => $token['expires_in'],
            'cached_for' => $cacheDuration,
        ]);

        return $token['access_token'];
    }

    /**
     * Request a fresh token directly from Azure AD. Does NOT read or write the
     * cache, so it is safe to call when the cache store (DB) is unavailable —
     * this is what the connection test uses to validate credentials in isolation.
     *
     * @return array{access_token: string, expires_in: int}|null
     */
    public function requestNewToken(): ?array
    {
        if (! $this->hasValidCredentials()) {
            Log::error('Cannot request Business Central token: missing credentials');

            return null;
        }

        try {
            $http = Http::asForm()->timeout(30);

            // Local Windows PHP often lacks a configured CA bundle; deployed
            // (Azure/Linux) environments verify TLS normally.
            if (app()->environment('local')) {
                $http = $http->withOptions(['verify' => false]);
            }

            $response = $http->post($this->tokenUrl, [
                'grant_type' => 'client_credentials',
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'scope' => $this->scope,
            ]);

            if ($response->successful()) {
                $data = $response->json();

                if (isset($data['access_token'])) {
                    return [
                        'access_token' => $data['access_token'],
                        'expires_in' => (int) ($data['expires_in'] ?? 3600),
                    ];
                }

                Log::error('Business Central OAuth response missing access_token', [
                    'response' => $data,
                ]);

                return null;
            }

            $errorData = $response->json() ?? [];
            Log::error('Failed to obtain Business Central access token', [
                'status' => $response->status(),
                'error' => $errorData['error'] ?? 'unknown',
                'error_description' => $errorData['error_description'] ?? null,
            ]);

            return null;
        } catch (\Throwable $e) {
            Log::error('Exception obtaining Business Central access token', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Whether all required OAuth credentials are present.
     */
    public function hasValidCredentials(): bool
    {
        return $this->tenantId !== ''
            && $this->clientId !== ''
            && $this->clientSecret !== ''
            && $this->tokenUrl !== '';
    }

    /**
     * Clear the cached access token (forces a refresh on next use).
     */
    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
