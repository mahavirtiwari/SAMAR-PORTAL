<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ERP-receipt projection of a successful Payment pushed to Business Central.
 */
class Receipt extends Model
{
    use HasFactory, SoftDeletes;

    public const SYNC_PENDING = 'pending';

    public const SYNC_SENDING = 'sending';

    public const SYNC_SENT = 'sent';

    public const SYNC_PROCESSED = 'processed';

    public const SYNC_FAILED = 'failed';

    protected $fillable = [
        'payment_id',
        'invoice_id',
        'customer_id',
        'posting_date',
        'payment_date',
        'amount_received',
        'invoice_amount',
        'tds_deducted',
        'tds_amount',
        'tan',
        'payment_mode',
        'utr_no',
        'bc_sync_status',
        'bc_entry_no',
        'bc_error_text',
        'bc_attempts',
        'bc_sent_at',
        'bc_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'posting_date' => 'date',
            'payment_date' => 'date',
            'amount_received' => 'decimal:2',
            'invoice_amount' => 'decimal:2',
            'tds_deducted' => 'boolean',
            'tds_amount' => 'decimal:2',
            'bc_entry_no' => 'integer',
            'bc_attempts' => 'integer',
            'bc_sent_at' => 'datetime',
            'bc_synced_at' => 'datetime',
        ];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
