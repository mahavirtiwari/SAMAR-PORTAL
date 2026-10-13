<?php

namespace App\Services\SupportPlatforms;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Zoho OAuth 2.0 Service for managing access tokens.
 *
 * Handles automatic token refresh using the refresh token grant type.
 * Access tokens are cached to minimize API calls to Zoho's auth server.
 *
 * @see https://www.zoho.com/accounts/protocol/oauth/use-refresh-token.html
 */
class ZohoOAuthService
{
    private const CACHE_KEY = 'zoho_desk_access_token';

    private const TOKEN_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry

    private string $clientId;

    private string $clientSecret;

    private string $refreshToken;

    private string $tokenUrl;

    public function __construct()
    {
        $oauth = config('services.zoho_desk.oauth', []);

        $this->clientId = $oauth['client_id'] ?? '';
        $this->clientSecret = $oauth['client_secret'] ?? '';
        $this->refreshToken = $oauth['refresh_token'] ?? '';
        $this->tokenUrl = $oauth['token_url'] ?? 'https://accounts.zoho.in/oauth/v2/token';
    }

    /**
     * Get a valid access token, refreshing if necessary.
     *
     * @return string|null The access token, or null if unable to obtain one
     */
    public function getAccessToken(): ?string
    {
        // Check if we have required credentials
        if (! $this->hasValidCredentials()) {
            Log::warning('Zoho OAuth credentials not configured');

            return null;
        }

        // Try to get cached token
        $cachedToken = Cache::get(self::CACHE_KEY);
        if ($cachedToken) {
            return $cachedToken;
        }

        // Refresh the token
        return $this->refreshAccessToken();
    }

    /**
     * Refresh the access token using the refresh token.
     *
     * @return string|null The new access token, or null on failure
     */
    public function refreshAccessToken(): ?string
    {
        if (! $this->hasValidCredentials()) {
            Log::error('Cannot refresh Zoho access token: missing credentials');

            return null;
        }

        try {
            $http = Http::asForm()->timeout(30);

            // Disable SSL verification in local development (Laragan SSL certificate issue)
            if (app()->environment('local', 'development')) {
                $http = $http->withOptions(['verify' => false]);
            }

            $response = $http->post($this->tokenUrl, [
                'grant_type' => 'refresh_token',
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'refresh_token' => $this->refreshToken,
            ]);

            if ($response->successful()) {
                $data = $response->json();

                if (isset($data['access_token'])) {
                    $accessToken = $data['access_token'];
                    $expiresIn = $data['expires_in'] ?? 3600; // Default 1 hour

                    // Cache the token (with buffer time before expiry)
                    $cacheDuration = max(60, $expiresIn - self::TOKEN_BUFFER_SECONDS);
                    Cache::put(self::CACHE_KEY, $accessToken, $cacheDuration);

                    Log::info('Zoho access token refreshed successfully', [
                        'expires_in' => $expiresIn,
                        'cached_for' => $cacheDuration,
                    ]);

                    return $accessToken;
                }

                Log::error('Zoho OAuth response missing access_token', [
                    'response' => $data,
                ]);

                return null;
            }

            // Handle specific error responses
            $errorData = $response->json();
            $errorCode = $errorData['error'] ?? 'unknown';

            Log::error('Failed to refresh Zoho access token', [
                'status' => $response->status(),
                'error' => $errorCode,
                'error_description' => $errorData['error_description'] ?? null,
            ]);

            // If refresh token is invalid, clear cache and notify
            if ($errorCode === 'invalid_code' || $errorCode === 'invalid_client') {
                Cache::forget(self::CACHE_KEY);
                Log::critical('Zoho refresh token may be invalid or expired. Manual intervention required.');
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Exception refreshing Zoho access token', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Check if OAuth credentials are configured.
     */
    public function hasValidCredentials(): bool
    {
        return ! empty($this->clientId)
            && ! empty($this->clientSecret)
            && ! empty($this->refreshToken);
    }

    /**
     * Clear the cached access token (useful for testing or forced refresh).
     */
    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
        Log::info('Zoho access token cache cleared');
    }

    /**
     * Test the OAuth configuration by attempting to get an access token.
     *
     * @return array{success: bool, message: string, token_preview?: string}
     */
    public function testConnection(): array
    {
        if (! $this->hasValidCredentials()) {
            return [
                'success' => false,
                'message' => 'OAuth credentials not configured. Please set ZOHO_DESK_CLIENT_ID, ZOHO_DESK_CLIENT_SECRET, and ZOHO_DESK_REFRESH_TOKEN.',
            ];
        }

        // Force refresh to test credentials
        $this->clearCache();
        $token = $this->refreshAccessToken();

        if ($token) {
            return [
                'success' => true,
                'message' => 'OAuth connection successful.',
                'token_preview' => substr($token, 0, 20).'...',
            ];
        }

        return [
            'success' => false,
            'message' => 'Failed to obtain access token. Check credentials and refresh token validity.',
        ];
    }
}
