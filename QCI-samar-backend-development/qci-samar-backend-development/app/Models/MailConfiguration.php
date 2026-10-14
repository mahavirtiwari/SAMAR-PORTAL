<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Outgoing mail server settings (Settings → Email Server). Single row.
 * The password is stored encrypted with the app key and never returned by
 * the API.
 */
class MailConfiguration extends Model
{
    protected $fillable = [
        'enabled',
        'host',
        'port',
        'encryption',
        'username',
        'password',
        'from_address',
        'from_name',
        'timeout',
        'updated_by',
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'enabled' => 'boolean',
        'port' => 'integer',
        'timeout' => 'integer',
        'password' => 'encrypted',
    ];

    public static function current(): self
    {
        return static::query()->first() ?? new self(['enabled' => false, 'encryption' => 'tls']);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Laravel SMTP mailer config for these settings. Port 465/"ssl" uses
     * implicit TLS (smtps); otherwise STARTTLS is used when the server offers it.
     */
    public function toMailerConfig(): array
    {
        return [
            'transport' => 'smtp',
            'scheme' => $this->encryption === 'ssl' ? 'smtps' : 'smtp',
            'host' => $this->host,
            'port' => $this->port ?: ($this->encryption === 'ssl' ? 465 : 587),
            'username' => $this->username ?: null,
            'password' => $this->password ?: null,
            'timeout' => $this->timeout ?: 30,
            'local_domain' => config('mail.mailers.smtp.local_domain'),
        ];
    }
}
