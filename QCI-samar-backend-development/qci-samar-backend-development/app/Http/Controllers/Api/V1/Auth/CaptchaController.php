<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auth\CaptchaService;
use Illuminate\Http\JsonResponse;

class CaptchaController extends Controller
{
    public function __construct(
        private CaptchaService $captchaService
    ) {}

    /**
     * Issue a CAPTCHA challenge for the browser auth forms.
     *
     * @OA\Get(
     *     path="/api/v1/auth/captcha",
     *     summary="Issue a login CAPTCHA challenge",
     *     description="Returns an opaque captcha_id and an inline image. Submit the id together with the user's answer on login or forgot-password. Challenges are single-use and expire.",
     *     tags={"Authentication"},
     *
     *     @OA\Response(
     *         response=200,
     *         description="Challenge issued",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="captcha_id", type="string", example="9f1c2e34-5b6a-47d8-9012-3456789abcde"),
     *                 @OA\Property(property="image", type="string", example="data:image/jpeg;base64,..."),
     *                 @OA\Property(property="expires_in", type="integer", example=300)
     *             )
     *         )
     *     )
     * )
     */
    public function show(): JsonResponse
    {
        return $this->successResponse(
            $this->captchaService->generate(),
            'Captcha generated successfully.'
        );
    }
}
