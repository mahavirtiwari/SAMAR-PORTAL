<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * A status change of an enterprise or a user account, with the reason given.
 *
 * @property int $id
 * @property string $subject_type
 * @property int $subject_id
 * @property string|null $from_status
 * @property string $to_status
 * @property int|null $changed_by
 * @property string|null $changed_by_role
 * @property string|null $remarks
 * @property array<string, mixed>|null $metadata
 * @property Carbon $changed_at
 */
class AccountStatusHistory extends Model
{
    public $timestamps = false;

    protected $fillable = [
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

    protected $casts = [
        'metadata' => 'array',
        'changed_at' => 'datetime',
    ];

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
