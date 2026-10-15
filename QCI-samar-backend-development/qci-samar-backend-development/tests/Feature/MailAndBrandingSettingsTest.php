<?php

namespace Tests\Feature;

use App\Mail\NotificationMail;
use App\Models\BrandAsset;
use App\Models\MailConfiguration;
use App\Models\Role;
use App\Models\User;
use App\Services\Email\MailConfigurationApplier;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Settings → Email Server and Settings → Branding & Logos (System Admin).
 */
class MailAndBrandingSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        MailConfigurationApplier::forget();
    }

    private function auth(string $role = Role::SYSTEM_ADMIN): array
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('slug', $role)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);

        return ['Authorization' => 'Bearer '.JWTAuth::fromUser($user)];
    }

    private function smtpPayload(array $overrides = []): array
    {
        return array_merge([
            'enabled' => true,
            'host' => 'smtp.example.org',
            'port' => 587,
            'encryption' => 'tls',
            'username' => 'mailer@example.org',
            'password' => 'S3cret!pass',
            'fromAddress' => 'noreply@example.org',
            'fromName' => 'SAMAR Portal',
        ], $overrides);
    }

    public function test_smtp_settings_are_saved_with_an_encrypted_password_that_is_never_returned(): void
    {
        $response = $this->putJson('/api/v1/admin/mail-settings', $this->smtpPayload(), $this->auth())->assertOk();

        $response->assertJsonPath('data.hasPassword', true)->assertJsonMissingPath('data.password');
        $raw = MailConfiguration::query()->first()->getRawOriginal('password');
        $this->assertNotSame('S3cret!pass', $raw, 'The password must be stored encrypted.');
        $this->assertSame('S3cret!pass', MailConfiguration::query()->first()->password);

        $this->getJson('/api/v1/admin/mail-settings', $this->auth())->assertOk()->assertJsonMissingPath('data.password');
    }

    public function test_a_blank_password_keeps_the_stored_one(): void
    {
        $this->putJson('/api/v1/admin/mail-settings', $this->smtpPayload(), $this->auth())->assertOk();
        $this->putJson('/api/v1/admin/mail-settings', $this->smtpPayload(['password' => '', 'port' => 2525]), $this->auth())->assertOk();

        $config = MailConfiguration::query()->first();
        $this->assertSame('S3cret!pass', $config->password);
        $this->assertSame(2525, $config->port);
    }

    public function test_enabled_settings_override_the_environment_mail_config(): void
    {
        $this->putJson('/api/v1/admin/mail-settings', $this->smtpPayload(['encryption' => 'ssl', 'port' => 465]), $this->auth())->assertOk();

        app(MailConfigurationApplier::class)->apply();

        $this->assertSame('smtp', config('mail.default'));
        $this->assertSame('smtp.example.org', config('mail.mailers.smtp.host'));
        $this->assertSame('smtps', config('mail.mailers.smtp.scheme'));
        $this->assertSame('mailer@example.org', config('mail.mailers.smtp.username'));
        $this->assertSame('noreply@example.org', config('mail.from.address'));
    }

    public function test_disabled_settings_leave_the_environment_config_alone(): void
    {
        $default = config('mail.default');
        $this->putJson('/api/v1/admin/mail-settings', $this->smtpPayload(['enabled' => false]), $this->auth())->assertOk();

        app(MailConfigurationApplier::class)->apply();

        $this->assertSame($default, config('mail.default'));
    }

    public function test_bcc_addresses_are_validated_and_saved(): void
    {
        $this->putJson('/api/v1/admin/mail-settings', $this->smtpPayload(['bcc' => ['not-an-email']]), $this->auth())
            ->assertStatus(422);

        $this->putJson('/api/v1/admin/mail-settings', $this->smtpPayload(['bcc' => [' Audit@Example.org', 'audit@example.org', 'records@example.org']]), $this->auth())
            ->assertOk()
            ->assertJsonPath('data.bcc', ['audit@example.org', 'records@example.org']);
    }

    public function test_every_outgoing_email_is_blind_copied_even_with_the_environment_mailer(): void
    {
        $this->putJson('/api/v1/admin/mail-settings', $this->smtpPayload(['enabled' => false, 'bcc' => ['audit@example.org', 'user@example.org']]), $this->auth())
            ->assertOk();
        config(['mail.default' => 'array']);

        Mail::to('user@example.org')->send(new NotificationMail('Subject', '<p>Body</p>', 'Body'));

        $messages = app('mail.manager')->mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $bcc = array_map(fn ($a) => $a->getAddress(), $messages[0]->getOriginalMessage()->getBcc());
        // Already a direct recipient, so not copied a second time.
        $this->assertSame(['audit@example.org'], $bcc);
    }

    public function test_enabling_requires_host_port_and_sender(): void
    {
        $this->putJson('/api/v1/admin/mail-settings', ['enabled' => true], $this->auth())
            ->assertStatus(422);
    }

    public function test_a_test_email_reports_an_unreachable_server(): void
    {
        $this->postJson('/api/v1/admin/mail-settings/test', $this->smtpPayload(['host' => '127.0.0.1', 'port' => 1, 'timeout' => 5]), $this->auth())
            ->assertStatus(502);
    }

    public function test_only_the_system_admin_manages_mail_settings(): void
    {
        $this->getJson('/api/v1/admin/mail-settings', $this->auth(Role::OPERATIONS_ADMIN))->assertForbidden();
        $this->putJson('/api/v1/admin/mail-settings', $this->smtpPayload())->assertUnauthorized();
    }

    public function test_branding_lists_every_logo_publicly_with_default_links(): void
    {
        $response = $this->getJson('/api/v1/branding')->assertOk();

        $this->assertCount(6, $response->json('data'));
        $drdo = collect($response->json('data'))->firstWhere('key', 'drdo_logo');
        $this->assertSame('https://www.drdo.gov.in', $drdo['linkUrl']);
        $this->assertNull($drdo['image']);
    }

    public function test_the_admin_replaces_a_logo_and_sets_its_link(): void
    {
        Storage::fake('local');

        $this->post('/api/v1/admin/branding/qci_logo', [
            'image' => UploadedFile::fake()->image('qci.png', 200, 80),
            'linkUrl' => 'https://qcin.org/about',
        ], $this->auth() + ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.isCustom', true)
            ->assertJsonPath('data.linkUrl', 'https://qcin.org/about');

        $public = collect($this->getJson('/api/v1/branding')->json('data'))->firstWhere('key', 'qci_logo');
        $this->assertStringStartsWith('data:image/png;base64,', $public['image']);

        $this->get('/api/v1/branding/qci_logo/image')->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->assertStringContainsString('/api/v1/branding/qci_logo/image', BrandAsset::emailImageUrl('qci_logo'));
        $this->assertStringStartsWith(Storage::disk('local')->path('branding'), BrandAsset::pdfImagePath('qci_logo'));
    }

    public function test_only_png_or_jpg_images_are_accepted(): void
    {
        Storage::fake('local');

        $this->post('/api/v1/admin/branding/samar_logo', [
            'image' => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml'),
        ], $this->auth() + ['Accept' => 'application/json'])->assertStatus(422);

        $this->post('/api/v1/admin/branding/samar_logo', [
            'linkUrl' => 'javascript:alert(1)',
        ], $this->auth() + ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_reset_restores_the_built_in_logo_and_link(): void
    {
        Storage::fake('local');
        $this->post('/api/v1/admin/branding/drdo_logo', [
            'image' => UploadedFile::fake()->image('drdo.jpg', 120, 60),
            'linkUrl' => 'https://example.org',
        ], $this->auth() + ['Accept' => 'application/json'])->assertOk();

        $this->postJson('/api/v1/admin/branding/drdo_logo/reset', [], $this->auth())
            ->assertOk()
            ->assertJsonPath('data.isCustom', false)
            ->assertJsonPath('data.linkUrl', 'https://www.drdo.gov.in');

        $this->assertStringContainsString('images/emails/footer-left.png', BrandAsset::emailImageUrl('drdo_logo'));
        $this->get('/api/v1/branding/drdo_logo/image')->assertNotFound();
    }
}
