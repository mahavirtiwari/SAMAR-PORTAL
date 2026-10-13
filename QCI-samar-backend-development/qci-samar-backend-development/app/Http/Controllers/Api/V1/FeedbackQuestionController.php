<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\FeedbackQuestion\StoreFeedbackQuestionRequest;
use App\Http\Requests\FeedbackQuestion\UpdateFeedbackQuestionRequest;
use App\Http\Resources\FeedbackQuestionResource;
use App\Models\FeedbackQuestion;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;

/**
 * @OA\Tag(
 *     name="Feedback Questions",
 *     description="API Endpoints for managing feedback questions for applicant surveys"
 * )
 */
class FeedbackQuestionController extends Controller
{
    /**
     * Display a listing of feedback questions.
     *
     * @OA\Get(
     *     path="/api/v1/feedback-questions",
     *     operationId="getFeedbackQuestions",
     *     tags={"Feedback Questions"},
     *     summary="Get list of feedback questions",
     *     description="Returns paginated list of feedback questions with optional filters",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Parameter(
     *         name="type",
     *         in="query",
     *         description="Filter by question type",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"rating", "yes_no"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="isActive",
     *         in="query",
     *         description="Filter by active status",
     *         required=false,
     *
     *         @OA\Schema(type="boolean")
     *     ),
     *
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search in question text",
     *         required=false,
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="perPage",
     *         in="query",
     *         description="Items per page (max 100)",
     *         required=false,
     *
     *         @OA\Schema(type="integer", default=15, maximum=100)
     *     ),
     *
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *         required=false,
     *
     *         @OA\Schema(type="integer", default=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Feedback questions retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="data",
     *                     type="array",
     *
     *                     @OA\Items(
     *
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="question_text", type="string", example="How satisfied are you with the assessment process?"),
     *                         @OA\Property(property="type", type="string", example="rating"),
     *                         @OA\Property(property="type_label", type="string", example="5 Star Rating"),
     *                         @OA\Property(property="display_order", type="integer", example=1),
     *                         @OA\Property(property="is_active", type="boolean", example=true),
     *                         @OA\Property(property="created_at", type="string", format="date-time"),
     *                         @OA\Property(property="updated_at", type="string", format="date-time")
     *                     )
     *                 ),
     *                 @OA\Property(property="current_page", type="integer", example=1),
     *                 @OA\Property(property="per_page", type="integer", example=15),
     *                 @OA\Property(property="total", type="integer", example=10),
     *                 @OA\Property(property="last_page", type="integer", example=1)
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Forbidden")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = FeedbackQuestion::query();

        // Filter by type
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        // Filter by active status
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        // Search by question text
        if ($request->filled('search')) {
            $query->where('question_text', 'like', "%{$request->search}%");
        }

        // Order by display order
        $query->orderBy('display_order');

        $perPage = $this->resolvePerPage($request, 15);
        $questions = $query->paginate($perPage);

        return $this->paginatedResponse(
            $questions->setCollection(
                $questions->getCollection()->map(fn ($item) => new FeedbackQuestionResource($item))
            ),
            'Feedback questions retrieved successfully'
        );
    }

    /**
     * Store a newly created feedback question.
     *
     * @OA\Post(
     *     path="/api/v1/feedback-questions",
     *     operationId="storeFeedbackQuestion",
     *     tags={"Feedback Questions"},
     *     summary="Create a new feedback question",
     *     description="Create a new feedback question for applicant surveys",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"questionText", "type"},
     *
     *             @OA\Property(property="questionText", type="string", maxLength=1000, example="How satisfied are you with the assessment process?", description="The question text"),
     *             @OA\Property(property="type", type="string", enum={"rating", "yes_no"}, example="rating", description="Question type"),
     *             @OA\Property(property="displayOrder", type="integer", minimum=0, example=1, description="Display order (optional)"),
     *             @OA\Property(property="isActive", type="boolean", example=true, description="Active status (optional)")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Feedback question created successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Feedback question created successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="question_text", type="string", example="How satisfied are you with the assessment process?"),
     *                 @OA\Property(property="type", type="string", example="rating"),
     *                 @OA\Property(property="type_label", type="string", example="5 Star Rating"),
     *                 @OA\Property(property="display_order", type="integer", example=1),
     *                 @OA\Property(property="is_active", type="boolean", example=true),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(
     *                 property="errors",
     *                 type="object",
     *                 @OA\Property(property="questionText", type="array", @OA\Items(type="string", example="The question text field is required."))
     *             )
     *         )
     *     )
     * )
     */
    public function store(StoreFeedbackQuestionRequest $request): JsonResponse
    {
        $question = FeedbackQuestion::create($request->validated());

        return $this->successResponse(
            new FeedbackQuestionResource($question),
            'Feedback question created successfully',
            201
        );
    }

