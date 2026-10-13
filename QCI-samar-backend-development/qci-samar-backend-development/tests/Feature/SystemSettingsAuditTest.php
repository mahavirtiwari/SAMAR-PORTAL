<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class SystemSettingsAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function admin(): User
    {
        $user = User::factory()->create();
        $role = Role::where('slug', Role::SYSTEM_ADMIN)->firstOrFail();
        $user->roles()->attach($role->id, ['organization_id' => null, 'unit_id' => null, 'is_active' => true, 'assigned_at' => now()]);

        return $user;
    }

    private function auditsFor(string $key, string $event)
    {
        $ids = SystemSetting::where('key', $key)->pluck('id');

        return AuditLog::where('auditable_type', SystemSetting::class)
            ->whereIn('auditable_id', $ids)
            ->where('custom_event', $event)
            ->get();
    }

    public function test_updating_a_setting_records_the_diff_and_actor(): void
    {
        $admin = $this->admin();
        SystemSetting::create(['key' => 'maintenance_mode', 'value' => 'false', 'description' => 'Maintenance flag']);

        $response = $this->withToken(JWTAuth::fromUser($admin))
            ->putJson('/api/v1/system-settings/maintenance_mode', ['value' => 'true']);

        $response->assertOk();

        $audits = $this->auditsFor('maintenance_mode', 'setting_updated');
        $this->assertCount(1, $audits);

        $audit = $audits->first();
        $this->assertSame('false', $audit->old_values['value']);
        $this->assertSame('true', $audit->new_values['value']);
        $this->assertSame(['value'], $audit->changed_fields);
        $this->assertSame($admin->id, $audit->user_id);
        $this->assertSame($admin->email, $audit->user_email);
        $this->assertContains('system_admin', $audit->user_roles);
        $this->assertSame('maintenance_mode', $audit->metadata['key']);
    }

    public function test_creating_a_setting_records_a_created_event(): void
    {
        $admin = $this->admin();

        $response = $this->withToken(JWTAuth::fromUser($admin))
            ->postJson('/api/v1/system-settings', [
                'key' => 'upload_max_file_size',
                'value' => '52428800',
                'description' => 'Max upload bytes',
            ]);

        $response->assertCreated();

        $audits = $this->auditsFor('upload_max_file_size', 'setting_created');
        $this->assertCount(1, $audits);
        $this->assertSame('52428800', $audits->first()->new_values['value']);
        $this->assertSame($admin->id, $audits->first()->user_id);
    }

    public function test_unchanged_value_records_nothing(): void
    {
        $admin = $this->admin();
        SystemSetting::create(['key' => 'application_submission_open', 'value' => 'true']);

        $response = $this->withToken(JWTAuth::fromUser($admin))
            ->putJson('/api/v1/system-settings/application_submission_open', ['value' => 'true']);

        $response->assertOk();

        $this->assertCount(0, $this->auditsFor('application_submission_open', 'setting_updated'));
    }
}
