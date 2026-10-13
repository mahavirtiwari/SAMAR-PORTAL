<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PendingLoginSession extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'session_token',
        'otp_code',
        'otp_expires_at',
        'otp_attempts',
        'otp_locked_until',
        'ip_address',
        'user_agent',
        'device_type',
        'device_name',
        'device_id',
        'resend_count',
        'expires_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'otp_code',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'otp_expires_at' => 'datetime',
        'otp_locked_until' => 'datetime',
        'expires_at' => 'datetime',
    ];

    /**
     * Get the user that owns the pending login session.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Generate a new OTP code.
     *
     * @return string The plain OTP (not hashed)
     */
    public function generateOtp(?int $expiryMinutes = null): string
    {
        $expiryMinutes ??= (int) config('auth.otp.expiry_minutes');

        // Generate 6-digit OTP
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $this->update([
            'otp_code' => Hash::make($otp),
            'otp_expires_at' => now()->addMinutes($expiryMinutes),
            'otp_attempts' => 0,
            'otp_locked_until' => null,
        ]);

        return $otp;
    }

    /**
     * Verify the provided OTP.
     */
    public function verifyOtp(string $otp): bool
    {
        // Check if locked
        if ($this->isLocked()) {
            return false;
        }

        // Check if expired
        if ($this->isOtpExpired()) {
            return false;
        }

        // Verify OTP
        if (! Hash::check($otp, $this->otp_code)) {
            $this->increment('otp_attempts');

            // Lock if too many attempts
            if ($this->otp_attempts >= 5) {
                $this->update(['otp_locked_until' => now()->addMinutes(30)]);
            }

            return false;
        }

        return true;
    }

    /**
     * Check if the session is expired.
     */
    public function isExpired(): bool
    {
        return now()->gt($this->expires_at);
    }

    /**
     * Check if OTP is expired.
     */
    public function isOtpExpired(): bool
    {
        return ! $this->otp_expires_at || now()->gt($this->otp_expires_at);
    }

    /**
     * Check if OTP attempts are locked.
     */
    public function isLocked(): bool
    {
        return $this->otp_locked_until && now()->lt($this->otp_locked_until);
    }

    /**
     * Check if OTP can be resent.
     */
    public function canResend(int $maxResends = 3): bool
    {
        return $this->resend_count < $maxResends;
    }

    /**
     * Increment the resend counter.
     */
    public function incrementResendCount(): void
    {
        $this->increment('resend_count');
    }

    /**
     * Generate a unique session token.
     */
    public static function generateSessionToken(): string
    {
        return Str::random(64);
    }

    /**
     * Scope: Active (non-expired) sessions only.
     */
    public function scopeActive($query)
    {
        return $query->where('expires_at', '>', now());
    }

    /**
     * Get remaining lockout time in minutes.
     */
    public function getLockoutMinutesRemaining(): ?int
    {
        if (! $this->isLocked()) {
            return null;
        }

        return now()->diffInMinutes($this->otp_locked_until, false);
    }

    /**
     * Get remaining OTP attempts.
     */
    public function getRemainingAttempts(): int
    {
        return max(0, 5 - $this->otp_attempts);
    }
}
