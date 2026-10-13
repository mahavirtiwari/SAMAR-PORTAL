<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApplicationAssessmentQuestion;
use App\Models\ApplicationAssessmentQuestionFeedback;
use App\Models\ApplicationAssessmentQuestionFeedbackAttachment;
use App\Models\Assessment;
use App\Services\FileStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @OA\Tag(
 *     name="Committee Members",
 *     description="Committee review and feedback endpoints"
 * )
 */
class ApplicationAssessmentQuestionFeedbackController extends Controller
{
    protected FileStorageService $fileStorage;

    public function __construct(FileStorageService $fileStorage)
    {
        $this->fileStorage = $fileStorage;
    }

    /**
     * Get feedback history for a question.
     *
     * @OA\Get(
     *     path="/api/v1/application-assessments/{assessmentId}/questions/{questionId}/feedback-history",
     *     summary="Get feedback history for a question",
     *     description="Returns chronological list of all feedback (QC feedback, committee feedback, send back) for a question with assessor clarifications nested inside each feedback",
     *     tags={"Operations Admin"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="questionId",
     *         in="path",
     *         required=true,
     *         description="Question ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Feedback history retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Feedback history retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="feedbacks",
     *                     type="array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="feedbackType", type="string", example="Committee Feedback"),
     *                         @OA\Property(property="rcScore", type="number", format="float", example=3.5, nullable=true),
     *                         @OA\Property(property="comment", type="string", example="Good compliance observed", nullable=true),
     *                         @OA\Property(
     *                             property="user",
     *                             type="object",
     *                             @OA\Property(property="id", type="integer", example=5),
     *                             @OA\Property(property="name", type="string", example="John Doe")
     *                         ),
     *                         @OA\Property(
     *                             property="clarification",
     *                             type="object",
     *                             nullable=true,
     *                             description="Assessor's clarification response to this feedback (most recent if multiple exist)",
     *                             @OA\Property(property="id", type="integer", example=2),
     *                             @OA\Property(property="comment", type="string", example="Here is the additional evidence requested"),
     *                             @OA\Property(
     *                                 property="user",
     *                                 type="object",
     *                                 @OA\Property(property="id", type="integer", example=8),
     *                                 @OA\Property(property="name", type="string", example="Lead Assessor")
     *                             ),
     *                             @OA\Property(
     *                                 property="attachments",
     *                                 type="array",
     *
     *                                 @OA\Items(
     *                                     type="object",
     *
     *                                     @OA\Property(property="id", type="integer", example=1),
     *                                     @OA\Property(property="fileName", type="string", example="evidence.pdf"),
     *                                     @OA\Property(property="fileSize", type="integer", example=256000),
     *                                     @OA\Property(property="formattedSize", type="string", example="250 KB"),
     *                                     @OA\Property(property="mimeType", type="string", example="application/pdf"),
     *                                     @OA\Property(property="isImage", type="boolean", example=false)
     *                                 )
     *                             ),
     *                             @OA\Property(property="createdAt", type="string", format="date-time", example="2025-02-02T14:00:00Z")
     *                         ),
     *                         @OA\Property(property="createdAt", type="string", format="date-time", example="2025-02-01T10:30:00Z")
     *                     )
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=404, description="Assessment or question not found"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function feedbackHistory(Request $request, int $assessmentId, int $questionId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);

        $question = ApplicationAssessmentQuestion::where('assessment_id', $assessmentId)
            ->find($questionId);

        if (! $question) {
            return $this->errorResponse('Question not found.', 404);
        }

        $feedbacks = $question->feedbacks()
            ->with(['user', 'attachments.uploader', 'replies.user', 'replies.attachments.uploader'])
            ->orderBy('created_at', 'asc')
            ->get();

        // Only return top-level feedbacks (QC, committee, send_back) with clarifications nested inside
        $topLevelFeedbacks = $feedbacks->filter(
            fn ($f) => $f->feedback_type !== ApplicationAssessmentQuestionFeedback::ASSESSOR_CLARIFICATION
        );

        return $this->successResponse([
            'feedbacks' => $topLevelFeedbacks->values()->map(fn ($feedback) => $this->formatFeedback($feedback)),
        ], 'Feedback history retrieved successfully');
    }

    /**
     * Update response during committee review.
     *
     * @OA\Put(
     *     path="/api/v1/application-assessments/{assessmentId}/questions/{questionId}/response",
     *     summary="Update response during committee review",
     *     description="Allows committee to update the selected option and remarks for a question during review",
     *     tags={"Operations Admin"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="questionId",
     *         in="path",
     *         required=true,
     *         description="Question ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"selected_option"},
     *
     *             @OA\Property(property="selected_option", type="integer", example=3, description="Selected option (1-5)"),
     *             @OA\Property(property="assessor_remarks", type="string", example="Updated during committee review", description="Optional remarks")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Response updated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Response updated successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="response", type="object",
     *                     @OA\Property(property="id", type="integer"),
     *                     @OA\Property(property="selectedOption", type="integer"),
     *                     @OA\Property(property="selectedScore", type="number"),
     *                     @OA\Property(property="weightedScore", type="number"),
     *                     @OA\Property(property="assessorRemarks", type="string")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=404, description="Assessment, question, or response not found"),
     *     @OA\Response(response=422, description="Validation error"),
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Unauthorized")
     * )
     */
    public function updateResponse(Request $request, int $assessmentId, int $questionId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);

