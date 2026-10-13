<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * @OA\Tag(
 *     name="Application Assessment Mobile Completion",
 *     description="Per-assessor mobile cutover. An assessor signals from the device that their field work is finished; the lead can only complete once every co-assessor has, and the lead's completion readies the assessment for QC submission on the web."
 * )
 */
class ApplicationAssessmentMobileCompletionController extends Controller
{
    /**
     * Record the current assessor's mobile cutover.
     *
     * @OA\Post(
     *     path="/api/v1/application-assessments/{assessmentId}/mobile-complete",
     *     summary="Complete on mobile",
     *     description="Marks the current assessor's field work as finished on the device. Co-assessors may complete once their own captures are done and they have punched out. The lead assessor can only complete after every co-assessor has, and after that the assessment moves to field-work-complete and QC submission unlocks on the web.",
     *     tags={"Application Assessment Mobile Completion", "Assessor - Assessment"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="assessmentId", in="path", required=true, @OA\Schema(type="integer", example=1)),
     *
     *     @OA\RequestBody(
     *         required=false,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="device_metadata", type="object", description="Optional device info (model, os_version, app_version)")
     *         )
     *     ),
     *
     *     @OA\Response(response=200, description="Mobile completion recorded"),
     *     @OA\Response(response=400, description="Not eligible to complete yet"),
     *     @OA\Response(response=403, description="Not a team member")
     * )
     */
    public function complete(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        $validator = Validator::make($request->all(), [
            'device_metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        try {
            $assessment->markMemberMobileComplete($teamMember, $request->input('device_metadata'));

            return $this->successResponse(
                $this->completionPayload($assessment->fresh(), $user->id),
                'Mobile completion recorded successfully'
            );
        } catch (BusinessException $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Per-member mobile completion status for an assessment.
     *
     * Drives the lead's "Complete on Mobile" gate (enabled once every
     * co-assessor is complete) and the web cutover checklist.
     *
     * @OA\Get(
     *     path="/api/v1/application-assessments/{assessmentId}/mobile-completion-status",
     *     summary="Mobile completion status",
     *     tags={"Application Assessment Mobile Completion", "Assessor - Assessment"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="assessmentId", in="path", required=true, @OA\Schema(type="integer", example=1)),
     *
     *     @OA\Response(response=200, description="Mobile completion status retrieved"),
     *     @OA\Response(response=403, description="Not a team member")
     * )
     */
    public function status(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        return $this->successResponse(
            $this->completionPayload($assessment, $user->id),
            'Mobile completion status retrieved successfully'
        );
    }

    /**
     * Shape the per-member completion view plus the viewer's own eligibility.
     */
    private function completionPayload(Assessment $assessment, int $viewerUserId): array
    {
        $members = $assessment->teamMembers()->with('user')->get();
        $viewer = $members->firstWhere('user_id', $viewerUserId);

        return [
            'assessment_status' => $assessment->status,
            'all_team_members_mobile_complete' => $assessment->areAllTeamMembersMobileComplete(),
            'members' => $members->map(fn (AssessmentTeamMember $m) => [
                'team_member_id' => $m->id,
                'user_id' => $m->user_id,
                'name' => $m->user->full_name ?? 'Unknown',
                'role' => $m->role,
                'mobile_completed' => $m->mobile_completed_at !== null,
                'mobile_completed_at' => $m->mobile_completed_at?->toIso8601String(),
            ])->values()->all(),
            'me' => $viewer ? [
                'team_member_id' => $viewer->id,
                'role' => $viewer->role,
                'mobile_completed' => $viewer->mobile_completed_at !== null,
                'mobile_completed_at' => $viewer->mobile_completed_at?->toIso8601String(),
                'can_complete' => $assessment->canMemberCompleteMobile($viewer)['can'],
                'blockers' => $assessment->canMemberCompleteMobile($viewer)['errors'],
            ] : null,
        ];
    }
}
