<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApplicationAssessmentParameter;
use App\Models\ApplicationAssessmentQuestion;
use App\Models\ApplicationAssessmentResponse;
use App\Models\ApplicationAssessmentResponseEvidence;
use App\Models\ApplicationAssessmentSiteTourPicture;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Services\FileStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Assessment Responses',
    description: 'Assessment response management endpoints - answering assessment questions',
)]
class ApplicationAssessmentResponseController extends Controller
{
    protected FileStorageService $fileStorage;

    public function __construct(FileStorageService $fileStorage)
    {
        $this->fileStorage = $fileStorage;
    }

    /**
     * Ensure the caller may act on the parameter this question belongs to.
     *
     * The lead assessor has full access. A co-assessor may only touch
     * parameters allocated to their own team-member row.
     *
     * @return JsonResponse|null Error response when forbidden, null when allowed.
     */
    private function authorizeParameterAccess(Request $request, Assessment $assessment, ApplicationAssessmentQuestion $question): ?JsonResponse
    {
        $teamMember = $assessment->teamMembers()
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a member of this assessment.', 403);
        }

        if ($teamMember->role === AssessmentTeamMember::ROLE_LEAD_ASSESSOR) {
            return null;
        }

        $assignedTo = $question->parameter?->assigned_to_team_member_id;
        if ($assignedTo === null || (int) $assignedTo !== (int) $teamMember->id) {
            return $this->errorResponse('You are not assigned to this parameter.', 403);
        }

