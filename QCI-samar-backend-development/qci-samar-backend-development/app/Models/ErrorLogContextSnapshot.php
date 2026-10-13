<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErrorLogContextSnapshot extends Model
{
    public const UPDATED_AT = null; // No updated_at for snapshots

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'error_log_id',
        'server_variables',
        'config_snapshot',
        'session_data',
        'route_parameters',
        'database_queries',
        'query_count',
        'query_time_ms',
        'memory_usage_bytes',
        'memory_peak_bytes',
        'execution_time_ms',
        'previous_exceptions',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'server_variables' => 'array',
        'config_snapshot' => 'array',
        'session_data' => 'array',
        'route_parameters' => 'array',
        'database_queries' => 'array',
        'previous_exceptions' => 'array',
        'query_count' => 'integer',
        'query_time_ms' => 'integer',
        'memory_usage_bytes' => 'integer',
        'memory_peak_bytes' => 'integer',
        'execution_time_ms' => 'integer',
        'created_at' => 'datetime',
    ];

    /**
     * Get the error log this snapshot belongs to.
     */
    public function errorLog(): BelongsTo
    {
        return $this->belongsTo(ErrorLog::class);
    }
}
