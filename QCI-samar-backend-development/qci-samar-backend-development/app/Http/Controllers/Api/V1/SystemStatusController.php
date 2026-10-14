<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'System Status',
    description: 'Public API endpoints for checking system status (no authentication required)',
)]
class SystemStatusController extends Controller
{
    /**
     * Get system status including maintenance mode.
     */
    #[OA\Get(
        path: '/api/v1/system/status',
        operationId: 'getSystemStatus',
        tags: ['System Status'],
        summary: 'Get system status',
        description: 'Returns the current system status including maintenance mode. No authentication required.',
        responses: [
            new OA\Response(
                response: 200,
                description: 'Successful operation',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'System status retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'maintenance_mode',
                                    type: 'boolean',
                                    example: false,
                                    description: 'Whether the system is in maintenance mode',
                                ),
                                new OA\Property(
                                    property: 'application_submission_open',
                                    type: 'boolean',
                                    example: true,
                                    description: 'Whether new applications can be submitted',
                                ),
                                new OA\Property(
                                    property: 'deployed_commit',
                                    type: 'string',
                                    nullable: true,
                                    example: '08f8072',
                                    description: 'Short git SHA of the code currently deployed (null if unstamped)',
                                ),
                                new OA\Property(
                                    property: 'maintenance_message',
                                    type: 'string',
                                    nullable: true,
                                    example: 'System is currently under maintenance. Please try again later.',
                                    description: 'Message to display during maintenance (only present when maintenance_mode is true)',
                                ),
                            ],
                        ),
                    ],
                ),
            ),
        ],
    )]
    public function status(): JsonResponse
    {
        $maintenanceMode = SystemSetting::isMaintenanceMode();
        $applicationSubmissionOpen = SystemSetting::isApplicationSubmissionOpen();

        $data = [
            'maintenance_mode' => $maintenanceMode,
            'application_submission_open' => $applicationSubmissionOpen,
            'deployed_commit' => $this->deployedCommit(),
        ];

        if ($maintenanceMode) {
            $data['maintenance_message'] = SystemSetting::getValue(
                'maintenance_message',
                'System is currently under maintenance. Please try again later.'
            );
        }

        return $this->successResponse($data, 'System status retrieved successfully');
    }

    private function deployedCommit(): ?string
    {
        $path = public_path('deployed-commit.txt');

        return is_readable($path) ? (trim((string) file_get_contents($path)) ?: null) : null;
    }
}
