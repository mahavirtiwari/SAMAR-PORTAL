<?php

namespace App\Services\Auth;

use App\Exceptions\AuthenticationFailedException;
use App\Models\Organization;
use App\Models\PendingLoginSession;
use App\Models\Role;
use App\Models\Session;
use App\Models\User;
use App\Services\Email\EmailNotificationService;
use App\Services\StateMachine\UserStateMachine;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

class AuthService
{
    /**
     * Create a new AuthService instance.
     */
    public function __construct(
        private EmailNotificationService $emailNotificationService
    ) {}

    /**
     * Register a new organization and enterprise admin user.
     *
     * @throws \Exception
     */
    public function register(array $data): array
    {
        // Duplicate emails are allowed: each registration creates its own
        // organization + enterprise-admin user (identity is the unique samar_id,
        // not email). Accidental duplicate orgs from a replayed register POST are
        // prevented client-side by not retrying non-idempotent requests.
        DB::beginTransaction();

        try {
            // Create organization
            $organization = Organization::create([
                'name' => $data['organization_name'],
                'email' => $data['email'],
                'mobile_number' => $data['mobile_number'] ?? null,
                'status' => 'pending_details',
                'is_verified' => false,
                'is_profile_completed' => false,
            ]);

            // Generate initial password
            $password = $this->generatePassword();

            // Create user
            $user = User::create([
                'organization_id' => $organization->id,
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $data['email'],
                'mobile_number' => $data['mobile_number'] ?? null,
                'password' => $password,
                'status' => 'pending_verification',
            ]);

            // Assign EnterpriseAdmin role
            $user->assignRole(Role::ENTERPRISE_ADMIN, $organization->id);

            // Generate OTP for email/phone verification
            $otp = $user->generateOtp();

            DB::commit();

            // Send OTP verification email
            try {
                $this->emailNotificationService->sendEmail(
                    $user,
                    'otp-verification',
                    [
                        'otp_code' => $otp,
                        'otp_expires_in' => ((int) config('auth.otp.expiry_minutes')).' minutes',
                    ]
                );
            } catch (\Exception $e) {
                Log::error('Failed to send OTP verification email', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'error' => $e->getMessage(),
                ]);
                // Don't throw - graceful failure
            }

            return [
                'user' => $user,
                'organization' => $organization,
                'otp' => $otp,
                'is_resend' => false,
                // temp_password removed for security - only sent via email
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Verify OTP and activate account.
     *
     * @throws \Exception
     */
    public function verifyOtp(string $samarId, string $otp): array
    {
        $user = User::where('samar_id', strtoupper($samarId))->first();

        if (! $user) {
            throw new \Exception('User not found.');
        }

        if (! $user->verifyOtp($otp)) {
            throw new \Exception('Invalid or expired OTP.');
        }

        // Generate new password for the user (since we can't retrieve the hashed one)
        $password = $this->generatePassword();
        $user->password = $password;
        $user->save();

        // Transition user to active status using state machine
        $user->transitionTo(UserStateMachine::TRANSITION_VERIFY);

        // Send registration successful email with credentials
        try {
            $this->emailNotificationService->sendEmail(
                $user,
                'registration-successful',
                [
                    'samar_id' => $user->samar_id,
                    'organization_name' => $user->organization->name ?? 'N/A',
                    'password' => $password,
                    'login_url' => config('app.frontend_url'),
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send registration successful email', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);
            // Don't throw - graceful failure
        }

        return [
            'user' => $user->fresh(),
            'message' => 'Account verified successfully. Your login credentials have been sent to your email.',
        ];
    }

    /**
     * Login user with SAMAR ID and password (Step 1: Create pending session and send OTP).
     *
     *
     * @throws \Exception
     */
    public function login(string $identifier, string $password, array $deviceInfo = []): array
    {
        $user = $this->authenticateByPassword($identifier, $password);

        // Only allow statuses that permit login (active and invited)
        // Invited users will be activated after successful OTP verification
        if (! in_array($user->status, UserStateMachine::getLoginAllowedStatuses())) {
            throw new \Exception('Account is not active. Please contact support.');
        }

        // Check if user's organization is active (for organization-dependent roles)
        $user->load(['organization', 'activeRoles']);
        if (! $user->hasActiveOrganization()) {
            throw new \Exception($user->getOrganizationInactiveMessage());
        }

        // Check if 2FA is disabled - if so, skip OTP and login directly
        if (! $user->is_two_factor_enabled) {
            // Check if single session enforcement is required
            $requiresSingleSession = config('auth.single_session.enabled')
                && $user->activeRoles()
                    ->where('enforce_single_session', true)
                    ->exists();

            if ($requiresSingleSession) {
                // Displace only same-class sessions: a mobile login ends the other
                // mobile session, a web login ends the other web session; web and one
                // mobile session may coexist.
                $this->terminateUserSessions($user, Session::TERMINATION_NEW_SESSION, $deviceInfo['device_type'] ?? 'web', $deviceInfo['device_id'] ?? null);
            }

            // Generate JWT tokens
            $token = JWTAuth::fromUser($user);
            $refreshToken = $this->generateRefreshToken($user, $deviceInfo['device_type'] ?? 'web', $deviceInfo['device_name'] ?? null, $deviceInfo['device_id'] ?? null);

            // Create session record
            $sessionId = Str::uuid()->toString();
            Session::create([
                'session_id' => $sessionId,
                'user_id' => $user->id,
                'token' => $token,
                'token_type' => 'access',
                'expires_at' => now()->addMinutes(config('jwt.ttl')),
                'ip_address' => $deviceInfo['ip'] ?? request()->ip(),
                'user_agent' => $deviceInfo['user_agent'] ?? request()->userAgent(),
                'device_type' => $deviceInfo['device_type'] ?? 'web',
                'device_name' => $deviceInfo['device_name'] ?? null,
                'device_id' => $deviceInfo['device_id'] ?? null,
                'is_active' => true,
                'started_at' => now(),
            ]);

            // Activate invited users on first successful login (when 2FA is disabled)
            $wasInvited = $user->status === UserStateMachine::STATUS_INVITED;
            if ($wasInvited) {
                $user->transitionTo(UserStateMachine::TRANSITION_VERIFY);
            }

            // Update user's current session (use forceFill since session fields are not mass-assignable)
            $user->forceFill([
                'current_session_id' => $sessionId,
                'session_started_at' => now(),
                'last_login_at' => now(),
                'last_login_ip' => $deviceInfo['ip'] ?? request()->ip(),
            ])->save();

            $user->logAudit('login', description: 'User logged in.', metadata: [
                'device_type' => $deviceInfo['device_type'] ?? 'web',
                'device_name' => $deviceInfo['device_name'] ?? null,
                'device_id' => $deviceInfo['device_id'] ?? null,
            ], actor: $user);

            Log::info('User logged in without 2FA (2FA disabled)', [
                'user_id' => $user->id,
                'was_invited' => $wasInvited,
            ]);

            $accessTokenTtl = (int) config('jwt.ttl') * 60; // In seconds
            $refreshTokenTtl = (int) config('jwt.refresh_ttl') * 60; // In seconds

            return [
                'direct_login' => true,
                'user' => $user->fresh()->load('activeRoles'),
                'access_token' => $token,
                'refresh_token' => $refreshToken,
                'token_type' => 'Bearer',
                'expires_in' => $accessTokenTtl,
                'refresh_expires_in' => $refreshTokenTtl,
                'access_token_expiration' => now()->addSeconds($accessTokenTtl)->setTimezone('Asia/Kolkata')->toIso8601String(),
                'refresh_token_expiration' => now()->addSeconds($refreshTokenTtl)->setTimezone('Asia/Kolkata')->toIso8601String(),
            ];
        }

        // Delete any existing pending sessions for this user
        PendingLoginSession::where('user_id', $user->id)->delete();

        $otpExpiryMinutes = (int) config('auth.otp.expiry_minutes');

        // Create pending login session
        $sessionToken = PendingLoginSession::generateSessionToken();
        $pendingSession = PendingLoginSession::create([
            'user_id' => $user->id,
            'session_token' => $sessionToken,
            'otp_code' => '', // Will be set by generateOtp()
            'otp_expires_at' => now()->addMinutes($otpExpiryMinutes),
            'ip_address' => $deviceInfo['ip'] ?? request()->ip(),
            'user_agent' => $deviceInfo['user_agent'] ?? request()->userAgent(),
            'device_type' => $deviceInfo['device_type'] ?? 'web',
            'device_name' => $deviceInfo['device_name'] ?? null,
            'device_id' => $deviceInfo['device_id'] ?? null,
            // Session window outlives the OTP so resend stays available after expiry
            'expires_at' => now()->addMinutes(15),
        ]);

        // Generate OTP
        $otp = $pendingSession->generateOtp();

        // Send OTP via email
        try {
            $this->emailNotificationService->sendEmail(
                $user,
                'login-otp-verification',
                [
                    'otp_code' => $otp,
                    'otp_expires_in' => $otpExpiryMinutes.' minutes',
                    'device_type' => $deviceInfo['device_type'] ?? 'web',
                    'device_name' => $deviceInfo['device_name'] ?? 'Unknown device',
                    'ip_address' => $deviceInfo['ip'] ?? request()->ip(),
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send login OTP email', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            // Don't throw - graceful failure
        }

        return [
            'pending_session' => $pendingSession,
            'user' => $user,
        ];
    }

    /**
     * Check whether the user already has an active session on another device.
     * Credentials are verified first so session existence is never leaked to
     * an unauthenticated caller.
     *
     * @throws \Exception
     */
    public function checkActiveSession(string $identifier, string $password, ?string $deviceType = null, ?string $deviceId = null): array
    {
        $user = $this->authenticateByPassword($identifier, $password);

        // Credentials are still verified above even when the check is switched
        // off, so this endpoint keeps feeding the lockout counter.
        if (! config('auth.single_session.enabled')) {
            return ['has_active_session' => false, 'device' => null];
        }

        $query = $this->scopeToSessionClass(
            Session::where('user_id', $user->id)->where('token_type', 'access')
                ->liveWithin((int) config('auth.session.liveness_minutes')),
            $deviceType
        );

        // Don't report the caller's own device as "another device": spare the same
        // device_id so a re-login from the same install isn't flagged as a conflict.
        if ($deviceId !== null) {
            $query->where(function ($q) use ($deviceId) {
                $q->where('device_id', '!=', $deviceId)
                    ->orWhereNull('device_id');
            });
        }

        $session = $query
            ->latest('started_at')
            ->first();

        if (! $session) {
            return ['has_active_session' => false, 'device' => null];
        }

        return [
            'has_active_session' => true,
            'device' => [
                'device_type' => $session->device_type,
                'device_name' => $session->device_name,
                'ip_address' => $session->ip_address,
                'last_activity_at' => optional($session->last_activity_at ?? $session->started_at)
                    ->setTimezone('Asia/Kolkata')->toIso8601String(),
            ],
        ];
    }

    /**
     * Verify login OTP and complete authentication (Step 2: Verify OTP and issue tokens).
     *
     * @throws \Exception
     */
    public function verifyLoginOtp(string $sessionToken, string $otp, array $deviceInfo = []): array
    {
        // Find pending session
        $pendingSession = PendingLoginSession::where('session_token', $sessionToken)
            ->active()
            ->first();

        if (! $pendingSession) {
            throw new \Exception('Invalid or expired session token.');
        }

        // Check if session is expired
        if ($pendingSession->isExpired()) {
            $pendingSession->delete();
            throw new \Exception('Session has expired. Please login again.');
        }

        // Check if locked
        if ($pendingSession->isLocked()) {
            $minutesRemaining = $pendingSession->getLockoutMinutesRemaining();
            throw new \Exception("Too many failed attempts. Please try again in {$minutesRemaining} minutes.");
        }

        // Verify OTP
        if (! $pendingSession->verifyOtp($otp)) {
            $remainingAttempts = $pendingSession->fresh()->getRemainingAttempts();

            if ($remainingAttempts > 0) {
                throw new \Exception("Invalid OTP. You have {$remainingAttempts} attempts remaining.");
            } else {
                throw new \Exception('Account locked due to multiple failed attempts. Please try again in 30 minutes.');
            }
        }

        // OTP verified successfully - proceed with login
        $user = $pendingSession->user;

        // Check if user's organization is active (for organization-dependent roles)
        // Eager load all relationships needed for validation and response
        $user->load(['organization', 'activeRoles']);
        if (! $user->hasActiveOrganization()) {
            $pendingSession->delete();
            throw new \Exception($user->getOrganizationInactiveMessage());
        }

        // Activate invited users on first successful OTP verification
        if ($user->status === UserStateMachine::STATUS_INVITED) {
            $user->transitionTo(UserStateMachine::TRANSITION_VERIFY);

            Log::info('Invited user activated after first successful login OTP verification', [
                'user_id' => $user->id,
            ]);
        }

        // Check if single session enforcement is required
        $requiresSingleSession = config('auth.single_session.enabled')
            && $user->activeRoles()
                ->where('enforce_single_session', true)
                ->exists();

        $deviceType = $deviceInfo['device_type'] ?? $pendingSession->device_type ?? 'web';
        $deviceName = $deviceInfo['device_name'] ?? $pendingSession->device_name;
        $deviceId = $deviceInfo['device_id'] ?? $pendingSession->device_id;

        if ($requiresSingleSession) {
            // Displace only same-class sessions (see login()): web + one mobile coexist.
            $this->terminateUserSessions($user, Session::TERMINATION_NEW_SESSION, $deviceType, $deviceId);
        }

        // Generate JWT tokens
        $token = JWTAuth::fromUser($user);
        $refreshToken = $this->generateRefreshToken($user, $deviceType, $deviceName, $deviceId);

        // Create session record
        $sessionId = Str::uuid()->toString();
        $session = Session::create([
            'session_id' => $sessionId,
            'user_id' => $user->id,
            'token' => $token,
            'token_type' => 'access',
            'expires_at' => now()->addMinutes(config('jwt.ttl')),
            'ip_address' => $deviceInfo['ip'] ?? $pendingSession->ip_address,
            'user_agent' => $deviceInfo['user_agent'] ?? $pendingSession->user_agent,
            'device_type' => $deviceType,
            'device_name' => $deviceInfo['device_name'] ?? $pendingSession->device_name,
            'device_id' => $deviceId,
            'is_active' => true,
            'started_at' => now(),
        ]);

        // Update user's current session (use forceFill since session fields are not mass-assignable)
        $user->forceFill([
            'current_session_id' => $sessionId,
            'session_started_at' => now(),
            'last_login_at' => now(),
            'last_login_ip' => $deviceInfo['ip'] ?? $pendingSession->ip_address,
        ])->save();

        $user->logAudit('login', description: 'User logged in.', metadata: [
            'device_type' => $deviceType,
            'device_name' => $deviceName,
            'device_id' => $deviceId,
        ], actor: $user);

        // Delete pending session
        $pendingSession->delete();

        $accessTokenTtl = (int) config('jwt.ttl') * 60; // In seconds
        $refreshTokenTtl = (int) config('jwt.refresh_ttl') * 60; // In seconds

        return [
            'user' => $user,
            'access_token' => $token,
            'refresh_token' => $refreshToken,
            'token_type' => 'Bearer',
            'expires_in' => $accessTokenTtl,
            'refresh_expires_in' => $refreshTokenTtl,
            'access_token_expiration' => now()->addSeconds($accessTokenTtl)->setTimezone('Asia/Kolkata')->toIso8601String(),
            'refresh_token_expiration' => now()->addSeconds($refreshTokenTtl)->setTimezone('Asia/Kolkata')->toIso8601String(),
        ];
    }

    /**
     * Resend login OTP for pending session.
     *
     * @throws \Exception
     */
    public function resendLoginOtp(string $sessionToken): array
    {
        // Find pending session
        $pendingSession = PendingLoginSession::where('session_token', $sessionToken)
            ->active()
            ->first();

        if (! $pendingSession) {
            throw new \Exception('Invalid or expired session token.');
        }

        // Check if session is expired
        if ($pendingSession->isExpired()) {
            $pendingSession->delete();
            throw new \Exception('Session has expired. Please login again.');
        }

        // Check if can resend
        if (! $pendingSession->canResend()) {
            throw new \Exception('Maximum OTP resend limit reached. Please login again.');
        }

        // Generate new OTP
        $otp = $pendingSession->generateOtp();

        // Increment resend count
        $pendingSession->incrementResendCount();

        // Send OTP via email
        $user = $pendingSession->user;
        try {
            $this->emailNotificationService->sendEmail(
                $user,
                'login-otp-verification',
                [
                    'otp_code' => $otp,
                    'otp_expires_in' => ((int) config('auth.otp.expiry_minutes')).' minutes',
                    'device_type' => $pendingSession->device_type,
                    'device_name' => $pendingSession->device_name ?? 'Unknown device',
                    'ip_address' => $pendingSession->ip_address,
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to resend login OTP email', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);
            // Don't throw - graceful failure
        }

        return [
            'message' => 'OTP has been resent successfully.',
            'resend_count' => $pendingSession->resend_count,
            'max_resends' => 3,
        ];
    }

    /**
     * Logout user and terminate session.
     */
    public function logout(User $user): void
    {
        $user->logAudit('logout', description: 'User logged out.', actor: $user);

        // Terminate all active sessions (access + refresh) FIRST so a failure to
        // blacklist the JWT below can never leave a live session row behind — that
        // row would keep the user "active" for new logins until it expires.
        $this->terminateUserSessions($user, Session::TERMINATION_LOGOUT);

        // Best-effort JWT blacklist; the token may already be expired or blacklisted
        // (e.g. a pre-request refresh just rotated it), which must not fail logout.
        try {
            JWTAuth::invalidate(JWTAuth::getToken());
        } catch (\Throwable) {
            // Session is already terminated; a stale/blacklisted token is harmless.
        }
    }

    /**
     * Refresh JWT token.
     *
     * @throws \Exception
     */
    public function refreshToken(string $refreshToken): array
    {
        // Verify refresh token
        $session = Session::where('token', $refreshToken)
            ->where('token_type', 'refresh')
            ->where('is_active', true)
            ->where('expires_at', '>', now())
            ->first();

        if (! $session) {
            throw new \Exception('Invalid or expired refresh token.');
        }

        $user = $session->user;

        // Check if user's organization is active (for organization-dependent roles)
        $user->load(['organization', 'activeRoles']);
        if (! $user->hasActiveOrganization()) {
            $session->update(['is_active' => false, 'ended_at' => now(), 'termination_reason' => Session::TERMINATION_ORGANIZATION_INACTIVE]);
            throw new \Exception($user->getOrganizationInactiveMessage());
        }

        // Idle timeout (web/interactive clients only). The refresh token slides
        // forward on every use, so without this an active-then-idle web session
        // would never expire. Reject the refresh once the user has had no
        // activity within idle_timeout_minutes — the resulting 401 makes the web
        // client log out. Mobile (ios/android) is exempt: offline field work
        // legitimately sends no requests for hours while queuing to the outbox,
        // so server-side idleness is not inactivity there. See BUG-05769.
        if ($this->sessionClassFor($session->device_type ?? 'web') === 'web') {
            $idleMinutes = (int) config('auth.session.idle_timeout_minutes', 60);
            $recentlyActive = Session::where('user_id', $user->id)
                ->where('token_type', 'access')
                ->where('device_type', $session->device_type ?? 'web')
                ->where('last_activity_at', '>=', now()->subMinutes($idleMinutes))
                ->exists();

            if (! $recentlyActive) {
                $session->terminate(Session::TERMINATION_IDLE_TIMEOUT);
                throw new \Exception('Your session has expired due to inactivity. Please log in again.');
            }
        }

        // Rotate: retire the presented refresh row so it can't be replayed and
        // active refresh rows don't accumulate.
        $session->terminate(Session::TERMINATION_EXPIRED);

        $deviceType = $session->device_type ?? 'web';

        // Retire the class's other refresh rows before minting the replacement,
        // so refresh rows never accumulate. Access rows are deliberately left to
        // their own expiry: the client's requests already on the wire still carry
        // the previous access token, and ending that row here answered them with
        // SESSION_TERMINATED and forced a logout mid-assessment. An expired
        // access row is refused by ValidateActiveSession on its own. The
        // concurrent-login check can see the superseded row for at most one
        // access-token lifetime, and it carries the same device_id as the fresh
        // row, so the same-device exemption treats both alike. Scoped to the
        // same device class (web vs mobile) so a coexisting session on the other
        // class survives.
        $this->terminateUserSessions($user, Session::TERMINATION_EXPIRED, $deviceType, null, 'refresh');

        // Generate new access token. Both new rows keep the device_id: a row
        // without one counts as "another device" in checkActiveSession, so a
        // same-device re-login after a rotation was wrongly warned about itself.
        $newToken = JWTAuth::fromUser($user);
        $refreshToken = $this->generateRefreshToken($user, $deviceType, $session->device_name, $session->device_id);

        // Create new session for access token, preserving the device class so
        // single-session scoping survives token rotation.
        $sessionId = Str::uuid()->toString();
        Session::create([
            'session_id' => $sessionId,
            'user_id' => $user->id,
            'token' => $newToken,
            'token_type' => 'access',
            'expires_at' => now()->addMinutes(config('jwt.ttl')),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'device_type' => $deviceType,
            'device_name' => $session->device_name,
            'device_id' => $session->device_id,
            'is_active' => true,
            'started_at' => now(),
        ]);

        $accessTokenTtl = (int) config('jwt.ttl') * 60; // In seconds
        $refreshTokenTtl = (int) config('jwt.refresh_ttl') * 60; // In seconds

        return [
            'access_token' => $newToken,
            'refresh_token' => $refreshToken,
            'token_type' => 'Bearer',
            'access_token_expiration' => now()->addSeconds($accessTokenTtl)->setTimezone('Asia/Kolkata')->toIso8601String(),
            'refresh_token_expiration' => now()->addSeconds($refreshTokenTtl)->setTimezone('Asia/Kolkata')->toIso8601String(),
        ];
    }

    /**
     * Change user password.
     *
     * @throws \Exception
     */
    public function changePassword(User $user, string $currentPassword, string $newPassword): void
    {
        // Verify current password
        if (! Hash::check($currentPassword, $user->password)) {
            throw new \Exception('Current password is incorrect.');
        }

        // Validate password strength
        $this->validatePasswordStrength($newPassword);

        // Update password
        $user->update([
            'password' => $newPassword,
            'password_changed_at' => now(),
        ]);

        $user->logAudit('password_change', description: 'User changed their password.', actor: $user);

        // Send password change confirmation email
        try {
            $this->emailNotificationService->sendEmail(
                $user,
                'password-reset-confirmation',
                [
                    'changed_at' => now()->setTimezone('Asia/Kolkata')->format('d M Y, h:i A'),
                    'ip_address' => request()->ip(),
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send password change confirmation email', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Initiate password reset.
     *
     * @param  string  $identifier  SAMAR ID
     *
     * @throws \Exception
     */
    public function forgotPassword(string $identifier): array
    {
        // Support forgot password with SAMAR ID only
        $user = User::where('samar_id', strtoupper($identifier))
            ->first();

        if (! $user) {
            throw new \Exception('User not found.');
        }

        // Check if user's organization is active (for organization-dependent roles)
        $user->load(['organization', 'activeRoles']);
        if (! $user->hasActiveOrganization()) {
            throw new \Exception($user->getOrganizationInactiveMessage());
        }

        // Check if account is locked due to too many OTP attempts
        if ($user->otp_locked_until && now()->lt($user->otp_locked_until)) {
            $minutesRemaining = now()->diffInMinutes($user->otp_locked_until);
            throw new \Exception("Account is temporarily locked. Please try again in {$minutesRemaining} minutes.");
        }

        // Generate 6-digit OTP (validity from config: auth.otp.expiry_minutes)
        $otp = $user->generateOtp(6);

        // Send password reset email
        try {
            $this->emailNotificationService->sendEmail(
                $user,
                'password-reset',
                [
                    'reset_token' => $otp,
                    'otp_code' => $otp,
                    'otp_expires_in' => ((int) config('auth.otp.expiry_minutes')).' minutes',
                ],
                ['channels' => ['email']]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send password reset email', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);
            // Don't throw - password reset still works even if email fails
        }

        // Log password reset request for security audit
        Log::info('Password reset OTP generated', [
            'user_id' => $user->id,
            'ip_address' => request()->ip(),
        ]);

        return [
            'user' => $user,
            'reset_token' => $otp,
        ];
    }

    /**
     * Reset password using OTP.
     *
     * @param  string  $identifier  SAMAR ID
     *
     * @throws \Exception
     */
    public function resetPassword(string $identifier, string $otp, string $newPassword): void
    {
        // Support reset password with SAMAR ID only
        $user = User::where('samar_id', strtoupper($identifier))
            ->first();

        if (! $user) {
            throw new \Exception('User not found.');
        }

        // Check if user's organization is active (for organization-dependent roles)
        $user->load(['organization', 'activeRoles']);
        if (! $user->hasActiveOrganization()) {
            throw new \Exception($user->getOrganizationInactiveMessage());
        }

        // Check if account is locked due to too many OTP attempts
        if ($user->otp_locked_until && now()->lt($user->otp_locked_until)) {
            $minutesRemaining = now()->diffInMinutes($user->otp_locked_until);
            throw new \Exception("Account is temporarily locked due to multiple failed attempts. Please try again in {$minutesRemaining} minutes.");
        }

        // Verify OTP
        if (! $user->verifyOtp($otp)) {
            $attemptsRemaining = max(0, 5 - $user->otp_attempts);

            if ($attemptsRemaining > 0) {
                throw new \Exception("Invalid or expired OTP. You have {$attemptsRemaining} attempts remaining.");
            } else {
                throw new \Exception('Account locked due to multiple failed attempts. Please try again in 30 minutes.');
            }
        }

        // Validate password strength
        $this->validatePasswordStrength($newPassword);

        // Update password
        $user->update([
            'password' => $newPassword,
            'password_changed_at' => now(),
        ]);

        $user->logAudit('password_reset', description: 'User reset their password via OTP.', actor: $user);

        // Log successful password reset
        Log::info('Password reset successful', [
            'user_id' => $user->id,
            'email' => $user->email,
            'ip_address' => request()->ip(),
        ]);

        // Terminate all sessions
        $this->terminateUserSessions($user, Session::TERMINATION_PASSWORD_RESET);

        // Send password reset confirmation email
        try {
            $this->emailNotificationService->sendEmail(
                $user,
                'password-reset-confirmation',
                [
                    'changed_at' => now()->setTimezone('Asia/Kolkata')->format('d M Y, h:i A'),
                    'ip_address' => request()->ip(),
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send password reset confirmation email', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Resolve a user by SAMAR ID and verify their password, enforcing the
     * account lockout. Shared by login() and checkActiveSession() so every
     * password-check entry point feeds the same failed-attempt counter — the
     * lockout cannot be bypassed by exhausting attempts on one endpoint.
     *
     * @throws AuthenticationFailedException
     */
    private function authenticateByPassword(string $identifier, string $password): User
    {
        $user = User::where('samar_id', strtoupper($identifier))->first();

        if (! $user) {
            throw new AuthenticationFailedException('Invalid credentials.');
        }

        if ($user->isLocked()) {
            throw new AuthenticationFailedException('Account is locked. Please try again later.');
        }

        if (! Hash::check($password, $user->password)) {
            $user->recordFailedLogin();

            $user->logAudit('login_failed', description: 'Failed login attempt.', metadata: [
                'reason' => 'invalid_password',
                'failed_login_attempts' => $user->failed_login_attempts,
            ], actor: $user);

            // recordFailedLogin() may have just tripped the lockout; record that
            // transition as its own security event.
            if ($user->isLocked()) {
                $user->logAudit('account_locked', description: 'Account locked after repeated failed login attempts.', metadata: [
                    'failed_login_attempts' => $user->failed_login_attempts,
                    'locked_until' => optional($user->locked_until)->toIso8601String(),
                ], actor: $user);
            }

            throw new AuthenticationFailedException('Invalid credentials.');
        }

        $user->resetFailedLogins();

        return $user;
    }

    /**
     * Terminate a user's sessions. When $deviceType is given, only sessions of the
     * same class are ended (a mobile login displaces the other mobile session, a web
     * login the other web session) so web + one mobile can coexist. A null
     * $deviceType ends every session — used by logout and password reset. A
     * $tokenType narrows the termination to one row kind (token rotation retires
     * refresh rows only).
     */
    public function terminateUserSessions(User $user, string $reason, ?string $deviceType = null, ?string $exceptDeviceId = null, ?string $tokenType = null): void
    {
        $query = $this->scopeToSessionClass(
            Session::where('user_id', $user->id)->where('is_active', true),
            $deviceType
        );

        if ($tokenType !== null) {
            $query->where('token_type', $tokenType);
        }

        // When the caller identifies its own device, spare that device's sessions so a
        // re-login (or a concurrent double login) from the same install never terminates
        // its own just-issued token as 'new_session' (BUG-06042). Sessions from other
        // devices — and legacy rows with no device_id — are still displaced.
        if ($exceptDeviceId !== null) {
            $query->where(function ($q) use ($exceptDeviceId) {
                $q->where('device_id', '!=', $exceptDeviceId)
                    ->orWhereNull('device_id');
            });
        }

        $query->update([
            'is_active' => false,
            'ended_at' => now(),
            'termination_reason' => $reason,
        ]);

        // Only clear the session pointer on a full termination. A class-scoped
        // termination is always followed by a fresh login that rewrites
        // current_session_id, and must not disturb a surviving session of the
        // other class.
        if ($deviceType === null) {
            $user->forceFill([
                'current_session_id' => null,
                'session_started_at' => null,
            ])->save();
        }
    }

    /**
     * Session "class" for single-session scoping: native app installs (ios/android)
     * are the "mobile" class; every browser session (web/tablet/mobile) is "web".
     */
    private function sessionClassFor(?string $deviceType): string
    {
        return in_array($deviceType, ['ios', 'android'], true) ? 'mobile' : 'web';
    }

    /**
     * Constrain a session query to the same class as $deviceType. A null
     * $deviceType applies no filter (all classes). Legacy rows with a null
     * device_type fall outside every class and are only cleared by an unscoped
     * termination — acceptable since they age out on next login.
     *
     * @param  Builder  $query
     * @return Builder
     */
    private function scopeToSessionClass($query, ?string $deviceType)
    {
        if ($deviceType === null) {
            return $query;
        }

        return $query->whereIn('device_type', $this->sessionClassFor($deviceType) === 'mobile'
            ? ['ios', 'android']
            : ['web', 'tablet', 'mobile']);
    }

    /**
     * Generate initial password for new users.
     */
    private function generatePassword(): string
    {
        return Str::random(7);
    }

    /**
     * Generate refresh token. The device class is recorded so single-session
     * scoping can displace the matching refresh row alongside its access row.
     */
    private function generateRefreshToken(User $user, ?string $deviceType = null, ?string $deviceName = null, ?string $deviceId = null): string
    {
        $refreshToken = Str::random(64);

        // Store refresh token in session table
        Session::create([
            'session_id' => Str::uuid()->toString(),
            'user_id' => $user->id,
            'token' => $refreshToken,
            'token_type' => 'refresh',
            'expires_at' => now()->addMinutes((int) config('jwt.refresh_ttl')),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'device_type' => $deviceType,
            'device_name' => $deviceName,
            'device_id' => $deviceId,
            'is_active' => true,
            'started_at' => now(),
        ]);

        return $refreshToken;
    }

    /**
     * Validate password strength.
     *
     * @throws \Exception
     */
    private function validatePasswordStrength(string $password): void
    {
        if (strlen($password) < 7) {
            throw new \Exception('Password must be at least 7 characters long.');
        }

        // if (!preg_match('/[A-Z]/', $password)) {
        //     throw new \Exception('Password must contain at least one uppercase letter.');
        // }

        // if (!preg_match('/[a-z]/', $password)) {
        //     throw new \Exception('Password must contain at least one lowercase letter.');
        // }

        // if (!preg_match('/[0-9]/', $password)) {
        //     throw new \Exception('Password must contain at least one number.');
        // }

        // if (!preg_match('/[!@#$%^&*(),.?":{}|<>]/', $password)) {
        //     throw new \Exception('Password must contain at least one special character.');
        // }
    }

    /**
     * Get two-factor authentication status for user.
     */
    public function getTwoFactorStatus(User $user): array
    {
        return [
            'is_two_factor_enabled' => $user->is_two_factor_enabled,
        ];
    }

    /**
     * Enable two-factor authentication for user.
     *
     * @throws \Exception
     */
    public function enableTwoFactor(User $user): array
    {
        if ($user->is_two_factor_enabled) {
            throw new \Exception('Two-factor authentication is already enabled.');
        }

        // Update user
        $user->update([
            'is_two_factor_enabled' => true,
        ]);

        // Log event
        Log::info('Two-factor authentication enabled', [
            'user_id' => $user->id,
            'email' => $user->email,
            'ip_address' => request()->ip(),
        ]);

        // Send email notification
        try {
            $this->emailNotificationService->sendEmail(
                $user,
                '2fa-enabled',
                [
                    'enabled_at' => now()->setTimezone('Asia/Kolkata')->format('Y-m-d H:i:s'),
                    'ip_address' => request()->ip(),
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send 2FA enabled email', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);
            // Don't throw - graceful failure
        }

        return [
            'is_two_factor_enabled' => true,
        ];
    }

    /**
     * Disable two-factor authentication for user.
     *
     * @throws \Exception
     */
    public function disableTwoFactor(User $user, string $currentPassword): array
    {
        if (! $user->is_two_factor_enabled) {
            throw new \Exception('Two-factor authentication is already disabled.');
        }

        // Verify current password
        if (! Hash::check($currentPassword, $user->password)) {
            throw new \Exception('The provided password is incorrect.');
        }

        // Update user
        $user->update([
            'is_two_factor_enabled' => false,
        ]);

        // Log event with warning level (security change)
        Log::warning('Two-factor authentication disabled', [
            'user_id' => $user->id,
            'email' => $user->email,
            'ip_address' => request()->ip(),
        ]);

        // Send email notification
        try {
            $this->emailNotificationService->sendEmail(
                $user,
                '2fa-disabled',
                [
                    'disabled_at' => now()->setTimezone('Asia/Kolkata')->format('Y-m-d H:i:s'),
                    'ip_address' => request()->ip(),
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send 2FA disabled email', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);
            // Don't throw - graceful failure
        }

        return [
            'is_two_factor_enabled' => false,
        ];
    }
}
