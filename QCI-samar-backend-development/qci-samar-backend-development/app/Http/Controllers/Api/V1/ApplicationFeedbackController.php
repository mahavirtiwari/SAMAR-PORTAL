<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ApplicationFeedback\BulkStoreApplicationFeedbackRequest;
use App\Http\Requests\ApplicationFeedback\FeedbackExportRequest;
use App\Http\Requests\ApplicationFeedback\StoreApplicationFeedbackRequest;
use App\Http\Resources\ApplicationFeedbackResource;
use App\Models\Application;
use App\Models\ApplicationFeedback;
use App\Models\Assessment;
use App\Models\FeedbackQuestion;
use App\Support\Csv;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @OA\Tag(
 *     name="Application Feedbacks",
 *     description="Application feedback management endpoints"
 * )
 */
class ApplicationFeedbackController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/v1/applications/feedback-pending",
     *     summary="List applications pending feedback",
     *     description="Retrieve all applications that are certified and pending feedback from the current user's organization",
     *     tags={"Application Feedbacks", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="q",
     *         in="query",
     *         description="Search by application number",
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="perPage",
     *         in="query",
     *         description="Number of items per page",
     *
     *         @OA\Schema(type="integer", default=10)
     *     ),
     *
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *
     *         @OA\Schema(type="integer", default=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Applications pending feedback retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Applications pending feedback retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="array",
     *
     *                 @OA\Items(
     *                     type="object",
     *
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="application_number", type="string", example="SAMAR-2025-001"),
     *                     @OA\Property(property="unit", type="object"),
     *                     @OA\Property(property="sector", type="string", example="manufacturing"),
     *                     @OA\Property(property="application_date", type="string", format="date"),
     *                     @OA\Property(property="assessment_date", type="string", format="date"),
     *                     @OA\Property(property="rating", type="number", nullable=true),
     *                     @OA\Property(property="feedback_status", type="string", enum={"pending", "completed"})
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function pendingFeedback(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get applications that have assessments in feedback-eligible states
        $query = Application::query()
            ->whereHas('assessment', function ($q) {
                $q->whereIn('status', Assessment::FEEDBACK_ELIGIBLE_STATES);
            })
            ->with(['unit:id,email,contact_person_name', 'assessment:id,application_id,status,total_score,actual_end_date,scheduled_end_date'])
            ->withCount('feedbacks as feedback_count');

        // Filter by organization for enterprise users
        if ($user->organization_id) {
            $query->where('organization_id', $user->organization_id);
        }

        // Search by application number
        if ($request->has('q') && ! empty($request->q)) {
            $query->where('application_number', 'like', '%'.$request->q.'%');
        }

        // Date filters. Query keys arrive snake_case (ConvertRequestToSnakeCase).
        if ($request->filled('application_date_from')) {
            $query->whereDate('submitted_at', '>=', $request->input('application_date_from'));
        }
        if ($request->filled('application_date_to')) {
            $query->whereDate('submitted_at', '<=', $request->input('application_date_to'));
        }

        // Order by most recently updated first
        $query->orderBy('updated_at', 'desc');

        // Pagination
        $perPage = $this->resolvePerPage($request, 10);

        $applications = $query->paginate($perPage);

        // Get total question count for feedback status calculation
        $totalQuestions = FeedbackQuestion::active()->count();

        // Transform the data
        $transformedData = $applications->through(function ($app) use ($totalQuestions) {
            // Use preloaded feedback count (avoids N+1 query)
            $answeredCount = $app->feedback_count ?? 0;

            // Completion is point-in-time: it is frozen the moment feedback is submitted
            // in full (feedback_completed_at). Adding new questions later must never reopen
            // it, so the status reads the frozen flag, not a live answered-vs-active compare
            // (BUG-06520). For a completed application the total is likewise frozen to what
            // was answered, so a newly added question doesn't drag its progress below 100%.
            $isCompleted = $app->feedback_completed_at !== null;
            $feedbackStatus = $isCompleted ? 'completed' : 'pending';
            $totalForProgress = $isCompleted ? $answeredCount : $totalQuestions;

            // sectorLabel = human sector; application_type = new|renewal.
            // Never use pre-camel keys that collide under ConvertResponseToCamelCase
            // (applicationType + application_type both become applicationType).
            $sectorLabel = match ($app->sector) {
                'manufacturing' => 'Manufacturing',
                'service' => 'Services',
                default => ucfirst($app->sector ?? ''),
            };

            return [
                'id' => $app->id,
                'application_number' => $app->application_number,
                'unit' => $app->unit ? [
                    'id' => $app->unit->id,
                    'name' => $app->unit_name ?? $app->unit->contact_person_name,
                    'email' => $app->unit->email,
                ] : null,
                'sector' => $app->sector,
                'sector_label' => $sectorLabel,
                'application_type' => $app->application_type,
                'enterprise_classification' => $app->enterprise_classification,
                'application_date' => $app->submitted_at?->format('Y-m-d'),
                'assessment_date' => $app->assessment?->actual_end_date?->format('Y-m-d')
                    ?? $app->assessment?->scheduled_end_date?->format('Y-m-d'),
                // total_score is numeric; clients must not treat this as Level label
                'total_score' => $app->assessment?->total_score,
                'rating' => Assessment::ratingLabelFromScore($app->assessment?->total_score, '-'),
                'feedback_status' => $feedbackStatus,
                'feedback_progress' => [
                    'answered' => $answeredCount,
                    'total' => $totalForProgress,
                ],
            ];
        });

        return $this->paginatedResponse(
            $transformedData,
            'Applications pending feedback retrieved successfully'
        );
    }

    /**
     * @OA\Get(
     *     path="/api/v1/applications/feedback-submissions",
     *     summary="List applications with submitted feedback (admin)",
     *     description="Retrieve all applications that have applicant feedback submitted, for Operations Manager / Operations Admin / System Admin review.",
     *     tags={"Application Feedbacks", "Operations - Application", "System Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="q",
     *         in="query",
     *         description="Search by application number",
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="samarId",
     *         in="query",
     *         description="Filter by the submitter's SAMAR ID",
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="perPage",
     *         in="query",
     *         description="Number of items per page",
     *
     *         @OA\Schema(type="integer", default=10)
     *     ),
     *
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *
     *         @OA\Schema(type="integer", default=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Applications with submitted feedback retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string"),
     *             @OA\Property(
     *                 property="data",
     *                 type="array",
     *
     *                 @OA\Items(
     *                     type="object",
     *
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="application_number", type="string", example="SAMAR-030125-11111"),
     *                     @OA\Property(property="user_samar_id", type="string", nullable=true, example="SAMAR-030125-22222"),
     *                     @OA\Property(property="feedback_date", type="string", format="date", nullable=true)
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthorized"),
     *     @OA\Response(response=403, description="Forbidden")
     * )
     */
    public function submittedFeedback(Request $request): JsonResponse
    {
        $query = Application::query()
            ->whereHas('feedbacks')
            ->with(['latestFeedback.creator:id,samar_id'])
            ->withMax('feedbacks as feedback_date', 'created_at');

        // Search by application number
        if ($request->filled('q')) {
            $query->where('application_number', 'like', '%'.$request->q.'%');
        }

        // Filter by the submitter's SAMAR ID. The web sends `samarId`, which
        // ConvertRequestToSnakeCase rewrites to `samar_id` before this runs.
        if ($request->filled('samar_id')) {
            $samarId = $request->input('samar_id');
            $query->whereHas('feedbacks.creator', function ($q) use ($samarId) {
                $q->where('samar_id', 'like', '%'.$samarId.'%');
            });
        }

        // Most recently submitted feedback first
        $query->orderByDesc('feedback_date');

        $perPage = $this->resolvePerPage($request, 10);

        $applications = $query->paginate($perPage);

        $data = $applications->through(function ($app) {
            return [
                'id' => $app->id,
                'application_number' => $app->application_number,
                'user_samar_id' => $app->latestFeedback?->creator?->samar_id,
                'feedback_date' => $app->feedback_date
                    ? Carbon::parse($app->feedback_date)->format('Y-m-d')
                    : null,
            ];
        });

        return $this->paginatedResponse(
            $data,
            'Applications with submitted feedback retrieved successfully'
        );
    }

    /**
     * @OA\Get(
     *     path="/api/v1/applications/{applicationId}/feedbacks",
     *     summary="List all feedbacks for an application",
     *     description="Retrieve all feedback responses submitted for a specific application",
     *     tags={"Application Feedbacks", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="applicationId",
     *         in="path",
     *         required=true,
     *         description="Application ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Application feedbacks retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Application feedbacks retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="array",
     *
     *                 @OA\Items(
     *                     type="object",
     *
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="application_id", type="integer", example=1),
     *                     @OA\Property(property="feedback_question_id", type="integer", example=1),
     *                     @OA\Property(property="question_text", type="string", example="How satisfied are you with the service?"),
     *                     @OA\Property(property="question_type", type="string", enum={"rating", "yes_no"}, example="rating"),
     *                     @OA\Property(property="rating", type="integer", minimum=1, maximum=5, nullable=true, example=4),
     *                     @OA\Property(property="yes_no_answer", type="boolean", nullable=true),
     *                     @OA\Property(property="remarks", type="string", nullable=true, example="Good service overall")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Application not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function index(Request $request, int $applicationId): JsonResponse
    {
        $application = Application::find($applicationId);

        if (! $application) {
            return $this->errorResponse('Application not found', 404);
        }

        // Authorize access to application feedbacks
        if (! Gate::allows('viewAny', [ApplicationFeedback::class, $application])) {
            return $this->errorResponse('You are not authorized to view feedbacks for this application', 403);
        }

        $query = ApplicationFeedback::forApplication($applicationId);

        // Apply filters
        if ($request->has('type') && in_array($request->type, ['rating', 'yes_no'])) {
            $query->byType($request->type);
        }

        // Search in remarks
        if ($request->has('search') && ! empty($request->search)) {
            $query->where('remarks', 'like', '%'.$request->search.'%');
        }

        // Pagination
        $perPage = $this->resolvePerPage($request, 15);

        $feedbacks = $query->paginate($perPage);

        return $this->paginatedResponse(
            ApplicationFeedbackResource::collection($feedbacks),
            'Application feedbacks retrieved successfully'
        );
    }

    /**
     * @OA\Post(
     *     path="/api/v1/applications/{applicationId}/feedbacks",
     *     summary="Store a single feedback for an application",
     *     description="Submit a feedback response for a specific question in an application",
     *     tags={"Application Feedbacks", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="applicationId",
     *         in="path",
     *         required=true,
     *         description="Application ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"feedback_question_id"},
     *
     *             @OA\Property(property="feedback_question_id", type="integer", description="ID of the feedback question", example=1),
     *             @OA\Property(property="rating", type="integer", minimum=1, maximum=5, nullable=true, description="Rating value (1-5) for rating type questions", example=4),
     *             @OA\Property(property="yes_no_answer", type="boolean", nullable=true, description="Yes/No answer for yes_no type questions", example=true),
     *             @OA\Property(property="remarks", type="string", nullable=true, description="Additional remarks or comments", example="Very satisfied with the process")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Application feedback saved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Application feedback saved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="application_id", type="integer", example=1),
     *                 @OA\Property(property="feedback_question_id", type="integer", example=1),
     *                 @OA\Property(property="question_text", type="string"),
     *                 @OA\Property(property="question_type", type="string"),
     *                 @OA\Property(property="rating", type="integer", nullable=true),
     *                 @OA\Property(property="yes_no_answer", type="boolean", nullable=true),
     *                 @OA\Property(property="remarks", type="string", nullable=true)
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Application or feedback question not found"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function store(StoreApplicationFeedbackRequest $request, int $applicationId): JsonResponse
    {
        $application = Application::find($applicationId);

        if (! $application) {
            return $this->errorResponse('Application not found', 404);
        }

        // Authorize creating feedback for this application
        if (! Gate::allows('create', [ApplicationFeedback::class, $application])) {
            return $this->errorResponse('You are not authorized to submit feedback for this application', 403);
        }

        $validated = $request->validated();

        // Get the question to copy its data
        $question = FeedbackQuestion::find($validated['feedback_question_id']);

        if (! $question) {
            return $this->errorResponse('Feedback question not found', 404);
        }

        // Build feedback data with question snapshot
        $feedbackData = [
            'application_id' => $applicationId,
            'feedback_question_id' => $question->id,
            'question_text' => $question->question_text,
            'question_type' => $question->type,
            'rating' => $validated['rating'] ?? null,
            'yes_no_answer' => $validated['yes_no_answer'] ?? null,
            'remarks' => $validated['remarks'] ?? null,
        ];

        $feedback = ApplicationFeedback::updateOrCreate(
            [
                'application_id' => $applicationId,
                'feedback_question_id' => $question->id,
            ],
            $feedbackData
        );

        $this->freezeFeedbackCompletion($application);

        return $this->successResponse(
            new ApplicationFeedbackResource($feedback),
            'Application feedback saved successfully',
            201
        );
    }

    /**
     * @OA\Post(
     *     path="/api/v1/applications/{applicationId}/feedbacks/submit",
     *     summary="Submit all feedbacks for an application",
     *     description="Submit all feedback responses for an application in a single request. Uses upsert logic so existing answers are updated.",
     *     tags={"Application Feedbacks", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="applicationId",
     *         in="path",
     *         required=true,
     *         description="Application ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"feedbacks"},
     *
     *             @OA\Property(
     *                 property="feedbacks",
     *                 type="array",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"feedbackQuestionId"},
     *
     *                     @OA\Property(property="feedbackQuestionId", type="integer", example=1),
     *                     @OA\Property(property="rating", type="integer", minimum=1, maximum=5, nullable=true, example=4),
     *                     @OA\Property(property="yesNoAnswer", type="boolean", nullable=true, example=true)
     *                 )
     *             ),
     *             @OA\Property(property="remarks", type="string", nullable=true, example="Good service overall")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="All feedbacks saved successfully"
     *     ),
     *     @OA\Response(response=404, description="Application not found"),
     *     @OA\Response(response=403, description="Unauthorized"),
     *     @OA\Response(response=400, description="Validation error")
     * )
     */
    public function submitAll(BulkStoreApplicationFeedbackRequest $request, int $applicationId): JsonResponse
    {
        $application = Application::find($applicationId);

        if (! $application) {
            return $this->errorResponse('Application not found', 404);
        }

        if (! Gate::allows('create', [ApplicationFeedback::class, $application])) {
            return $this->errorResponse('You are not authorized to submit feedback for this application', 403);
        }

        $validated = $request->validated();
        $globalRemarks = $validated['remarks'] ?? null;
        $savedFeedbacks = [];

        DB::beginTransaction();
        try {
            foreach ($validated['feedbacks'] as $item) {
                $question = FeedbackQuestion::find($item['feedback_question_id']);

                if (! $question) {
                    DB::rollBack();

                    return $this->errorResponse(
                        "Feedback question with ID {$item['feedback_question_id']} not found",
                        400
                    );
                }

                $feedbackData = [
                    'application_id' => $applicationId,
                    'feedback_question_id' => $question->id,
                    'question_text' => $question->question_text,
                    'question_type' => $question->type,
                    'rating' => $item['rating'] ?? null,
                    'yes_no_answer' => $item['yes_no_answer'] ?? null,
                    'remarks' => $item['remarks'] ?? $globalRemarks,
                ];

                $savedFeedbacks[] = ApplicationFeedback::updateOrCreate(
                    [
                        'application_id' => $applicationId,
                        'feedback_question_id' => $question->id,
                    ],
                    $feedbackData
                );
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to save feedbacks');
        }

        $this->freezeFeedbackCompletion($application);

        return $this->successResponse(
            ApplicationFeedbackResource::collection(collect($savedFeedbacks)),
            'All feedbacks saved successfully',
            201
        );
    }

    /**
     * Freeze feedback completion the first time an application has answered every
     * currently-active question. Once stamped, feedback_completed_at is never cleared, so
     * questions added later apply only to still-open applications and can't reopen a
     * Completed one (BUG-06520). No-op when already frozen or no active questions exist.
     */
    private function freezeFeedbackCompletion(Application $application): void
    {
        if ($application->feedback_completed_at !== null) {
            return;
        }

        $activeQuestionCount = FeedbackQuestion::active()->count();

        if ($activeQuestionCount === 0) {
            return;
        }

        $answeredCount = ApplicationFeedback::forApplication($application->id)->count();

        if ($answeredCount >= $activeQuestionCount) {
            $application->forceFill(['feedback_completed_at' => now()])->save();
        }
    }

    /**
     * @OA\Get(
     *     path="/api/v1/applications/{applicationId}/feedbacks/form",
     *     summary="Get feedback form for an application",
     *     description="Retrieve all feedback questions with any existing answers for an application. Use this endpoint to render a feedback form.",
     *     tags={"Application Feedbacks", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="applicationId",
     *         in="path",
     *         required=true,
     *         description="Application ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Feedback form retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Feedback form retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="application_id", type="integer", example=1),
     *                 @OA\Property(
     *                     property="questions",
     *                     type="array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="question_id", type="integer", example=1),
     *                         @OA\Property(property="question_text", type="string", example="How satisfied are you with the service?"),
     *                         @OA\Property(property="type", type="string", enum={"rating", "yes_no"}, example="rating"),
     *                         @OA\Property(property="rating", type="integer", nullable=true, description="Existing rating answer if any"),
     *                         @OA\Property(property="yes_no_answer", type="boolean", nullable=true, description="Existing yes/no answer if any"),
     *                         @OA\Property(property="remarks", type="string", nullable=true, description="Existing remarks if any"),
     *                         @OA\Property(property="has_answer", type="boolean", example=false, description="Whether this question has been answered")
     *                     )
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Application not found"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function form(int $applicationId): JsonResponse
    {
        $application = Application::find($applicationId);

        if (! $application) {
            return $this->errorResponse('Application not found', 404);
        }

        // Authorize access to application feedbacks
        if (! Gate::allows('viewAny', [ApplicationFeedback::class, $application])) {
            return $this->errorResponse('You are not authorized to view feedback form for this application', 403);
        }

        $existingFeedbacks = ApplicationFeedback::forApplication($applicationId)
            ->orderBy('id')
            ->get();

        // Get global remarks (from the first feedback that has remarks)
        $globalRemarks = $existingFeedbacks->first(function ($feedback) {
            return ! empty($feedback->remarks);
        })?->remarks;

        if ($application->feedback_completed_at !== null) {
            // Completed feedback is frozen to the question set answered at completion,
            // read from the per-answer snapshot. Questions added or deactivated later
            // must never alter a completed form (mirrors the feedback_completed_at freeze
            // on the status read path).
            $formData = $existingFeedbacks->map(function ($feedback) {
                return [
                    'question_id' => $feedback->feedback_question_id,
                    'question_text' => $feedback->question_text,
                    'type' => $feedback->question_type,
                    'rating' => $feedback->rating,
                    'yes_no_answer' => $feedback->yes_no_answer,
                    'has_answer' => $feedback->rating !== null || $feedback->yes_no_answer !== null,
                ];
            })->values();
        } else {
            // Pending feedback tracks the live active question set, so newly added
            // questions apply only to still-open feedback.
            $feedbacksByQuestion = $existingFeedbacks->keyBy('feedback_question_id');
            $formData = FeedbackQuestion::active()
                ->ordered()
                ->get()
                ->map(function ($question) use ($feedbacksByQuestion) {
                    $feedback = $feedbacksByQuestion->get($question->id);

                    return [
                        'question_id' => $question->id,
                        'question_text' => $question->question_text,
                        'type' => $question->type,
                        'rating' => $feedback?->rating,
                        'yes_no_answer' => $feedback?->yes_no_answer,
                        'has_answer' => $feedback !== null,
                    ];
                });
        }

        return $this->successResponse([
            'application_id' => $applicationId,
            'questions' => $formData,
            'remarks' => $globalRemarks,
            // Authoritative read-only signal: a completed form must not be re-submitted.
            'feedback_completed_at' => $application->feedback_completed_at,
        ], 'Feedback form retrieved successfully');
    }

    /**
     * Bulk CSV export of every application with submitted feedback (wide pivot).
     *
     * One row per application; one column per feedback question. Columns are the union of
     * feedback_question_id across the export scope, ordered by FeedbackQuestion.display_order,
     * each header labelled with the question_text. Keying on feedback_question_id (not text)
     * keeps an edited question a single column; an application missing a question gets a blank
     * cell. Answers snapshot question_text/type per row, so questions changing, deactivating or
     * soft-deleting later never corrupts a historical export.
     *
     * Restricted to Operations Manager / Operations Admin / System Admin via route middleware.
     */
    public function export(FeedbackExportRequest $request): StreamedResponse|JsonResponse
    {
        try {
            $query = Application::query()
                ->whereHas('feedbacks')
                ->with(['latestFeedback.creator:id,samar_id'])
                ->withMax('feedbacks as feedback_date', 'created_at');

            // Search by application number (mirrors submittedFeedback listing).
            if ($request->filled('q')) {
                $query->where('application_number', 'like', '%'.$request->input('q').'%');
            }

            // Filter by the submitter's SAMAR ID. The web sends `samarId`, which
            // ConvertRequestToSnakeCase rewrites to `samar_id` before this runs.
            if ($request->filled('samar_id')) {
                $samarId = $request->input('samar_id');
                $query->whereHas('feedbacks.creator', function ($q) use ($samarId) {
                    $q->where('samar_id', 'like', '%'.$samarId.'%');
                });
            }

            $query->orderByDesc('feedback_date');

            $applications = $query->get();

            // All answers for the scoped applications in one query, grouped per application.
            $answers = ApplicationFeedback::whereIn('application_id', $applications->pluck('id'))->get();
            $answersByApplication = $answers->groupBy('application_id');

            // Ordered question-column set: distinct question ids present, ordered by the live
            // question display_order; header = current question_text, falling back to the
            // per-answer snapshot for questions removed since (feedback_question_id is not an FK).
            $questionIds = $answers->pluck('feedback_question_id')->filter()->unique();
            $questions = FeedbackQuestion::withTrashed()
                ->whereIn('id', $questionIds)
                ->orderBy('display_order')
                ->get();

            $questionColumns = []; // [feedback_question_id => header text], in display order
            foreach ($questions as $question) {
                $questionColumns[$question->id] = $question->question_text;
            }
            foreach ($questionIds as $questionId) {
                if (! array_key_exists($questionId, $questionColumns)) {
                    $snapshot = $answers->firstWhere('feedback_question_id', $questionId);
                    $questionColumns[$questionId] = $snapshot->question_text ?? "Question #{$questionId}";
                }
            }

            $filename = 'feedback_submissions_export_'.now()->format('Y-m-d_His').'.csv';

            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ];

            $callback = function () use ($applications, $answersByApplication, $questionColumns) {
                $file = fopen('php://output', 'w');

                // BOM for UTF-8 Excel compatibility
                fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

                Csv::putRow($file, array_merge(
                    ['Application Number', 'SAMAR ID', 'Feedback Date'],
                    array_values($questionColumns)
                ));

                foreach ($applications as $application) {
                    $applicationAnswers = ($answersByApplication->get($application->id) ?? collect())
                        ->keyBy('feedback_question_id');

                    $row = [
                        $application->application_number,
                        $application->latestFeedback?->creator?->samar_id,
                        $application->feedback_date
                            ? Carbon::parse($application->feedback_date)->format('Y-m-d')
                            : '',
                    ];

                    foreach (array_keys($questionColumns) as $questionId) {
                        $answer = $applicationAnswers->get($questionId);
                        $row[] = $answer instanceof ApplicationFeedback ? ($answer->formatted_answer ?? '') : '';
                    }

                    Csv::putRow($file, $row);
                }

                fclose($file);
            };

            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            Log::error('Failed to export feedback submissions', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to export feedback submissions.', 500);
        }
    }

    /**
     * Individual CSV export of one application's feedback answers.
     *
     * Fixed columns: Question | Type | Answer | Remarks | Date. Values come from the immutable
     * per-answer snapshot. Restricted to Operations Manager / Operations Admin / System Admin
     * via route middleware.
     */
    public function exportForApplication(int $applicationId): StreamedResponse|JsonResponse
    {
        $application = Application::find($applicationId);

        if (! $application) {
            return $this->errorResponse('Application not found', 404);
        }

        try {
            $feedbacks = ApplicationFeedback::forApplication($applicationId)
                ->orderBy('id')
                ->get();

            $filename = 'feedback_'.$application->application_number.'_'.now()->format('Y-m-d_His').'.csv';

            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ];

            $callback = function () use ($feedbacks) {
                $file = fopen('php://output', 'w');

                // BOM for UTF-8 Excel compatibility
                fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

                fputcsv($file, ['Question', 'Type', 'Answer', 'Remarks', 'Date']);

                foreach ($feedbacks as $feedback) {
                    Csv::putRow($file, [
                        $feedback->question_text,
                        $feedback->question_type === ApplicationFeedback::TYPE_RATING ? 'Rating' : 'Yes/No',
                        $feedback->formatted_answer ?? '',
                        $feedback->remarks ?? '',
                        $feedback->created_at?->toDateTimeString() ?? '',
                    ]);
                }

                fclose($file);
            };

            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            Log::error('Failed to export application feedback', [
                'error' => $e->getMessage(),
                'application_id' => $applicationId,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to export application feedback.', 500);
        }
    }
}
