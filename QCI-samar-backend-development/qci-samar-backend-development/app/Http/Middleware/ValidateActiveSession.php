<?php

namespace App\Http\Middleware;

use App\Models\Session;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ValidateActiveSession Middleware
 *
 * Checks if the current JWT token has an active session in the database.
 * This enables concurrent login detection - when a user logs in on another
 * device, the previous session is terminated and this middleware will
 * reject requests with the old token.
 */
class ValidateActiveSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        // Extract the bearer token from the request
        $token = $request->bearerToken();

        if (! $token) {
            return $next($request);
        }

        // Find the session for this token
        $session = Session::forToken($token)
            ->where('user_id', $user->id)
            ->where('token_type', 'access')
            ->first();

        // If no session record found, allow the request (backwards compatibility)
        if (! $session) {
            return $next($request);
        }

        // Check if session has been terminated (e.g., by new login on another device)
        if (! $session->is_active) {
            $message = match ($session->termination_reason) {
                Session::TERMINATION_NEW_SESSION => 'Your session was terminated because you logged in on another device.',
                Session::TERMINATION_FORCED => 'Your session was terminated by an administrator.',
                Session::TERMINATION_PASSWORD_RESET => 'Your session was terminated because your password was changed.',
                Session::TERMINATION_SPOC_CHANGED => 'Your session was terminated because the contact person for this unit was changed.',
                default => 'Your session has been terminated.',
            };

            return response()->json([
                'success' => false,
                'message' => $message,
                'error_code' => 'SESSION_TERMINATED',
            ], 401);
        }

        // Check if session has expired
        if ($session->isExpired()) {
            $session->terminate(Session::TERMINATION_EXPIRED);

            return response()->json([
                'success' => false,
                'message' => 'Your session has expired. Please log in again.',
                'error_code' => 'SESSION_EXPIRED',
            ], 401);
        }

        // Session is valid - update last activity
        $session->updateActivity();

        return $next($request);
    }
}
