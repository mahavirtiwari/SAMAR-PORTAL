<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ERP-customer projection of an Organization pushed to Business Central.
 * reference_no is the enterprise admin's SAMAR ID — BC's customer-matching key.
 */
class Customer extends Model
{
    use HasFactory, SoftDeletes;

    public const SYNC_PENDING = 'pending';

    public const SYNC_SENDING = 'sending';

    public const SYNC_SENT = 'sent';

    public const SYNC_PROCESSED = 'processed';

    public const SYNC_FAILED = 'failed';

    protected $fillable = [
        'organization_id',
        'user_id',
        'reference_no',
        'bc_sync_status',
        'bc_entry_no',
        'bc_error_text',
        'bc_customer_exists',
        'bc_attempts',
        'bc_sent_at',
        'bc_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'bc_customer_exists' => 'boolean',
            'bc_entry_no' => 'integer',
            'bc_attempts' => 'integer',
            'bc_sent_at' => 'datetime',
            'bc_synced_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'organization_id', 'organization_id');
    }
}