    /**
     * Display the specified feedback question.
     *
     * @OA\Get(
     *     path="/api/v1/feedback-questions/{id}",
     *     operationId="getFeedbackQuestion",
     *     tags={"Feedback Questions"},
     *     summary="Get feedback question by ID",
     *     description="Returns a single feedback question",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Feedback question ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Feedback question retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="question_text", type="string", example="How satisfied are you with the assessment process?"),
     *                 @OA\Property(property="type", type="string", example="rating"),
     *                 @OA\Property(property="type_label", type="string", example="5 Star Rating"),
     *                 @OA\Property(property="display_order", type="integer", example=1),
     *                 @OA\Property(property="is_active", type="boolean", example=true),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=404,
     *         description="Feedback question not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Feedback question not found")
     *         )
     *     )
     * )
     */
    public function show(int $id): JsonResponse
    {
        $question = FeedbackQuestion::find($id);

        if (! $question) {
            return $this->errorResponse('Feedback question not found', 404);
        }

        return $this->successResponse(
            new FeedbackQuestionResource($question),
            'Feedback question retrieved successfully'
        );
    }

    /**
     * Update the specified feedback question.
     *
     * @OA\Put(
     *     path="/api/v1/feedback-questions/{id}",
     *     operationId="updateFeedbackQuestion",
     *     tags={"Feedback Questions"},
     *     summary="Update feedback question",
     *     description="Update an existing feedback question",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Feedback question ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="questionText", type="string", maxLength=1000, example="How satisfied are you with the assessment process?"),
     *             @OA\Property(property="type", type="string", enum={"rating", "yes_no"}, example="rating"),
     *             @OA\Property(property="displayOrder", type="integer", minimum=0, example=1),
     *             @OA\Property(property="isActive", type="boolean", example=true)
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Feedback question updated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Feedback question updated successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="question_text", type="string", example="How satisfied are you with the assessment process?"),
     *                 @OA\Property(property="type", type="string", example="rating"),
     *                 @OA\Property(property="type_label", type="string", example="5 Star Rating"),
     *                 @OA\Property(property="display_order", type="integer", example=1),
     *                 @OA\Property(property="is_active", type="boolean", example=true),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=404,
     *         description="Feedback question not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Feedback question not found")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Validation error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(
     *                 property="errors",
     *                 type="object",
     *                 @OA\Property(property="questionText", type="array", @OA\Items(type="string", example="The question text field is required."))
     *             )
     *         )
     *     )
     * )
     */
    public function update(UpdateFeedbackQuestionRequest $request, int $id): JsonResponse
    {
        $question = FeedbackQuestion::find($id);

        if (! $question) {
            return $this->errorResponse('Feedback question not found', 404);
        }

        $question->update($request->validated());

        return $this->successResponse(
            new FeedbackQuestionResource($question->fresh()),
            'Feedback question updated successfully'
        );
    }

    /**
     * Remove the specified feedback question.
     *
     * @OA\Delete(
     *     path="/api/v1/feedback-questions/{id}",
     *     operationId="deleteFeedbackQuestion",
     *     tags={"Feedback Questions"},
     *     summary="Delete feedback question",
     *     description="Soft delete a feedback question (only if no responses exist)",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Feedback question ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Feedback question deleted successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Feedback question deleted successfully"),
     *             @OA\Property(property="data", type="object", nullable=true, example=null)
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=404,
     *         description="Feedback question not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Feedback question not found")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Cannot delete question with responses",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Cannot delete feedback question that has responses")
     *         )
     *     )
     * )
     */

