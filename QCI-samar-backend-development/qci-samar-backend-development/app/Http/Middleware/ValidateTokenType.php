<?php

namespace App\Http\Middleware;

use App\Models\Session;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ValidateTokenType Middleware
 *
 * Validates that the JWT token is of the expected type (access vs refresh)
 */
class ValidateTokenType
{
    /**
     * Handle an incoming request.
     *
     * @param  string  $expectedType  The expected token type: 'access' or 'refresh'
     */
    public function handle(Request $request, Closure $next, string $expectedType = 'access'): Response
    {
        // If expecting a refresh token, validate it from the request body
        if ($expectedType === 'refresh') {
            return $this->validateRefreshToken($request, $next);
        }

        // If expecting an access token, ensure no refresh token is being used
        if ($expectedType === 'access') {
            return $this->validateAccessToken($request, $next);
        }

        return response()->json([
            'success' => false,
            'message' => 'Invalid token type specified in middleware.',
        ], 500);
    }

    /**
     * Validate that the request contains a valid refresh token.
     */
    private function validateRefreshToken(Request $request, Closure $next): Response
    {
        $refreshToken = $request->input('refresh_token');

        if (! $refreshToken) {
            return response()->json([
                'success' => false,
                'message' => 'Refresh token is required.',
            ], 401);
        }

        // Check if the token exists in the sessions table as a refresh token
        $session = Session::forToken($refreshToken)
            ->where('token_type', 'refresh')
            ->where('is_active', true)
            ->where('expires_at', '>', now())
            ->first();

        if (! $session) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired refresh token.',
            ], 401);
        }

        return $next($request);
    }

    /**
     * Validate that the request is using an access token (JWT), not a refresh token.
     */
    private function validateAccessToken(Request $request, Closure $next): Response
    {
        // Get the Authorization header
        $authHeader = $request->header('Authorization');

        if (! $authHeader) {
            return response()->json([
                'success' => false,
                'message' => 'Authorization header is missing.',
            ], 401);
        }

        // Extract the token from "Bearer <token>"
        $token = null;
        if (preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
            $token = $matches[1];
        }

        if (! $token) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid authorization token format.',
            ], 401);
        }

        // Check if this token is a refresh token (which should NOT be used for regular API calls)
        // Looked up by the indexed token hash (see Session::scopeForToken).
        $isRefreshToken = Session::forToken($token)
            ->where('token_type', 'refresh')
            ->exists();

        if ($isRefreshToken) {
            return response()->json([
                'success' => false,
                'message' => 'Refresh tokens cannot be used for API requests. Please use an access token.',
            ], 403);
        }

        return $next($request);
    }
}
