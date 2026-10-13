<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Traits\AuthorizesAssessmentAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Application Assessment Step Progress",
 *     description="Track assessment step completion progress. There are 7 steps in an assessment: 1) Parameter Allocation, 2) Site Pictures, 3) Opening Meeting, 4) Site Tour, 5) Basic Information, 6) Assessment Parameters, 7) Closing Meeting"
 * )
 */
class ApplicationAssessmentStepProgressController extends Controller
{
    use AuthorizesAssessmentAccess;

    /**
     * Get step progress for an assessment.
     *
     * @OA\Get(
     *     path="/api/v1/application-assessments/{assessmentId}/step-progress",
     *     summary="Get assessment step progress",
     *     description="Returns the overall step progress for an assessment, including current step, completion percentage, and whether all steps are complete.",
     *     tags={"Application Assessment Step Progress", "Assessor - Assessment"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Step progress retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="status", type="string", example="in_progress", description="Current assessment status"),
     *                 @OA\Property(
     *                     property="step_progress",
     *                     type="object",
     *                     description="Status of each step",
     *                     @OA\Property(property="parameter_allocation", type="string", enum={"pending", "in_progress", "completed"}, example="completed"),
     *                     @OA\Property(property="site_pictures", type="string", example="completed"),
     *                     @OA\Property(property="opening_meeting", type="string", example="completed"),
     *                     @OA\Property(property="site_tour", type="string", example="in_progress"),
     *                     @OA\Property(property="basic_information", type="string", example="pending"),
     *                     @OA\Property(property="assessment_parameters", type="string", example="pending"),
     *                     @OA\Property(property="closing_meeting", type="string", example="pending")
     *                 ),
     *                 @OA\Property(
     *                     property="steps",
     *                     type="array",
     *                     description="Array of step summaries",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="step", type="string", example="parameter_allocation"),
     *                         @OA\Property(property="status", type="string", example="completed"),
     *                         @OA\Property(property="is_completed", type="boolean", example=true)
     *                     )
     *                 ),
     *                 @OA\Property(property="current_step", type="string", nullable=true, example="site_tour", description="First incomplete step"),
     *                 @OA\Property(property="completion_percentage", type="number", format="float", example=42.86),
     *                 @OA\Property(property="all_steps_completed", type="boolean", example=false),
     *                 @OA\Property(property="can_submit_for_qc", type="boolean", example=false, description="Whether assessment can be submitted for QC")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=404, description="Assessment not found")
     * )
     */
    public function show(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);

        if ($denied = $this->denyUnlessAssessmentVisible($request, $assessment)) {
            return $denied;
        }

        // Per-member view: site_pictures, site_tour and assessment_parameters
        // reflect only THIS assessor's own captures so a co-assessor's progress
        // never inherits the lead's green ticks. The other steps stay global.
        // opening_meeting stays global, so the co-assessor reads the lead's
        // server-confirmed opening-meeting status straight off this response —
        // that's the online signal gating their site tour.
        $teamMember = $assessment->teamMembers()
            ->where('user_id', $request->user()->id)
            ->first();

        $progress = $teamMember
            ? $assessment->getStepProgressForMember($teamMember)
            : ($assessment->step_progress ?? []);

        return $this->successResponse([
            'status' => $assessment->status,
            'step_progress' => $progress,
            'steps' => $assessment->getStepProgressSummary($progress),
            'current_step' => $assessment->getCurrentStep($progress),
            'completion_percentage' => $assessment->getStepCompletionPercentage($progress),
            // Whole-team gates stay global — QC submission needs every member done.
            'all_steps_completed' => $assessment->areAllStepsCompleted(),
            // Mirror the AUTHORITATIVE submission rule (canSubmitForQC: in_progress
            // + every assigned-parameter question answered + all team punched out),
            // not areAllStepsCompleted(). The two can disagree — e.g. an assigned
            // parameter with no questions keeps the step "pending" forever yet
            // submission would still succeed — so gating the UI on step completion
            // misleads the web submit button. Use the same check submitForQC() runs.
            'can_submit_for_qc' => $assessment->canSubmitForQC()['can_submit'],
            'allocation_locked' => $assessment->isAllocationLocked(),
        ], 'Step progress retrieved successfully');
    }
}
