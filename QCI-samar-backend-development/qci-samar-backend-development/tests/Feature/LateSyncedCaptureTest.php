<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationAssessmentMeeting;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Captures queued offline on a phone can sync after the lead marks field work
 * complete. The apps treat a 400 as final, so these must still be accepted
 * while the assessment is mobile_complete, and rejected once it goes to QC.
 */
class LateSyncedCaptureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Storage::fake('private');
    }

    /**
     * @return array{0: Assessment, 1: User}
     */
    private function makeAssessment(string $status): array
    {
        $org = Organization::factory()->create();
        $unit = Unit::create([
            'organization_id' => $org->id,
            'name' => 'Test Unit',
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Haryana',
            'district' => 'Gurugram',
            'pincode' => '122016',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
        $application = Application::create([
            'organization_id' => $org->id,
            'organization_name' => $org->name ?? 'Org',
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'application_number' => 'SAMAR-SRC-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_name' => 'Acme Defense',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'mfg_products' => [['product_name' => 'Widget']],
            'customers' => [['customer_name' => 'DRDO']],
            'status' => 'certified',
            'payment_status' => 'success',
            'payment_amount' => 25000,
        ]);

        $assessment = new Assessment;
        $assessment->forceFill([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => $status,
        ])->save();

        $user = User::factory()->create();
        $user->roles()->attach(Role::where('slug', Role::ASSESSOR)->firstOrFail()->id, [
            'is_active' => true,
            'assigned_at' => now(),
        ]);
        $assessment->teamMembers()->create([
            'user_id' => $user->id,
            'role' => AssessmentTeamMember::ROLE_LEAD_ASSESSOR,
        ]);
        ApplicationAssessmentMeeting::create([
            'assessment_id' => $assessment->id,
            'type' => ApplicationAssessmentMeeting::TYPE_OPENING,
            'image_path' => 'meetings/opening.jpg',
            'disk' => 'private',
            'conducted_at' => now(),
            'created_by' => $user->id,
        ]);

        return [$assessment->fresh(), $user];
    }

    private function upload(string $path, User $user, array $fields = [])
    {
        return $this->withToken(JWTAuth::fromUser($user))->post($path, $fields + [
            'image' => UploadedFile::fake()->image('photo.jpg', 800, 600),
            'clientUuid' => (string) str()->uuid(),
        ], ['Accept' => 'application/json']);
    }

    public function test_site_pictures_sync_after_field_work_is_complete(): void
    {
        [$assessment, $user] = $this->makeAssessment(Assessment::STATUS_MOBILE_COMPLETE);

        $this->upload("/api/v1/application-assessments/{$assessment->id}/site-pictures", $user, ['title' => 'Site Exterior Picture'])
            ->assertSuccessful();

        $this->withToken(JWTAuth::fromUser($user))
            ->getJson("/api/v1/application-assessments/{$assessment->id}/site-pictures")
            ->assertOk()
            ->assertJsonPath('data.totalCount', 1);
    }

    public function test_site_tour_pictures_sync_after_field_work_is_complete_with_their_caption(): void
    {
        [$assessment, $user] = $this->makeAssessment(Assessment::STATUS_MOBILE_COMPLETE);

        $this->upload("/api/v1/application-assessments/{$assessment->id}/site-tour-pictures", $user, ['title' => 'Paint shop, line 2'])
            ->assertSuccessful();

        $this->withToken(JWTAuth::fromUser($user))
            ->getJson("/api/v1/application-assessments/{$assessment->id}/site-tour-pictures")
            ->assertOk()
            ->assertJsonFragment(['title' => 'Paint shop, line 2']);
    }

    public function test_captures_are_rejected_once_the_assessment_is_submitted_for_qc(): void
    {
        [$assessment, $user] = $this->makeAssessment(Assessment::STATUS_SUBMITTED_FOR_QC);

        $this->upload("/api/v1/application-assessments/{$assessment->id}/site-pictures", $user, ['title' => 'Site Exterior Picture'])
            ->assertStatus(400);
        $this->upload("/api/v1/application-assessments/{$assessment->id}/site-tour-pictures", $user, ['title' => 'Late'])
            ->assertStatus(400);
    }
}
