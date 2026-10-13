<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssessmentStatusHistory extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'application_assessment_status_histories';

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'assessment_id',
        'from_status',
        'to_status',
        'changed_by',
        'changed_by_role',
        'remarks',
        'metadata',
        'ip_address',
        'user_agent',
        'changed_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'metadata' => 'array',
        'changed_at' => 'datetime',
    ];

    /**
     * Get the assessment that owns the status history.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * Get the user who changed the status.
     */
    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    /**
     * Scope: Order by latest first.
     */
    public function scopeLatest($query)
    {
        return $query->orderBy('changed_at', 'desc');
    }

    /**
     * Scope: By status.
     */
    public function scopeToStatus($query, string $status)
    {
        return $query->where('to_status', $status);
    }
}
