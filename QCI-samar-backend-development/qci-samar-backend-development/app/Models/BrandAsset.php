<?php

namespace App\Models;

use App\Support\BrandAssetDefaults;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * A replaceable logo (Settings → Branding & Logos). Uploaded files live on
 * the local disk under branding/ and are served by BrandAssetController.
 */
class BrandAsset extends Model
{
    public const DISK = 'local';

    private const CACHE_KEY = 'brand_assets.all';

    protected $fillable = ['key', 'title', 'description', 'file_path', 'mime_type', 'link_url', 'updated_by'];

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::CACHE_KEY));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function hasCustomImage(): bool
    {
        return $this->file_path !== null && Storage::disk(self::DISK)->exists($this->file_path);
    }

    /** The custom image as a data: URI (for the web app, whose CSP allows data: images), or null. */
    public function dataUri(): ?string
    {
        if (! $this->hasCustomImage()) {
            return null;
        }

        return 'data:'.$this->mime_type.';base64,'.base64_encode(Storage::disk(self::DISK)->get($this->file_path));
    }

    /**
     * The custom image for the public branding list: a data: URI, or for large
     * pictures (`inline` false in BrandAssetDefaults) a versioned URL to the
     * image endpoint, so they are not sent on every page load. Null when none.
     */
    public function publicImage(): ?string
    {
        if (! $this->hasCustomImage()) {
            return null;
        }
        if (BrandAssetDefaults::find($this->key)['inline'] ?? true) {
            return $this->dataUri();
        }

        return url('/api/v1/branding/'.$this->key.'/image').'?v='.$this->updated_at?->timestamp;
    }

    /** Upload limit for this asset, in kilobytes. */
    public function maxKilobytes(): int
    {
        return BrandAssetDefaults::find($this->key)['max_kb'] ?? 1024;
    }

    /**
     * All assets keyed by key, cached until one is saved.
     *
     * @return array<string, self>
     */
    public static function allByKey(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, fn () => static::query()->get()->keyBy('key')->all());
    }

    /**
     * Absolute image URL for emails: the uploaded logo when there is one,
     * else the built-in file.
     */
    public static function emailImageUrl(string $key): string
    {
        $asset = static::allByKey()[$key] ?? null;
        if ($asset && $asset->file_path) {
            return url('/api/v1/branding/'.$key.'/image').'?v='.$asset->updated_at?->timestamp;
        }

        return asset(BrandAssetDefaults::find($key)['email_image'] ?? '');
    }

    /** Absolute filesystem path of the image a PDF should embed. */
    public static function pdfImagePath(string $key): string
    {
        $asset = static::allByKey()[$key] ?? null;
        if ($asset && $asset->hasCustomImage()) {
            return Storage::disk(self::DISK)->path($asset->file_path);
        }

        return public_path(BrandAssetDefaults::find($key)['pdf_image'] ?? '');
    }

    public static function linkFor(string $key): ?string
    {
        return (static::allByKey()[$key] ?? null)?->link_url;
    }
}
