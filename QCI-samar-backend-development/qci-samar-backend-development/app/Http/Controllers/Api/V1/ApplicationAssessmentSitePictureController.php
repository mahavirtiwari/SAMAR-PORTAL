<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApplicationAssessmentSitePicture;
use App\Models\Assessment;
use App\Services\FileStorageService;
use App\Traits\AuthorizesAssessmentAccess;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * @OA\Tag(
 *     name="Application Assessment Site Pictures",
 *     description="Step 2: Site pictures. Manufacturing: assessor team members upload. Service sector: only the applicant (owning unit/enterprise admin) uploads; assessors have read-only access. Minimum 1 picture required to complete this step."
 * )
 */
class ApplicationAssessmentSitePictureController extends Controller
{
    use AuthorizesAssessmentAccess;

    protected FileStorageService $fileStorage;

    public function __construct(FileStorageService $fileStorage)
    {
        $this->fileStorage = $fileStorage;
    }

    /**
     * Get all site pictures for an assessment.
     *
     * @OA\Get(
     *     path="/api/v1/application-assessments/{assessmentId}/site-pictures",
     *     summary="List all site pictures",
     *     description="Returns all site pictures for the assessment, grouped by team member. Includes step completion status.",
     *     tags={"Application Assessment Site Pictures", "Assessor - Assessment"},
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
     *         description="Site pictures retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="pictures",
     *                     type="array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="assessment_id", type="integer", example=1),
     *                         @OA\Property(property="team_member_id", type="integer", example=1),
     *                         @OA\Property(property="title", type="string", example="Front entrance"),
     *                         @OA\Property(property="file_path", type="string", example="assessments/1/site-pictures/abc123.jpg"),
     *                         @OA\Property(property="file_name", type="string", example="entrance.jpg"),
     *                         @OA\Property(property="file_size", type="integer", example=1024000),
     *                         @OA\Property(property="latitude", type="number", format="float", example=28.6139),
     *                         @OA\Property(property="longitude", type="number", format="float", example=77.2090),
     *                         @OA\Property(property="captured_at", type="string", format="date-time"),
     *                         @OA\Property(property="created_at", type="string", format="date-time")
     *                     )
     *                 ),
     *                 @OA\Property(property="by_team_member", type="object", description="Pictures grouped by team member ID"),
     *                 @OA\Property(property="total_count", type="integer", example=5),
     *                 @OA\Property(property="step_completed", type="boolean", example=true)
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=404, description="Assessment not found")
     * )
     */
    public function index(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);

        if ($denied = $this->denyUnlessAssessmentVisible($request, $assessment)) {
            return $denied;
        }

        $pictures = $assessment->sitePictures()
            ->with(['teamMember.user', 'uploadedByUser'])
            ->orderBy('created_at', 'desc')
            ->get();

        // Group by team member
        $groupedByMember = $pictures->groupBy('team_member_id');

