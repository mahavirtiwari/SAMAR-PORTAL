<?php

namespace App\Models;

use App\Support\ContentBlockDefaults;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An admin-editable instruction, declaration or disclaimer shown in the
 * portal (Settings → Content & Disclaimers). `format` is 'html' for rich
 * blocks (sanitised on save) or 'text' for single-line labels.
 */
class ContentBlock extends Model
{
    protected $fillable = [
        'key',
        'group',
        'title',
        'description',
        'format',
        'body',
        'updated_by',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * The block's body, falling back to its built-in default when the row is
     * missing (e.g. before migrations ran) so callers always get text.
     */
    public static function bodyFor(string $key): string
    {
        $body = static::query()->where('key', $key)->value('body');

        return $body ?? (ContentBlockDefaults::find($key)['body'] ?? '');
    }

    public function isDefault(): bool
    {
        return trim((string) $this->body) === trim(ContentBlockDefaults::find($this->key)['body'] ?? '');
    }
}
