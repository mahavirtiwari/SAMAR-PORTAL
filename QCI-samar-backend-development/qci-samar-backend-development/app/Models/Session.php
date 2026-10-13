<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Session extends Model
{
    use HasFactory;

    // termination_reason is a plain string column, so a new reason is a new constant here, not a migration.
    public const TERMINATION_LOGOUT = 'logout';

    public const TERMINATION_TIMEOUT = 'timeout';

    public const TERMINATION_FORCED = 'forced';

    public const TERMINATION_NEW_SESSION = 'new_session';

    public const TERMINATION_EXPIRED = 'expired';

    public const TERMINATION_PASSWORD_RESET = 'password_reset';

    public const TERMINATION_ORGANIZATION_INACTIVE = 'organization_inactive';

    public const TERMINATION_IDLE_TIMEOUT = 'idle_timeout';

    public const TERMINATION_SPOC_CHANGED = 'spoc_changed';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'session_id',
        'user_id',
        'token',
        'token_type',
        'expires_at',
        'ip_address',
        'user_agent',
        'device_type',
        'device_name',
        'device_id',
        'last_activity_at',
        'started_at',
        'ended_at',
        'is_active',
        'termination_reason',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'expires_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    /**
     * Get the user that owns the session.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Terminate the session.
     */
    public function terminate(string $reason = self::TERMINATION_LOGOUT): void
    {
        $this->update([
            'is_active' => false,
            'ended_at' => now(),
            'termination_reason' => $reason,
        ]);
    }

    /**
     * Update last activity timestamp.
     */
    public function updateActivity(): void
    {
        $this->update(['last_activity_at' => now()]);
    }

    /**
     * Check if session is expired.
     */
    public function isExpired(): bool
    {
        return now()->gt($this->expires_at);
    }

    /**
     * Scope: Active sessions only.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)->where('expires_at', '>', now());
    }

    /**
     * Scope: sessions that are active AND used within the last $minutes.
     *
     * "Used" is last_activity_at, which the ValidateActiveSession middleware
     * bumps on every authenticated request; a freshly created row that has not
     * yet made a request falls back to started_at. A client that silently
     * disappears (closed tab / killed app) stops bumping last_activity_at, so
     * its row drops out of this window even though is_active stays true until
     * an explicit termination or expiry. This is the liveness signal the
     * concurrent-login check needs so it doesn't flag abandoned sessions.
     */
    public function scopeLiveWithin($query, int $minutes)
    {
        $cutoff = now()->subMinutes($minutes);

        return $query->where('is_active', true)
            ->where('expires_at', '>', now())
            ->where(function ($q) use ($cutoff) {
                $q->where('last_activity_at', '>=', $cutoff)
                    ->orWhere(function ($q2) use ($cutoff) {
                        $q2->whereNull('last_activity_at')
                            ->where('started_at', '>=', $cutoff);
                    });
            });
    }
}
