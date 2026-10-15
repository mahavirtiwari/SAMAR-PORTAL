<?php

namespace App\Models;

use App\Services\StateMachine\ApplicationStateMachine;
use App\Traits\HasAuditLog;
use App\Traits\HasLgdLocation;
use App\Traits\HasOrganizationScope;
use App\Traits\HasStateMachine;
use App\Traits\HasUnitScope;
use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Application extends Model
{
    use HasAuditLog, HasFactory, HasLgdLocation, HasOrganizationScope, HasStateMachine, HasUnitScope, SoftDeletes, TracksUserActions;

    /**
     * The attributes that should be hidden for serialization.
     * Hide raw file paths - expose URLs instead via accessors.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'gst_certificate_file',
        'govt_registration_certificate',
        'drdo_certificate_file',
        'dpiit_certificate_file',
        'udyam_certificate_file',
        'incorporation_certificate_file',
        'site_exterior_photo',
        // Hide raw columns - expose via accessors with *Name/*Names suffix for consistency
        'vendor_category',
        'third_party_certifications',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    /**
     * NOT NULL columns with a database default. A draft save (the per-field autosave
     * included) may carry these as null while the question is still unanswered; the
     * draft flow drops those nulls so the stored value (or the default) stands.
     */
    public const DRAFT_DEFAULTED_COLUMNS = [
        'application_type',
        'is_existing_drdo_vendor',
        'is_exporting',
        'male_employees_count',
        'female_employees_count',
        'payment_status',
        'payment_amount',
    ];

    protected $fillable = [
        'organization_id',
        'organization_name',
        'unit_id',
        'unit_name',
        'application_number',
        'application_type',
        'previous_application_id',
        'file_upload_metadata',
        // Sector Classification
        'sector',
        'vendor_category',
        'is_existing_drdo_vendor',
        'enterprise_classification',
        'enterprise_name',
        // Registered Office Address
        'registered_office_address',
        'registered_office_state',
        'registered_office_district',
        'registered_office_pincode',
        'registered_office_mobile',
        'registered_office_landline',
        'registered_office_email',
        'registered_office_alternate_email',
        // Unit Address
        'unit_address',
        'unit_state',
        'unit_district',
        'unit_pincode',
        'unit_mobile',
        'unit_landline',
        'unit_email',
        'unit_alternate_email',
        'unit_commencement_date',
        'site_exterior_photo',
        // Contact Person
        'contact_person_name',
        'contact_person_designation',
        'contact_person_mobile',
        'contact_person_email',
        // Ownership & Business
        'ownership_type',
        'male_employees_count',
        'female_employees_count',
        'other_employees_count',
        // Export Information
        'is_exporting',
        'export_countries',
        'export_percentage',
        // GST & Tax
        'gst_number',
        'gst_certificate_file',
        'has_gst',
        // Government Registration
        'govt_organisation_name',
        'govt_registration_certificate',
        'has_govt_registration',
        // Compliance & Declarations
        'is_blacklisted',
        'blacklisted_organizations',
        'has_ongoing_enquiry',
        // Registration Certificates
        'drdo_registration_number',
        'drdo_certificate_file',
        'dpiit_registration_number',
        'dpiit_certificate_file',
        'udyam_registration_number',
        'udyam_certificate_file',
        'cin',
        'incorporation_certificate_file',
        // Certifications
        'third_party_certifications',
        // Status & Workflow
        'status',
        'preferred_assessment_date',
        'submitted_at',
        'is_drdo_approval_required',
        'drdo_approved_at',
        'payment_completed_at',
        'allocated_at',
        'assessment_started_at',
        'assessment_completed_at',
        'qc_completed_at',
        'committee_review_at',
        'certified_at',
        'certificate_expiry_at',
        'rejected_at',
        // Payment
        'payment_status',
        'payment_amount',
        // Remarks
        'rejection_reason',
        'drdo_approval_remarks',
        // Audit
        'created_by',
        'updated_by',
        'deleted_by',
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
        // COMMON JSON FIELDS
        // =====================================================
        'customers',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        // Common Arrays
        'export_countries' => 'array',
        'third_party_certifications' => 'array',
        'blacklisted_organizations' => 'array',
        'file_upload_metadata' => 'array',
        // =====================================================
        // MANUFACTURING-SPECIFIC JSON FIELDS (prefix: mfg_)
        // =====================================================
        'mfg_drdo_vendor_stores' => 'array',
        'mfg_products' => 'array',
        'mfg_raw_materials' => 'array',
        'mfg_bought_out_parts' => 'array',
        'mfg_key_processes' => 'array',
        'mfg_outsourced_processes' => 'array',
        // =====================================================
        // SERVICES-SPECIFIC JSON FIELDS (prefix: svc_)
        // =====================================================
        'svc_drdo_vendor_labs' => 'array',
        'svc_services' => 'array',
        'svc_key_resources' => 'array',
        'svc_outsourced_components' => 'array',
        'svc_key_processes' => 'array',
        'svc_outsourced_processes' => 'array',
        // =====================================================
        // COMMON JSON FIELDS
        // =====================================================
        'customers' => 'array',
        // Booleans
        'is_exporting' => 'boolean',
        'is_existing_drdo_vendor' => 'boolean',
        // Note: is_blacklisted, has_ongoing_enquiry, has_gst and has_govt_registration
        // are handled by accessors to preserve null
        'is_drdo_approval_required' => 'boolean',
        // Decimals
        'export_percentage' => 'decimal:2',
        'mfg_production_capacity' => 'decimal:2',
        'payment_amount' => 'decimal:2',
        // Dates
        'unit_commencement_date' => 'date',
        'preferred_assessment_date' => 'date',
        // Datetimes
        'submitted_at' => 'datetime',
        'drdo_approved_at' => 'datetime',
        'payment_completed_at' => 'datetime',
        'allocated_at' => 'datetime',
        'assessment_started_at' => 'datetime',
        'assessment_completed_at' => 'datetime',
        'qc_completed_at' => 'datetime',
        'committee_review_at' => 'datetime',
        'certified_at' => 'datetime',
        'certificate_expiry_at' => 'datetime',
        'rejected_at' => 'datetime',
        'feedback_completed_at' => 'datetime',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<int, string>
     */
    protected $appends = [
        'third_party_certification_names',
        'vendor_category_name',
        'export_country_names',
        'full_unit_address',
        'full_registered_office_address',
        // Note: File download URL accessors (gst_certificate_file_url, etc.) are intentionally
        // NOT appended here to avoid the overhead of generating signed URLs on every serialization,
        // including list responses where they are not needed. They are explicitly included
        // in detail views via ApplicationController::formatApplicationData() when $includeDetails is true.
    ];

    /**
     * Get the third party certification names.
     * Stored as names directly for immutability.
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
     * Get the vendor category name.
     *
     * ARCHITECTURE NOTE: The vendor_category field on Application is stored as a plain string
     * (the category name at time of application submission) rather than a foreign key to a
     * vendor_categories table. This is an intentional denormalization: it creates an immutable
     * snapshot of the vendor category at the time of application, preventing retrospective
     * changes if a vendor category is later renamed or deleted in the master table.
     *
     * This diverges from AssessmentParameter which uses a FK-based vendor_category_id.
     * The accessor is a pass-through for API consistency (exposes vendor_category_name
     * instead of the raw vendor_category column, which is hidden in $hidden).
     */
    protected function vendorCategoryName(): Attribute
    {
        return Attribute::make(
            get: function () {
                return $this->vendor_category;
            }
        );
    }

    /**
     * Get the export country names.
     * Stored as names directly for immutability.
     */
    protected function exportCountryNames(): Attribute
    {
        return Attribute::make(
            get: function () {
                $countries = $this->export_countries;
                if (empty($countries) || ! is_array($countries)) {
                    return [];
                }

                return $countries;
            }
        );
    }

    /**
     * Canonical full unit address: "address, district, state - pincode".
     * Single source of truth so every consumer (mobile lists, exports, sheets)
     * renders the same complete address including pincode. Mirrors the web
     * formatFullAddress() helper.
     */
    protected function fullUnitAddress(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->buildFullAddress(
                $this->unit_address,
                $this->unit_district,
                $this->unit_state,
                $this->unit_pincode,
            ),
        );
    }

    /**
     * Canonical full registered-office address: "address, district, state - pincode".
     */
    protected function fullRegisteredOfficeAddress(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->buildFullAddress(
                $this->registered_office_address,
                $this->registered_office_district,
                $this->registered_office_state,
                $this->registered_office_pincode,
            ),
        );
    }

    private function buildFullAddress(?string $address, ?string $district, ?string $state, ?string $pincode): ?string
    {
        $line = implode(', ', array_filter([$address, $district, $state], fn ($part) => filled($part)));

        if (filled($pincode)) {
            return $line !== '' ? "{$line} - {$pincode}" : (string) $pincode;
        }

        return $line !== '' ? $line : null;
    }

    /**
     * Tri-state boolean, for questions where "not answered" must stay distinct from "No".
     * null = not answered, false = answered No, true = answered Yes.
     *
     * These cannot use a 'boolean' cast: it would coerce null to false and collapse the two
     * states into one, which is the defect BUG-05727 was filed for.
     */
    private static function nullableBoolean(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value === null ? null : (bool) $value,
            set: fn ($value) => $value === null || $value === '' ? null : (bool) $value,
        );
    }

    protected function isBlacklisted(): Attribute
    {
        return self::nullableBoolean();
    }

    protected function hasOngoingEnquiry(): Attribute
    {
        return self::nullableBoolean();
    }

    protected function hasGst(): Attribute
    {
        return self::nullableBoolean();
    }

    protected function hasGovtRegistration(): Attribute
    {
        return self::nullableBoolean();
    }

    /**
     * Generate a file download URL for a given field.
     *
     * @param  string  $field  The field name (e.g., 'gst_certificate_file')
     * @return string|null The download URL or null if no file exists
     */
    protected function getFileDownloadUrl(string $field): ?string
    {
        if (empty($this->{$field}) || empty($this->id)) {
            return null;
        }

        return url("/api/v1/applications/{$this->id}/files/{$field}");
    }

    /**
     * Get the GST certificate file download URL.
     */
    protected function gstCertificateFileUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->getFileDownloadUrl('gst_certificate_file')
        );
    }

    /**
     * Get the government registration certificate download URL.
     */
    protected function govtRegistrationCertificateUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->getFileDownloadUrl('govt_registration_certificate')
        );
    }

    /**
     * Get the DRDO certificate file download URL.
     */
    protected function drdoCertificateFileUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->getFileDownloadUrl('drdo_certificate_file')
        );
    }

    /**
     * Get the DPIIT certificate file download URL.
     */
    protected function dpiitCertificateFileUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->getFileDownloadUrl('dpiit_certificate_file')
        );
    }

    /**
     * Get the UDYAM certificate file download URL.
     */
    protected function udyamCertificateFileUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->getFileDownloadUrl('udyam_certificate_file')
        );
    }

    /**
     * Get the incorporation certificate file download URL.
     */
    protected function incorporationCertificateFileUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->getFileDownloadUrl('incorporation_certificate_file')
        );
    }

    /**
     * Get the site exterior photo download URL.
     */
    protected function siteExteriorPhotoUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->getFileDownloadUrl('site_exterior_photo')
        );
    }

    /**
     * Get the organization that owns the application.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the unit that owns the application.
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * Get the user who created the application.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The certified application this renewal was cloned from.
     */
    public function previousApplication(): BelongsTo
    {
        return $this->belongsTo(Application::class, 'previous_application_id');
    }

    /**
     * Renewal applications that were cloned from this one.
     */
    public function renewalApplications(): HasMany
    {
        return $this->hasMany(Application::class, 'previous_application_id');
    }

    /**
     * Get the assessment for the application.
     */
    public function assessment(): HasOne
    {
        return $this->hasOne(Assessment::class);
    }

    /**
     * Get the payments for the application.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Get the certificate for the application.
     *
     * An application can accumulate more than one certificate row (a retried
     * issuance, or a superseded/renewed certificate). The current certificate
     * is the most recently issued one; plain hasOne would return an arbitrary
     * row and could surface a stale expiry date or download URL.
     */
    public function certificate(): HasOne
    {
        return $this->hasOne(Certificate::class)->latestOfMany();
    }

    /**
     * Get the feedback responses for the application.
     */
    public function feedbacks(): HasMany
    {
        return $this->hasMany(ApplicationFeedback::class);
    }

    /**
     * Get the most recently submitted feedback response for the application.
     *
     * All feedback rows for an application share the same submitter, so this
     * is the row used to surface the submitter and the submission date on the
     * admin feedback listing.
     */
    public function latestFeedback(): HasOne
    {
        return $this->hasOne(ApplicationFeedback::class)->latestOfMany();
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * The most recent invoice raised for the application. Payment History rows
     * offer that invoice's ERP-issued PDFs; an application accumulates several
     * invoices over its life (application/assessment/surveillance fees), and the
     * latest is the one whose documents are surfaced.
     */
    public function latestInvoice(): HasOne
    {
        return $this->hasOne(Invoice::class)->latestOfMany();
    }

    /**
     * Get the status histories for the application.
     */
    public function statusHistories(): HasMany
    {
        return $this->hasMany(ApplicationStatusHistory::class)->orderBy('changed_at', 'desc');
    }

    /**
     * Check if a unit can submit a new application.
     * Business Rule: Only ONE active application allowed per unit at any time.
     * Exception: Can apply for renewal once within the recertification window
     * (recertification_window_days before a certified application's expiry).
     * Rejected applications are terminal and never block a new application.
     *
     * @param  int|null  $excludeApplicationId  For update operations, exclude this application from check
     * @return array ['allowed' => bool, 'reason' => string|null]
     */
    public static function canUnitApply(int $unitId, ?int $excludeApplicationId = null): array
    {
        $query = static::where('unit_id', $unitId)
            ->where('status', '!=', 'rejected');

        if ($excludeApplicationId) {
            $query->where('id', '!=', $excludeApplicationId);
        }

        $existingApplication = $query->orderBy('id', 'desc')->first();

        // No active application - allowed
        if (! $existingApplication) {
            return ['allowed' => true, 'reason' => null];
        }

        // If there's a certified application, check if it's within renewal window
        if ($existingApplication->status === 'certified') {
            // Check if certificate has expiry date
            if ($existingApplication->certificate_expiry_at) {
                $windowDays = SystemSetting::getRecertificationWindowDays();
                $expiryDate = $existingApplication->certificate_expiry_at;
                $windowOpensAt = $expiryDate->copy()->subDays($windowDays);
                $now = now();

                // Within the recertification window (window-open .. expiry)
                if ($now->greaterThanOrEqualTo($windowOpensAt) && $now->lessThanOrEqualTo($expiryDate)) {
                    return ['allowed' => true, 'reason' => null];
                }

                // Certificate has expired - renewal still allowed
                if ($now->greaterThan($expiryDate)) {
                    return ['allowed' => true, 'reason' => null];
                }

                // Within validity period but not in renewal window yet
                return [
                    'allowed' => false,
                    'reason' => 'Unit has an active certified application. Renewal applications can be submitted starting from '.
                                $windowOpensAt->format('Y-m-d').' ('.$windowDays.' days before expiry on '.
                                $expiryDate->format('Y-m-d').').',
                ];
            }

            // Certified but no expiry date set - don't allow another application
            return [
                'allowed' => false,
                'reason' => "Unit has a certified application (Application #{$existingApplication->application_number}). No expiry date is set for this certificate.",
            ];
        }

        // For any other status (draft, in_progress, submitted, etc.)
        return [
            'allowed' => false,
            'reason' => "Unit already has an application in progress (Application #{$existingApplication->application_number}, Status: {$existingApplication->status}). Only one application per unit is allowed at a time.",
        ];
    }

    /**
     * Generate a unique application number.
     *
     * Format: SAMAR-{n}-{MMYY}, n from the application_number_sequence
     * auto-increment: unique under concurrent creates without locking the
     * applications table, and never reissued (even if the creating transaction
     * rolls back or the application is later deleted).
     */
    public static function generateApplicationNumber(): string
    {
        $next = DB::table('application_number_sequence')->insertGetId(['created_at' => now()]);

        return "SAMAR-{$next}-".date('my');
    }

    /**
     * Get application completion progress.
     */
    public function getProgress(): float
    {
        $totalFields = 14; // 6 required fields + max sector bonus (mfg: +4 products, +2 processes) + customers (+2)
        $completedFields = 0;

        $requiredFields = [
            'application_type', 'sector', 'vendor_category',
            'enterprise_name', 'male_employees_count', 'other_employees_count',
        ];

        foreach ($requiredFields as $field) {
            if (! empty($this->$field)) {
                $completedFields++;
            }
        }

        // Check related data based on sector (using JSON columns)
        if ($this->sector === 'manufacturing') {
            if (is_array($this->mfg_products) && count($this->mfg_products) > 0) {
                $completedFields += 4;
            }
            if (is_array($this->mfg_key_processes) && count($this->mfg_key_processes) > 0) {
                $completedFields += 2;
            }
        } elseif ($this->sector === 'service') {
            if (is_array($this->svc_services) && count($this->svc_services) > 0) {
                $completedFields += 4;
            }
        }

        if (is_array($this->customers) && count($this->customers) > 0) {
            $completedFields += 2;
        }

        return min(100, ($completedFields / $totalFields) * 100);
    }

    /**
     * Log status change.
     */
    protected function logStatusChange(?string $fromStatus, string $toStatus, ?string $remarks = null): void
    {
        ApplicationStatusHistory::create([
            'application_id' => $this->id,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'changed_by' => auth()->id(),
            'changed_by_role' => auth()->user()?->activeRoles->first()?->slug,
            'remarks' => $remarks,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }

    /**
     * Scope: Filter applications by unit state.
     */
    public function scopeForStates(Builder $query, array $states): Builder
    {
        if (empty($states)) {
            return $query;
        }

        return self::applyStateVisibility($query, $states);
    }

    /**
     * The one definition of "this application is visible to someone restricted to
     * these states". Reused by the Assessment, Certificate and payment filters, which
     * all reach unit_state through the application, and mirrored by
     * StateFilterService::assessmentInStates for the single-record check.
     *
     * An application whose unit_state is not set counts as unassigned and is visible to
     * everyone. A plain whereIn silently drops NULL, so such an application disappeared
     * from every state-restricted Operations Manager's list and dashboard while still
     * counting in the System Admin's unfiltered total: invisible to the person expected
     * to act on it, with nothing on screen to say so. Showing it to everyone is the
     * lesser fault, since the alternative is an application nobody sees. [BUG-08934]
     */
    public static function applyStateVisibility(Builder $query, array $states): Builder
    {
        return $query->where(function (Builder $scoped) use ($states) {
            $scoped->whereIn('unit_state', $states)->orWhereNull('unit_state');
        });
    }

    /**
     * Scope: Filter by status.
     */
    public function scopeByStatus(Builder $query, string|array $status): Builder
    {
        if (is_array($status)) {
            return $query->whereIn('status', $status);
        }

        return $query->where('status', $status);
    }

    /**
     * Scope: Pending payment.
     */
    public function scopePendingPayment(Builder $query): Builder
    {
        return $query->where('status', 'payment_pending');
    }

    /**
     * Scope: By application type.
     */
    public function scopeByType(Builder $query, string $type): Builder
    {
        return $query->where('application_type', $type);
    }

    /**
     * Scope: Applications awaiting DRDO approval.
     */
    public function scopeDrdoApprovalPending(Builder $query): Builder
    {
        return $query->where('status', 'drdo_approval_pending');
    }

    /**
     * Scope: Search applications by application number or enterprise name.
     */
    public function scopeSearch(Builder $query, string $search): Builder
    {
        return $query->where(function ($q) use ($search) {
            $q->where('application_number', 'LIKE', "%{$search}%")
                ->orWhereHas('organization', function ($orgQuery) use ($search) {
                    $orgQuery->where('name', 'LIKE', "%{$search}%");
                });
        });
    }

    /**
     * Scope: Filter by enterprise size/classification.
     */
    public function scopeByEnterpriseSize(Builder $query, string $size): Builder
    {
        return $query->where('enterprise_classification', $size);
    }

    /**
     * Scope: Filter by vendor category.
     */
    public function scopeByVendorCategory(Builder $query, string $category): Builder
    {
        return $query->where('vendor_category', $category);
    }

    /**
     * Scope: Filter by sector.
     */
    public function scopeBySector(Builder $query, string $sector): Builder
    {
        return $query->where('sector', $sector);
    }

    /**
     * Get the state machine class name for Application.
     */
    protected function getStateMachineClass(): string
    {
        return ApplicationStateMachine::class;
    }

    /**
     * Check if the application can be edited by the given user.
     *
     * @param  User  $user
     */
    public function canEdit($user): bool
    {
        // Only drafts can be edited
        if ($this->status !== 'draft') {
            return false;
        }

        // System admins can edit any application
        if ($user->hasRole('system_admin')) {
            return true;
        }

        // Check organization ownership first (security - prevent cross-org access)
        if ($this->organization_id !== $user->organization_id) {
            return false;
        }

        // Enterprise admins can edit ALL drafts in their organization
        if ($user->hasRole('enterprise_admin')) {
            return true;
        }

        // Unit admins can only edit applications for their assigned units
        if ($user->hasRole('unit_admin')) {
            // Optimized: Use exists() with direct unit_id check to prevent N+1 query
            return $user->roles()
                ->where('slug', Role::UNIT_ADMIN)
                ->wherePivot('is_active', true)
                ->wherePivot('unit_id', $this->unit_id)
                ->exists();
        }

        return false;
    }
}
