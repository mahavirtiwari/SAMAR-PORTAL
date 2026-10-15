<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * A link under the login page picture (Settings → Quick Links): a web address
 * or an uploaded PDF, which QuickLinkController serves.
 *
 * @property int $id
 * @property string $label
 * @property string|null $url
 * @property string|null $file_path
 * @property string|null $file_name
 * @property int $sort_order
 * @property bool $is_active
 */
class QuickLink extends Model
{
    public const DISK = 'local';

    /** Most links shown on the login page; more would crowd the picture. */
    public const MAX_ACTIVE = 6;

    protected $fillable = ['label', 'url', 'file_path', 'file_name', 'sort_order', 'is_active', 'updated_by'];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function hasFile(): bool
    {
        return $this->file_path !== null && Storage::disk(self::DISK)->exists($this->file_path);
    }

    /** Where the link goes: the uploaded file's download URL, else the web address. */
    public function href(): ?string
    {
        if ($this->file_path) {
            return url('/api/v1/quick-links/'.$this->id.'/file').'?v='.$this->updated_at?->timestamp;
        }

        return $this->url;
    }
}
