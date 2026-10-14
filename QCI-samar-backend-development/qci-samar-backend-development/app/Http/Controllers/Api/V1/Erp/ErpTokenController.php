<?php

namespace App\Http\Controllers\Api\V1\Erp;

use App\Http\Controllers\Controller;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use OpenApi\Attributes as OA;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

class ErpTokenController extends Controller
{
    public function __construct(private AuthService $authService) {}

    /**
     * Token endpoint for Business Central's document-sync codeunit.
     *
     * The request contract is fixed by QCI's vendor reference document:
     * { userName, password, grant_type: "password", refreshToken: "" }.
     * userName must identify the ERP service account (SAMAR ID or email);
     * authentication and session handling reuse the standard login flow. The
     * response carries the token under several common key spellings because the
     * exact field BC's parser reads is not published.
     */
    #[OA\Post(
        path: '/api/v1/erp/tokens',
        summary: 'Issue an access token for the ERP document-sync caller',
        tags: ['ERP Integration'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['userName', 'password'],
                properties: [
                    new OA\Property(
                        property: 'userName',
                        type: 'string',
                        description: 'ERP service account (SAMAR ID or email)',
                    ),
                    new OA\Property(property: 'password', type: 'string'),
                    new OA\Property(
                        property: 'grant_type',
                        type: 'string',
                        example: 'password',
                        description: 'Accepted for compatibility; ignored',
                    ),
                    new OA\Property(
                        property: 'refreshToken',
                        type: 'string',
                        example: '',
                        description: 'Accepted for compatibility; ignored',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Token issued'),
            new OA\Response(response: 401, description: 'Invalid credentials'),
        ],
    )]
    public function token(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'userName' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $inbound = config('services.business_central.inbound', []);
        $known = array_filter([
            strtolower($inbound['samar_id'] ?? ''),
            strtolower($inbound['email'] ?? ''),
        ]);

        if (! in_array(strtolower($validated['userName']), $known, true)) {
            Log::warning('ERP token request for unknown userName');

            return response()->json(['success' => false, 'message' => 'Invalid credentials.'], 401);
        }

        // Machine callers cannot re-authenticate mid-batch, so this account gets
        // its own token lifetime instead of the short global jwt.ttl that human
        // sessions use. Overriding the config here scopes the change to this
        // request: AuthService reads jwt.ttl for both the JWT and the session
        // row's expires_at, and the JWT factory is re-pointed to match.
        $ttlMinutes = (int) ($inbound['token_ttl_minutes'] ?? 1440);
        config(['jwt.ttl' => $ttlMinutes]);
        JWTAuth::factory()->setTTL($ttlMinutes);

        try {
            $result = $this->authService->login($inbound['samar_id'], $validated['password'], [
                'device_type' => 'web',
                'device_id' => 'bc-erp-document-sync',
                'device_name' => 'Business Central Document Sync',
            ]);
        } catch (\Exception $e) {
            Log::warning('ERP token request failed authentication', ['error' => $e->getMessage()]);

            return response()->json(['success' => false, 'message' => 'Invalid credentials.'], 401);
        }

        if (empty($result['access_token'])) {
            // 2FA unexpectedly enabled on the service account — a machine caller
            // cannot complete an OTP flow, so fail loudly instead of half-logging-in.
            Log::error('ERP token request hit the OTP path; disable 2FA on the service account');

            return response()->json(['success' => false, 'message' => 'Service account misconfigured.'], 500);
        }

        $token = $result['access_token'];

        return response()->json([
            'success' => true,
            'token' => $token,
            'access_token' => $token,
            'accessToken' => $token,
            'token_type' => 'Bearer',
            'expires_in' => $result['expires_in'],
            'refreshToken' => $result['refresh_token'],
            'refresh_token' => $result['refresh_token'],
        ]);
    }
}
