<?php

namespace Tests\Feature;

use App\Models\QuickLink;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * The login page picture and quick links are set by the System Admin.
 */
class LoginPageSettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Cache::forget('brand_assets.all');
        $this->seed(RoleSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->roles()->attach(Role::where('slug', Role::SYSTEM_ADMIN)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);
    }

    private function headers(?User $user = null): array
    {
        return ['Authorization' => 'Bearer '.JWTAuth::fromUser($user ?? $this->admin)];
    }

    public function test_the_login_picture_is_served_as_a_url_not_inline(): void
    {
        $this->post('/api/v1/admin/branding/login_picture', [
            'image' => UploadedFile::fake()->image('hero.jpg', 1200, 1200)->size(1500),
        ], $this->headers())->assertOk();

        $picture = collect($this->getJson('/api/v1/branding')->json('data'))->firstWhere('key', 'login_picture');
        $this->assertStringContainsString('/api/v1/branding/login_picture/image?v=', $picture['image']);

        // Logos stay inline and keep their 1 MB limit.
        $this->post('/api/v1/admin/branding/samar_logo', [
            'image' => UploadedFile::fake()->image('logo.png', 200, 200)->size(1500),
        ], $this->headers())->assertStatus(422);
    }

    public function test_quick_links_default_to_the_user_manual(): void
    {
        $links = $this->getJson('/api/v1/quick-links')->assertOk()->json('data');

        $this->assertCount(1, $links);
        $this->assertSame('Applicant User Manual', $links[0]['label']);
        $this->assertSame('/assets/document/applicant-user-manual.pdf', $links[0]['href']);
    }

    public function test_admin_adds_edits_hides_and_removes_quick_links(): void
    {
        $created = $this->post('/api/v1/admin/quick-links', [
            'label' => 'Scheme Guidelines',
            'file' => UploadedFile::fake()->create('guidelines.pdf', 300, 'application/pdf'),
        ], $this->headers())->assertCreated()->json('data');

        $this->assertTrue($created['isFile']);
        $link = QuickLink::findOrFail($created['id']);
        Storage::disk('local')->assertExists($link->file_path);
        $this->get('/api/v1/quick-links/'.$link->id.'/file')->assertOk();

        $this->post('/api/v1/admin/quick-links/'.$link->id, [
            'label' => 'DRDO website',
            'url' => 'https://www.drdo.gov.in',
        ], $this->headers())->assertOk();
        Storage::disk('local')->assertMissing($link->file_path);

        $this->post('/api/v1/admin/quick-links/'.$link->id, ['label' => 'DRDO website', 'isActive' => 0], $this->headers())->assertOk();
        $this->assertSame(['Applicant User Manual'], array_column($this->getJson('/api/v1/quick-links')->json('data'), 'label'));

        $this->delete('/api/v1/admin/quick-links/'.$link->id, [], $this->headers())->assertOk();
        $this->assertNull(QuickLink::find($link->id));
    }

    public function test_quick_link_needs_a_safe_target(): void
    {
        $this->post('/api/v1/admin/quick-links', ['label' => 'Nothing'], $this->headers())->assertStatus(422);
        $this->post('/api/v1/admin/quick-links', ['label' => 'Script', 'url' => 'javascript:alert(1)'], $this->headers())->assertStatus(422);
        $this->post('/api/v1/admin/quick-links', ['label' => 'Other host', 'url' => '//evil.example'], $this->headers())->assertStatus(422);
        $this->post('/api/v1/admin/quick-links', [
            'label' => 'Not a PDF',
            'file' => UploadedFile::fake()->create('run.exe', 10, 'application/octet-stream'),
        ], $this->headers())->assertStatus(422);
    }

    public function test_only_six_links_can_be_shown(): void
    {
        foreach (range(2, QuickLink::MAX_ACTIVE) as $i) {
            $this->post('/api/v1/admin/quick-links', ['label' => "Link {$i}", 'url' => "/page-{$i}"], $this->headers())->assertCreated();
        }

        $this->post('/api/v1/admin/quick-links', ['label' => 'One too many', 'url' => '/more'], $this->headers())
            ->assertStatus(422)->assertJsonValidationErrors('isActive');
    }

    public function test_only_the_system_admin_manages_quick_links(): void
    {
        $assessor = User::factory()->create();
        $assessor->roles()->attach(Role::where('slug', Role::ASSESSOR)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);

        $this->getJson('/api/v1/admin/quick-links', $this->headers($assessor))->assertForbidden();
        $this->post('/api/v1/admin/quick-links', ['label' => 'X', 'url' => '/x'], $this->headers($assessor))->assertForbidden();
    }
}
