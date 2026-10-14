<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Services\FileStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Application Assessment Reset',
    description: 'Restart an in-progress assessment by wiping the assessor-captured execution data on the server (responses, attendance, meetings, basic information, assessor site & site-tour pictures). Applicant-uploaded pictures and the parameter allocation are preserved. Only available before the assessment is submitted for QC.',
)]
class ApplicationAssessmentResetController extends Controller
{
    protected FileStorageService $fileStorage;

    public function __construct(FileStorageService $fileStorage)
    {
        $this->fileStorage = $fileStorage;
    }

    /**
     * Reset (restart) an assessment's captured execution data.
     */
    #[OA\Delete(
        path: '/api/v1/application-assessments/{assessmentId}/reset',
        summary: 'Reset assessment data',
        description: 'Wipes the assessor-captured execution data for the assessment so it can be started again from the beginning. Deletes responses (and evidence), attendance, meetings, basic information, and assessor-captured site/site-tour pictures on the server; preserves applicant-uploaded pictures (clearing only their selection) and the parameter allocation. Only a team member may reset, and only while the assessment is still in progress (not yet submitted for QC).',
        tags: ['Application Assessment Reset', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Assessment data reset'),
            new OA\Response(response: 403, description: 'Not a team member'),
            new OA\Response(response: 409, description: 'Assessment can no longer be reset'),
        ],
    )]
    public function reset(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        // Only the lead may restart the assessment — a reset wipes the whole
        // team's captures, so a co-assessor must not be able to trigger it.
        if (! $teamMember->isLeadAssessor()) {
            return $this->errorResponse('Only the lead assessor can reset this assessment', 403);
        }

        if (! $assessment->canResetExecutionData()) {
            return $this->errorResponse(
                'This assessment can no longer be reset — its field work has already been submitted for review.',
                409
            );
        }

        $deletedFiles = $assessment->resetExecutionData();

        // Best-effort file cleanup, outside the DB transaction: the rows are gone
        // either way, so a storage hiccup must not fail the reset.
        foreach ($deletedFiles as $path) {
            try {
                $this->fileStorage->delete($path);
            } catch (\Throwable $e) {
                Log::warning('Assessment reset: file cleanup failed', [
                    'assessment_id' => $assessmentId,
                    'path' => $path,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Log::info('Assessment execution data reset', [
            'assessment_id' => $assessmentId,
            'user_id' => $user->id,
            'files_removed' => count($deletedFiles),
        ]);

        return $this->successResponse(
            [
                'assessment_id' => $assessmentId,
                'status' => $assessment->fresh()->status,
            ],
            'Assessment data reset successfully'
        );
    }
}
