<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Exceptions\AuthenticationFailedException;
use App\Http\Controllers\Controller;
use App\Services\Auth\AuthService;
use App\Services\Auth\CaptchaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

class LoginController extends Controller
{
    public function __construct(
        private AuthService $authService,
        private CaptchaService $captchaService
    ) {}

    /**
     * Login user (Step 1: Validate credentials and send OTP).
     */
    #[OA\Post(
        path: '/api/v1/auth/login',
        summary: 'Login user - Step 1: Send OTP',
        description: 'Validates user credentials and sends a 6-digit OTP to the user\'s email. Returns a session_token to be used in the verify-login-otp endpoint. This is the first step of the 2FA login process.',
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
                required: ['samar_id', 'password'],
                properties: [
                    new OA\Property(
                        property: 'samar_id',
                        type: 'string',
                        example: 'SAMAR-040226-1',
                        description: 'SAMAR ID (format: SAMAR-DDMMYY-ID)',
                    ),
                    new OA\Property(
                        property: 'password',
                        type: 'string',
                        format: 'password',
                        example: 'password123',
                    ),
                    new OA\Property(
                        property: 'deviceType',
                        type: 'string',
                        enum: ['web', 'tablet', 'mobile', 'ios', 'android'],
                        example: 'web',
                    ),
                    new OA\Property(property: 'deviceName', type: 'string', example: 'Chrome on Windows'),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'OTP sent successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'OTP sent to your email. Please verify to complete login.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'session_token', type: 'string', example: 'abcd1234...'),
                                new OA\Property(property: 'otp_expires_in', type: 'string', example: '2 minutes'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Invalid credentials',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Invalid credentials.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation failed.'),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
        ],
    )]
    public function login(Request $request): JsonResponse
    {
        // Accept ONLY SAMAR ID for login
        $validator = Validator::make($request->all(), [
            'samar_id' => ['required', 'string', function ($attribute, $value, $fail) {
                // Check if it's a valid SAMAR ID format
                $isSamarId = preg_match('/^SAMAR-\d{6}-\d+$/i', $value);
                if (! $isSamarId) {
                    $fail('Please enter a valid SAMAR ID (format: SAMAR-DDMMYY-ID).');
                }
            }],
            'password' => 'required|string',
            'device_type' => 'nullable|string|in:web,tablet,mobile,ios,android',
            'device_name' => 'nullable|string',
            'device_id' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // Browser clients only — the mobile apps hit this same endpoint and are
        // covered by the throttle, account lockout and OTP step instead. A pass
        // from the check-active-session step counts; a direct call still needs
        // its own solved challenge.
        if ($this->captchaService->isRequiredFor($request)
            && ! $this->captchaService->consumePass($request, $request->samar_id)
            && ! $this->captchaService->verify($request->captcha_id, $request->captcha)) {
            return $this->errorResponse('Validation failed.', 400, [
                'captcha' => ['The captcha is incorrect or has expired. Please try again.'],
            ]);
        }

        try {
            $deviceInfo = [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'device_type' => $request->device_type ?? 'web',
                'device_name' => $request->device_name,
                'device_id' => $request->device_id,
            ];

            $loginIdentifier = $request->samar_id;
            $result = $this->authService->login(
                $loginIdentifier,
                $request->password,
                $deviceInfo
            );

            // Check if direct login (2FA disabled)
            if (isset($result['direct_login']) && $result['direct_login'] === true) {
                // Load organization relationship
                $result['user']->load('organization');

                return $this->successResponse([
                    'user' => [
                        'id' => $result['user']->id,
                        'samar_id' => $result['user']->samar_id,
                        'first_name' => $result['user']->first_name,
                        'last_name' => $result['user']->last_name,
                        'full_name' => $result['user']->full_name,
                        'email' => $result['user']->email,
                        'mobile_number' => $result['user']->mobile_number,
                        'organization' => $result['user']->organization ? [
                            'id' => $result['user']->organization->id,
                            'name' => $result['user']->organization->name,
                            'is_verified' => $result['user']->organization->is_verified,
                            'is_profile_completed' => $result['user']->organization->is_profile_completed,
                        ] : null,
                        'roles' => $result['user']->activeRoles->map(fn ($role) => [
                            'id' => $role->id,
                            'name' => $role->name,
                            'slug' => $role->slug,
                        ]),
                        'assigned_states' => $result['user']->assigned_states,
                    ],
                    'access_token' => $result['access_token'],
                    'refresh_token' => $result['refresh_token'],
                    'token_type' => $result['token_type'],
                    'access_token_expiration' => $result['access_token_expiration'],
                    'refresh_token_expiration' => $result['refresh_token_expiration'],
                    'requires_otp' => false,
                ], 'Login successful.');
            }

            // 2FA enabled - return session token for OTP verification
            return $this->successResponse([
                'session_token' => $result['pending_session']->session_token,
                'otp_expires_in' => ((int) config('auth.otp.expiry_minutes')).' minutes',
                'requires_otp' => true,
            ], 'OTP sent to your email. Please verify to complete login.');
        } catch (AuthenticationFailedException $e) {
            // Expected outcome with a curated message — returned deliberately so
            // the reason never depends on the debug-only field.
            return $this->errorResponse($e->getMessage(), 401);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Login failed.', 401);
        }
    }

    /**
     * Check for an existing active session before logging in.
     */
    #[OA\Post(
        path: '/api/v1/auth/check-active-session',
        summary: 'Check for an active session on another device',
        description: 'Verifies credentials and reports whether the account already has an active session elsewhere, so the client can warn the user that continuing will end that session. Does not issue tokens or create a session.',
        tags: ['Authentication'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['samarId', 'password'],
                properties: [
                    new OA\Property(property: 'samarId', type: 'string', example: 'SAMAR-040226-1'),
                    new OA\Property(
                        property: 'password',
                        type: 'string',
                        format: 'password',
                        example: 'password123',
                    ),
                    new OA\Property(
                        property: 'deviceType',
                        type: 'string',
                        enum: ['web', 'tablet', 'mobile', 'ios', 'android'],
                        example: 'android',
                        description: 'Device class of the attempted login; scopes the conflict check so a mobile login only reports another mobile session, not the web session.',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Active-session status',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'has_active_session', type: 'boolean', example: true),
                                new OA\Property(property: 'device', type: 'object', nullable: true),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Invalid credentials'),
        ],
    )]
    public function checkActiveSession(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'samar_id' => ['required', 'string', function ($attribute, $value, $fail) {
                if (! preg_match('/^SAMAR-\d{6}-\d+$/i', $value)) {
                    $fail('Please enter a valid SAMAR ID (format: SAMAR-DDMMYY-ID).');
                }
            }],
            'password' => 'required|string',
            'device_type' => 'nullable|string|in:web,tablet,mobile,ios,android',
            'device_id' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        // This endpoint validates the password too, so it is challenged like
        // login itself. Solving here issues the pass that login then spends,
        // keeping the browser flow to a single puzzle.
        if ($this->captchaService->isRequiredFor($request)) {
            if (! $this->captchaService->verify($request->captcha_id, $request->captcha)) {
                return $this->errorResponse('Validation failed.', 400, [
                    'captcha' => ['The captcha is incorrect or has expired. Please try again.'],
                ]);
            }

            $this->captchaService->issuePass($request, $request->samar_id);
        }

        try {
            $result = $this->authService->checkActiveSession($request->samar_id, $request->password, $request->device_type, $request->device_id);

            return $this->successResponse($result);
        } catch (AuthenticationFailedException $e) {
            return $this->errorResponse($e->getMessage(), 401);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to check active session.', 401);
        }
    }

    /**
     * Verify login OTP (Step 2: Complete login with OTP verification).
     */
    #[OA\Post(
        path: '/api/v1/auth/verify-login-otp',
        summary: 'Verify login OTP - Step 2: Complete login',
        description: 'Verifies the OTP sent during login and completes the authentication process. Returns JWT access and refresh tokens along with user details.',
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
                required: ['sessionToken', 'otp'],
                properties: [
                    new OA\Property(property: 'sessionToken', type: 'string', example: 'abcd1234...'),
                    new OA\Property(
                        property: 'otp',
                        type: 'string',
                        minLength: 6,
                        maxLength: 6,
                        example: '123456',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Login successful',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'Login successful.'),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'user',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(property: 'first_name', type: 'string', example: 'John'),
                                        new OA\Property(property: 'last_name', type: 'string', example: 'Doe'),
                                        new OA\Property(
                                            property: 'full_name',
                                            type: 'string',
                                            example: 'John Doe',
                                        ),
                                        new OA\Property(
                                            property: 'email',
                                            type: 'string',
                                            example: 'john.doe@example.com',
                                        ),
                                        new OA\Property(
                                            property: 'mobile_number',
                                            type: 'string',
                                            example: '9876543210',
                                        ),
                                        new OA\Property(
                                            property: 'organization',
                                            type: 'object',
                                            nullable: true,
                                            properties: [
                                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                                new OA\Property(
                                                    property: 'name',
                                                    type: 'string',
                                                    example: 'DRDO Labs',
                                                ),
                                                new OA\Property(
                                                    property: 'is_verified',
                                                    type: 'boolean',
                                                    example: true,
                                                ),
                                                new OA\Property(
                                                    property: 'is_profile_completed',
                                                    type: 'boolean',
                                                    example: true,
                                                ),
                                            ],
                                        ),
                                        new OA\Property(
                                            property: 'roles',
                                            type: 'array',
                                            items: new OA\Items(type: 'object'),
                                        ),
                                        new OA\Property(
                                            property: 'permissions',
                                            type: 'array',
                                            items: new OA\Items(type: 'object'),
                                        ),
                                    ],
                                ),
                                new OA\Property(
                                    property: 'access_token',
                                    type: 'string',
                                    example: 'eyJ0eXAiOiJKV1QiLCJhbGc...',
                                ),
                                new OA\Property(
                                    property: 'refresh_token',
                                    type: 'string',
                                    example: 'eyJ0eXAiOiJKV1QiLCJhbGc...',
                                ),
                                new OA\Property(property: 'token_type', type: 'string', example: 'bearer'),
                                new OA\Property(property: 'expires_in', type: 'integer', example: 3600),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Invalid OTP or session',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Invalid OTP. You have 4 attempts remaining.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation failed.'),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
        ],
    )]
    public function verifyLoginOtp(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'session_token' => 'required|string',
            'otp' => 'required|string|size:6',
            'device_id' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            $deviceInfo = [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'device_id' => $request->device_id,
            ];

            $result = $this->authService->verifyLoginOtp(
                $request->session_token,
                $request->otp,
                $deviceInfo
            );

            // Load organization relationship
            $result['user']->load('organization');

            return $this->successResponse([
                'user' => [
                    'id' => $result['user']->id,
                    'samar_id' => $result['user']->samar_id,
                    'first_name' => $result['user']->first_name,
                    'last_name' => $result['user']->last_name,
                    'full_name' => $result['user']->full_name,
                    'email' => $result['user']->email,
                    'mobile_number' => $result['user']->mobile_number,
                    'organization' => $result['user']->organization ? [
                        'id' => $result['user']->organization->id,
                        'name' => $result['user']->organization->name,
                        'is_verified' => $result['user']->organization->is_verified,
                        'is_profile_completed' => $result['user']->organization->is_profile_completed,
                    ] : null,
                    'roles' => $result['user']->activeRoles->map(fn ($role) => [
                        'id' => $role->id,
                        'name' => $role->name,
                        'slug' => $role->slug,
                    ]),
                    'assigned_states' => $result['user']->assigned_states,
                ],
                'access_token' => $result['access_token'],
                'refresh_token' => $result['refresh_token'],
                'token_type' => $result['token_type'],
                'access_token_expiration' => $result['access_token_expiration'],
                'refresh_token_expiration' => $result['refresh_token_expiration'],
            ], 'Login successful.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to verify OTP.', 401);
        }
    }

    /**
     * Resend login OTP.
     */
    #[OA\Post(
        path: '/api/v1/auth/resend-login-otp',
        summary: 'Resend login OTP',
        description: 'Resends the OTP for a pending login session. Maximum 3 resends allowed per session.',
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
                required: ['sessionToken'],
                properties: [
                    new OA\Property(property: 'sessionToken', type: 'string', example: 'abcd1234...'),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'OTP resent successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'OTP has been resent to your email.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - failed to resend OTP or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Maximum OTP resend limit reached. Please login again.',
                        ),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
        ],
    )]
    public function resendLoginOtp(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'session_token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            $result = $this->authService->resendLoginOtp($request->session_token);

            return $this->successResponse(null, 'OTP has been resent to your email.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to resend OTP.', 400);
        }
    }

    /**
     * Logout user.
     */
    #[OA\Post(
        path: '/api/v1/auth/logout',
        summary: 'Logout user',
        description: 'Logs out the currently authenticated user by invalidating the JWT token.',
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
                description: 'Logout successful',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'Logout successful.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Logout failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Logout failed.'),
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
    public function logout(Request $request): JsonResponse
    {
        try {
            $this->authService->logout($request->user());

            return $this->successResponse(null, 'Logout successful.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Logout failed.', 400);
        }
    }

    /**
     * Refresh access token.
     */
    #[OA\Post(
        path: '/api/v1/auth/refresh',
        summary: 'Refresh access token',
        description: 'Refreshes the JWT access token using a valid refresh token.',
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
                required: ['refreshToken'],
                properties: [
                    new OA\Property(
                        property: 'refreshToken',
                        type: 'string',
                        example: 'eyJ0eXAiOiJKV1QiLCJhbGc...',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Token refreshed successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Token refreshed successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'access_token',
                                    type: 'string',
                                    example: 'eyJ0eXAiOiJKV1QiLCJhbGc...',
                                ),
                                new OA\Property(property: 'token_type', type: 'string', example: 'bearer'),
                                new OA\Property(property: 'expires_in', type: 'integer', example: 3600),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Invalid or expired refresh token',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Invalid or expired refresh token.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation failed.'),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
        ],
    )]
    public function refresh(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'refresh_token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        try {
            $result = $this->authService->refreshToken($request->refresh_token);

            return $this->successResponse($result, 'Token refreshed successfully.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to refresh token.', 401);
        }
    }

    /**
     * Get current user.
     */
    #[OA\Get(
        path: '/api/v1/auth/me',
        summary: 'Get current authenticated user',
        description: 'Returns the details of the currently authenticated user including roles, permissions, and organization information.',
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
                description: 'User details retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'user',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(property: 'first_name', type: 'string', example: 'John'),
                                        new OA\Property(property: 'last_name', type: 'string', example: 'Doe'),
                                        new OA\Property(
                                            property: 'full_name',
                                            type: 'string',
                                            example: 'John Doe',
                                        ),
                                        new OA\Property(
                                            property: 'email',
                                            type: 'string',
                                            example: 'john.doe@example.com',
                                        ),
                                        new OA\Property(
                                            property: 'mobile_number',
                                            type: 'string',
                                            example: '9876543210',
                                        ),
                                        new OA\Property(
                                            property: 'designation',
                                            type: 'string',
                                            example: 'Manager',
                                        ),
                                        new OA\Property(property: 'district', type: 'string', example: 'Mumbai'),
                                        new OA\Property(property: 'state', type: 'string', example: 'Maharashtra'),
                                        new OA\Property(property: 'organization', type: 'object'),
                                        new OA\Property(
                                            property: 'roles',
                                            type: 'array',
                                            items: new OA\Items(type: 'object'),
                                        ),
                                        new OA\Property(
                                            property: 'permissions',
                                            type: 'array',
                                            items: new OA\Items(type: 'string'),
                                        ),
                                        new OA\Property(
                                            property: 'is_profile_completed',
                                            type: 'boolean',
                                            example: true,
                                        ),
                                    ],
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
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('activeRoles', 'organization');

        return $this->successResponse([
            'user' => [
                'id' => $user->id,
                'samar_id' => $user->samar_id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'mobile_number' => $user->mobile_number,
                'designation' => $user->designation,
                'district' => $user->district,
                'state' => $user->state,
                'organization' => $user->organization ? [
                    'id' => $user->organization->id,
                    'name' => $user->organization->name,
                    'is_verified' => $user->organization->is_verified,
                    'is_profile_completed' => $user->organization->is_profile_completed,
                ] : null,
                'roles' => $user->activeRoles->map(fn ($role) => [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                ]),
                'is_profile_completed' => $user->is_profile_completed,
                'assigned_states' => $user->assigned_states,
            ],
        ], 'User details retrieved successfully.');
    }
}