        $question = ApplicationAssessmentQuestion::where('assessment_id', $assessmentId)
            ->find($questionId);

        if (! $question) {
            return $this->errorResponse('Question not found.', 404);
        }

        $response = $question->response;
        if (! $response) {
            return $this->errorResponse('Response not found for this question.', 404);
        }

        $request->validate([
            'selected_option' => 'required|integer|min:1|max:5',
            'assessor_remarks' => 'nullable|string|max:2000',
        ]);

        try {
            // Update the response
            $response->setResponse(
                $request->selected_option,
                $request->assessor_remarks ?? $response->assessor_remarks,
                $request->user()->id
            );
            $response->save();

            // Create a feedback record to track the change
            ApplicationAssessmentQuestionFeedback::create([
                'application_assessment_question_id' => $questionId,
                'user_id' => $request->user()->id,
                'feedback_type' => ApplicationAssessmentQuestionFeedback::COMMITTEE_FEEDBACK,
                'comment' => 'Response updated during committee review. New option: '.$request->selected_option,
            ]);

            return $this->successResponse([
                'response' => [
                    'id' => $response->id,
                    'questionId' => $response->question_id,
                    'selectedOption' => $response->selected_option,
                    'selectedScore' => $response->selected_score,
                    'weightedScore' => $response->weighted_score,
                    'assessorRemarks' => $response->assessor_remarks,
                    'assessedAt' => $response->assessed_at?->toIso8601String(),
                ],
            ], 'Response updated successfully');
        } catch (\Exception $e) {
            Log::error('Failed to update response', [
                'exception' => $e->getMessage(),
                'user_id' => $request->user()->id,
                'question_id' => $questionId,
            ]);

            return $this->errorResponse('Failed to update response. Please try again.', 500);
        }
    }

    /**
     * Submit clarification response from assessor.
     *
     * @OA\Post(
     *     path="/api/v1/application-assessments/{assessmentId}/questions/{questionId}/clarification",
     *     summary="Submit assessor clarification response",
     *     description="Allows assessors to submit clarification responses (comment + attachments) for flagged questions during QC or committee review",
     *     tags={"Assessor - Assessment Responses"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="questionId",
     *         in="path",
     *         required=true,
     *         description="Question ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *
     *             @OA\Schema(
     *                 required={"comment"},
     *
     *                 @OA\Property(property="comment", type="string", maxLength=2000, description="Clarification comment", example="Attaching additional evidence as requested"),
     *                 @OA\Property(property="parent_feedback_id", type="integer", nullable=true, description="ID of the feedback being replied to. If omitted, auto-detected from the most recent QC/committee feedback for this question.", example=12),
     *                 @OA\Property(
     *                     property="attachments",
     *                     type="array",
     *                     description="Optional file attachments (max 5 files, 10MB each, jpeg/jpg/png/gif/pdf)",
     *
     *                     @OA\Items(type="string", format="binary")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Clarification submitted successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Clarification submitted successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="feedback",
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="feedbackType", type="string", example="Assessor Clarification"),
     *                     @OA\Property(property="comment", type="string", example="Attaching additional evidence as requested"),
     *                     @OA\Property(
     *                         property="inReplyTo",
     *                         type="object",
     *                         nullable=true,
     *                         description="The parent feedback this clarification replies to",
     *                         @OA\Property(property="id", type="integer", example=12),
     *                         @OA\Property(property="feedbackType", type="string", example="QC Feedback"),
     *                         @OA\Property(
     *                             property="user",
     *                             type="object",
     *                             @OA\Property(property="id", type="integer", example=5),
     *                             @OA\Property(property="name", type="string", example="QC Reviewer")
     *                         )
     *                     ),
     *                     @OA\Property(
     *                         property="attachments",
     *                         type="array",
     *
     *                         @OA\Items(
     *                             type="object",
     *
     *                             @OA\Property(property="id", type="integer", example=1),
     *                             @OA\Property(property="fileName", type="string", example="evidence.pdf"),
     *                             @OA\Property(property="fileSize", type="integer", example=256000),
     *                             @OA\Property(property="formattedSize", type="string", example="250 KB"),
     *                             @OA\Property(property="mimeType", type="string", example="application/pdf"),
     *                             @OA\Property(property="isImage", type="boolean", example=false)
     *                         )
     *                     ),
     *                     @OA\Property(property="createdAt", type="string", format="date-time", example="2026-02-11T10:30:00Z")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Assessment is not in feedback status or question is not flagged"),
     *     @OA\Response(response=403, description="Unauthorized - assessor not assigned to this assessment"),
     *     @OA\Response(response=404, description="Assessment or question not found"),
     *     @OA\Response(response=422, description="Validation error"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function submitClarification(Request $request, int $assessmentId, int $questionId): JsonResponse
    {
        // Validate assessment exists
        $assessment = Assessment::findOrFail($assessmentId);

        // Authorize assessor can conduct this assessment
        Gate::authorize('conduct', $assessment);

        // Check assessment is in feedback status
        if (! in_array($assessment->status, [Assessment::STATUS_QC_FEEDBACK, Assessment::STATUS_COMMITTEE_FEEDBACK])) {
            return $this->errorResponse(
                'Clarifications can only be submitted when assessment is in QC or committee feedback status.',
                400
            );
        }

        // Validate question exists and belongs to this assessment
        $question = ApplicationAssessmentQuestion::where('assessment_id', $assessmentId)
            ->find($questionId);

        if (! $question) {
            return $this->errorResponse('Question not found.', 404);
        }

        // Validate question is flagged or clarified
        if (! $question->isFlaggedOrClarified()) {
            return $this->errorResponse('Clarifications can only be submitted for flagged questions.', 400);
        }

        // Validate request
        $validator = Validator::make($request->all(), [
            'comment' => 'required|string|max:2000',
            'parent_feedback_id' => 'nullable|integer|exists:application_assessment_question_feedbacks,id',
            'attachments' => 'nullable|array|max:5',
            'attachments.*' => 'file|max:10240|mimes:jpeg,jpg,png,gif,pdf',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        // Resolve parent_feedback_id: explicit or auto-detected
        $parentFeedbackId = $request->parent_feedback_id;

        if ($parentFeedbackId) {
            // Validate the parent feedback belongs to the same question and is of the correct type
            $parentFeedback = ApplicationAssessmentQuestionFeedback::where('id', $parentFeedbackId)
                ->where('application_assessment_question_id', $questionId)
                ->whereIn('feedback_type', [
                    ApplicationAssessmentQuestionFeedback::QC_FEEDBACK,
                    ApplicationAssessmentQuestionFeedback::COMMITTEE_FEEDBACK,
                ])
                ->first();

            if (! $parentFeedback) {
                return $this->errorResponse(
                    'Invalid parent_feedback_id. It must belong to the same question and be a QC or committee feedback.',
                    422
                );
            }
        } else {
            // Auto-detect: find the most recent QC or committee feedback for this question
            // based on the current assessment status
            $autoDetectType = match ($assessment->status) {
                Assessment::STATUS_QC_FEEDBACK => ApplicationAssessmentQuestionFeedback::QC_FEEDBACK,
                Assessment::STATUS_COMMITTEE_FEEDBACK => ApplicationAssessmentQuestionFeedback::COMMITTEE_FEEDBACK,
                default => null,
            };

            if ($autoDetectType) {
                $latestParent = ApplicationAssessmentQuestionFeedback::where('application_assessment_question_id', $questionId)
                    ->where('feedback_type', $autoDetectType)
                    ->orderBy('created_at', 'desc')
                    ->first();

                $parentFeedbackId = $latestParent?->id;
            }
        }

        DB::beginTransaction();
        try {
            // Create feedback record
            $feedback = ApplicationAssessmentQuestionFeedback::create([
                'application_assessment_question_id' => $questionId,
                'user_id' => $request->user()->id,
                'feedback_type' => ApplicationAssessmentQuestionFeedback::ASSESSOR_CLARIFICATION,
                'rc_score' => null,
                'comment' => $request->comment,
                'parent_feedback_id' => $parentFeedbackId,
            ]);

            // Handle file attachments if provided
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    // Upload file
                    $uploadResult = $this->fileStorage->storeAssessmentFile(
                        $file,
                        $assessmentId,
                        FileStorageService::ASSESSMENT_CLARIFICATIONS
                    );

                    // Create attachment record
                    ApplicationAssessmentQuestionFeedbackAttachment::create([
                        'feedback_id' => $feedback->id,
                        'file_name' => $uploadResult['original_filename'],
                        'file_path' => $uploadResult['path'],
                        'file_size' => $uploadResult['size'],
                        'mime_type' => $uploadResult['mime_type'],
                        'disk' => $uploadResult['disk'],
                        'uploaded_by' => $request->user()->id,
                    ]);
                }
            }

            // Mark question as clarified
            $question->markReviewed(
                ApplicationAssessmentQuestion::REVIEW_STATUS_CLARIFIED,
                $question->review_type,
                $request->user()->id
            );

            DB::commit();

            // Reload feedback with relationships
            $feedback->load(['user', 'attachments.uploader', 'parent.user']);

            return $this->successResponse(
                ['feedback' => $this->formatFeedback($feedback)],
                'Clarification submitted successfully',
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to submit assessor clarification', [
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $request->user()->id,
                'assessment_id' => $assessmentId,
                'question_id' => $questionId,
            ]);

            return $this->errorResponse('Failed to submit clarification. Please try again.', 500);
        }
    }

    /**
     * Update assessor clarification response.
     *
     * @OA\Put(
     *     path="/api/v1/application-assessments/{assessmentId}/questions/{questionId}/clarification/{feedbackId}",
     *     summary="Update assessor clarification response",
     *     description="Allows assessors to edit their clarification responses (comment + attachments) for flagged questions during QC or committee review",
     *     tags={"Assessor - Assessment Responses"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="questionId",
     *         in="path",
     *         required=true,
     *         description="Question ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="feedbackId",
     *         in="path",
     *         required=true,
     *         description="Feedback ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *
     *             @OA\Schema(
     *                 required={"comment"},
     *
     *                 @OA\Property(property="comment", type="string", maxLength=2000, description="Updated clarification comment", example="Updated explanation with new evidence"),
     *                 @OA\Property(
     *                     property="attachments",
     *                     type="array",
     *                     description="Optional new file attachments (max 5 total, 10MB each, jpeg/jpg/png/gif/pdf)",
     *
     *                     @OA\Items(type="string", format="binary")
     *                 ),
     *
     *                 @OA\Property(
     *                     property="remove_attachment_ids",
     *                     type="array",
     *                     description="Array of attachment IDs to remove",
     *
     *                     @OA\Items(type="integer"),
     *                     example={1, 3}
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Clarification updated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Clarification updated successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="feedback",
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="feedbackType", type="string", example="Assessor Clarification"),
     *                     @OA\Property(property="comment", type="string", example="Updated explanation with new evidence"),
     *                     @OA\Property(
     *                         property="attachments",
     *                         type="array",
     *
     *                         @OA\Items(
     *                             type="object",
     *
     *                             @OA\Property(property="id", type="integer", example=1),
     *                             @OA\Property(property="fileName", type="string", example="evidence.pdf"),
     *                             @OA\Property(property="fileSize", type="integer", example=256000),
     *                             @OA\Property(property="formattedSize", type="string", example="250 KB"),
     *                             @OA\Property(property="mimeType", type="string", example="application/pdf"),
     *                             @OA\Property(property="isImage", type="boolean", example=false)
     *                         )
     *                     ),
     *                     @OA\Property(property="createdAt", type="string", format="date-time", example="2026-02-11T10:30:00Z")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Assessment is not in feedback status or question is not flagged"),
     *     @OA\Response(response=403, description="Unauthorized - assessor not assigned to this assessment or feedback not owned by user"),
     *     @OA\Response(response=404, description="Assessment, question, or feedback not found"),
     *     @OA\Response(response=422, description="Validation error"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function updateClarification(Request $request, int $assessmentId, int $questionId, int $feedbackId): JsonResponse
    {
        // Validate assessment exists
        $assessment = Assessment::findOrFail($assessmentId);

        // Authorize assessor can conduct this assessment
        Gate::authorize('conduct', $assessment);

        // Check assessment is in feedback status
        if (! in_array($assessment->status, [Assessment::STATUS_QC_FEEDBACK, Assessment::STATUS_COMMITTEE_FEEDBACK])) {
            return $this->errorResponse(
                'Clarifications can only be updated when assessment is in QC or committee feedback status.',
                400
            );
        }

        // Validate question exists and belongs to this assessment
        $question = ApplicationAssessmentQuestion::where('assessment_id', $assessmentId)
            ->find($questionId);

        if (! $question) {
            return $this->errorResponse('Question not found.', 404);
        }

        // Validate question is flagged or clarified
        if (! $question->isFlaggedOrClarified()) {
            return $this->errorResponse('Clarifications can only be updated for flagged questions.', 400);
        }

        // Validate feedback exists, belongs to question, and was created by current user
        $feedback = ApplicationAssessmentQuestionFeedback::where('application_assessment_question_id', $questionId)
            ->where('id', $feedbackId)
            ->first();

        if (! $feedback) {
            return $this->errorResponse('Feedback not found.', 404);
        }

        // Ensure feedback is of type ASSESSOR_CLARIFICATION
        if ($feedback->feedback_type !== ApplicationAssessmentQuestionFeedback::ASSESSOR_CLARIFICATION) {
            return $this->errorResponse('Only assessor clarifications can be updated.', 400);
        }

        // Ensure feedback belongs to current user
        if ($feedback->user_id !== $request->user()->id) {
            return $this->errorResponse('You can only update your own clarifications.', 403);
        }

        // Validate request
        $validator = Validator::make($request->all(), [
            'comment' => 'required|string|max:2000',
            'attachments' => 'nullable|array|max:5',
            'attachments.*' => 'file|max:10240|mimes:jpeg,jpg,png,gif,pdf',
            'remove_attachment_ids' => 'nullable|array',
            'remove_attachment_ids.*' => 'integer|exists:application_assessment_question_feedback_attachments,id',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        DB::beginTransaction();
        try {
            // Update comment
            $feedback->comment = $request->comment;
            $feedback->save();

            // Handle attachment removals
            if ($request->has('remove_attachment_ids') && is_array($request->remove_attachment_ids)) {
                $attachmentsToRemove = ApplicationAssessmentQuestionFeedbackAttachment::whereIn('id', $request->remove_attachment_ids)
                    ->where('feedback_id', $feedbackId)
                    ->get();

                foreach ($attachmentsToRemove as $attachment) {
                    // Delete file from storage
                    $this->fileStorage->delete($attachment->file_path);
                    // Delete DB record
                    $attachment->delete();
                }
            }

            // Handle new file attachments if provided
            if ($request->hasFile('attachments')) {
                // Check total attachments count (existing + new - removed)
                $currentAttachmentsCount = $feedback->attachments()->count();
                $newAttachmentsCount = count($request->file('attachments'));
                $totalAttachmentsAfterAdd = $currentAttachmentsCount + $newAttachmentsCount;

                if ($totalAttachmentsAfterAdd > 5) {
                    return $this->errorResponse(
                        "Total attachments cannot exceed 5. Current: {$currentAttachmentsCount}, Adding: {$newAttachmentsCount}",
                        422
                    );
                }

                foreach ($request->file('attachments') as $file) {
                    // Upload file
                    $uploadResult = $this->fileStorage->storeAssessmentFile(
                        $file,
                        $assessmentId,
                        FileStorageService::ASSESSMENT_CLARIFICATIONS
                    );

                    // Create attachment record
                    ApplicationAssessmentQuestionFeedbackAttachment::create([
                        'feedback_id' => $feedback->id,
                        'file_name' => $uploadResult['original_filename'],
                        'file_path' => $uploadResult['path'],
                        'file_size' => $uploadResult['size'],
                        'mime_type' => $uploadResult['mime_type'],
                        'disk' => $uploadResult['disk'],
                        'uploaded_by' => $request->user()->id,
                    ]);
                }
            }

            DB::commit();

            // Reload feedback with relationships
            $feedback->load(['user', 'attachments.uploader']);

            return $this->successResponse(
                ['feedback' => $this->formatFeedback($feedback)],
                'Clarification updated successfully',
                200
            );
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update assessor clarification', [
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $request->user()->id,
                'assessment_id' => $assessmentId,
                'question_id' => $questionId,
                'feedback_id' => $feedbackId,
            ]);

            return $this->errorResponse('Failed to update clarification. Please try again.', 500);
        }
    }

    /**
     * Download a feedback attachment.
     *
     * @OA\Get(
     *     path="/api/v1/application-assessments/{assessmentId}/questions/{questionId}/feedback/{feedbackId}/attachments/{attachmentId}/download",
     *     summary="Download a feedback attachment",
     *     description="Downloads a file attachment associated with feedback (assessor clarification, etc.)",
     *     tags={"Assessor - Assessment Responses"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="questionId",
     *         in="path",
     *         required=true,
     *         description="Question ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="feedbackId",
     *         in="path",
     *         required=true,
     *         description="Feedback ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="attachmentId",
     *         in="path",
     *         required=true,
     *         description="Attachment ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="File downloaded successfully",
     *
     *         @OA\MediaType(mediaType="application/octet-stream")
     *     ),
     *
     *     @OA\Response(response=404, description="Assessment, question, feedback, or attachment not found"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function downloadAttachment(
        Request $request,
        int $assessmentId,
        int $questionId,
        int $feedbackId,
        int $attachmentId
    ): StreamedResponse|JsonResponse {
        // Validate assessment exists and authorize access
        $assessment = Assessment::findOrFail($assessmentId);
        Gate::authorize('view', $assessment);

        // Validate question exists and belongs to assessment
        $question = ApplicationAssessmentQuestion::where('assessment_id', $assessmentId)
            ->find($questionId);

        if (! $question) {
            return $this->errorResponse('Question not found.', 404);
        }

        // Validate feedback exists and belongs to question
        $feedback = ApplicationAssessmentQuestionFeedback::where('application_assessment_question_id', $questionId)
            ->find($feedbackId);

        if (! $feedback) {
            return $this->errorResponse('Feedback not found.', 404);
        }

        // Validate attachment exists and belongs to feedback
        $attachment = ApplicationAssessmentQuestionFeedbackAttachment::where('feedback_id', $feedbackId)
            ->find($attachmentId);

        if (! $attachment) {
            return $this->errorResponse('Attachment not found.', 404);
        }

        // Check if file exists
        if (! $this->fileStorage->exists($attachment->file_path)) {
            Log::error('Feedback attachment file not found', [
                'attachment_id' => $attachmentId,
                'file_path' => $attachment->file_path,
            ]);

            return $this->errorResponse('File not found.', 404);
        }

        try {
            // Stream the file download
            return $this->fileStorage->download($attachment->file_path, $attachment->file_name);
        } catch (\Exception $e) {
            Log::error('Failed to download feedback attachment', [
                'exception' => $e->getMessage(),
                'attachment_id' => $attachmentId,
                'file_path' => $attachment->file_path,
            ]);

            return $this->errorResponse('Failed to download file. Please try again.', 500);
        }
    }

    /**
     * Format feedback for API output.
     */
    private function formatFeedback(ApplicationAssessmentQuestionFeedback $feedback): array
    {
        if (! $feedback->relationLoaded('attachments')) {
            $feedback->load('attachments.uploader');
        }

        $formatted = [
            'id' => $feedback->id,
            'feedbackType' => $feedback->getFeedbackTypeLabel(),
            'rcScore' => $feedback->rc_score,
            'comment' => $feedback->comment,
            'user' => $feedback->user ? [
                'id' => $feedback->user->id,
                'name' => $feedback->user->full_name,
            ] : null,
            'attachments' => $feedback->attachments->map(fn ($att) => $this->formatAttachment($att, $feedback)),
            'createdAt' => $feedback->created_at?->toIso8601String(),
        ];

        // Nest assessor clarification inside the feedback it replies to
        if ($feedback->feedback_type !== ApplicationAssessmentQuestionFeedback::ASSESSOR_CLARIFICATION) {
            if (! $feedback->relationLoaded('replies')) {
                $feedback->load('replies.user', 'replies.attachments.uploader');
            }

            $clarification = $feedback->replies
                ->where('feedback_type', ApplicationAssessmentQuestionFeedback::ASSESSOR_CLARIFICATION)
                ->sortByDesc('created_at')
                ->first();

            $formatted['clarification'] = $clarification ? [
                'id' => $clarification->id,
                'comment' => $clarification->comment,
                'user' => $clarification->user ? [
                    'id' => $clarification->user->id,
                    'name' => $clarification->user->full_name,
                ] : null,
                'attachments' => $clarification->attachments->map(fn ($att) => $this->formatAttachment($att, $clarification)),
                'createdAt' => $clarification->created_at?->toIso8601String(),
            ] : null;
        }

        return $formatted;
    }

    /**
     * Format attachment for API output.
     */
    private function formatAttachment(ApplicationAssessmentQuestionFeedbackAttachment $attachment, ApplicationAssessmentQuestionFeedback $feedback): array
    {
        $question = $feedback->question;

        return [
            'id' => $attachment->id,
            'fileName' => $attachment->file_name,
            'fileSize' => $attachment->file_size,
            'formattedSize' => $attachment->formatted_size,
            'mimeType' => $attachment->mime_type,
            'isImage' => $attachment->isImage(),
            'uploadedBy' => $attachment->uploader ? [
                'id' => $attachment->uploader->id,
                'name' => $attachment->uploader->full_name,
            ] : null,
            'downloadUrl' => $question ? url("/api/v1/application-assessments/{$question->assessment_id}/questions/{$question->id}/feedback/{$feedback->id}/attachments/{$attachment->id}/download") : null,
            'createdAt' => $attachment->created_at?->toIso8601String(),
        ];
    }
}
