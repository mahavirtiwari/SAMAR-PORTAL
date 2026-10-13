<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\DB;

class ErrorLog extends Model
{
    public const UPDATED_AT = null; // No updated_at for error logs

    // Severity constants
    public const SEVERITY_EMERGENCY = 'emergency';

    public const SEVERITY_CRITICAL = 'critical';

    public const SEVERITY_ERROR = 'error';

    public const SEVERITY_WARNING = 'warning';

    public const SEVERITY_NOTICE = 'notice';

    // Status constants
    public const STATUS_NEW = 'new';

    public const STATUS_INVESTIGATING = 'investigating';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_IGNORED = 'ignored';

    public const STATUS_ARCHIVED = 'archived';

    /**
     * Severity levels ordered least → most severe. Used to compare a captured
     * severity against the configured minimum threshold.
     *
     * @var array<int, string>
     */
    public const SEVERITY_ORDER = [
        self::SEVERITY_NOTICE,
        self::SEVERITY_WARNING,
        self::SEVERITY_ERROR,
        self::SEVERITY_CRITICAL,
        self::SEVERITY_EMERGENCY,
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'error_id',
        'error_group_id',
        'exception_class',
        'exception_message',
        'exception_code',
        'file',
        'line',
        'severity',
        'source',
        'http_status_code',
        'request_method',
        'request_url',
        'request_endpoint',
        'ip_address',
        'user_agent',
        'request_id',
        'user_id',
        'user_email',
        'user_roles',
        'stack_trace',
        'request_headers',
        'request_body',
        'request_query',
        'context',
        'environment',
        'server_hostname',
        'app_version',
        'fingerprint',
        'status',
        'resolved_by',
        'resolved_at',
        'resolution_notes',
        'notified',
        'tags',
        'occurred_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'line' => 'integer',
        'http_status_code' => 'integer',
        'user_roles' => 'array',
        'request_headers' => 'array',
        'request_body' => 'array',
        'request_query' => 'array',
        'context' => 'array',
        'tags' => 'array',
        'notified' => 'boolean',
        'occurred_at' => 'datetime',
        'resolved_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * Get the error group this log belongs to.
     */
    public function errorGroup(): BelongsTo
    {
        return $this->belongsTo(ErrorGroup::class);
    }

    /**
     * Get the user associated with this error.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the user who resolved this error.
     */
    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * Get the context snapshot for this error log.
     */
    public function contextSnapshot(): HasOne
    {
        return $this->hasOne(ErrorLogContextSnapshot::class);
    }

    /**
     * Generate a unique fingerprint for error grouping.
     */
    public static function generateFingerprint(
        string $exceptionClass,
        string $file,
        int $line,
        ?string $endpoint = null
    ): string {
        $data = $exceptionClass.'|'.$file.'|'.$line.'|'.($endpoint ?? 'no-endpoint');

        return hash('sha256', $data);
    }

    /**
     * Extract endpoint pattern from URL (replace IDs/UUIDs with placeholders).
     */
    public static function extractEndpoint(string $url): string
    {
        // Remove query string
        $url = parse_url($url, PHP_URL_PATH) ?? $url;

        // Replace numeric IDs with {id}
        $url = preg_replace('/\/\d+/', '/{id}', $url);

        // Replace UUIDs with {uuid}
        $url = preg_replace('/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i', '/{uuid}', $url);

        // Replace error IDs (ERR-XXXXXXXX) with {error-id}
        $url = preg_replace('/\/ERR-[A-Z0-9]{8}/', '/{error-id}', $url);

        return $url;
    }

    /**
     * Rank of a severity level (higher = more severe). Unknown levels rank at
     * the bottom so they are never dropped by the threshold gate.
     */
    public static function severityRank(string $severity): int
    {
        $rank = array_search($severity, self::SEVERITY_ORDER, true);

        return $rank === false ? 0 : $rank;
    }

    /**
     * Whether a severity meets or exceeds the given minimum threshold.
     */
    public static function severityMeetsThreshold(string $severity, string $minimum): bool
    {
        return self::severityRank($severity) >= self::severityRank($minimum);
    }

    /**
     * Scope to filter by severity.
     */
    public function scopeBySeverity($query, string $severity)
    {
        return $query->where('severity', $severity);
    }

    /**
     * Scope to filter by source (subsystem the failure came from).
     */
    public function scopeBySource($query, string $source)
    {
        return $query->where('source', $source);
    }

    /**
     * Scope to filter by status.
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to filter by date range.
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('occurred_at', [$startDate, $endDate]);
    }

    /**
     * Scope to get unresolved errors.
     */
    public function scopeUnresolved($query)
    {
        return $query->whereIn('status', [self::STATUS_NEW, self::STATUS_INVESTIGATING]);
    }

    /**
     * Get error statistics grouped by endpoint.
     */
    public static function getStatsByEndpoint(int $days = 30): array
    {
        return self::select('request_endpoint', DB::raw('count(*) as count'))
            ->where('occurred_at', '>=', now()->subDays($days))
            ->groupBy('request_endpoint')
            ->orderByDesc('count')
            ->limit(20)
            ->get()
            ->toArray();
    }

    /**
     * Get error trends over time.
     */
    public static function getTrends(int $days = 30): array
    {
        return self::select(
            DB::raw('DATE(occurred_at) as date'),
            'severity',
            DB::raw('count(*) as count')
        )
            ->where('occurred_at', '>=', now()->subDays($days))
            ->groupBy('date', 'severity')
            ->orderBy('date')
            ->get()
            ->groupBy('date')
            ->map(function ($dayErrors) {
                $result = ['total' => 0];
                foreach ($dayErrors as $error) {
                    $result[$error->severity] = $error->count;
                    $result['total'] += $error->count;
                }

                return $result;
            })
            ->toArray();
    }
}
