<?php

namespace Tests\Feature;

use App\Models\ContentBlock;
use App\Models\Role;
use App\Models\User;
use App\Support\ContentBlockDefaults;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Settings → Content & Disclaimers: instructions, declarations and
 * disclaimers are readable by anyone (login/policy pages are public) and
 * editable only by the System Admin.
 */
class ContentBlockManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function auth(string $role = Role::SYSTEM_ADMIN): array
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('slug', $role)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);

        return ['Authorization' => 'Bearer '.JWTAuth::fromUser($user)];
    }

    public function test_the_migration_seeds_every_default_block(): void
    {
        $this->assertSame(count(ContentBlockDefaults::all()), ContentBlock::count());
        $this->assertSame(
            ContentBlockDefaults::find('payment_undertaking')['body'],
            ContentBlock::where('key', 'payment_undertaking')->value('body'),
        );
    }

    public function test_blocks_are_readable_without_signing_in(): void
    {
        $this->getJson('/api/v1/content-blocks/registration_instructions')
            ->assertOk()
            ->assertJsonPath('data.key', 'registration_instructions');

        $response = $this->getJson('/api/v1/content-blocks?keys=payment_undertaking,payment_undertaking_agreement')->assertOk();
        $this->assertCount(2, $response->json('data'));

        $this->getJson('/api/v1/content-blocks/nope')->assertNotFound();
    }

    public function test_the_admin_edits_a_block_and_the_html_is_sanitised(): void
    {
        $this->putJson('/api/v1/admin/content-blocks/registration_instructions', [
            'body' => '<p>New rules</p><img src=x onerror="alert(1)"><script>alert(2)</script>',
        ], $this->auth())->assertOk()->assertJsonPath('data.isDefault', false);

        $body = ContentBlock::where('key', 'registration_instructions')->value('body');
        $this->assertStringContainsString('<p>New rules</p>', $body);
        $this->assertStringNotContainsString('onerror', $body);
        $this->assertStringNotContainsString('<script', $body);
    }

    public function test_text_blocks_drop_markup(): void
    {
        $this->putJson('/api/v1/admin/content-blocks/maintenance_message', [
            'body' => '<b>Back</b> at 6 pm.',
        ], $this->auth())->assertOk();

        $this->assertSame('Back at 6 pm.', ContentBlock::where('key', 'maintenance_message')->value('body'));
    }

    public function test_only_the_system_admin_can_edit(): void
    {
        $this->putJson('/api/v1/admin/content-blocks/maintenance_message', ['body' => 'x'], $this->auth(Role::OPERATIONS_MANAGER))
            ->assertForbidden();
        $this->putJson('/api/v1/admin/content-blocks/maintenance_message', ['body' => 'x'])->assertUnauthorized();
    }

    public function test_reset_restores_the_original_text(): void
    {
        ContentBlock::where('key', 'password_reset_notice')->update(['body' => 'Changed']);

        $this->postJson('/api/v1/admin/content-blocks/password_reset_notice/reset', [], $this->auth())
            ->assertOk()
            ->assertJsonPath('data.isDefault', true);

        $this->assertSame(
            ContentBlockDefaults::find('password_reset_notice')['body'],
            ContentBlock::where('key', 'password_reset_notice')->value('body'),
        );
    }

    public function test_the_report_disclaimer_reads_the_edited_block(): void
    {
        ContentBlock::where('key', 'assessment_report_disclaimer')->update(['body' => '<p>Edited disclaimer</p>']);

        $html = view('pdfs.assessment.partials.disclaimer', ['footerData' => []])->render();

        $this->assertStringContainsString('Edited disclaimer', $html);
    }
}
