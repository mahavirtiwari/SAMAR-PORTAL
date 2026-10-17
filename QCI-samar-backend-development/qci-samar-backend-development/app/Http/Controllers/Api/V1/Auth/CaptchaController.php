<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auth\CaptchaService;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

class CaptchaController extends Controller
{
    public function __construct(
        private CaptchaService $captchaService
    ) {}

    /**
     * Issue a CAPTCHA challenge for the browser auth forms.
     */
    #[OA\Get(
        path: '/api/v1/auth/captcha',
        summary: 'Issue a login CAPTCHA challenge',
        description: 'Returns an opaque captcha_id and an inline image. Submit the id together with the user\'s answer on login or forgot-password. Challenges are single-use and expire.',
        tags: ['Authentication'],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Challenge issued',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'captcha_id',
                                    type: 'string',
                                    example: '9f1c2e34-5b6a-47d8-9012-3456789abcde',
                                ),
                                new OA\Property(
                                    property: 'image',
                                    type: 'string',
                                    example: 'data:image/jpeg;base64,...',
                                ),
                                new OA\Property(property: 'expires_in', type: 'integer', example: 300),
                                new OA\Property(
                                    property: 'enabled',
                                    type: 'boolean',
                                    example: true,
                                    description: 'False when the security code is switched off in System Settings; captcha_id and image are then null.',
                                ),
                            ],
                        ),
                    ],
                ),
            ),
        ],
    )]
    public function show(): JsonResponse
    {
        // Switched off in System Settings: no challenge, and the forms hide the field.
        if (! $this->captchaService->isEnabled()) {
            return $this->successResponse(
                ['enabled' => false, 'captcha_id' => null, 'image' => null, 'expires_in' => 0],
                'Captcha is switched off.'
            );
        }

        return $this->successResponse(
            ['enabled' => true] + $this->captchaService->generate(),
            'Captcha generated successfully.'
        );
    }
}
