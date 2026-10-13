<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Rules\EntityName;
use App\Rules\PersonName;
use App\Services\Auth\AuthService;
use App\Services\Auth\CaptchaService;
use App\Services\Notification\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * @OA\Tag(
 *     name="Authentication",
 *     description="User authentication and registration endpoints"
 * )
 */
class RegisterController extends Controller
{
    public function __construct(
        private AuthService $authService,
        private NotificationService $notificationService,
        private CaptchaService $captchaService
    ) {}

    /**
     * Register new organization and enterprise admin.
     *
     * @OA\Post(
     *     path="/api/v1/auth/register",
     *     summary="Register new organization and enterprise admin",
     *     description="Creates a new organization account along with an enterprise admin user. Sends OTP for verification. If the email is already registered but pending verification (user abandoned previous registration), this endpoint will automatically resend a new OTP, generate a new password, and update the user details. Note: Re-registration is NOT allowed for verified organizations.",
     *     tags={"Authentication", "System Admin - Authentication", "DRDO Admin - Authentication", "Operations Manager - Authentication", "Operations Admin - Authentication", "Assessor - Authentication", "Unit Admin - Authentication", "Enterprise Admin - Authentication"},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"organization_name", "first_name", "last_name", "email"},
     *
     *             @OA\Property(property="organization_name", type="string", maxLength=255, example="ABC Manufacturing Pvt Ltd"),
     *             @OA\Property(property="first_name", type="string", maxLength=100, example="John"),
     *             @OA\Property(property="last_name", type="string", maxLength=100, example="Doe"),
     *             @OA\Property(property="email", type="string", format="email", example="john.doe@example.com"),
     *             @OA\Property(property="mobile_number", type="string", pattern="^[0-9]{10}$", example="9876543210")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Registration successful or OTP resent for pending verification. Check is_resend flag to distinguish between new registration and OTP resend.",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Registration successful. Check your email for login credentials and verification OTP."),
     *             @OA\Property(property="is_resend", type="boolean", example=false, description="True if this was a resend for existing pending verification account, false for new registration")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Bad request - validation failed or registration failed (email already registered)",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed or email already registered."),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     )
     * )
     */
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'organization_name' => ['required', 'string', 'max:255', new EntityName],
            'first_name' => ['required', 'string', 'max:50', new PersonName],
            'last_name' => ['required', 'string', 'max:50', new PersonName],
            'email' => 'required|email',  // Uniqueness handled in AuthService to allow re-registration for pending users
            'mobile_number' => 'nullable|string|regex:/^[0-9]{10}$/',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // Browser clients only - see CaptchaService::isRequiredFor().
        if ($this->captchaService->isRequiredFor($request)
            && ! $this->captchaService->verify($request->captcha_id, $request->captcha)) {
            return $this->errorResponse('Validation failed.', 400, [
                'captcha' => ['The captcha is incorrect or has expired. Please try again.'],
            ]);
        }

        try {
            $result = $this->authService->register($request->all());

            // Check if this was a resend (user re-registering with pending verification)
            $isResend = $result['is_resend'] ?? false;

            $message = $isResend
                ? 'A verification OTP has been resent to your email. Please check your email to verify your account.'
                : 'Registration successful. Check your email for login credentials and verification OTP.';

            return $this->successResponse([
                'samar_id' => $result['user']->samar_id,
                'is_resend' => $isResend,
            ], $message, 201);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Registration failed.', 400);
        }
    }

    /**
     * Verify OTP.
     *
     * @OA\Post(
     *     path="/api/v1/auth/verify-otp",
     *     summary="Verify OTP for user registration",
     *     description="Verifies the OTP sent to user's email/phone during registration. Upon successful verification, user account is activated.",
     *     tags={"Authentication", "System Admin - Authentication", "DRDO Admin - Authentication", "Operations Manager - Authentication", "Operations Admin - Authentication", "Assessor - Authentication", "Unit Admin - Authentication", "Enterprise Admin - Authentication"},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"samar_id", "otp"},
     *
     *             @OA\Property(property="samar_id", type="string", example="SAMAR-040226-1", description="SAMAR ID received from registration"),
     *             @OA\Property(property="otp", type="string", minLength=6, maxLength=6, example="123456")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="OTP verified successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="OTP verified successfully. You can now login.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Bad request - validation failed or invalid/expired OTP",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Invalid or expired OTP."),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     )
     * )
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'samar_id' => 'required|string',
            'otp' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            $result = $this->authService->verifyOtp(
                $request->samar_id,
                $request->otp
            );

            return $this->successResponse(null, $result['message']);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to verify OTP.', 400);
        }
    }

    /**
     * Resend OTP.
     *
     * @OA\Post(
     *     path="/api/v1/auth/resend-otp",
     *     summary="Resend OTP for verification",
     *     description="Resends a new OTP to the user's email/phone for account verification.",
     *     tags={"Authentication", "System Admin - Authentication", "DRDO Admin - Authentication", "Operations Manager - Authentication", "Operations Admin - Authentication", "Assessor - Authentication", "Unit Admin - Authentication", "Enterprise Admin - Authentication"},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"samar_id"},
     *
     *             @OA\Property(property="samar_id", type="string", example="SAMAR-040226-1", description="SAMAR ID received from registration")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="OTP resent successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="OTP has been resent. Check your email.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Bad request - validation failed or failed to resend OTP",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to resend OTP."),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     )
     * )
     */
    public function resendOtp(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'samar_id' => 'required|string|exists:users,samar_id',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            $user = User::where('samar_id', strtoupper($request->samar_id))->first();
            $otp = $user->generateOtp();

            // Send OTP verification email (do not send temporary password - only OTP)
            try {
                $this->notificationService->send(
                    $user,
                    'otp-verification',
                    [
                        'otp_code' => $otp,
                        'otp_expires_in' => ((int) config('auth.otp.expiry_minutes')).' minutes',
                    ],
                    ['channels' => ['email']]
                );
            } catch (\Exception $e) {
                Log::error('Failed to send OTP verification email on resend', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'error' => $e->getMessage(),
                ]);
                // Don't throw - graceful failure
            }

            // OTP is sent via email only for security
            return $this->successResponse(null, 'OTP has been resent. Check your email.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to resend OTP.', 400);
        }
    }
}
