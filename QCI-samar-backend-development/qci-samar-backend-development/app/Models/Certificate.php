<?php

namespace App\Models;

use App\Traits\HasOrganizationScope;
use App\Traits\HasUnitScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Certificate extends Model
{
    use HasFactory, HasOrganizationScope, HasUnitScope, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'application_id',
        'organization_id',
        'unit_id',
        'committee_decision_id',
        'certificate_number',
        'qr_code',
        'verification_url',
        'certificate_type',
        'scheme',
        'scope',
        'issue_date',
        'valid_from',
        'valid_until',
        'validity_months',
        'status',
        'suspended_from',
        'suspended_until',
        'suspension_reason',
        'suspended_by',
        'revoked_at',
        'revocation_reason',
        'revoked_by',
        'renewed_by_certificate_id',
        'renews_certificate_id',
        'renewal_reminders_sent',
        'final_score',
        'grade',
        'certificate_pdf_path',
        'digital_signature',
        'signature_algorithm',
        'signatory_name',
        'signatory_designation',
        'signed_date',
        'issued_by',
        'issued_at',
        'approved_by',
        'approved_at',
        'remarks',
        'metadata',
        'is_public',
        'allow_verification',
        'deleted_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'issue_date' => 'date',
        'valid_from' => 'date',
        'valid_until' => 'date',
        'suspended_from' => 'date',
        'suspended_until' => 'date',
        'revoked_at' => 'date',
        'signed_date' => 'date',
        'issued_at' => 'datetime',
        'approved_at' => 'datetime',
        'final_score' => 'decimal:2',
        'metadata' => 'array',
        'renewal_reminders_sent' => 'array',
        'is_public' => 'boolean',
        'allow_verification' => 'boolean',
    ];

    /**
     * Get the application that owns the certificate.
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /**
     * Get the organization that owns the certificate.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the unit that owns the certificate.
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * Get the user who issued the certificate.
     */
    public function issuedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    /**
     * Get the user who approved the certificate.
     */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Get the user who revoked the certificate.
     */
    public function revokedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by');
    }

    /**
     * Get the user who suspended the certificate.
     */
    public function suspendedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'suspended_by');
    }

    /**
     * Get the certificate this one renews.
     */
    public function renewsCertificate(): BelongsTo
    {
        return $this->belongsTo(Certificate::class, 'renews_certificate_id');
    }

    /**
     * Get the certificate that renewed this one.
     */
    public function renewedByCertificate(): BelongsTo
    {
        return $this->belongsTo(Certificate::class, 'renewed_by_certificate_id');
    }

    /**
     * Scope: Filter certificates by organization's registered state (via application).
     */
    public function scopeForStates(Builder $query, array $states): Builder
    {
        if (empty($states)) {
            return $query;
        }

        return $query->whereHas('application', function ($q) use ($states) {
            Application::applyStateVisibility($q, $states);
        });
    }

    /**
     * Scope: Active certificates. valid_until is a DATE and is the LAST valid day
     * (issuance sets addMonths()->subDay()), so compare against today, inclusive;
     * comparing against now() would expire every certificate a day early.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active')
            ->where('valid_until', '>=', today());
    }

    /**
     * Scope: Expired certificates: lapsed live ones only. A renewed predecessor is
     * past-dated by construction (its valid_until is the successor's valid_from)
     * and must not count.
     */
    public function scopeExpired(Builder $query): Builder
    {
        return $query->where(function ($q) {
            $q->where('status', 'expired')
                ->orWhere(function ($live) {
                    $live->where('status', 'active')
                        ->where('valid_until', '<', today());
                });
        });
    }

    /**
     * Scope: Expiring soon (within days).
     */
    public function scopeExpiringSoon(Builder $query, int $days = 30): Builder
    {
        return $query->where('status', 'active')
            ->whereBetween('valid_until', [today(), today()->addDays($days)]);
    }

    /**
     * Scope: Suspended certificates.
     */
    public function scopeSuspended(Builder $query): Builder
    {
        return $query->where('status', 'suspended');
    }

    /**
     * Scope: Revoked certificates.
     */
    public function scopeRevoked(Builder $query): Builder
    {
        return $query->where('status', 'revoked');
    }

    /**
     * Scope: Public certificates.
     */
    public function scopePublic(Builder $query): Builder
    {
        return $query->where('is_public', true);
    }

    /**
     * The status to show: a stored "active" whose validity has lapsed reads as
     * "expired". Nothing writes "expired" to the column, so it must be derived.
     */
    public function getEffectiveStatusAttribute(): string
    {
        if ($this->status === 'active' && $this->valid_until !== null && $this->valid_until->lt(today())) {
            return 'expired';
        }

        return $this->status;
    }

    /**
     * Check if certificate is valid.
     */
    public function isValid(): bool
    {
        return $this->status === 'active' && $this->valid_until >= today();
    }

    /**
     * Check if certificate is expired.
     */
    public function isExpired(): bool
    {
        return $this->valid_until < today();
    }
}
