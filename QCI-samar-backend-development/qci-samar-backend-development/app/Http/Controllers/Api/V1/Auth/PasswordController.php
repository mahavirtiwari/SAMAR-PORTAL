<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\AuthService;
use App\Services\Auth\CaptchaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

class PasswordController extends Controller
{
    public function __construct(
        private AuthService $authService,
        private CaptchaService $captchaService
    ) {}

    /**
     * Change password.
     */
    #[OA\Post(
        path: '/api/v1/auth/change-password',
        summary: 'Change password for authenticated user',
        description: 'Allows authenticated user to change their password by providing current password and new password.',
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
                required: ['current_password', 'new_password', 'new_password_confirmation'],
                properties: [
                    new OA\Property(
                        property: 'current_password',
                        type: 'string',
                        format: 'password',
                        example: 'oldPassword123',
                    ),
                    new OA\Property(
                        property: 'new_password',
                        type: 'string',
                        format: 'password',
                        minLength: 7,
                        example: 'newPassword123',
                    ),
                    new OA\Property(
                        property: 'new_password_confirmation',
                        type: 'string',
                        format: 'password',
                        example: 'newPassword123',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Password changed successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Password changed successfully.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - invalid current password, password change failed, or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Current password is incorrect.',
                        ),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 429, description: 'Too many attempts, limited to 5 per minute per user'),
        ],
    )]
    public function change(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:7|max:20|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            $this->authService->changePassword(
                $request->user(),
                $request->current_password,
                $request->new_password
            );

            return $this->successResponse(null, 'Password changed successfully.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to change password.', 400);
        }
    }

    /**
     * Forgot password.
     */
    #[OA\Post(
        path: '/api/v1/auth/forgot-password',
        summary: 'Request password reset',
        description: 'Sends a 6-digit OTP to the user\'s email address for password reset. OTP expires in 2 minutes and allows 5 attempts before 30-minute lockout.',
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
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['samar_id'],
                properties: [
                    new OA\Property(
                        property: 'samar_id',
                        type: 'string',
                        example: 'SAMAR-040226-1',
                        description: 'SAMAR ID (format: SAMAR-DDMMYY-ID)',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Password reset OTP sent successfully via email',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Password reset OTP has been sent to your email. Valid for 2 minutes.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - failed to send OTP or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Account is temporarily locked. Please try again in 25 minutes.',
                        ),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
        ],
    )]
    public function forgot(Request $request): JsonResponse
    {
        // Format only. Whether the account exists is deliberately NOT validated
        // here: a per-field "No account found with this SAMAR ID." reply turned
        // this endpoint into a user-enumeration oracle.
        $validator = Validator::make($request->all(), [
            'samar_id' => ['required', 'string', 'regex:/^SAMAR-\d{6}-\d+$/i'],
        ], [
            'samar_id.regex' => 'Please enter a valid SAMAR ID (format: SAMAR-DDMMYY-ID).',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // Checked before any account lookup, so the response cannot be used to
        // probe which SAMAR IDs exist without solving a challenge first.
        // Browser clients only — see CaptchaService::isRequiredFor().
        if ($this->captchaService->isRequiredFor($request)
            && ! $this->captchaService->verify($request->captcha_id, $request->captcha)) {
            return $this->errorResponse('Validation failed.', 400, [
                'captcha' => ['The captcha is incorrect or has expired. Please try again.'],
            ]);
        }

        $otpExpiryMinutes = (int) config('auth.otp.expiry_minutes');

        try {
            $this->authService->forgotPassword($request->samar_id);
        } catch (\Exception $e) {
            // Unknown account, inactive organization, OTP lockout — every one of
            // these is answered identically below. Surfacing the reason would
            // reveal whether the account exists and what state it is in, so it
            // is recorded server-side only.
            Log::info('Password reset request not fulfilled.', [
                'samar_id' => strtoupper((string) $request->samar_id),
                'reason' => $e->getMessage(),
                'ip' => $request->ip(),
            ]);
        }

        return $this->successResponse(null, "If an account exists for that SAMAR ID, a password reset OTP has been sent to the registered email. Valid for {$otpExpiryMinutes} minutes.");
    }

    /**
     * Resend password reset OTP.
     */
    #[OA\Post(
        path: '/api/v1/auth/resend-password-otp',
        summary: 'Resend password reset OTP',
        description: 'Regenerates and re-sends the password-reset OTP to the user\'s email. Uses a separate per-account resend rate limit so it does not consume the stricter forgot-password limit.',
        tags: ['Authentication'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['samar_id'],
                properties: [
                    new OA\Property(
                        property: 'samar_id',
                        type: 'string',
                        example: 'SAMAR-040226-1',
                        description: 'SAMAR ID (format: SAMAR-DDMMYY-ID)',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Password reset OTP resent successfully via email',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'A new password reset OTP has been sent to your email. Valid for 2 minutes.',
                        ),
                    ],
                ),
            ),
        ],
    )]
    public function resendOtp(Request $request): JsonResponse
    {
        // Mirror forgot-password: format only, no existence check — see forgot().
        $validator = Validator::make($request->all(), [
            'samar_id' => ['required', 'string', 'regex:/^SAMAR-\d{6}-\d+$/i'],
        ], [
            'samar_id.regex' => 'Please enter a valid SAMAR ID (format: SAMAR-DDMMYY-ID).',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        $otpExpiryMinutes = (int) config('auth.otp.expiry_minutes');

        try {
            $this->authService->forgotPassword($request->samar_id);
        } catch (\Exception $e) {
            Log::info('Password reset OTP resend not fulfilled.', [
                'samar_id' => strtoupper((string) $request->samar_id),
                'reason' => $e->getMessage(),
                'ip' => $request->ip(),
            ]);
        }

        return $this->successResponse(null, "If an account exists for that SAMAR ID, a new password reset OTP has been sent to the registered email. Valid for {$otpExpiryMinutes} minutes.");
    }

    /**
     * Reset password.
     */
    #[OA\Post(
        path: '/api/v1/auth/reset-password',
        summary: 'Reset password using OTP',
        description: 'Resets user password using the 6-digit OTP received via email. Maximum 5 attempts allowed before 30-minute lockout.',
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
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['samar_id', 'otp', 'password', 'password_confirmation'],
                properties: [
                    new OA\Property(
                        property: 'samar_id',
                        type: 'string',
                        example: 'SAMAR-040226-1',
                        description: 'SAMAR ID (format: SAMAR-DDMMYY-ID)',
                    ),
                    new OA\Property(
                        property: 'otp',
                        type: 'string',
                        pattern: '^\\d{6}$',
                        example: '123456',
                        description: '6-digit OTP received via email',
                    ),
                    new OA\Property(
                        property: 'password',
                        type: 'string',
                        format: 'password',
                        minLength: 7,
                        example: 'newPassword123!',
                    ),
                    new OA\Property(
                        property: 'password_confirmation',
                        type: 'string',
                        format: 'password',
                        example: 'newPassword123!',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Password reset successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Password has been reset successfully. Please login with your new password.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - invalid/expired OTP, account locked, or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Invalid or expired OTP. You have 3 attempts remaining.',
                        ),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
        ],
    )]
    public function reset(Request $request): JsonResponse
    {
        // Format only — account existence is not validated here; see forgot().
        $validator = Validator::make($request->all(), [
            'samar_id' => ['required', 'string', 'regex:/^SAMAR-\d{6}-\d+$/i'],
            'otp' => 'required|string|digits:6',
            'password' => 'required|string|min:7|max:20|confirmed',
        ], [
            'samar_id.regex' => 'Please enter a valid SAMAR ID (format: SAMAR-DDMMYY-ID).',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // Guards the OTP against automated guessing. Browser clients only —
        // see CaptchaService::isRequiredFor().
        if ($this->captchaService->isRequiredFor($request)
            && ! $this->captchaService->verify($request->captcha_id, $request->captcha)) {
            return $this->errorResponse('Validation failed.', 400, [
                'captcha' => ['The captcha is incorrect or has expired. Please try again.'],
            ]);
        }

        try {
            $this->authService->resetPassword(
                $request->samar_id,
                $request->otp,
                $request->password
            );

            return $this->successResponse(null, 'Password has been reset successfully. Please login with your new password.');
        } catch (\Exception $e) {
            // One message for a wrong OTP and for an unknown account, so this
            // endpoint cannot be used to tell the two apart.
            Log::info('Password reset not completed.', [
                'samar_id' => strtoupper((string) $request->samar_id),
                'reason' => $e->getMessage(),
                'ip' => $request->ip(),
            ]);

            return $this->errorResponse('The SAMAR ID or OTP is invalid, or the OTP has expired.', 400);
        }
    }
}
