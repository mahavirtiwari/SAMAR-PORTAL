<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A live GSTIN verification snapshot from the government registry (via Protean).
 * Keyed by GSTIN; see the create migration for why it is application-independent
 * and how it doubles as the verification cache.
 */
class GstinVerification extends Model
{
    protected $fillable = [
        'gstin',
        'provider',
        'status',
        'legal_name',
        'trade_name',
        'constitution',
        'taxpayer_type',
        'gstin_status',
        'registration_date',
        'state_jurisdiction',
        'centre_jurisdiction',
        'nature_of_business',
        'principal_address',
        'error_code',
        'reason',
        'raw_response',
        'verified_at',
        'last_checked_at',
    ];

    protected $casts = [
        'principal_address' => 'array',
        'raw_response' => 'array',
        'verified_at' => 'datetime',
        'last_checked_at' => 'datetime',
    ];
}
