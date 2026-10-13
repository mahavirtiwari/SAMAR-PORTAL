<?php

namespace App\Models;

use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FeeConfiguration extends Model
{
    use HasFactory, SoftDeletes, TracksUserActions;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'sector',
        'enterprise_size',
        'base_certification_fee',
        'food_and_accommodation_fee',
        'gst_percentage',
        'tds_enabled',
        'created_by',
        'updated_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'base_certification_fee' => 'decimal:2',
        'food_and_accommodation_fee' => 'decimal:2',
        'gst_percentage' => 'decimal:2',
        'tds_enabled' => 'boolean',
    ];

    /**
     * Sector type constants.
     */
    public const SECTOR_MANUFACTURING = 'manufacturing';

    public const SECTOR_SERVICE = 'service';

    /**
     * Enterprise size constants.
     */
    public const SIZE_STARTUP = 'startup';

    public const SIZE_MICRO = 'micro';

    public const SIZE_SMALL = 'small';

    public const SIZE_MEDIUM = 'medium';

    public const SIZE_LARGE = 'large';

    /**
     * Get all available sectors.
     *
     * @return array<string>
     */
    public static function getSectors(): array
    {
        return [
            self::SECTOR_MANUFACTURING,
            self::SECTOR_SERVICE,
        ];
    }

    /**
     * Get all available enterprise sizes.
     *
     * @return array<string>
     */
    public static function getEnterpriseSizes(): array
    {
        return [
            self::SIZE_STARTUP,
            self::SIZE_MICRO,
            self::SIZE_SMALL,
            self::SIZE_MEDIUM,
            self::SIZE_LARGE,
        ];
    }

    /**
     * Calculate total fee before GST.
     */
    public function getTotalFeeAttribute(): float
    {
        return (float) $this->base_certification_fee + (float) $this->food_and_accommodation_fee;
    }

    /**
     * Calculate GST amount.
     */
    public function getGstAmountAttribute(): float
    {
        return $this->total_fee * ((float) $this->gst_percentage / 100);
    }

    /**
     * Scope: Filter by sector.
     */
    public function scopeBySector(Builder $query, string $sector): Builder
    {
        return $query->where('sector', $sector);
    }

    /**
     * Scope: Filter by enterprise size.
     */
    public function scopeByEnterpriseSize(Builder $query, string $size): Builder
    {
        return $query->where('enterprise_size', $size);
    }

    /**
     * Scope: Manufacturing sector.
     */
    public function scopeManufacturing(Builder $query): Builder
    {
        return $query->where('sector', self::SECTOR_MANUFACTURING);
    }

    /**
     * Scope: Service sector.
     */
    public function scopeService(Builder $query): Builder
    {
        return $query->where('sector', self::SECTOR_SERVICE);
    }

    /**
     * Find fee configuration by sector and enterprise size.
     */
    public static function findByConfiguration(string $sector, string $enterpriseSize): ?self
    {
        return static::where('sector', $sector)
            ->where('enterprise_size', $enterpriseSize)
            ->first();
    }
}
