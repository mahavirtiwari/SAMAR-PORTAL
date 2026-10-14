<?php

namespace Tests\Feature;

use App\Mail\NotificationMail;
use App\Models\EmailNotificationTemplate;
use App\Models\Role;
use App\Models\User;
use App\Services\Email\EmailNotificationService;
use Database\Seeders\NotificationTemplateSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Settings → Email Templates: a System Admin can view every transactional
 * email, customise its subject and body, preview and test it, and reset it.
 */
class EmailTemplateManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->seed(NotificationTemplateSeeder::class);
        $this->admin = $this->userWithRole(Role::SYSTEM_ADMIN);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('slug', $role)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);

        return $user;
    }

    private function auth(?User $user = null): array
    {
        return ['Authorization' => 'Bearer '.JWTAuth::fromUser($user ?? $this->admin)];
    }

    private function template(string $slug = 'application-received'): EmailNotificationTemplate
    {
        return EmailNotificationTemplate::where('slug', $slug)->firstOrFail();
    }

    public function test_the_admin_lists_every_seeded_template(): void
    {
        $response = $this->getJson('/api/v1/admin/email-templates', $this->auth())->assertOk();

        $this->assertCount(EmailNotificationTemplate::count(), $response->json('data'));
        $this->assertFalse($response->json('data.0.isCustomized'));
    }

    public function test_only_the_system_admin_can_manage_templates(): void
    {
        $operations = $this->userWithRole(Role::OPERATIONS_ADMIN);

        $this->getJson('/api/v1/admin/email-templates', $this->auth($operations))->assertForbidden();
        $this->putJson('/api/v1/admin/email-templates/'.$this->template()->id, ['subject' => 'x'], $this->auth($operations))->assertForbidden();
    }

    public function test_the_detail_offers_the_current_wording_with_placeholders(): void
    {
        $response = $this->getJson('/api/v1/admin/email-templates/'.$this->template()->id, $this->auth())->assertOk();

        $this->assertStringContainsString('{{application_number}}', $response->json('data.body'));
        $this->assertContains('application_number', $response->json('data.placeholders'));
        $this->assertTrue($response->json('data.defaultAvailable'));
    }

    public function test_a_customised_body_is_sanitised_and_used_for_real_emails(): void
    {
        Mail::fake();
        $template = $this->template();

        $this->putJson('/api/v1/admin/email-templates/'.$template->id, [
            'subject' => 'Received: {{application_number}}',
            'body' => '<p onclick="steal()">Thanks for application <strong>{{application_number}}</strong>.</p><script>alert(1)</script>',
        ], $this->auth())->assertOk()->assertJsonPath('data.isCustomized', true);

        $template->refresh();
        $this->assertStringNotContainsString('<script', $template->body);
        $this->assertStringNotContainsString('onclick', $template->body);
        $this->assertStringContainsString('{{application_number}}', $template->body);

        $recipient = User::factory()->create(['email' => 'applicant@example.com']);
        app(EmailNotificationService::class)->sendEmail($recipient, $template->slug, ['application_number' => 'APP-<42>']);

        Mail::assertSent(NotificationMail::class, function (NotificationMail $mail) {
            return $mail->mailSubject === 'Received: APP-&lt;42&gt;'
                && str_contains($mail->htmlBody, 'Thanks for application <strong>APP-&lt;42&gt;</strong>.')
                && ! str_contains($mail->htmlBody, '<script');
        });
    }

    public function test_saving_the_untouched_default_body_keeps_the_built_in_design(): void
    {
        $template = $this->template();
        $default = $this->getJson('/api/v1/admin/email-templates/'.$template->id, $this->auth())->json('data.body');

        $this->putJson('/api/v1/admin/email-templates/'.$template->id, [
            'subject' => 'New subject',
            'body' => $default,
        ], $this->auth())->assertOk()->assertJsonPath('data.isCustomized', false);

        $template->refresh();
        $this->assertNull($template->body);
        $this->assertSame('New subject', $template->subject);
    }

    public function test_preview_renders_unsaved_edits_with_sample_data(): void
    {
        $response = $this->postJson('/api/v1/admin/email-templates/'.$this->template()->id.'/preview', [
            'subject' => 'Hello {{user_name}}',
            'body' => '<p>Ref {{application_number}}</p>',
        ], $this->auth())->assertOk();

        $this->assertSame('Hello [user_name]', $response->json('data.subject'));
        $this->assertStringContainsString('Ref [application_number]', $response->json('data.html'));
        $this->assertNull($this->template()->fresh()->body, 'A preview must not save anything.');
    }

    public function test_a_test_email_goes_to_the_signed_in_admin(): void
    {
        Mail::fake();

        $this->postJson('/api/v1/admin/email-templates/'.$this->template()->id.'/test', [], $this->auth())
            ->assertOk()
            ->assertJsonPath('data.sentTo', $this->admin->email);

        Mail::assertSent(NotificationMail::class, fn (NotificationMail $mail) => $mail->hasTo($this->admin->email)
            && str_starts_with($mail->mailSubject, '[TEST] '));
    }

    public function test_reset_restores_the_built_in_design(): void
    {
        $template = $this->template();
        $template->update(['body' => '<p>Custom</p>', 'title' => 'Custom', 'customized_at' => now()]);

        $this->postJson('/api/v1/admin/email-templates/'.$template->id.'/reset', [], $this->auth())
            ->assertOk()
            ->assertJsonPath('data.isCustomized', false);

        $template->refresh();
        $this->assertNull($template->body);
        $this->assertNull($template->title);
    }

    public function test_deactivating_a_template_stops_it_being_sent(): void
    {
        Mail::fake();
        $template = $this->template();

        $this->putJson('/api/v1/admin/email-templates/'.$template->id, ['isActive' => false], $this->auth())->assertOk();

        app(EmailNotificationService::class)->sendEmail(User::factory()->create(), $template->slug, ['application_number' => 'X']);
        Mail::assertNothingSent();
    }
}
