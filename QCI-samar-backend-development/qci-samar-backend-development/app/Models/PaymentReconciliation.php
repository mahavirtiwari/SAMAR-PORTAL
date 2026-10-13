<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentReconciliation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'payment_id',
        'reconciliation_reference',
        'settlement_date',
        'settlement_amount',
        'gateway_fee_actual',
        'tax_actual',
        'net_settlement',
        'amount_variance',
        'has_variance',
        'variance_remarks',
        'status',
        'bank_reference',
        'utr_number',
        'gateway_settlement_data',
        'bank_statement_data',
        'reconciled_by',
        'reconciled_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'settlement_date' => 'date',
        'settlement_amount' => 'decimal:2',
        'gateway_fee_actual' => 'decimal:2',
        'tax_actual' => 'decimal:2',
        'net_settlement' => 'decimal:2',
        'amount_variance' => 'decimal:2',
        'has_variance' => 'boolean',
        'gateway_settlement_data' => 'array',
        'bank_statement_data' => 'array',
        'reconciled_at' => 'datetime',
    ];

    /**
     * Get the payment that owns the reconciliation.
     */
    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /**
     * Get the user who reconciled.
     */
    public function reconciledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reconciled_by');
    }

    /**
     * Scope: Matched reconciliations.
     */
    public function scopeMatched(Builder $query): Builder
    {
        return $query->where('status', 'matched');
    }

    /**
     * Scope: Mismatched reconciliations.
     */
    public function scopeMismatched(Builder $query): Builder
    {
        return $query->where('status', 'mismatched');
    }

    /**
     * Scope: With variance.
     */
    public function scopeWithVariance(Builder $query): Builder
    {
        return $query->where('has_variance', true);
    }
}
