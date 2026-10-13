<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * TASK-05253: service-flow image uploads (web) must persist upload geolocation
 * and timestamp metadata alongside the stored file.
 */
class ServicesDraftUploadMetadataTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Storage::fake('private');
        Storage::fake('local');
    }

    private function makeApplicant(): User
    {
        $org = Organization::factory()->create();
        $user = User::factory()->create([
            'organization_id' => $org->id,
            'status' => 'active',
        ]);

        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $org->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return $user;
    }

    private function draftPayload(array $overrides = []): array
    {
        return array_merge([
            'unitName' => 'Metadata Test Unit',
            'unitAddress' => 'Plot 9, Industrial Area',
            'unitState' => 'Haryana',
            'unitDistrict' => 'Gurugram',
            'unitPincode' => '122016',
        ], $overrides);
    }

    public function test_draft_stores_geolocation_and_timestamp_for_uploaded_picture(): void
    {
        $user = $this->makeApplicant();

        $response = $this->withToken(JWTAuth::fromUser($user))->post('/api/v1/applications/services/draft', $this->draftPayload([
            'siteExteriorPhoto' => UploadedFile::fake()->create('site.jpg', 120, 'image/jpeg'),
            'siteExteriorPhotoLatitude' => '28.459497',
            'siteExteriorPhotoLongitude' => '77.026634',
            'siteExteriorPhotoCapturedAt' => '2026-07-16T12:00:00+05:30',
        ]));

        $response->assertCreated();

        $application = Application::latest('id')->first();
        $meta = $application->file_upload_metadata['site_exterior_photo'] ?? null;

        $this->assertNotNull($meta, 'file_upload_metadata must hold an entry for site_exterior_photo');
        $this->assertEqualsWithDelta(28.459497, $meta['latitude'], 0.000001);
        $this->assertEqualsWithDelta(77.026634, $meta['longitude'], 0.000001);
        $this->assertSame('2026-07-16T12:00:00+05:30', $meta['captured_at']);
        $this->assertNotEmpty($meta['uploaded_at']);
        $this->assertNotEmpty($application->site_exterior_photo);
    }

    public function test_draft_upload_without_geolocation_still_records_timestamps(): void
    {
        $user = $this->makeApplicant();

        $response = $this->withToken(JWTAuth::fromUser($user))->post('/api/v1/applications/services/draft', $this->draftPayload([
            'siteExteriorPhoto' => UploadedFile::fake()->create('site.jpg', 120, 'image/jpeg'),
        ]));

        $response->assertCreated();

        $meta = Application::latest('id')->first()->file_upload_metadata['site_exterior_photo'] ?? null;

        $this->assertNotNull($meta);
        $this->assertNull($meta['latitude']);
        $this->assertNull($meta['longitude']);
        $this->assertNotEmpty($meta['captured_at']);
        $this->assertNotEmpty($meta['uploaded_at']);
    }

    public function test_step_wise_saves_accumulate_metadata_per_file(): void
    {
        $user = $this->makeApplicant();
        $token = JWTAuth::fromUser($user);

        $first = $this->withToken($token)->post('/api/v1/applications/services/draft', $this->draftPayload([
            'siteExteriorPhoto' => UploadedFile::fake()->create('site.jpg', 120, 'image/jpeg'),
            'siteExteriorPhotoLatitude' => '28.459497',
            'siteExteriorPhotoLongitude' => '77.026634',
            'siteExteriorPhotoCapturedAt' => '2026-07-16T12:00:00+05:30',
        ]));
        $first->assertCreated();
        $applicationId = Application::latest('id')->first()->id;

        $second = $this->withToken($token)->post('/api/v1/applications/services/draft', $this->draftPayload([
            'applicationId' => $applicationId,
            'gstCertificateFile' => UploadedFile::fake()->create('gst.png', 80, 'image/png'),
            'gstCertificateFileLatitude' => '28.5',
            'gstCertificateFileLongitude' => '77.1',
            'gstCertificateFileCapturedAt' => '2026-07-16T13:00:00+05:30',
        ]));
        $second->assertOk();

        $meta = Application::find($applicationId)->file_upload_metadata;

        $this->assertArrayHasKey('site_exterior_photo', $meta, 'earlier file metadata must survive later step saves');
        $this->assertArrayHasKey('gst_certificate_file', $meta);
        $this->assertSame('2026-07-16T13:00:00+05:30', $meta['gst_certificate_file']['captured_at']);
    }

    public function test_invalid_coordinates_are_rejected(): void
    {
        $user = $this->makeApplicant();

        $response = $this->withToken(JWTAuth::fromUser($user))->post('/api/v1/applications/services/draft', $this->draftPayload([
            'siteExteriorPhoto' => UploadedFile::fake()->create('site.jpg', 120, 'image/jpeg'),
            'siteExteriorPhotoLatitude' => '999',
        ]));

        $response->assertStatus(422);
    }
}
