<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SecurityHeaders Middleware
 *
 * Adds security headers to all responses to protect against common web vulnerabilities
 */
class SecurityHeaders
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Strict-Transport-Security (HSTS) - Force HTTPS for 1 year, including subdomains, with preload
        $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

        // X-Content-Type-Options - Prevent MIME type sniffing
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // X-Frame-Options - Prevent clickjacking
        $response->headers->set('X-Frame-Options', 'DENY');

        // X-XSS-Protection - Disabled (deprecated, can introduce vulnerabilities in older browsers)
        $response->headers->set('X-XSS-Protection', '0');

        // Referrer-Policy - Control referrer information
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Content-Security-Policy - Use relaxed policy for Swagger UI in dev only, strict policy for all other routes
        if (app()->environment(['local', 'development']) && ($request->is('docs/*') || $request->is('api/documentation*'))) {
            // Relaxed CSP required for Swagger UI (uses inline scripts/styles and eval)
            $csp = implode('; ', [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data:",
                "font-src 'self' data:",
                "connect-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "object-src 'none'",
            ]);
        } else {
            // Strict CSP for all API routes
            $csp = implode('; ', [
                "default-src 'none'",
                "script-src 'self'",
                "style-src 'self'",
                "img-src 'self' data:",
                "font-src 'self'",
                "connect-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "object-src 'none'",
                "worker-src 'none'",
                "media-src 'none'",
                'upgrade-insecure-requests',
            ]);
        }
        $response->headers->set('Content-Security-Policy', $csp);

        // Permissions-Policy (formerly Feature-Policy)
        $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), serial=(), bluetooth=(), display-capture=()');

        // X-Permitted-Cross-Domain-Policies - Prevent Adobe Flash/PDF cross-domain requests
        $response->headers->set('X-Permitted-Cross-Domain-Policies', 'none');

        // Cross-Origin-Embedder-Policy - Prevent cross-origin resource loading without explicit permission
        $response->headers->set('Cross-Origin-Embedder-Policy', 'require-corp');

        // Cross-Origin-Opener-Policy - Isolate browsing context from cross-origin documents
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');

        // Cross-Origin-Resource-Policy - Prevent cross-origin resource inclusion
        $response->headers->set('Cross-Origin-Resource-Policy', 'same-origin');

        // Remove headers that expose server implementation details.
        // `Server` is not removable here — nginx sets its own after PHP responds;
        // it is suppressed to a bare "nginx" by `server_tokens off` in the site config.
        $response->headers->remove('X-Powered-By');

        return $response;
    }
}
