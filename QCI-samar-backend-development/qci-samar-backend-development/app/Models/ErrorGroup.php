<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErrorGroup extends Model
{
    // Status constants
    public const STATUS_ACTIVE = 'active';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_IGNORED = 'ignored';

    public const STATUS_ARCHIVED = 'archived';

    // Severity constants
    public const SEVERITY_EMERGENCY = 'emergency';

    public const SEVERITY_CRITICAL = 'critical';

    public const SEVERITY_ERROR = 'error';

    public const SEVERITY_WARNING = 'warning';

    public const SEVERITY_NOTICE = 'notice';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'fingerprint',
        'signature',
        'exception_class',
        'exception_message',
        'file',
        'line',
        'request_endpoint',
        'source',
        'occurrences_count',
        'affected_users_count',
        'first_seen_at',
        'last_seen_at',
        'severity',
        'status',
        'assigned_to',
        'notes',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'line' => 'integer',
        'occurrences_count' => 'integer',
        'affected_users_count' => 'integer',
        'first_seen_at' => 'datetime',
        'last_seen_at' => 'datetime',
    ];

    /**
     * Get the error logs belonging to this group.
     */
    public function errorLogs(): HasMany
    {
        return $this->hasMany(ErrorLog::class);
    }

    /**
     * Get the user assigned to this error group.
     */
    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * Record a new occurrence of this error group.
     */
    public function recordOccurrence(bool $newAffectedUser = false): void
    {
        $this->increment('occurrences_count');
        $this->last_seen_at = now();

        if ($newAffectedUser) {
            $this->increment('affected_users_count');
        }

        $this->save();
    }

    /**
     * Generate a human-readable signature.
     */
    public static function generateSignature(string $exceptionClass, string $file, int $line): string
    {
        $className = class_basename($exceptionClass);
        $fileName = basename($file);

        return "{$className} at {$fileName}:{$line}";
    }

    /**
     * Scope to get active error groups.
     */
    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    /**
     * Scope to get recently active error groups.
     */
    public function scopeRecentlyActive($query, int $days = 7)
    {
        return $query->where('last_seen_at', '>=', now()->subDays($days));
    }
}
