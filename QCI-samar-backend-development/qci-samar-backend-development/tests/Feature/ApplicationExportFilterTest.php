<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * The applications export must honour the same filters its list screens send.
 * Two the list accepted but the export ignored: enterprise size, and the
 * excluded statuses the DRDO Admin screen uses to hide drafts. [TASK-05937]
 */
class ApplicationExportFilterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeApplication(array $overrides = []): Application
    {
        $org = Organization::factory()->create();
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Pune Plant',
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Maharashtra',
            'district' => 'Pune',
            'pincode' => '411001',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);

        return Application::create(array_merge([
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'unit_state' => 'Maharashtra',
            'application_number' => 'SAMAR-APP-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_classification' => 'micro',
            'enterprise_name' => 'Acme Defence',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'status' => 'in_progress',
        ], $overrides));
    }

    private function export(string $query = ''): string
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(
            Role::where('slug', Role::SYSTEM_ADMIN)->firstOrFail()->id,
            ['is_active' => true, 'assigned_at' => now()],
        );

        $response = $this->get(
            '/api/v1/applications/export'.($query ? '?'.$query : ''),
            ['Authorization' => 'Bearer '.JWTAuth::fromUser($admin)],
        );

        $response->assertOk();

        return $response->streamedContent();
    }

    public function test_the_enterprise_size_filter_narrows_the_exported_rows(): void
    {
        $micro = $this->makeApplication();
        $small = $this->makeApplication(['enterprise_classification' => 'small']);

        $csv = $this->export('enterpriseClassification=micro');

        $this->assertStringContainsString($micro->application_number, $csv);
        $this->assertStringNotContainsString($small->application_number, $csv);
    }

    public function test_excluded_statuses_are_kept_out_of_the_file(): void
    {
        $live = $this->makeApplication();
        $draft = $this->makeApplication(['status' => 'draft']);

        $csv = $this->export('excludeStatus=draft');

        $this->assertStringContainsString($live->application_number, $csv);
        $this->assertStringNotContainsString($draft->application_number, $csv, 'A screen that hides drafts must not export them.');
    }

    public function test_several_excluded_statuses_are_all_honoured(): void
    {
        $live = $this->makeApplication();
        $draft = $this->makeApplication(['status' => 'draft']);
        $rejected = $this->makeApplication(['status' => 'rejected']);

        $csv = $this->export('excludeStatus=draft,rejected');

        $this->assertStringContainsString($live->application_number, $csv);
        $this->assertStringNotContainsString($draft->application_number, $csv);
        $this->assertStringNotContainsString($rejected->application_number, $csv);
    }
}