        return $this->successResponse([
            'pictures' => $pictures,
            'by_team_member' => $groupedByMember,
            'total_count' => $pictures->count(),
            'step_completed' => $assessment->isSitePicturesComplete(),
        ], 'Site pictures retrieved successfully');
    }

    /**
     * Get site pictures uploaded by current user.
     *
     * @OA\Get(
     *     path="/api/v1/application-assessments/{assessmentId}/site-pictures/mine",
     *     summary="Get my site pictures",
     *     description="Returns only the site pictures uploaded by the currently authenticated user.",
     *     tags={"Application Assessment Site Pictures", "Assessor - Assessment"},
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
     *         description="My site pictures retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="pictures", type="array", @OA\Items(type="object")),
     *                 @OA\Property(property="count", type="integer", example=3)
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Not a team member of this assessment")
     * )
     */
    public function mine(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        $query = $assessment->sitePictures()->with(['teamMember.user', 'uploadedByUser']);
        if ($teamMember) {
            $query->where('team_member_id', $teamMember->id);
        } elseif ($assessment->isApplicantOwner($user)) {
            $query->where('uploaded_by_user_id', $user->id);
        } else {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        $pictures = $query->orderBy('created_at', 'desc')->get();

        return $this->successResponse([
            'pictures' => $pictures,
            'count' => $pictures->count(),
        ], 'My site pictures retrieved successfully');
    }

    /**
     * Upload a site picture.
     *
     * @OA\Post(
     *     path="/api/v1/application-assessments/{assessmentId}/site-pictures",
     *     summary="Upload a site picture",
     *     description="Upload a site picture for the assessment. All team members can upload. Required fields: title (mandatory), image. GPS coordinates optional but recommended. Max file size: 10MB.",
     *     tags={"Application Assessment Site Pictures", "Assessor - Assessment"},
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
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *
     *             @OA\Schema(
     *                 required={"title", "image"},
     *
     *                 @OA\Property(property="title", type="string", description="Mandatory title for the picture", example="Factory entrance"),
     *                 @OA\Property(property="image", type="string", format="binary", description="Image file (jpg, png, etc). Max 10MB"),
     *                 @OA\Property(property="latitude", type="number", format="float", description="GPS latitude", example=28.6139),
     *                 @OA\Property(property="longitude", type="number", format="float", description="GPS longitude", example=77.2090),
     *                 @OA\Property(property="captured_at", type="string", format="date-time", description="When the photo was taken")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Picture uploaded successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Site picture uploaded successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="picture", type="object"),
     *                 @OA\Property(property="step_completed", type="boolean", example=true)
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Assessment not in progress or validation error"),
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Not a team member of this assessment")
     * )
     */
    public function store(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        // Service-sector assessments are applicant-captured: only the owning
        // applicant (unit/enterprise admin) may upload site pictures. In
        // manufacturing it stays the assessor team member's job.
        $isApplicant = false;
        if ($assessment->isServiceSector()) {
            if (! $assessment->isApplicantOwner($user)) {
                return $this->errorResponse('Only the applicant can upload site pictures for a service-sector assessment', 403);
            }
            $isApplicant = true;
            $teamMember = null;
        } elseif (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        // Site pictures may be captured before the opening meeting (which starts
        // the assessment), so uploading is allowed while still scheduled.
        if (! in_array($assessment->status, [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS], true)) {
            return $this->errorResponse('Site pictures can only be uploaded before the assessment is completed', 400);
        }

        // The applicant may only capture site pictures once the lead assessor is
        // physically on site (punched in) — the lead's presence is what makes a
        // site visit official — and only after the lead has locked parameter
        // allocation, so the assessment scope is fixed before any field capture.
        if ($isApplicant) {
            if (! $assessment->hasLeadPunchedIn()) {
                return $this->errorResponse('Site pictures can only be uploaded after the lead assessor has punched in', 403);
            }

            if (! $assessment->isAllocationLocked()) {
                return $this->errorResponse('Site pictures can only be uploaded after parameter allocation is done', 403);
            }
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'image' => 'required|image|max:10240', // 10MB max
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'captured_at' => 'nullable|date',
            'client_uuid' => 'nullable|string|max:64',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        // Idempotency: an offline replay carries the same client_uuid. Return the
        // already-stored row instead of creating a duplicate picture + file.
        $clientUuid = $request->input('client_uuid');
        if ($clientUuid) {
            $existing = ApplicationAssessmentSitePicture::where('assessment_id', $assessmentId)
                ->where('client_uuid', $clientUuid)
                ->first();
            if ($existing) {
                return $this->successResponse([
                    'picture' => $existing->load(['teamMember.user', 'uploadedByUser']),
                    'step_completed' => $assessment->isSitePicturesComplete(),
                ], 'Site picture uploaded successfully', 201);
            }
        }

        $maxRetries = 3;
        $attempt = 0;
        $lastException = null;

        while ($attempt < $maxRetries) {
            $attempt++;
            DB::beginTransaction();
            try {
                $file = $request->file('image');

                // Store file using FileStorageService (private storage)
                $fileData = $this->fileStorage->storeAssessmentFile(
                    $file,
                    $assessmentId,
                    FileStorageService::ASSESSMENT_SITE_PICTURES
                );

                $picture = ApplicationAssessmentSitePicture::create([
                    'assessment_id' => $assessmentId,
                    'team_member_id' => $teamMember?->id,
                    'uploaded_by_user_id' => $user->id,
                    'uploader_type' => $isApplicant ? 'applicant' : 'assessor',
                    // For service sector the applicant's upload IS the official
                    // set — it completes the lead/co-assessor step on upload, with
                    // no assessor curation. Manufacturing assessor captures were
                    // always selected on upload too, so every row is selected.
                    'is_selected' => true,
                    'client_uuid' => $clientUuid,
                    'title' => $request->title,
                    'file_path' => $fileData['path'],
                    'file_name' => $fileData['original_filename'],
                    'file_size' => $fileData['size'],
                    'disk' => $fileData['disk'],
                    'latitude' => $request->latitude,
                    'longitude' => $request->longitude,
                    'captured_at' => $request->captured_at ?? now(),
                ]);

                // Manufacturing invariant: an assessor captures exactly one
                // interior and one exterior picture, so a re-capture must REPLACE
                // the prior same-title assessor picture, not pile up. Each save
                // mints a fresh client_uuid, so the idempotency guard above can't
                // catch this — supersede this assessor's earlier picture of this
                // title (and its stored file) here. Scope to team_member_id: every
                // assessor uses the same fixed titles, so an unscoped sweep would
                // delete a teammate's same-title capture and fail their per-member
                // site-pictures check. Applicant uploads are exempt: the service
                // applicant client replaces by delete-then-upload.
                if (! $isApplicant) {
                    $superseded = ApplicationAssessmentSitePicture::where('assessment_id', $assessmentId)
                        ->where('uploader_type', 'assessor')
                        ->where('team_member_id', $picture->team_member_id)
                        ->where('title', $picture->title)
                        ->where('id', '!=', $picture->id)
                        ->get();
                    foreach ($superseded as $old) {
                        if ($old->file_path) {
                            $this->fileStorage->delete($old->file_path);
                        }
                        $old->delete();
                    }
                }

                // Lock the assessment row and update step progress to prevent deadlocks
                $assessment = Assessment::lockForUpdate()->find($assessmentId);
                $assessment->recalculateStepProgress();

                DB::commit();

                return $this->successResponse([
                    'picture' => $picture->load(['teamMember.user', 'uploadedByUser']),
                    'step_completed' => $assessment->isSitePicturesComplete(),
                ], 'Site picture uploaded successfully', 201);
            } catch (QueryException $e) {
                DB::rollBack();
                // Check if it's a deadlock error (MySQL error 1213)
                if ($e->errorInfo[1] == 1213 && $attempt < $maxRetries) {
                    $lastException = $e;
                    // Wait a small random time before retrying to reduce collision
                    usleep(rand(10000, 100000)); // 10-100ms

                    continue;
                }

                return $this->serverErrorResponse($e, 'Failed to upload site picture');
            } catch (\Exception $e) {
                DB::rollBack();

                return $this->serverErrorResponse($e, 'Failed to upload site picture');
            }
        }

        // If we exhausted all retries
        if ($lastException) {
            return $this->serverErrorResponse($lastException, 'Failed to upload site picture after multiple attempts');
        }

        return $this->errorResponse('Failed to upload site picture after multiple attempts', 500);
    }

    /**
     * Delete a site picture.
     *
     * @OA\Delete(
     *     path="/api/v1/application-assessments/{assessmentId}/site-pictures/{pictureId}",
     *     summary="Delete a site picture",
     *     description="Delete a site picture. Users can only delete their own pictures. Assessment must be in progress.",
     *     tags={"Application Assessment Site Pictures", "Assessor - Assessment"},
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
     *     @OA\Parameter(
     *         name="pictureId",
     *         in="path",
     *         required=true,
     *         description="Site picture ID",
     *
     *         @OA\Schema(type="integer", example=5)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Picture deleted successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Site picture deleted successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="step_completed", type="boolean", example=false, description="Whether step 2 is still complete after deletion")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Assessment not in progress"),
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Not authorized - can only delete your own pictures"),
     *     @OA\Response(response=404, description="Picture not found")
     * )
     */
    public function destroy(Request $request, int $assessmentId, int $pictureId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        $isApplicant = false;
        if ($assessment->isServiceSector()) {
            if (! $assessment->isApplicantOwner($user)) {
                return $this->errorResponse('Only the applicant can manage site pictures for a service-sector assessment', 403);
            }
            $isApplicant = true;
            $teamMember = null;
        } elseif (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        $picture = ApplicationAssessmentSitePicture::where('id', $pictureId)
            ->where('assessment_id', $assessmentId)
            ->first();

        if (! $picture) {
            return $this->errorResponse('Picture not found.', 404);
        }

        // Only the uploader can delete their own pictures
        $ownsAsAssessor = $teamMember && $picture->team_member_id === $teamMember->id;
        $ownsAsApplicant = $isApplicant && $picture->uploaded_by_user_id === $user->id;
        if (! $ownsAsAssessor && ! $ownsAsApplicant) {
            return $this->errorResponse('You can only delete your own pictures', 403);
        }

        if (! in_array($assessment->status, [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS], true)) {
            return $this->errorResponse('Pictures can only be deleted before the assessment is completed', 400);
        }

        $maxRetries = 3;
        $attempt = 0;
        $lastException = null;

        while ($attempt < $maxRetries) {
            $attempt++;
            DB::beginTransaction();
            try {
                // Delete file from storage using FileStorageService
                if ($picture->file_path) {
                    $this->fileStorage->delete($picture->file_path);
                }

                $picture->delete();

                // Lock the assessment row and update step progress to prevent deadlocks
                $assessment = Assessment::lockForUpdate()->find($assessmentId);
                $assessment->recalculateStepProgress();

                DB::commit();

                return $this->successResponse([
                    'step_completed' => $assessment->isSitePicturesComplete(),
                ], 'Site picture deleted successfully');
            } catch (QueryException $e) {
                DB::rollBack();
                // Check if it's a deadlock error (MySQL error 1213)
                if ($e->errorInfo[1] == 1213 && $attempt < $maxRetries) {
                    $lastException = $e;
                    usleep(rand(10000, 100000)); // 10-100ms

                    continue;
                }

                return $this->serverErrorResponse($e, 'Failed to delete site picture');
            } catch (\Exception $e) {
                DB::rollBack();

                return $this->serverErrorResponse($e, 'Failed to delete site picture');
            }
        }

        if ($lastException) {
            return $this->serverErrorResponse($lastException, 'Failed to delete site picture after multiple attempts');
        }

        return $this->errorResponse('Failed to delete site picture after multiple attempts', 500);
    }

    /**
     * Stream or download a site picture.
     */
    public function download(Request $request, int $assessmentId, int $pictureId)
    {
        $assessment = Assessment::findOrFail($assessmentId);
        if ($denied = $this->denyUnlessAssessmentVisible($request, $assessment)) {
            return $denied;
        }

        $picture = ApplicationAssessmentSitePicture::where('id', $pictureId)
            ->where('assessment_id', $assessmentId)
            ->first();

        if (! $picture) {
            return $this->errorResponse('Site picture not found.', 404);
        }

        if (! $picture->file_path || ! $this->fileStorage->exists($picture->file_path)) {
            return $this->errorResponse('Site picture file not found in storage.', 404);
        }

        $forceDownload = $request->boolean('download', false);

        if ($forceDownload) {
            return $this->fileStorage->download($picture->file_path, $picture->file_name ?? basename($picture->file_path));
        }

        return $this->fileStorage->stream($picture->file_path, $picture->file_name ?? basename($picture->file_path));
    }
}
