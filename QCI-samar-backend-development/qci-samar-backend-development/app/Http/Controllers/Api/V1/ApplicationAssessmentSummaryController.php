<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationAssessmentResponseEvidence;
use App\Models\Assessment;
use App\Models\Role;
use App\Services\FileStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @OA\Tag(
 *     name="Application Assessment Summary",
 *     description="Read-only endpoint for enterprise and unit admins to view assessment data"
 * )
 */
class ApplicationAssessmentSummaryController extends Controller
{
    /**
     * File storage service instance.
     */
    protected FileStorageService $fileStorage;

    /**
     * Create a new controller instance.
     */
    public function __construct(FileStorageService $fileStorage)
    {
        $this->fileStorage = $fileStorage;
    }

    /**
     * @OA\Get(
     *     path="/api/v1/applications/{applicationId}/assessment-summary",
     *     summary="Get assessment summary for an application",
     *     description="Retrieve assessment summary including site tour pictures, basic information, and evidences. Only available when assessment is in submitted_for_qc or later states. Restricted to Enterprise Admin (own org) and Unit Admin (own units).",
     *     tags={"Application Assessment Summary", "Enterprise Admin - Application", "Unit Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="applicationId",
     *         in="path",
     *         required=true,
     *         description="Application ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Assessment summary retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Assessment summary retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="assessmentId", type="integer", example=12),
     *                 @OA\Property(property="status", type="string", example="submitted_for_qc"),
     *                 @OA\Property(property="totalScore", type="number", format="float", example=3.75, nullable=true),
     *                 @OA\Property(
     *                     property="siteTour",
     *                     type="object",
     *                     @OA\Property(
     *                         property="pictures",
     *                         type="array",
     *
     *                         @OA\Items(
     *                             type="object",
     *
     *                             @OA\Property(property="id", type="integer", example=1),
     *                             @OA\Property(property="title", type="string", example="Production floor"),
     *                             @OA\Property(property="fileName", type="string", example="floor.jpg"),
     *                             @OA\Property(property="fileSize", type="integer", example=1024000),
     *                             @OA\Property(property="latitude", type="number", format="float", example=28.6139, nullable=true),
     *                             @OA\Property(property="longitude", type="number", format="float", example=77.2090, nullable=true),
     *                             @OA\Property(property="capturedAt", type="string", format="date-time", example="2024-01-15T10:30:00+00:00", nullable=true),
     *                             @OA\Property(property="downloadUrl", type="string", example="http://localhost:8000/api/v1/assessments/1/site-tour-pictures/1/download"),
     *                             @OA\Property(
     *                                 property="uploadedBy",
     *                                 type="object",
     *                                 nullable=true,
     *                                 @OA\Property(property="id", type="integer", example=1),
     *                                 @OA\Property(property="name", type="string", example="John Doe")
     *                             )
     *                         )
     *                     ),
     *                     @OA\Property(property="totalCount", type="integer", example=5)
     *                 ),
     *                 @OA\Property(
     *                     property="basicInformation",
     *                     type="object",
     *                     nullable=true,
     *                     description="Basic information captured during assessment. Contains sector-specific fields (mfg_* for manufacturing, svc_* for services).",
     *                     @OA\Property(property="category", type="string", example="manufacturing"),
     *                     @OA\Property(property="customers", type="array", @OA\Items(type="string")),
     *                     @OA\Property(property="thirdPartyCertificationNames", type="array", @OA\Items(type="string")),
     *                     @OA\Property(property="mfgDrdoVendorStores", type="array", @OA\Items(type="string"), description="Manufacturing: DRDO vendor stores"),
     *                     @OA\Property(property="mfgProducts", type="array", @OA\Items(type="string"), description="Manufacturing: Products"),
     *                     @OA\Property(property="mfgRawMaterials", type="array", @OA\Items(type="string"), description="Manufacturing: Raw materials"),
     *                     @OA\Property(property="mfgBoughtOutParts", type="array", @OA\Items(type="string"), description="Manufacturing: Bought out parts"),
     *                     @OA\Property(property="mfgKeyProcesses", type="array", @OA\Items(type="string"), description="Manufacturing: Key processes"),
     *                     @OA\Property(property="svcDrdoVendorLabs", type="array", @OA\Items(type="string"), description="Services: DRDO vendor labs"),
     *                     @OA\Property(property="svcServices", type="array", @OA\Items(type="string"), description="Services: Services offered"),
     *                     @OA\Property(property="svcKeyProcesses", type="array", @OA\Items(type="string"), description="Services: Key processes")
     *                 ),
     *                 @OA\Property(
     *                     property="evidences",
     *                     type="array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="questionCode", type="string", example="Q-00001", nullable=true),
     *                         @OA\Property(property="questionText", type="string", example="Does the organization have ISO 9001 certification?", nullable=true),
     *                         @OA\Property(property="parameterName", type="string", example="Quality Management", nullable=true),
     *                         @OA\Property(property="fileName", type="string", example="evidence.pdf"),
     *                         @OA\Property(property="fileSize", type="integer", example=2048000),
     *                         @OA\Property(property="formattedSize", type="string", example="2 MB"),
     *                         @OA\Property(property="mimeType", type="string", example="application/pdf"),
     *                         @OA\Property(property="description", type="string", example="Quality certificate", nullable=true),
     *                         @OA\Property(property="isImage", type="boolean", example=false),
     *                         @OA\Property(property="downloadUrl", type="string", example="http://localhost:8000/api/v1/assessments/1/responses/questions/1/evidences/1/download"),
     *                         @OA\Property(property="latitude", type="number", format="float", example=28.6139, nullable=true),
     *                         @OA\Property(property="longitude", type="number", format="float", example=77.2090, nullable=true),
     *                         @OA\Property(property="capturedAt", type="string", format="date-time", example="2024-01-15T10:30:00+00:00", nullable=true),
     *                         @OA\Property(
     *                             property="uploadedBy",
     *                             type="object",
     *                             nullable=true,
     *                             @OA\Property(property="id", type="integer", example=1),
     *                             @OA\Property(property="name", type="string", example="John Doe")
     *                         )
     *                     )
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden - User not authorized or assessment not in eligible state",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="You are not authorized to view this assessment summary")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Application not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Application not found")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized - Invalid or missing token"
     *     )
     * )
     */
    public function show(Request $request, int $applicationId): JsonResponse
    {
        $user = $request->user();

        // Find application or return 404
        $application = Application::find($applicationId);
        if (! $application) {
            return $this->errorResponse('Application not found', 404);
        }

        // Authorization: Check if user is Enterprise Admin (own org) or Unit Admin (own units)
        $authorized = false;

        // Check Enterprise Admin
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) && $user->organization_id === $application->organization_id) {
            $authorized = true;
        }

        // Check Unit Admin
        if ($user->hasRole(Role::UNIT_ADMIN)) {
            $userUnits = $user->roles()
                ->where('slug', Role::UNIT_ADMIN)
                ->wherePivot('is_active', true)
                ->get()
                ->pluck('pivot.unit_id')
                ->filter()
                ->toArray();

            if (in_array($application->unit_id, $userUnits)) {
                $authorized = true;
            }
        }

        if (! $authorized) {
            return $this->errorResponse('You are not authorized to view this assessment summary', 403);
        }

        // Check assessment exists
        $assessment = $application->assessment;
        if (! $assessment) {
            return $this->errorResponse('Assessment not found for this application', 404);
        }

        // Check assessment is in eligible state
        if (! in_array($assessment->status, Assessment::FEEDBACK_ELIGIBLE_STATES)) {
            return $this->errorResponse('Assessment summary is not available at this stage', 403);
        }

        // Load site tour pictures with team member and user relationships. Only
        // the selected pictures form the official set — for service the applicant
        // uploads a pool the assessor selects from; manufacturing captures are
        // selected on upload.
        $siteTourPictures = $assessment->siteTourPictures()
            ->where('is_selected', true)
            ->with(['teamMember.user', 'uploadedByUser'])
            ->orderBy('created_at', 'desc')
            ->get();

        // Load basic information
        $basicInfo = $assessment->basicInformation;

        // Load evidences with response, question, and uploader relationships
        $evidences = ApplicationAssessmentResponseEvidence::whereHas('response', function ($q) use ($assessment) {
            $q->where('assessment_id', $assessment->id);
        })
            ->with(['response.question.parameter', 'uploader'])
            ->orderBy('created_at', 'desc')
            ->get();

        // Format site tour pictures
        $formattedPictures = $siteTourPictures->map(function ($picture) {
            // Assessor captures resolve through the team member; applicant
            // captures (service sector) have no team member, so fall back to the
            // recorded uploader user.
            $uploader = $picture->teamMember?->user ?? $picture->uploadedByUser;

            return [
                'id' => $picture->id,
                'title' => $picture->title,
                'fileName' => $picture->file_name,
                'fileSize' => $picture->file_size,
                'latitude' => $picture->latitude,
                'longitude' => $picture->longitude,
                'capturedAt' => $picture->captured_at?->toIso8601String(),
                'downloadUrl' => $picture->download_url,
                'uploadedBy' => $uploader ? [
                    'id' => $uploader->id,
                    'name' => $uploader->full_name,
                ] : null,
            ];
        });

        // Format evidences
        $formattedEvidences = $evidences->map(function ($evidence) use ($applicationId) {
            $question = $evidence->response?->question;

            return [
                'id' => $evidence->id,
                'questionCode' => $question?->code,
                'questionText' => $question?->question_text,
                'parameterName' => $question?->parameter?->name,
                'fileName' => $evidence->file_name,
                'fileSize' => $evidence->file_size,
                'formattedSize' => $evidence->formatted_size,
                'mimeType' => $evidence->mime_type,
                'description' => $evidence->description,
                'isImage' => $evidence->isImage(),
                'downloadUrl' => route('applications.assessment-summary.evidences.download', [
                    'applicationId' => $applicationId,
                    'evidenceId' => $evidence->id,
                ]),
                'latitude' => $evidence->latitude,
                'longitude' => $evidence->longitude,
                'capturedAt' => $evidence->captured_at?->toIso8601String(),
                'uploadedBy' => $evidence->uploader ? [
                    'id' => $evidence->uploader->id,
                    'name' => $evidence->uploader->full_name,
                ] : null,
            ];
        });

        // Prepare response data
        $data = [
            'assessmentId' => $assessment->id,
            'status' => $assessment->status,
            'totalScore' => $assessment->total_score,
            'siteTour' => [
                'pictures' => $formattedPictures,
                'totalCount' => $siteTourPictures->count(),
            ],
            'basicInformation' => $basicInfo ? $basicInfo->toArray() : null,
            'evidences' => $formattedEvidences,
        ];

        return $this->successResponse($data, 'Assessment summary retrieved successfully');
    }

    /**
     * @OA\Get(
     *     path="/api/v1/applications/{applicationId}/assessment-summary/evidences/{evidenceId}/download",
     *     summary="Download evidence file from assessment summary",
     *     description="Download an evidence file for enterprise admin (own org) or unit admin (own units). Only available when assessment is in eligible state (submitted_for_qc or later).",
     *     tags={"Application Assessment Summary", "Enterprise Admin - Application", "Unit Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="applicationId",
     *         in="path",
     *         required=true,
     *         description="Application ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="evidenceId",
     *         in="path",
     *         required=true,
     *         description="Evidence ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="download",
     *         in="query",
     *         required=false,
     *         description="Force download (true) or stream inline (false, default)",
     *
     *         @OA\Schema(type="boolean", default=false)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="File download/stream successful",
     *
     *         @OA\MediaType(
     *             mediaType="application/octet-stream"
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden - User not authorized or assessment not in eligible state",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="You are not authorized to download this evidence")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Application, evidence, or file not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Evidence not found")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized - Invalid or missing token"
     *     )
     * )
     */
    public function downloadEvidence(Request $request, int $applicationId, int $evidenceId): StreamedResponse|JsonResponse
    {
        $user = $request->user();

        // Find application or return 404
        $application = Application::find($applicationId);
        if (! $application) {
            return $this->errorResponse('Application not found', 404);
        }

        // Authorization: Check if user is Enterprise Admin (own org) or Unit Admin (own units)
        $authorized = false;

        // Check Enterprise Admin
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) && $user->organization_id === $application->organization_id) {
            $authorized = true;
        }

        // Check Unit Admin
        if ($user->hasRole(Role::UNIT_ADMIN)) {
            $userUnits = $user->roles()
                ->where('slug', Role::UNIT_ADMIN)
                ->wherePivot('is_active', true)
                ->get()
                ->pluck('pivot.unit_id')
                ->filter()
                ->toArray();

            if (in_array($application->unit_id, $userUnits)) {
                $authorized = true;
            }
        }

        if (! $authorized) {
            return $this->errorResponse('You are not authorized to download this evidence', 403);
        }

        // Check assessment exists
        $assessment = $application->assessment;
        if (! $assessment) {
            return $this->errorResponse('Assessment not found for this application', 404);
        }

        // Check assessment is in eligible state
        if (! in_array($assessment->status, Assessment::FEEDBACK_ELIGIBLE_STATES)) {
            return $this->errorResponse('Evidence download is not available at this stage', 403);
        }

        // Find evidence and verify it belongs to this application's assessment
        $evidence = ApplicationAssessmentResponseEvidence::whereHas('response', function ($q) use ($assessment) {
            $q->where('assessment_id', $assessment->id);
        })
            ->find($evidenceId);

        if (! $evidence) {
            return $this->errorResponse('Evidence not found', 404);
        }

        // Check file exists in storage
        if (! $this->fileStorage->exists($evidence->file_path)) {
            return $this->errorResponse('Evidence file not found in storage', 404);
        }

        // Determine download vs stream based on query parameter
        $forceDownload = $request->boolean('download', false);

        if ($forceDownload) {
            return $this->fileStorage->download($evidence->file_path, $evidence->file_name);
        }

        return $this->fileStorage->stream($evidence->file_path, $evidence->file_name);
    }
}
