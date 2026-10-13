<?php

namespace App\Models;

use App\Traits\HasAuditLog;
use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssessmentParameter extends Model
{
    use HasAuditLog, HasFactory, SoftDeletes, TracksUserActions;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'assessment_parameters';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'code',
        'name',
        'discipline_id',
        'vendor_category_id',
        'sector',
        'enterprise_size',
        'service_provider_type',
        'is_mandatory',
        'is_active',
        'created_by',
        'updated_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_mandatory' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * The attributes that should be hidden for serialization.
     * Hide raw ID - expose via accessor with *Name suffix for consistency.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'vendor_category_id',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<int, string>
     */
    protected $appends = [
        'vendor_category_name',
    ];

    /**
     * Generate the next human-readable, globally-unique parameter code for a sector:
     * MFG-### for manufacturing, SVC-### for service. The sequence is per-prefix,
     * monotonic and never reused (soft-deleted rows are counted). Must be called inside
     * the same DB transaction as the row create so the pessimistic lock holds; the unique
     * index on `code` is the final race backstop.
     */
    public static function generateCode(string $sector): string
    {
        $prefix = $sector === 'service' ? 'SVC-' : 'MFG-';

        $maxCode = static::withTrashed()
            ->where('code', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING(code, 5) AS UNSIGNED) DESC')
            ->lockForUpdate()
            ->value('code');

        $sequence = $maxCode ? intval(substr($maxCode, 4)) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 3, '0', STR_PAD_LEFT);
    }

    /**
     * Get the questions for this parameter.
     */
    public function questions(): HasMany
    {
        return $this->hasMany(AssessmentQuestion::class, 'parameter_id');
    }

    /**
     * Get the discipline that owns the parameter.
     */
    public function discipline(): BelongsTo
    {
        return $this->belongsTo(Discipline::class, 'discipline_id');
    }

    /**
     * Get the manufacturing DRDO vendor category.
     */
    public function manufacturingVendorCategory(): BelongsTo
    {
        return $this->belongsTo(ManufacturingVendorCategory::class, 'vendor_category_id');
    }

    /**
     * Get the service DRDO vendor category.
     */
    public function serviceVendorCategory(): BelongsTo
    {
        return $this->belongsTo(ServiceVendorCategory::class, 'vendor_category_id');
    }

    /**
     * Get the DRDO vendor category based on sector.
     * Returns the appropriate category model based on the sector value.
     *
     * @return ManufacturingVendorCategory|ServiceVendorCategory|null
     */
    public function getVendorCategory()
    {
        if (! $this->vendor_category_id) {
            return null;
        }

        if ($this->sector === 'manufacturing') {
            return $this->manufacturingVendorCategory;
        } elseif ($this->sector === 'service') {
            return $this->serviceVendorCategory;
        }

        return null;
    }

    /**
     * Get the DRDO vendor category name attribute.
     * This provides a convenient accessor for the category name regardless of sector.
     */
    protected function vendorCategoryName(): Attribute
    {
        return Attribute::make(
            get: function () {
                $category = $this->getVendorCategory();

                return $category?->category_name;
            }
        );
    }

    /**
     * Scope: Active parameters.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: Mandatory parameters.
     */
    public function scopeMandatory(Builder $query): Builder
    {
        return $query->where('is_mandatory', true);
    }

    /**
     * Scope: By discipline.
     */
    public function scopeByDiscipline(Builder $query, int $disciplineId): Builder
    {
        return $query->where('discipline_id', $disciplineId);
    }

    /**
     * Scope: By sector.
     */
    public function scopeBySector(Builder $query, string $sector): Builder
    {
        return $query->where('sector', $sector);
    }

    /**
     * Scope: By enterprise size.
     */
    public function scopeByEnterpriseSize(Builder $query, string $enterpriseSize): Builder
    {
        return $query->where('enterprise_size', $enterpriseSize);
    }

    /**
     * Scope: By service provider type.
     */
    public function scopeByServiceProviderType(Builder $query, ?string $serviceProviderType): Builder
    {
        if ($serviceProviderType === null) {
            return $query->whereNull('service_provider_type');
        }

        return $query->where('service_provider_type', $serviceProviderType);
    }

    /**
     * Scope: Filter for specific application criteria.
     */
    public function scopeForApplication(
        Builder $query,
        string $sector,
        string $enterpriseSize,
        ?string $serviceProviderType = null,
        ?int $disciplineId = null,
        ?string $vendorCategoryName = null
    ): Builder {
        $query->where('sector', $sector)
            ->where('enterprise_size', $enterpriseSize);

        if ($serviceProviderType !== null) {
            $query->where('service_provider_type', $serviceProviderType);
        } else {
            $query->whereNull('service_provider_type');
        }

        if ($disciplineId !== null) {
            $query->where('discipline_id', $disciplineId);
        }

        // Filter by DRDO vendor category
        if ($vendorCategoryName !== null) {
            // Resolve category name to ID based on sector
            $categoryId = null;

            if ($sector === 'manufacturing') {
                $category = ManufacturingVendorCategory::where('category_name', $vendorCategoryName)
                    ->where('is_active', true)
                    ->first();
                $categoryId = $category?->id;
            } elseif ($sector === 'service') {
                $category = ServiceVendorCategory::where('category_name', $vendorCategoryName)
                    ->where('is_active', true)
                    ->first();
                $categoryId = $category?->id;
            }

            if ($categoryId !== null) {
                $query->where('vendor_category_id', $categoryId);
            } else {
                // Category name not found in lookup table - return no results
                // Log warning for debugging purposes
                \Log::warning('DRDO vendor category not found', [
                    'category_name' => $vendorCategoryName,
                    'sector' => $sector,
                ]);
                $query->whereRaw('1 = 0'); // Force no results
            }
        } else {
            // If no category provided, filter for parameters with no category requirement
            $query->whereNull('vendor_category_id');
        }

        return $query;
    }

    /**
     * Get the sum of weightages for active questions only.
     */
    public function getActiveQuestionsWeightage(): int
    {
        return (int) $this->questions()->where('is_active', true)->sum('weightage');
    }

    /**
     * Auto-deactivate parameter if active weightage does not equal 100.
     * Returns true if parameter was deactivated, false otherwise.
     */
    public function autoDeactivateIfNeeded(): bool
    {
        if ($this->is_active && $this->getActiveQuestionsWeightage() !== 100) {
            $this->update(['is_active' => false]);

            \Illuminate\Support\Facades\Log::info('Assessment parameter auto-deactivated due to active questions weightage != 100%', [
                'parameter_id' => $this->id,
                'active_weightage' => $this->getActiveQuestionsWeightage(),
            ]);

            return true;
        }

        return false;
    }
}