        return null;
    }

    /**
     * Get all questions with responses for an assessment, grouped by parameters.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/responses',
        summary: 'List all questions with responses grouped by parameters',
        description: 'Retrieves all parameters with their questions and responses. Each parameter includes assigned assessor, weighted score, and questions with simplified response format.',
        tags: ['Assessment Responses', 'Assessor - Assessment Responses'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Parameters with questions and responses retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'parameters',
                                    type: 'array',
                                    items: new OA\Items(
                                        type: 'object',
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer', example: 1),
                                            new OA\Property(
                                                property: 'code',
                                                type: 'string',
                                                example: 'PARAM-0004',
                                            ),
                                            new OA\Property(
                                                property: 'name',
                                                type: 'string',
                                                example: 'Document Control',
                                            ),
                                            new OA\Property(
                                                property: 'disciplineName',
                                                type: 'string',
                                                example: 'Quality Management System',
                                            ),
                                            new OA\Property(
                                                property: 'isMandatory',
                                                type: 'boolean',
                                                example: true,
                                                description: 'Whether this parameter is mandatory for step completion',
                                            ),
                                            new OA\Property(
                                                property: 'assignedAssessor',
                                                type: 'object',
                                                nullable: true,
                                                properties: [
                                                    new OA\Property(property: 'id', type: 'integer', example: 14),
                                                    new OA\Property(
                                                        property: 'name',
                                                        type: 'string',
                                                        example: 'Abhay Assessor',
                                                    ),
                                                ],
                                            ),
                                            new OA\Property(
                                                property: 'score',
                                                type: 'number',
                                                format: 'float',
                                                nullable: true,
                                                example: 4.25,
                                                description: 'Assessor weighted score on the 0-5 scale; null until every question in the parameter is answered',
                                            ),
                                            new OA\Property(
                                                property: 'rcScore',
                                                type: 'number',
                                                format: 'float',
                                                nullable: true,
                                                example: 4.00,
                                                description: 'Committee weighted score on the 0-5 scale; null until every question in the parameter is answered',
                                            ),
                                            new OA\Property(
                                                property: 'totalQuestions',
                                                type: 'integer',
                                                example: 7,
                                                description: 'Total questions in this parameter',
                                            ),
                                            new OA\Property(
                                                property: 'completedQuestions',
                                                type: 'integer',
                                                example: 7,
                                                description: 'Number of questions with responses',
                                            ),
                                            new OA\Property(
                                                property: 'questions',
                                                type: 'array',
                                                items: new OA\Items(
                                                    type: 'object',
                                                    properties: [
                                                        new OA\Property(property: 'id', type: 'integer'),
                                                        new OA\Property(property: 'code', type: 'string'),
                                                        new OA\Property(property: 'questionText', type: 'string'),
                                                        new OA\Property(property: 'category', type: 'string'),
                                                        new OA\Property(property: 'weightage', type: 'integer'),
                                                        new OA\Property(property: 'options', type: 'object'),
                                                        new OA\Property(
                                                            property: 'response',
                                                            type: 'object',
                                                            nullable: true,
                                                            properties: [
                                                                new OA\Property(property: 'id', type: 'integer'),
                                                                new OA\Property(
                                                                    property: 'selectedOption',
                                                                    type: 'integer',
                                                                    example: 3,
                                                                ),
                                                                new OA\Property(
                                                                    property: 'score',
                                                                    type: 'integer',
                                                                    example: 3,
                                                                ),
                                                                new OA\Property(
                                                                    property: 'rcScore',
                                                                    type: 'number',
                                                                    format: 'float',
                                                                    nullable: true,
                                                                    example: 2.5,
                                                                    description: 'RC (Review Committee) score',
                                                                ),
                                                                new OA\Property(
                                                                    property: 'assessorRemarks',
                                                                    type: 'string',
                                                                ),
                                                                new OA\Property(
                                                                    property: 'assessedAt',
                                                                    type: 'string',
                                                                ),
                                                                new OA\Property(
                                                                    property: 'evidences',
                                                                    type: 'array',
                                                                    items: new OA\Items(type: 'object'),
                                                                ),
                                                                new OA\Property(
                                                                    property: 'assessor',
                                                                    type: 'object',
                                                                    nullable: true,
                                                                    properties: [
                                                                        new OA\Property(
                                                                            property: 'id',
                                                                            type: 'integer',
                                                                            example: 18,
                                                                        ),
                                                                        new OA\Property(
                                                                            property: 'name',
                                                                            type: 'string',
                                                                            example: 'Abhay Lead',
                                                                        ),
                                                                        new OA\Property(
                                                                            property: 'role',
                                                                            type: 'string',
                                                                            nullable: true,
                                                                            example: 'Lead Assessor',
                                                                        ),
                                                                    ],
                                                                ),
                                                            ],
                                                        ),
                                                    ],
                                                ),
                                            ),
                                        ],
                                    ),
                                ),
                                new OA\Property(
                                    property: 'summary',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'total_questions', type: 'integer', example: 50),
                                        new OA\Property(
                                            property: 'answered_questions',
                                            type: 'integer',
                                            example: 30,
                                        ),
                                        new OA\Property(
                                            property: 'completion_percentage',
                                            type: 'number',
                                            format: 'float',
                                            example: 60.0,
                                        ),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to view this assessment'),
            new OA\Response(response: 404, description: 'Assessment not found'),
        ],
    )]
    public function index(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);

        Gate::authorize('view', $assessment);

        // Load team members for role resolution
        $assessment->load('teamMembers');
        $teamMembers = $assessment->teamMembers;

        // Get parameters with all required relationships
        // Order: mandatory parameters first (is_mandatory DESC), then by id for consistency
        $parameters = $assessment->parameters()
            ->with([
                'assignedTeamMember.user',
                'questions.response.assessor',
                'questions.response.evidences',
                'questions.reviewer',
            ])
            ->orderByDesc('is_mandatory')
            ->orderBy('id')
            ->get();

        // Calculate summary statistics
        $totalQuestions = 0;
        $answeredQuestions = 0;

        foreach ($parameters as $parameter) {
            $totalQuestions += $parameter->questions->count();
            $answeredQuestions += $parameter->questions->filter(fn ($q) => self::hasAnswer($q))->count();
        }

        $completionPercentage = $totalQuestions > 0 ? round(($answeredQuestions / $totalQuestions) * 100, 2) : 0;

        return $this->successResponse([
            'parameters' => $parameters->map(fn ($parameter) => $this->formatParameter($parameter, $teamMembers)),
            'summary' => [
                'total_questions' => $totalQuestions,
                'answered_questions' => $answeredQuestions,
                'completion_percentage' => $completionPercentage,
            ],
        ], 'Parameters with questions and responses retrieved successfully');
    }

    /**
     * Get a single question with response.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/responses/{questionId}',
        summary: 'Get question with response details',
        description: 'Retrieves detailed information about a specific question including all options and the assessor\'s response.',
        tags: ['Assessment Responses', 'Assessor - Assessment Responses'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'questionId',
                in: 'path',
                required: true,
                description: 'Question ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Question with response retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'question', type: 'object'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to view this assessment'),
            new OA\Response(response: 404, description: 'Assessment or question not found'),
        ],
    )]
    public function show(Request $request, int $assessmentId, int $questionId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        Gate::authorize('view', $assessment);

        // Load team members for role resolution
        $assessment->load('teamMembers');
        $teamMembers = $assessment->teamMembers;

        $question = ApplicationAssessmentQuestion::with(['parameter', 'response.assessor'])
            ->where('assessment_id', $assessmentId)
            ->find($questionId);

        if (! $question) {
            return $this->errorResponse('Question not found.', 404);
        }

        return $this->successResponse([
            'question' => $this->formatQuestionWithResponse($question, $teamMembers, true),
        ], 'Question with response retrieved successfully');
    }

    /**
     * Update or create response for a question.
     */
    #[OA\Put(
        path: '/api/v1/application-assessments/{assessmentId}/responses/{questionId}',
        summary: 'Update response for a question',
        description: 'Updates or creates a response for an assessment question. Only assessors assigned to the assessment can update. Assessment must be in \'in_progress\' or \'mobile_complete\' status.',
        tags: ['Assessment Responses', 'Assessor - Assessment Responses'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                description: 'Assessment ID',
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'questionId',
                in: 'path',
                required: true,
                description: 'Question ID',
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['selected_option'],
                properties: [
                    new OA\Property(
                        property: 'selected_option',
                        type: 'integer',
                        example: 3,
                        description: 'Selected option (1-5)',
                    ),
                    new OA\Property(
                        property: 'assessor_remarks',
                        type: 'string',
                        example: 'Organization demonstrates strong quality management practices',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Response updated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Response updated successfully.',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'response', type: 'object'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Bad request - assessment not in progress, invalid option, or validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation failed.'),
                        new OA\Property(property: 'errors', type: 'object'),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Unauthorized to conduct this assessment'),
            new OA\Response(response: 404, description: 'Assessment or question not found'),
        ],
    )]
    public function update(Request $request, int $assessmentId, int $questionId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        Gate::authorize('conduct', $assessment);

        if (! in_array($assessment->status, [Assessment::STATUS_IN_PROGRESS, Assessment::STATUS_MOBILE_COMPLETE], true)) {
            return $this->errorResponse('Responses can only be updated while the assessment is in progress or field work is complete.', 400);
        }

        $question = ApplicationAssessmentQuestion::where('assessment_id', $assessmentId)
            ->with('parameter')
            ->find($questionId);

        if (! $question) {
            return $this->errorResponse('Question not found.', 404);
        }

        if ($denied = $this->authorizeParameterAccess($request, $assessment, $question)) {
            return $denied;
        }

        $validator = Validator::make($request->all(), [
            'selected_option' => 'required|integer|min:1|max:5',
            'assessor_remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        // Validate that the selected option has text (not empty)
        $optionText = $question->getOptionText($request->selected_option);
        if (empty($optionText)) {
            return $this->errorResponse("Option {$request->selected_option} is not available for this question.", 400);
        }

        try {
            DB::beginTransaction();

            // Find or create response
            $response = ApplicationAssessmentResponse::firstOrNew([
                'assessment_id' => $assessmentId,
                'question_id' => $questionId,
            ]);

            // The mobile app re-sends the loaded remark on every save, even when
            // the assessor only changed the score. Re-attribute the remark (and
            // its author) to this user ONLY when the text actually changed, so an
            // unchanged remark keeps its original author instead of flipping to
            // whoever last saved the question.
            $remarkChanged = (string) $request->assessor_remarks !== (string) $response->assessor_remarks;

            $response->setResponse(
                $request->selected_option,
                $remarkChanged ? $request->assessor_remarks : $response->assessor_remarks,
                $request->user()->id,
                $remarkChanged
            );

            $response->save();

            DB::commit();

            // Refresh the responses relationship cache and recalculate step progress
            $assessment->load('responses');
            $assessment->recalculateStepProgress();

            // Reload team members for role resolution
            $assessment->load('teamMembers');

            return $this->successResponse([
                'response' => $this->formatResponse($response->fresh(['question', 'assessor']), $assessment->teamMembers),
            ], 'Response updated successfully.');
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to update response.');
        }
    }

    /**
     * Format question with response for API output.
     */
    private function formatQuestionWithResponse(ApplicationAssessmentQuestion $question, Collection $teamMembers, bool $detailed = false): array
    {
        $data = [
            'id' => $question->id,
            'assessment_id' => $question->assessment_id,
            'parameter' => $question->parameter ? [
                'id' => $question->parameter->id,
                'code' => $question->parameter->code,
                'name' => $question->parameter->name,
                'discipline_name' => $question->parameter->discipline_name,
            ] : null,
            'code' => $question->code,
            'question_text' => $question->question_text,
            'category' => $question->category,
            'weightage' => $question->weightage,
            'options' => $question->getOptionsArray(),
            'response' => $question->response ? $this->formatResponse($question->response, $teamMembers) : null,
        ];

        return $data;
    }

    /**
     * Format response for API output.
     */
    private function formatResponse(ApplicationAssessmentResponse $response, Collection $teamMembers): array
    {
        return [
            'id' => $response->id,
            'selected_option' => $response->selected_option,
            'selected_score' => $response->selected_score,
            'weighted_score' => $response->weighted_score,
            'rc_score' => $response->rc_score,
            'assessor_remarks' => $response->assessor_remarks,
            'assessed_by' => $response->assessor ? [
                'id' => $response->assessor->id,
                'name' => $response->assessor->full_name,
                'role' => $this->getAssessorTeamRole($response, $teamMembers),
            ] : null,
            'assessed_at' => $response->assessed_at?->toIso8601String(),
            'evidences' => $response->relationLoaded('evidences')
                ? $response->evidences->map(fn ($e) => $this->formatEvidence($e))
                : [],
        ];
    }

    /**
     * Format parameter with questions for API output (grouped structure).
     *
     * @param  ApplicationAssessmentParameter  $parameter
     */
    private function formatParameter($parameter, Collection $teamMembers): array
    {
        // Weightages per parameter total exactly 100%, so the weighted sums stay on the
        // 0-5 scale ONLY when every question is answered. A partial sum is a deflated
        // number (Level 5 answers at 60% progress read as 3.00) that cannot be told apart
        // from a finished mediocre score, so the score is null until the parameter is
        // complete; the client renders a dash and the question counts carry progress.
        $score = 0;   // Assessor's weighted average (from selected_score)
        $rcScore = 0; // RC-weighted average (rc_score if present, else selected_score)
        foreach ($parameter->questions as $question) {
            if (self::hasAnswer($question)) {
                $weightage = $question->weightage ?? 0;
                $selectedScore = $question->response->selected_score ?? 0;
                $score += $selectedScore * ($weightage / 100);
                // For RC score: use rc_score if present, otherwise fall back to selected_score
                $effectiveRcScore = $question->response->rc_score ?? $selectedScore;
                $rcScore += $effectiveRcScore * ($weightage / 100);
            }
        }

        $totalQuestions = $parameter->questions->count();
        $completedQuestions = $parameter->questions->filter(fn ($q) => self::hasAnswer($q))->count();
        $isComplete = $totalQuestions > 0 && $completedQuestions === $totalQuestions;

        return [
            'id' => $parameter->id,
            'code' => $parameter->code,
            'name' => $parameter->name,
            'disciplineName' => $parameter->discipline_name,
            'isMandatory' => $parameter->is_mandatory,
            'assignedAssessor' => $parameter->assignedTeamMember && $parameter->assignedTeamMember->user ? [
                'id' => $parameter->assignedTeamMember->user->id,
                'name' => $parameter->assignedTeamMember->user->full_name,
            ] : null,
            'score' => $isComplete ? round($score, 2) : null,
            'rcScore' => $isComplete ? round($rcScore, 2) : null,
            'totalQuestions' => $totalQuestions,
            'completedQuestions' => $completedQuestions,
            'questions' => $parameter->questions->map(fn ($question) => $this->formatQuestionForParameter($question, $teamMembers)),
        ];
    }

    /**
     * The single definition of "answered" for parameter progress and scoring.
     */
    private static function hasAnswer(ApplicationAssessmentQuestion $question): bool
    {
        return $question->response !== null && $question->response->selected_option !== null;
    }

    /**
     * Format question for parameter-grouped output (no redundant parameter object).
     *
     * @param  ApplicationAssessmentQuestion  $question
     */
    private function formatQuestionForParameter($question, Collection $teamMembers): array
    {
        return [
            'id' => $question->id,
            'code' => $question->code,
            'questionText' => $question->question_text,
            'category' => $question->category,
            'weightage' => $question->weightage,
            'options' => $question->getOptionsArray(),
            'response' => $question->response ? $this->formatSimplifiedResponse($question->response, $teamMembers) : null,
            'reviewStatus' => $question->review_status,
            'reviewType' => $question->review_type,
            'reviewedBy' => $question->reviewer ? [
                'id' => $question->reviewer->id,
                'name' => $question->reviewer->full_name,
            ] : null,
            'reviewedAt' => $question->reviewed_at?->toIso8601String(),
        ];
    }

    /**
     * Format simplified response (for parameter-grouped structure).
     */
    private function formatSimplifiedResponse(ApplicationAssessmentResponse $response, Collection $teamMembers): array
    {
        // Keep `score`/`assessor` for existing clients; also emit selectedScore/assessedBy
        // so list and detail paths share the same property names.
        $assessor = $response->assessor ? [
            'id' => $response->assessor->id,
            'name' => $response->assessor->full_name,
            'role' => $this->getAssessorTeamRole($response, $teamMembers),
        ] : null;

        return [
            'id' => $response->id,
            'selectedOption' => $response->selected_option,
            'score' => $response->selected_score,
            'selectedScore' => $response->selected_score,
            'rcScore' => $response->rc_score,
            'assessorRemarks' => $response->assessor_remarks,
            'assessedAt' => $response->assessed_at?->toIso8601String(),
            'evidences' => $response->relationLoaded('evidences')
                ? $response->evidences->map(fn ($e) => $this->formatEvidence($e))
                : [],
            'assessor' => $assessor,
            'assessedBy' => $assessor,
        ];
    }

    /**
     * Upload evidence for a response.
     */
    #[OA\Post(
        path: '/api/v1/application-assessments/{assessmentId}/responses/{questionId}/evidences',
        summary: 'Upload evidence for a response',
        description: 'Upload an image or document as evidence for an assessment question response.',
        tags: ['Assessment Responses', 'Assessor - Assessment Responses'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'questionId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: [
                new OA\MediaType(
                    mediaType: 'multipart/form-data',
                    schema: new OA\Schema(
                        required: ['file'],
                        properties: [
                            new OA\Property(
                                property: 'file',
                                type: 'string',
                                format: 'binary',
                                description: 'Evidence file (image or PDF, max 10MB)',
                            ),
                            new OA\Property(
                                property: 'description',
                                type: 'string',
                                description: 'Optional description',
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
                                property: 'capturedAt',
                                type: 'string',
                                format: 'date-time',
                                description: 'When the evidence was captured',
                            ),
                            new OA\Property(
                                property: 'sourceSiteTourPictureId',
                                type: 'integer',
                                description: 'Site tour picture this evidence was created from, when it came from the site tour picker. Must belong to the same assessment.',
                            ),
                        ],
                    ),
                ),
            ],
        ),
        responses: [
            new OA\Response(response: 201, description: 'Evidence uploaded successfully'),
            new OA\Response(response: 400, description: 'Invalid request or validation failed'),
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 404, description: 'Response not found'),
        ],
    )]
    public function uploadEvidence(Request $request, int $assessmentId, int $questionId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        Gate::authorize('conduct', $assessment);

        if (! in_array($assessment->status, [Assessment::STATUS_IN_PROGRESS, Assessment::STATUS_MOBILE_COMPLETE], true)) {
            return $this->errorResponse('Evidence can only be uploaded while the assessment is in progress or field work is complete.', 400);
        }

        $question = ApplicationAssessmentQuestion::where('assessment_id', $assessmentId)
            ->with('parameter')
            ->find($questionId);

        if (! $question) {
            return $this->errorResponse('Question not found.', 404);
        }

        if ($denied = $this->authorizeParameterAccess($request, $assessment, $question)) {
            return $denied;
        }

        // Find or create response
        $response = ApplicationAssessmentResponse::firstOrCreate(
            ['assessment_id' => $assessmentId, 'question_id' => $questionId],
            []
        );

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:jpeg,jpg,png,gif,pdf|max:10240', // 10MB max
            'description' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'captured_at' => 'nullable|date',
            'client_uuid' => 'nullable|string|max:64',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        // The site-tour link is resolved leniently, never validated as a hard
        // rule: the mobile app's offline queue can replay an evidence whose
        // source picture id is stale, deleted, or a client-local id that never
        // existed server-side. Rejecting the whole upload for a broken link
        // makes the client retire the evidence permanently, so an unresolvable
        // value degrades to "no link" instead. Scoped to this assessment so an
        // evidence can never be linked to another assessment's picture.
        $sourceSiteTourPictureId = $request->input('source_site_tour_picture_id');
        if ($sourceSiteTourPictureId !== null) {
            $sourceSiteTourPictureId = ctype_digit((string) $sourceSiteTourPictureId)
                ? ApplicationAssessmentSiteTourPicture::where('assessment_id', $assessmentId)
                    ->where('id', $sourceSiteTourPictureId)
                    ->value('id')
                : null;
        }

        // Idempotency: an offline replay carries the same client_uuid. Return the
        // already-stored evidence instead of creating a duplicate row + file.
        $clientUuid = $request->input('client_uuid');
        if ($clientUuid) {
            // Scoped to this response: the client reference is supplied by the caller and is not
            // guaranteed unique, so an unscoped lookup would return another assessment's evidence,
            // and its download link, to whoever happened to send a matching value.
            $existing = ApplicationAssessmentResponseEvidence::where('response_id', $response->id)
                ->where('client_uuid', $clientUuid)
                ->first();
            if ($existing) {
                return $this->successResponse([
                    'evidence' => $this->formatEvidence($existing),
                ], 'Evidence uploaded successfully.', 201);
            }
        }

        try {
            $file = $request->file('file');

            // Store file using FileStorageService (private storage)
            $fileData = $this->fileStorage->storeAssessmentFile(
                $file,
                $assessmentId,
                FileStorageService::ASSESSMENT_EVIDENCES
            );

            $evidence = ApplicationAssessmentResponseEvidence::create([
                'response_id' => $response->id,
                'source_site_tour_picture_id' => $sourceSiteTourPictureId,
                'client_uuid' => $clientUuid,
                'file_name' => $fileData['original_filename'],
                'file_path' => $fileData['path'],
                'file_size' => $fileData['size'],
                'mime_type' => $fileData['mime_type'],
                'disk' => $fileData['disk'],
                'description' => $request->description,
                'uploaded_by' => $request->user()->id,
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'captured_at' => $request->captured_at ?? now(),
            ]);

            return $this->successResponse([
                'evidence' => $this->formatEvidence($evidence),
            ], 'Evidence uploaded successfully.', 201);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to upload evidence.');
        }
    }

    /**
     * List evidences for a response.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/responses/{questionId}/evidences',
        summary: 'List evidences for a response',
        tags: ['Assessment Responses', 'Assessor - Assessment Responses'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'questionId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Evidences retrieved successfully'),
            new OA\Response(response: 404, description: 'Response not found'),
        ],
    )]
    public function listEvidences(Request $request, int $assessmentId, int $questionId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        Gate::authorize('view', $assessment);

        $response = ApplicationAssessmentResponse::where('assessment_id', $assessmentId)
            ->where('question_id', $questionId)
            ->first();

        if (! $response) {
            return $this->successResponse(['evidences' => []], 'No evidences found');
        }

        $evidences = $response->evidences()->with('uploader')->get();

        return $this->successResponse([
            'evidences' => $evidences->map(fn ($e) => $this->formatEvidence($e)),
        ], 'Evidences retrieved successfully');
    }

    /**
     * Delete evidence.
     */
    #[OA\Delete(
        path: '/api/v1/application-assessments/{assessmentId}/responses/{questionId}/evidences/{evidenceId}',
        summary: 'Delete evidence',
        tags: ['Assessment Responses', 'Assessor - Assessment Responses'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'questionId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'evidenceId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Evidence deleted successfully'),
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 404, description: 'Evidence not found'),
        ],
    )]
    public function deleteEvidence(Request $request, int $assessmentId, int $questionId, int $evidenceId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        Gate::authorize('conduct', $assessment);

        if (! in_array($assessment->status, [Assessment::STATUS_IN_PROGRESS, Assessment::STATUS_MOBILE_COMPLETE], true)) {
            return $this->errorResponse('Evidence can only be deleted while the assessment is in progress or field work is complete.', 400);
        }

        $response = ApplicationAssessmentResponse::where('assessment_id', $assessmentId)
            ->where('question_id', $questionId)
            ->first();

        if (! $response) {
            return $this->errorResponse('Response not found.', 404);
        }

        $evidence = ApplicationAssessmentResponseEvidence::where('response_id', $response->id)
            ->find($evidenceId);

        if (! $evidence) {
            return $this->errorResponse('Evidence not found.', 404);
        }

        try {
            // Delete file from storage using FileStorageService
            $this->fileStorage->delete($evidence->file_path);

            $evidence->delete();

            return $this->successResponse(null, 'Evidence deleted successfully.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to delete evidence.');
        }
    }

    /**
     * Download evidence file.
     */
    #[OA\Get(
        path: '/api/v1/application-assessments/{assessmentId}/responses/{questionId}/evidences/{evidenceId}/download',
        summary: 'Download evidence file',
        tags: ['Assessment Responses', 'Assessor - Assessment Responses'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'assessmentId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'questionId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'evidenceId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
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
            new OA\Response(response: 403, description: 'Unauthorized'),
            new OA\Response(response: 404, description: 'Evidence not found'),
        ],
    )]
    public function downloadEvidence(Request $request, int $assessmentId, int $questionId, int $evidenceId)
    {
        $assessment = Assessment::findOrFail($assessmentId);
        Gate::authorize('view', $assessment);

        $response = ApplicationAssessmentResponse::where('assessment_id', $assessmentId)
            ->where('question_id', $questionId)
            ->first();

        if (! $response) {
            return $this->errorResponse('Response not found.', 404);
        }

        $evidence = ApplicationAssessmentResponseEvidence::where('response_id', $response->id)
            ->find($evidenceId);

        if (! $evidence) {
            return $this->errorResponse('Evidence not found.', 404);
        }

        if (! $this->fileStorage->exists($evidence->file_path)) {
            return $this->errorResponse('Evidence file not found in storage.', 404);
        }

        $forceDownload = $request->boolean('download', false);

        if ($forceDownload) {
            return $this->fileStorage->download($evidence->file_path, $evidence->file_name);
        }

        return $this->fileStorage->stream($evidence->file_path, $evidence->file_name);
    }

    /**
     * Resolve the assessor's team role for a given response.
     *
     * Looks up the user identified by $response->assessed_by in the
     * assessment's team members collection and returns a human-readable
     * role label ("Lead Assessor" or "Co-Assessor").
     */
    private function getAssessorTeamRole(ApplicationAssessmentResponse $response, Collection $teamMembers): ?string
    {
        $teamMember = $teamMembers->first(
            fn ($member) => $member->user_id === $response->assessed_by
        );

        if (! $teamMember) {
            return null;
        }

        return match ($teamMember->role) {
            'lead_assessor' => 'Lead Assessor',
            'co_assessor' => 'Co-Assessor',
            default => null,
        };
    }

    /**
     * Format evidence for API output.
     */
    private function formatEvidence(ApplicationAssessmentResponseEvidence $evidence): array
    {
        return [
            'id' => $evidence->id,
            'source_site_tour_picture_id' => $evidence->source_site_tour_picture_id,
            'file_name' => $evidence->file_name,
            'file_type' => pathinfo($evidence->file_name, PATHINFO_EXTENSION),
            'file_size' => $evidence->file_size,
            'formatted_size' => $evidence->formatted_size,
            'mime_type' => $evidence->mime_type,
            'description' => $evidence->description,
            'is_image' => $evidence->isImage(),
            'download_url' => $evidence->download_url,
            'latitude' => $evidence->latitude,
            'longitude' => $evidence->longitude,
            'captured_at' => $evidence->captured_at?->toIso8601String(),
            'uploaded_by' => $evidence->uploader ? [
                'id' => $evidence->uploader->id,
                'name' => $evidence->uploader->full_name,
            ] : null,
            'created_at' => $evidence->created_at?->toIso8601String(),
        ];
    }
}
