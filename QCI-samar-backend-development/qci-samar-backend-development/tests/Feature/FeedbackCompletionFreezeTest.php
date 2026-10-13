<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\FeedbackQuestion;
use App\Models\Organization;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Feedback completion is point-in-time: once an application's feedback is submitted in
 * full it stays Completed, even after a System Admin adds a new active feedback question
 * afterwards (BUG-06520). New questions apply only to still-open applications.
 */
class FeedbackCompletionFreezeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function enterpriseAdminFor(Organization $org): User
    {
        $user = User::factory()->create(['organization_id' => $org->id]);
        $role = Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail();
        $user->roles()->attach($role->id, [
            'organization_id' => $org->id,
            'is_active' => true,
            'assigned_at' => now(),
        ]);

        return $user;
    }

    private function makeApplication(Organization $org): Application
    {
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
            'application_number' => 'SAMAR-APP-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_name' => 'Acme Defense',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'status' => 'certified',
            'payment_status' => 'success',
            'payment_amount' => 25000,
        ]);

        Assessment::create([
            'application_id' => $application->id,
            'organization_id' => $org->id,
            'unit_id' => $unit->id,
            'status' => Assessment::STATUS_CERTIFIED,
            'total_score' => 3.5,
        ]);

        return $application;
    }

    private function makeQuestion(string $text, int $order): FeedbackQuestion
    {
        return FeedbackQuestion::create([
            'question_text' => $text,
            'type' => FeedbackQuestion::TYPE_RATING,
            'display_order' => $order,
            'is_active' => true,
        ]);
    }

    private function pendingStatusFor(User $user, string $applicationNumber): ?string
    {
        $response = $this->withToken(JWTAuth::fromUser($user))
            ->getJson('/api/v1/applications/feedback-pending');
        $response->assertOk();

        foreach ($response->json('data') as $row) {
            if (($row['applicationNumber'] ?? null) === $applicationNumber) {
                return $row['feedbackStatus'] ?? null;
            }
        }

        return null;
    }

    public function test_completed_feedback_stays_completed_after_a_new_question_is_added(): void
    {
        $org = Organization::factory()->create();
        $enterpriseAdmin = $this->enterpriseAdminFor($org);
        $application = $this->makeApplication($org);

        $q1 = $this->makeQuestion('How satisfied are you with the assessment?', 1);
        $q2 = $this->makeQuestion('Was the assessor professional?', 2);

        $this->withToken(JWTAuth::fromUser($enterpriseAdmin))
            ->postJson("/api/v1/applications/{$application->id}/feedbacks/submit", [
                'feedbacks' => [
                    ['feedbackQuestionId' => $q1->id, 'rating' => 5],
                    ['feedbackQuestionId' => $q2->id, 'rating' => 4],
                ],
            ])->assertCreated();

        $this->assertNotNull(
            $application->fresh()->feedback_completed_at,
            'answering every active question freezes completion'
        );
        $this->assertSame(
            'completed',
            $this->pendingStatusFor($enterpriseAdmin, $application->application_number)
        );

        // System Admin adds a new active question after completion.
        $this->makeQuestion('Would you recommend SAMAR to others?', 3);

        $this->assertSame(
            'completed',
            $this->pendingStatusFor($enterpriseAdmin, $application->application_number),
            'a question added after completion must not reopen completed feedback'
        );
    }

    public function test_incomplete_feedback_is_pending_and_not_frozen(): void
    {
        $org = Organization::factory()->create();
        $enterpriseAdmin = $this->enterpriseAdminFor($org);
        $application = $this->makeApplication($org);

        $q1 = $this->makeQuestion('How satisfied are you with the assessment?', 1);
        $this->makeQuestion('Was the assessor professional?', 2);

        // Answer only one of the two active questions.
        $this->withToken(JWTAuth::fromUser($enterpriseAdmin))
            ->postJson("/api/v1/applications/{$application->id}/feedbacks/submit", [
                'feedbacks' => [
                    ['feedbackQuestionId' => $q1->id, 'rating' => 5],
                ],
            ])->assertCreated();

        $this->assertNull($application->fresh()->feedback_completed_at);
        $this->assertSame(
            'pending',
            $this->pendingStatusFor($enterpriseAdmin, $application->application_number)
        );
    }
}
