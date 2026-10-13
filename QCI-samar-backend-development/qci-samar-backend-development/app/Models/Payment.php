<?php

namespace App\Models;

use App\Traits\HasOrganizationScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use HasFactory, HasOrganizationScope, SoftDeletes;

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<int, string>
     */
    protected $appends = [
        'breakdown',
        'payment_number',
        'enterprise_name',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'payment_type',
        'application_id',
        'organization_id',
        'user_id',
        'payment_id',
        'transaction_id',
        'order_id',
        'gateway',
        'gateway_payment_id',
        'gateway_order_id',
        'gateway_signature',
        'amount',
        'currency',
        'gateway_fee',
        'tax_amount',
        'net_amount',
        'payment_method',
        'payment_method_details',
        'status',
        'initiated_at',
        'completed_at',
        'failed_at',
        'cancelled_at',
        'failure_reason',
        'failure_message',
        'error_code',
        'is_verified',
        'verified_at',
        'verified_by',
        'verification_attempts',
        'last_verified_at',
        'is_reconciled',
        'reconciled_at',
        'webhook_payload',
        'webhook_received_at',
        'customer_name',
        'customer_email',
        'customer_phone',
        'gstin',
        'tan',
        'receipt_number',
        'description',
        'metadata',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'amount' => 'decimal:2',
        'gateway_fee' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'is_verified' => 'boolean',
        'is_reconciled' => 'boolean',
        'webhook_payload' => 'array',
        'metadata' => 'array',
        'initiated_at' => 'datetime',
        'completed_at' => 'datetime',
        'failed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'verified_at' => 'datetime',
        'verification_attempts' => 'integer',
        'last_verified_at' => 'datetime',
        'reconciled_at' => 'datetime',
        'webhook_received_at' => 'datetime',
    ];

    /**
     * Get the application that owns the payment.
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /**
     * Get the organization that owns the payment.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the user who initiated the payment.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Alias for user() - Get the user who paid.
     */
    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the reconciliation record.
     */
    public function reconciliation(): HasOne
    {
        return $this->hasOne(PaymentReconciliation::class);
    }

    /**
     * Scope: Successful payments.
     */
    public function scopeSuccessful(Builder $query): Builder
    {
        return $query->where('status', 'success');
    }

    /**
     * Scope: Failed payments.
     */
    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', 'failed');
    }

    /**
     * Scope: Pending payments.
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->whereIn('status', ['initiated', 'pending', 'processing']);
    }

    /**
     * Scope: Verified payments.
     */
    public function scopeVerified(Builder $query): Builder
    {
        return $query->where('is_verified', true);
    }

    /**
     * Scope: Unverified payments.
     */
    public function scopeUnverified(Builder $query): Builder
    {
        return $query->where('is_verified', false);
    }

    /**
     * Scope: Reconciled payments.
     */
    public function scopeReconciled(Builder $query): Builder
    {
        return $query->where('is_reconciled', true);
    }

    /**
     * Scope: Unreconciled payments.
     */
    public function scopeUnreconciled(Builder $query): Builder
    {
        return $query->where('is_reconciled', false);
    }

    /**
     * Scope: By gateway.
     */
    public function scopeByGateway(Builder $query, string $gateway): Builder
    {
        return $query->where('gateway', $gateway);
    }

    /**
     * Check if payment is successful.
     */
    public function isSuccessful(): bool
    {
        return $this->status === 'success';
    }

    /**
     * Get the enterprise name from the related application.
     */
    public function getEnterpriseNameAttribute(): ?string
    {
        return $this->application?->enterprise_name;
    }

    /**
     * Get the payment number (alias for payment_id field).
     */
    public function getPaymentNumberAttribute(): ?string
    {
        return $this->payment_id;
    }

    /**
     * Get the formatted breakdown from metadata.
     * Returns breakdown in camelCase format for frontend consumption.
     */
    public function getBreakdownAttribute(): array
    {
        $metadata = $this->metadata ?? [];

        // Extract breakdown values from metadata (supports both camelCase and snake_case keys)
        $baseFee = $metadata['baseFee'] ?? $metadata['base_fee'] ?? null;
        $foodAccommodation = $metadata['foodAccommodation'] ?? $metadata['food_accommodation'] ?? null;
        $gstAmount = $metadata['gstAmount'] ?? $metadata['gst_amount'] ?? null;
        $tdsAmount = $metadata['tdsAmount'] ?? $metadata['tds_amount'] ?? null;
        $gstPercentage = $metadata['gstPercentage'] ?? $metadata['gst_percentage'] ?? 18;
        $tdsPercentage = $metadata['tdsPercentage'] ?? $metadata['tds_percentage'] ?? 0;
        $tdsDeductible = $metadata['tdsDeductible'] ?? $metadata['tds_deductible'] ?? false;

        // Calculate amount payable (base + food) if we have the breakdown
        $amountPayable = null;
        if ($baseFee !== null) {
            $amountPayable = ($baseFee ?? 0) + ($foodAccommodation ?? 0);
        }

        // Return in camelCase format for frontend
        return [
            'baseCertificationFee' => $baseFee,
            'foodAccommodation' => $foodAccommodation,
            'amountPayable' => $amountPayable,
            'gstPercentage' => $gstPercentage,
            'gstAmount' => $gstAmount,
            'tdsDeductible' => $tdsDeductible,
            'tdsPercentage' => $tdsPercentage,
            'tdsAmount' => $tdsAmount,
        ];
    }
}
