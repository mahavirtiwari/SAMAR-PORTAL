<?php

namespace App\Http\Middleware;

use App\Models\Role;
use App\Models\SystemSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckMaintenanceMode
{
    /**
     * Roles that are allowed to bypass maintenance mode.
     * Only system admin should have access during maintenance.
     */
    protected array $allowedRoles = [
        Role::SYSTEM_ADMIN,
    ];

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! SystemSetting::isMaintenanceMode()) {
            return $next($request);
        }

        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        $userRoles = $user->activeRoles->pluck('slug')->toArray();
        $isAllowedRole = ! empty(array_intersect($userRoles, $this->allowedRoles));

        // Only allowed roles (system_admin) can bypass maintenance mode
        // All other roles should see maintenance page
        if (! $isAllowedRole) {
            return response()->json([
                'success' => false,
                'message' => 'System is currently under maintenance. Please try again later.',
                'error_code' => 'MAINTENANCE_MODE',
                'maintenance' => true,
            ], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        return $next($request);
    }
}
