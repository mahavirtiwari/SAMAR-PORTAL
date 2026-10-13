<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Application Assessment Basic Information
 *
 * Stores basic information captured during assessment (Step 5).
 * Filled by Lead Assessor.
 *
 * Structure matches Application model for API consistency:
 * - mfg_ prefix for manufacturing-specific fields
 * - svc_ prefix for services-specific fields
 * - Common fields without prefix
 */
class ApplicationAssessmentBasicInformation extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'application_assessment_basic_information';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'assessment_id',
        'category',
        // =====================================================
        // MANUFACTURING-SPECIFIC FIELDS (prefix: mfg_)
        // =====================================================
        'mfg_drdo_vendor_stores',
        'mfg_products',
        'mfg_raw_materials',
        'mfg_bought_out_parts',
        'mfg_key_processes',
        'mfg_outsourced_processes',
        'mfg_production_capacity',
        'mfg_capacity_unit',
        // =====================================================
        // SERVICES-SPECIFIC FIELDS (prefix: svc_)
        // =====================================================
        'svc_provider_type',
        'svc_drdo_vendor_labs',
        'svc_services',
        'svc_key_resources',
        'svc_outsourced_components',
        'svc_key_processes',
        'svc_outsourced_processes',
        // =====================================================
        // COMMON FIELDS
        // =====================================================
        'third_party_certifications',
        'customers',
        'filled_by',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        // Manufacturing arrays
        'mfg_drdo_vendor_stores' => 'array',
        'mfg_products' => 'array',
        'mfg_raw_materials' => 'array',
        'mfg_bought_out_parts' => 'array',
        'mfg_key_processes' => 'array',
        'mfg_outsourced_processes' => 'array',
        'mfg_production_capacity' => 'decimal:2',
        // Services arrays
        'svc_drdo_vendor_labs' => 'array',
        'svc_services' => 'array',
        'svc_key_resources' => 'array',
        'svc_outsourced_components' => 'array',
        'svc_key_processes' => 'array',
        'svc_outsourced_processes' => 'array',
        // Common arrays
        'third_party_certifications' => 'array',
        'customers' => 'array',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'created_at',
        'updated_at',
        // Hide raw column - expose via accessor with *Names suffix for consistency
        'third_party_certifications',
    ];

    /**
     * The accessors to append to the model's array form.
     */
    protected $appends = [
        'third_party_certification_names',
    ];

    /**
     * Get the third party certification names.
     * Exposed with *Names suffix for API consistency.
     */
    protected function thirdPartyCertificationNames(): Attribute
    {
        return Attribute::make(
            get: function () {
                $certifications = $this->third_party_certifications;
                if (empty($certifications) || ! is_array($certifications)) {
                    return [];
                }

                return $certifications;
            }
        );
    }

    /**
     * Get the assessment this basic information belongs to.
     */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(Assessment::class);
    }

    /**
     * Get the user who filled this information.
     */
    public function filledByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'filled_by');
    }

    /**
     * Check if basic information is complete for manufacturing applications.
     */
    public function isManufacturingComplete(): bool
    {
        return ! empty($this->category)
            && ! empty($this->mfg_drdo_vendor_stores)
            && ! empty($this->mfg_key_processes)
            && ! empty($this->mfg_products)
            && ! empty($this->customers)
            && ! empty($this->mfg_raw_materials)
            && ! empty($this->mfg_bought_out_parts);
    }

    /**
     * Check if basic information is complete for services applications.
     */
    public function isServicesComplete(): bool
    {
        return ! empty($this->category)
            && ! empty($this->svc_drdo_vendor_labs)
            && ! empty($this->svc_key_processes)
            && ! empty($this->svc_services)
            && ! empty($this->customers);
    }

    /**
     * Get products count (for manufacturing).
     */
    public function getProductsCount(): int
    {
        return is_array($this->mfg_products) ? count($this->mfg_products) : 0;
    }

    /**
     * Get customers count.
     */
    public function getCustomersCount(): int
    {
        return is_array($this->customers) ? count($this->customers) : 0;
    }

    /**
     * Get raw materials count (for manufacturing).
     */
    public function getRawMaterialsCount(): int
    {
        return is_array($this->mfg_raw_materials) ? count($this->mfg_raw_materials) : 0;
    }

    /**
     * Get bought out parts count (for manufacturing).
     */
    public function getBoughtOutPartsCount(): int
    {
        return is_array($this->mfg_bought_out_parts) ? count($this->mfg_bought_out_parts) : 0;
    }

    /**
     * Get services count (for services applications).
     */
    public function getServicesCount(): int
    {
        return is_array($this->svc_services) ? count($this->svc_services) : 0;
    }
}
