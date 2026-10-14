<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Dashboards', description: 'Role-specific dashboard endpoints')]
class DashboardController extends Controller
{
    /**
     * Dashboard service instance.
     */
    protected DashboardService $dashboardService;

    /**
     * Constructor.
     */
    public function __construct(DashboardService $dashboardService)
    {
        $this->dashboardService = $dashboardService;
    }

    #[OA\Get(
        path: '/api/v1/dashboards/ea',
        summary: 'Get Enterprise Admin dashboard',
        tags: ['Dashboard', 'Enterprise Admin - Dashboard'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Enterprise Admin dashboard retrieved successfully'),
            new OA\Response(response: 403, description: 'Forbidden - User must have enterprise_admin role'),
        ],
    )]
    public function enterpriseAdmin(): JsonResponse
    {
        try {
            $user = Auth::user();

            if (! $user->hasRole('enterprise_admin')) {
                return $this->errorResponse('Unauthorized to access this dashboard', 403);
            }

            $data = $this->dashboardService->getEnterpriseAdminDashboard($user);

            return $this->successResponse($data, 'Enterprise Admin dashboard retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to load Enterprise Admin dashboard');
        }
    }

    #[OA\Get(
        path: '/api/v1/dashboards/om',
        summary: 'Get Operations Manager dashboard',
        tags: ['Dashboard', 'Operations Manager - Dashboard'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Operations Manager dashboard retrieved successfully'),
            new OA\Response(response: 403, description: 'Forbidden - User must have operations_manager role'),
        ],
    )]
    public function operationsManager(): JsonResponse
    {
        try {
            $user = Auth::user();

            if (! $user->hasRole('operations_manager')) {
                return $this->errorResponse('Unauthorized to access this dashboard', 403);
            }

            $data = $this->dashboardService->getOperationsManagerDashboard($user);

            return $this->successResponse($data, 'Operations Manager dashboard retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to load Operations Manager dashboard');
        }
    }

    #[OA\Get(
        path: '/api/v1/dashboards/oa',
        summary: 'Get Operations Admin dashboard',
        tags: ['Dashboard', 'Operations Admin - Dashboard'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Operations Admin dashboard retrieved successfully'),
            new OA\Response(response: 403, description: 'Forbidden - User must have operations_admin role'),
        ],
    )]
    public function operationsAdmin(): JsonResponse
    {
        try {
            $user = Auth::user();

            if (! $user->hasRole('operations_admin')) {
                return $this->errorResponse('Unauthorized to access this dashboard', 403);
            }

            $data = $this->dashboardService->getOperationsAdminDashboard($user);

            return $this->successResponse($data, 'Operations Admin dashboard retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to load Operations Admin dashboard');
        }
    }

    #[OA\Get(
        path: '/api/v1/dashboards/dr',
        summary: 'Get DRDO Admin dashboard',
        tags: ['Dashboard', 'DRDO Admin - Dashboard'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'DRDO Admin dashboard retrieved successfully'),
            new OA\Response(response: 403, description: 'Forbidden - User must have drdo_admin role'),
        ],
    )]
    public function drdoAdmin(): JsonResponse
    {
        try {
            $user = Auth::user();

            if (! $user->hasRole('drdo_admin')) {
                return $this->errorResponse('Unauthorized to access this dashboard', 403);
            }

            $data = $this->dashboardService->getDrdoAdminDashboard($user);

            return $this->successResponse($data, 'DRDO Admin dashboard retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to load DRDO Admin dashboard');
        }
    }

    #[OA\Get(
        path: '/api/v1/dashboards/assessor',
        summary: 'Get Assessor dashboard',
        tags: ['Dashboard', 'Assessor - Dashboard'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Assessor dashboard retrieved successfully'),
            new OA\Response(response: 403, description: 'Forbidden - User must have assessor role'),
        ],
    )]
    public function assessor(): JsonResponse
    {
        try {
            $user = Auth::user();

            if (! $user->hasRole('assessor')) {
                return $this->errorResponse('Unauthorized to access this dashboard', 403);
            }

            $data = $this->dashboardService->getAssessorDashboard($user);

            return $this->successResponse($data, 'Assessor dashboard retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to load Assessor dashboard');
        }
    }

    #[OA\Get(
        path: '/api/v1/dashboards/sa',
        summary: 'Get System Admin dashboard',
        tags: ['Dashboard', 'System Admin - Dashboard'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'System Admin dashboard retrieved successfully'),
            new OA\Response(response: 403, description: 'Forbidden - User must have system_admin role'),
        ],
    )]
    public function systemAdmin(): JsonResponse
    {
        try {
            $user = Auth::user();

            if (! $user->hasRole('system_admin')) {
                return $this->errorResponse('Unauthorized to access this dashboard', 403);
            }

            $data = $this->dashboardService->getSystemAdminDashboard($user);

            return $this->successResponse($data, 'System Admin dashboard retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to load System Admin dashboard');
        }
    }
}
