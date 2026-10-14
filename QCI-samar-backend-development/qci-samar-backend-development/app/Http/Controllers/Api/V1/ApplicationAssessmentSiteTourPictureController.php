<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApplicationAssessmentSiteTourPicture;
use App\Models\Assessment;
use App\Services\FileStorageService;
use App\Traits\AuthorizesAssessmentAccess;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Application Assessment Site Tour Pictures',
    description: 'Step 4: Site tour pictures. Manufacturing: assessor team members upload. Service sector: only the applicant (owning unit/enterprise admin) uploads; assessors have read-only access. Requires the opening meeting to be complete. Minimum 1 picture required to complete this step.',
)]
class ApplicationAssessmentSiteTourPictureController extends Controller
{
    use AuthorizesAssessmentAccess;

    protected FileStorageService $fileStorage;

    public function __construct(FileStorageService $fileStorage)
    {
        $this->fileStorage = $fileStorage;
    }

    /**
     * Get all site tour pictures for an assessment.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/site-tour-pictures',
        summary: 'List all site tour pictures',
        description: 'Returns all site tour pictures for the assessment. Includes step completion status and total count.',
        tags: ['Application Assessment Site Tour Pictures', 'Assessor - Assessment', 'DRDO Lab'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Site tour pictures retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'pictures',
                                    type: 'array',
                                    items: new OA\Items(
                                        type: 'object',
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer', example: 1),
                                            new OA\Property(
                                                property: 'assessment_id',
                                                type: 'integer',
                                                example: 1,
                                            ),
                                            new OA\Property(
                                                property: 'team_member_id',
                                                type: 'integer',
                                                example: 1,
                                            ),
                                            new OA\Property(
                                                property: 'title',
                                                type: 'string',
                                                nullable: true,
                                                example: 'Production floor',
                                            ),
                                            new OA\Property(
                                                property: 'file_path',
                                                type: 'string',
                                                example: 'assessments/1/site-tour/abc123.jpg',
                                            ),
                                            new OA\Property(
                                                property: 'file_name',
                                                type: 'string',
                                                example: 'floor.jpg',
                                            ),
                                            new OA\Property(
                                                property: 'file_size',
                                                type: 'integer',
                                                example: 1024000,
                                            ),
                                            new OA\Property(
                                                property: 'latitude',
                                                type: 'number',
                                                format: 'float',
                                                example: 28.6139,
                                            ),
                                            new OA\Property(
                                                property: 'longitude',
                                                type: 'number',
                                                format: 'float',
                                                example: 77.2090,
                                            ),
                                            new OA\Property(
                                                property: 'captured_at',
                                                type: 'string',
                                                format: 'date-time',
                                            ),
                                            new OA\Property(
                                                property: 'created_at',
                                                type: 'string',
                                                format: 'date-time',
                                            ),
                                        ],
                                    ),
                                ),
                                new OA\Property(property: 'total_count', type: 'integer', example: 8),
                                new OA\Property(property: 'step_completed', type: 'boolean', example: true),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function index(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);

        if ($denied = $this->denyUnlessAssessmentVisible($request, $assessment)) {
            return $denied;
        }

        $pictures = $assessment->siteTourPictures()
            ->with(['teamMember.user', 'uploadedByUser'])
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse([
            'pictures' => $pictures,
            'total_count' => $pictures->count(),
            'step_completed' => $assessment->isSiteTourComplete(),
        ], 'Site tour pictures retrieved successfully');
    }

    /**
     * Get site tour pictures uploaded by current user.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/site-tour-pictures/mine',
        summary: 'Get my site tour pictures',
        description: 'Returns only the site tour pictures uploaded by the currently authenticated user.',
        tags: ['Application Assessment Site Tour Pictures', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'My site tour pictures retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'pictures',
                                    type: 'array',
                                    items: new OA\Items(type: 'object'),
                                ),
                                new OA\Property(property: 'count', type: 'integer', example: 5),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Not a team member of this assessment'),
        ],
    )]
    public function mine(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        $query = $assessment->siteTourPictures()->with(['teamMember.user', 'uploadedByUser']);
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
        ], 'My site tour pictures retrieved successfully');
    }

    /**
     * Upload a site tour picture.
     */
    #[OA\Post(
        path: '/api/v1/application-assessments/{assessmentId}/site-tour-pictures',
        summary: 'Upload a site tour picture',
        description: 'Upload a site tour picture during the facility walkthrough. All team members can upload. Title is optional (unlike site pictures). GPS coordinates optional but recommended. Max file size: 10MB.',
        tags: ['Application Assessment Site Tour Pictures', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: [
                new OA\MediaType(
                    mediaType: 'multipart/form-data',
                    schema: new OA\Schema(
                        required: ['image'],
                        properties: [
                            new OA\Property(
                                property: 'title',
                                type: 'string',
                                description: 'Optional title for the picture',
                                example: 'Assembly line',
                            ),
                            new OA\Property(
                                property: 'image',
                                type: 'string',
                                format: 'binary',
                                description: 'Image file (jpg, png, etc). Max 10MB',
                            ),
                            new OA\Property(
                                property: 'latitude',
                                type: 'number',
                                format: 'float',
                                description: 'GPS latitude',
                                example: 28.6139,
                            ),
                            new OA\Property(
                                property: 'longitude',
                                type: 'number',
                                format: 'float',
                                description: 'GPS longitude',
                                example: 77.2090,
                            ),
                            new OA\Property(
                                property: 'captured_at',
                                type: 'string',
                                format: 'date-time',
                                description: 'When the photo was taken',
                            ),
                        ],
                    ),
                ),
            ],
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Picture uploaded successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Site tour picture uploaded successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'picture', type: 'object'),
                                new OA\Property(property: 'step_completed', type: 'boolean', example: true),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Assessment not in progress or validation error'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Not a team member of this assessment'),
        ],
    )]
    public function store(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        // Service-sector assessments are applicant-captured: only the owning
        // applicant (unit/enterprise admin) may upload the site tour. In
        // manufacturing it stays the assessor team member's job.
        $isApplicant = false;
        if ($assessment->isServiceSector()) {
            if (! $assessment->isApplicantOwner($user)) {
                return $this->errorResponse('Only the applicant can upload site tour pictures for a service-sector assessment', 403);
            }
            $isApplicant = true;
            $teamMember = null;
        } elseif (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        if ($assessment->status !== Assessment::STATUS_IN_PROGRESS) {
            return $this->errorResponse('Site tour pictures can only be uploaded when assessment is in progress', 400);
        }

        // The one cross-role dependency: for assessor-captured tours the site tour
        // cannot start until the lead's opening meeting is complete. Service-sector
        // applicants supply the pool ahead of the (online) assessment, so the gate
        // does not apply to applicant uploads.
        if (! $isApplicant && ! $assessment->isOpeningMeetingComplete()) {
            return $this->errorResponse('The lead must complete the opening meeting before the site tour can begin', 422);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'nullable|string|max:255',
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
            $existing = ApplicationAssessmentSiteTourPicture::where('assessment_id', $assessmentId)
                ->where('client_uuid', $clientUuid)
                ->first();
            if ($existing) {
                return $this->successResponse([
                    'picture' => $existing->load(['teamMember.user', 'uploadedByUser']),
                    'step_completed' => $assessment->isSiteTourComplete(),
                ], 'Site tour picture uploaded successfully', 201);
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
                    FileStorageService::ASSESSMENT_SITE_TOUR
                );

                $picture = ApplicationAssessmentSiteTourPicture::create([
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

                // Lock the assessment row and update step progress to prevent deadlocks
                $assessment = Assessment::lockForUpdate()->find($assessmentId);
                $assessment->recalculateStepProgress();

                DB::commit();

                return $this->successResponse([
                    'picture' => $picture->load(['teamMember.user', 'uploadedByUser']),
                    'step_completed' => $assessment->isSiteTourComplete(),
                ], 'Site tour picture uploaded successfully', 201);
            } catch (QueryException $e) {
                DB::rollBack();
                if ($e->errorInfo[1] == 1213 && $attempt < $maxRetries) {
                    $lastException = $e;
                    usleep(rand(10000, 100000));

                    continue;
                }

                return $this->serverErrorResponse($e, 'Failed to upload site tour picture');
            } catch (\Exception $e) {
                DB::rollBack();

                return $this->serverErrorResponse($e, 'Failed to upload site tour picture');
            }
        }

        if ($lastException) {
            return $this->serverErrorResponse($lastException, 'Failed to upload site tour picture after multiple attempts');
        }

        return $this->errorResponse('Failed to upload site tour picture after multiple attempts', 500);
    }

    /**
     * Delete a site tour picture.
     */
    #[OA\Delete(
        path: '/api/v1/application-assessments/{assessmentId}/site-tour-pictures/{pictureId}',
        summary: 'Delete a site tour picture',
        description: 'Delete a site tour picture. Users can only delete their own pictures. Assessment must be in progress.',
        tags: ['Application Assessment Site Tour Pictures', 'Assessor - Assessment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'pictureId',
                in: 'path',
                required: true,
                description: 'Site tour picture ID',
                schema: new OA\Schema(type: 'integer', example: 10),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Picture deleted successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Site tour picture deleted successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'step_completed',
                                    type: 'boolean',
                                    example: true,
                                    description: 'Whether step 4 is still complete after deletion',
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Assessment not in progress'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Not authorized - can only delete your own pictures'),
            new OA\Response(response: 404, description: 'Picture not found'),
        ],
    )]
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
                return $this->errorResponse('Only the applicant can manage site tour pictures for a service-sector assessment', 403);
            }
            $isApplicant = true;
            $teamMember = null;
        } elseif (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        $picture = ApplicationAssessmentSiteTourPicture::where('id', $pictureId)
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

        if ($assessment->status !== Assessment::STATUS_IN_PROGRESS) {
            return $this->errorResponse('Pictures can only be deleted when assessment is in progress', 400);
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
                    'step_completed' => $assessment->isSiteTourComplete(),
                ], 'Site tour picture deleted successfully');
            } catch (QueryException $e) {
                DB::rollBack();
                if ($e->errorInfo[1] == 1213 && $attempt < $maxRetries) {
                    $lastException = $e;
                    usleep(rand(10000, 100000));

                    continue;
                }

                return $this->serverErrorResponse($e, 'Failed to delete site tour picture');
            } catch (\Exception $e) {
                DB::rollBack();

                return $this->serverErrorResponse($e, 'Failed to delete site tour picture');
            }
        }

        if ($lastException) {
            return $this->serverErrorResponse($lastException, 'Failed to delete site tour picture after multiple attempts');
        }

        return $this->errorResponse('Failed to delete site tour picture after multiple attempts', 500);
    }

    /**
     * Download a site tour picture.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/site-tour-pictures/{pictureId}/download',
        summary: 'Download site tour picture',
        description: 'Download or view a site tour picture. Use ?download=true to force download.',
        tags: ['Application Assessment Site Tour Pictures', 'Assessor - Assessment', 'DRDO Lab'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'pictureId',
                in: 'path',
                required: true,
                description: 'Site tour picture ID',
                schema: new OA\Schema(type: 'integer', example: 10),
            ),
            new OA\Parameter(
                name: 'download',
                in: 'query',
                required: false,
                description: 'Set to true to force download',
                schema: new OA\Schema(type: 'boolean', default: false),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'File stream'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 404, description: 'Picture not found'),
        ],
    )]
    public function download(Request $request, int $assessmentId, int $pictureId)
    {
        $assessment = Assessment::findOrFail($assessmentId);

        if ($denied = $this->denyUnlessAssessmentVisible($request, $assessment)) {
            return $denied;
        }

        $picture = ApplicationAssessmentSiteTourPicture::where('id', $pictureId)
            ->where('assessment_id', $assessmentId)
            ->first();

        if (! $picture) {
            return $this->errorResponse('Picture not found.', 404);
        }

        if (! $this->fileStorage->exists($picture->file_path)) {
            return $this->errorResponse('Site tour picture file not found in storage.', 404);
        }

        $forceDownload = $request->boolean('download', false);

        if ($forceDownload) {
            return $this->fileStorage->download($picture->file_path, $picture->file_name);
        }

        return $this->fileStorage->stream($picture->file_path, $picture->file_name);
    }
}