    /**
     * Get all available options for dropdowns.
     *
     * @OA\Get(
     *     path="/api/v1/feedback-questions/options",
     *     operationId="getFeedbackQuestionOptions",
     *     tags={"Feedback Questions"},
     *     summary="Get feedback question options",
     *     description="Get all available question types and their labels for dropdowns",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Response(
     *         response=200,
     *         description="Options retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Feedback question options retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="types",
     *                     type="array",
     *
     *                     @OA\Items(type="string"),
     *                     example={"rating", "yes_no"}
     *                 ),
     *
     *                 @OA\Property(
     *                     property="type_labels",
     *                     type="object",
     *                     @OA\Property(property="rating", type="string", example="5 Star Rating"),
     *                     @OA\Property(property="yes_no", type="string", example="Yes/No")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function options(): JsonResponse
    {
        return $this->successResponse([
            'types' => FeedbackQuestion::getTypes(),
            'type_labels' => FeedbackQuestion::getTypeLabels(),
        ], 'Feedback question options retrieved successfully');
    }

    /**
     * Get active questions for feedback form.
     *
     * @OA\Get(
     *     path="/api/v1/feedback-questions/active",
     *     operationId="getActiveFeedbackQuestions",
     *     tags={"Feedback Questions"},
     *     summary="Get active feedback questions",
     *     description="Get all active feedback questions ordered by display order for use in feedback forms",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Response(
     *         response=200,
     *         description="Active questions retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Active feedback questions retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="array",
     *
     *                 @OA\Items(
     *
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="question_text", type="string", example="How satisfied are you with the assessment process?"),
     *                     @OA\Property(property="type", type="string", example="rating"),
     *                     @OA\Property(property="type_label", type="string", example="5 Star Rating"),
     *                     @OA\Property(property="display_order", type="integer", example=1),
     *                     @OA\Property(property="is_active", type="boolean", example=true),
     *                     @OA\Property(property="created_at", type="string", format="date-time"),
     *                     @OA\Property(property="updated_at", type="string", format="date-time")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function activeQuestions(): JsonResponse
    {
        $questions = FeedbackQuestion::active()
            ->ordered()
            ->get();

        return $this->successResponse(
            FeedbackQuestionResource::collection($questions),
            'Active feedback questions retrieved successfully'
        );
    }

    /**
     * @OA\Post(
     *     path="/api/v1/feedback-questions/{id}/activate",
     *     summary="Activate feedback question",
     *     tags={"Feedback Questions"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="Feedback question activated successfully"),
     *     @OA\Response(response=401, description="Unauthorized"),
     *     @OA\Response(response=403, description="Forbidden"),
     *     @OA\Response(response=404, description="Feedback question not found"),
     *     @OA\Response(response=400, description="Bad request - Feedback question is already active"),
     *     @OA\Response(response=500, description="Server error")
     * )
     */
    public function activate(int $id): JsonResponse
    {
        try {
            $question = FeedbackQuestion::findOrFail($id);
            Gate::authorize('changeStatus', $question);

            if ($question->is_active === true) {
                return $this->errorResponse('Feedback question is already active.', 400);
            }

            $question->update(['is_active' => true]);

            Log::info('Feedback question activated', [
                'question_id' => $question->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse(
                new FeedbackQuestionResource($question),
                'Feedback question activated successfully.'
            );
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Feedback question not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to activate feedback question', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'question_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate feedback question.', 500);
        }
    }

    /**
     * @OA\Post(
     *     path="/api/v1/feedback-questions/{id}/deactivate",
     *     summary="Deactivate feedback question",
     *     tags={"Feedback Questions"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="Feedback question deactivated successfully"),
     *     @OA\Response(response=401, description="Unauthorized"),
     *     @OA\Response(response=403, description="Forbidden"),
     *     @OA\Response(response=404, description="Feedback question not found"),
     *     @OA\Response(response=400, description="Bad request - Feedback question is already inactive"),
     *     @OA\Response(response=500, description="Server error")
     * )
     */
    public function deactivate(int $id): JsonResponse
    {
        try {
            $question = FeedbackQuestion::findOrFail($id);
            Gate::authorize('changeStatus', $question);

            if ($question->is_active === false) {
                return $this->errorResponse('Feedback question is already inactive.', 400);
            }

            $question->update(['is_active' => false]);

            Log::info('Feedback question deactivated', [
                'question_id' => $question->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse(
                new FeedbackQuestionResource($question),
                'Feedback question deactivated successfully.'
            );
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Feedback question not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to deactivate feedback question', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'question_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate feedback question.', 500);
        }
    }
}
