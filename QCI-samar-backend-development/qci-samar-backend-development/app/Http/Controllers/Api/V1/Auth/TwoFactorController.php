<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\DisableTwoFactorRequest;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class TwoFactorController extends Controller
{
    public function __construct(
        private AuthService $authService
    ) {}

    /**
     * Get two-factor authentication status.
     */
    #[OA\Get(
        path: '/api/v1/auth/2fa-status',
        summary: 'Get 2FA status',
        description: 'Returns the current two-factor authentication status for the authenticated user.',
        tags: [
            'Authentication',
            'System Admin - Authentication',
            'DRDO Admin - Authentication',
            'Operations Manager - Authentication',
            'Operations Admin - Authentication',
            'Assessor - Authentication',
            'Unit Admin - Authentication',
            'Enterprise Admin - Authentication',
        ],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: '2FA status retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'is_two_factor_enabled',
                                    type: 'boolean',
                                    example: false,
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function status(Request $request): JsonResponse
    {
        $result = $this->authService->getTwoFactorStatus($request->user());

        return $this->successResponse($result, '2FA status retrieved successfully.');
    }

    /**
     * Enable two-factor authentication.
     */
    #[OA\Post(
        path: '/api/v1/auth/2fa/enable',
        summary: 'Enable 2FA',
        description: 'Enables two-factor authentication for the authenticated user. Once enabled, the user will be required to enter an OTP sent to their email during login.',
        tags: [
            'Authentication',
            'System Admin - Authentication',
            'DRDO Admin - Authentication',
            'Operations Manager - Authentication',
            'Operations Admin - Authentication',
            'Assessor - Authentication',
            'Unit Admin - Authentication',
            'Enterprise Admin - Authentication',
        ],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: '2FA enabled successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Two-factor authentication has been enabled successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'is_two_factor_enabled', type: 'boolean', example: true),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: '2FA already enabled',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Two-factor authentication is already enabled.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function enable(Request $request): JsonResponse
    {
        try {
            $result = $this->authService->enableTwoFactor($request->user());

            return $this->successResponse(
                $result,
                'Two-factor authentication has been enabled successfully.'
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to enable two-factor authentication.', 400);
        }
    }

    /**
     * Disable two-factor authentication.
     */
    #[OA\Post(
        path: '/api/v1/auth/2fa/disable',
        summary: 'Disable 2FA',
        description: 'Disables two-factor authentication for the authenticated user. Requires current password for security verification. Once disabled, the user will be able to login without OTP verification.',
        tags: [
            'Authentication',
            'System Admin - Authentication',
            'DRDO Admin - Authentication',
            'Operations Manager - Authentication',
            'Operations Admin - Authentication',
            'Assessor - Authentication',
            'Unit Admin - Authentication',
            'Enterprise Admin - Authentication',
        ],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['current_password'],
                properties: [
                    new OA\Property(
                        property: 'current_password',
                        type: 'string',
                        format: 'password',
                        example: 'CurrentPassword123!',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: '2FA disabled successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Two-factor authentication has been disabled.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'is_two_factor_enabled',
                                    type: 'boolean',
                                    example: false,
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - 2FA already disabled, validation error, or incorrect password',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Two-factor authentication is already disabled.',
                        ),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 429, description: 'Too many attempts, limited to 5 per minute per user'),
        ],
    )]
    public function disable(DisableTwoFactorRequest $request): JsonResponse
    {
        try {
            $result = $this->authService->disableTwoFactor(
                $request->user(),
                $request->current_password
            );

            return $this->successResponse(
                $result,
                'Two-factor authentication has been disabled.'
            );
        } catch (\Exception $e) {
            // If password is incorrect, return 400 with specific error format
            if (str_contains($e->getMessage(), 'password is incorrect')) {
                return $this->errorResponse(
                    'The provided password is incorrect.',
                    400,
                    ['current_password' => ['The provided password is incorrect.']]
                );
            }

            return $this->serverErrorResponse($e, 'Failed to disable two-factor authentication.', 400);
        }
    }
}
