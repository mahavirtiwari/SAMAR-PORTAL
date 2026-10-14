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
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Feedback Questions',
    description: 'API Endpoints for managing feedback questions for applicant surveys',
)]
class FeedbackQuestionController extends Controller
{
    /**
     * Display a listing of feedback questions.
     */
    #[OA\Get(
        path: '/api/v1/feedback-questions',
        operationId: 'getFeedbackQuestions',
        tags: ['Feedback Questions'],
        summary: 'Get list of feedback questions',
        description: 'Returns paginated list of feedback questions with optional filters',
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'type',
                in: 'query',
                description: 'Filter by question type',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['rating', 'yes_no']),
            ),
            new OA\Parameter(
                name: 'isActive',
                in: 'query',
                description: 'Filter by active status',
                required: false,
                schema: new OA\Schema(type: 'boolean'),
            ),
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search in question text',
                required: false,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Items per page (max 100)',
                required: false,
                schema: new OA\Schema(type: 'integer', default: 15, maximum: 100),
            ),
            new OA\Parameter(
                name: 'page',
                in: 'query',
                description: 'Page number',
                required: false,
                schema: new OA\Schema(type: 'integer', default: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Successful operation',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Feedback questions retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'data',
                                    type: 'array',
                                    items: new OA\Items(
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer', example: 1),
                                            new OA\Property(
                                                property: 'question_text',
                                                type: 'string',
                                                example: 'How satisfied are you with the assessment process?',
                                            ),
                                            new OA\Property(property: 'type', type: 'string', example: 'rating'),
                                            new OA\Property(
                                                property: 'type_label',
                                                type: 'string',
                                                example: '5 Star Rating',
                                            ),
                                            new OA\Property(
                                                property: 'display_order',
                                                type: 'integer',
                                                example: 1,
                                            ),
                                            new OA\Property(property: 'is_active', type: 'boolean', example: true),
                                            new OA\Property(
                                                property: 'created_at',
                                                type: 'string',
                                                format: 'date-time',
                                            ),
                                            new OA\Property(
                                                property: 'updated_at',
                                                type: 'string',
                                                format: 'date-time',
                                            ),
                                        ],
                                    ),
                                ),
                                new OA\Property(property: 'current_page', type: 'integer', example: 1),
                                new OA\Property(property: 'per_page', type: 'integer', example: 15),
                                new OA\Property(property: 'total', type: 'integer', example: 10),
                                new OA\Property(property: 'last_page', type: 'integer', example: 1),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
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
     */
    #[OA\Post(
        path: '/api/v1/feedback-questions',
        operationId: 'storeFeedbackQuestion',
        tags: ['Feedback Questions'],
        summary: 'Create a new feedback question',
        description: 'Create a new feedback question for applicant surveys',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['questionText', 'type'],
                properties: [
                    new OA\Property(
                        property: 'questionText',
                        type: 'string',
                        maxLength: 1000,
                        example: 'How satisfied are you with the assessment process?',
                        description: 'The question text',
                    ),
                    new OA\Property(
                        property: 'type',
                        type: 'string',
                        enum: ['rating', 'yes_no'],
                        example: 'rating',
                        description: 'Question type',
                    ),
                    new OA\Property(
                        property: 'displayOrder',
                        type: 'integer',
                        minimum: 0,
                        example: 1,
                        description: 'Display order (optional)',
                    ),
                    new OA\Property(
                        property: 'isActive',
                        type: 'boolean',
                        example: true,
                        description: 'Active status (optional)',
                    ),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Feedback question created successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Feedback question created successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(
                                    property: 'question_text',
                                    type: 'string',
                                    example: 'How satisfied are you with the assessment process?',
                                ),
                                new OA\Property(property: 'type', type: 'string', example: 'rating'),
                                new OA\Property(property: 'type_label', type: 'string', example: '5 Star Rating'),
                                new OA\Property(property: 'display_order', type: 'integer', example: 1),
                                new OA\Property(property: 'is_active', type: 'boolean', example: true),
                                new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
                                new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(
                response: 400,
                description: 'Validation error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation failed'),
                        new OA\Property(
                            property: 'errors',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'questionText',
                                    type: 'array',
                                    items: new OA\Items(type: 'string', example: 'The question text field is required.'),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
        ],
    )]
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
     */
    #[OA\Get(
        path: '/api/v1/feedback-questions/{id}',
        operationId: 'getFeedbackQuestion',
        tags: ['Feedback Questions'],
        summary: 'Get feedback question by ID',
        description: 'Returns a single feedback question',
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Feedback question ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Successful operation',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Feedback question retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(
                                    property: 'question_text',
                                    type: 'string',
                                    example: 'How satisfied are you with the assessment process?',
                                ),
                                new OA\Property(property: 'type', type: 'string', example: 'rating'),
                                new OA\Property(property: 'type_label', type: 'string', example: '5 Star Rating'),
                                new OA\Property(property: 'display_order', type: 'integer', example: 1),
                                new OA\Property(property: 'is_active', type: 'boolean', example: true),
                                new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
                                new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(
                response: 404,
                description: 'Feedback question not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Feedback question not found',
                        ),
                    ],
                ),
            ),
        ],
    )]
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
     */
    #[OA\Put(
        path: '/api/v1/feedback-questions/{id}',
        operationId: 'updateFeedbackQuestion',
        tags: ['Feedback Questions'],
        summary: 'Update feedback question',
        description: 'Update an existing feedback question',
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Feedback question ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'questionText',
                        type: 'string',
                        maxLength: 1000,
                        example: 'How satisfied are you with the assessment process?',
                    ),
                    new OA\Property(
                        property: 'type',
                        type: 'string',
                        enum: ['rating', 'yes_no'],
                        example: 'rating',
                    ),
                    new OA\Property(property: 'displayOrder', type: 'integer', minimum: 0, example: 1),
                    new OA\Property(property: 'isActive', type: 'boolean', example: true),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Feedback question updated successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Feedback question updated successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(
                                    property: 'question_text',
                                    type: 'string',
                                    example: 'How satisfied are you with the assessment process?',
                                ),
                                new OA\Property(property: 'type', type: 'string', example: 'rating'),
                                new OA\Property(property: 'type_label', type: 'string', example: '5 Star Rating'),
                                new OA\Property(property: 'display_order', type: 'integer', example: 1),
                                new OA\Property(property: 'is_active', type: 'boolean', example: true),
                                new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
                                new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(
                response: 404,
                description: 'Feedback question not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Feedback question not found',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Validation error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation failed'),
                        new OA\Property(
                            property: 'errors',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'questionText',
                                    type: 'array',
                                    items: new OA\Items(type: 'string', example: 'The question text field is required.'),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
        ],
    )]
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
     * Get all available options for dropdowns.
     */
    #[OA\Get(
        path: '/api/v1/feedback-questions/options',
        operationId: 'getFeedbackQuestionOptions',
        tags: ['Feedback Questions'],
        summary: 'Get feedback question options',
        description: 'Get all available question types and their labels for dropdowns',
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Options retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Feedback question options retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'types',
                                    type: 'array',
                                    example: ['rating', 'yes_no'],
                                    items: new OA\Items(type: 'string'),
                                ),
                                new OA\Property(
                                    property: 'type_labels',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(
                                            property: 'rating',
                                            type: 'string',
                                            example: '5 Star Rating',
                                        ),
                                        new OA\Property(property: 'yes_no', type: 'string', example: 'Yes/No'),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ],
    )]
    public function options(): JsonResponse
    {
        return $this->successResponse([
            'types' => FeedbackQuestion::getTypes(),
            'type_labels' => FeedbackQuestion::getTypeLabels(),
        ], 'Feedback question options retrieved successfully');
    }

    /**
     * Get active questions for feedback form.
     */
    #[OA\Get(
        path: '/api/v1/feedback-questions/active',
        operationId: 'getActiveFeedbackQuestions',
        tags: ['Feedback Questions'],
        summary: 'Get active feedback questions',
        description: 'Get all active feedback questions ordered by display order for use in feedback forms',
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Active questions retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Active feedback questions retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'id', type: 'integer', example: 1),
                                    new OA\Property(
                                        property: 'question_text',
                                        type: 'string',
                                        example: 'How satisfied are you with the assessment process?',
                                    ),
                                    new OA\Property(property: 'type', type: 'string', example: 'rating'),
                                    new OA\Property(
                                        property: 'type_label',
                                        type: 'string',
                                        example: '5 Star Rating',
                                    ),
                                    new OA\Property(property: 'display_order', type: 'integer', example: 1),
                                    new OA\Property(property: 'is_active', type: 'boolean', example: true),
                                    new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
                                    new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
                                ],
                            ),
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ],
    )]
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

    #[OA\Post(
        path: '/api/v1/feedback-questions/{id}/activate',
        summary: 'Activate feedback question',
        tags: ['Feedback Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Feedback question activated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Feedback question not found'),
            new OA\Response(response: 400, description: 'Bad request - Feedback question is already active'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
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

    #[OA\Post(
        path: '/api/v1/feedback-questions/{id}/deactivate',
        summary: 'Deactivate feedback question',
        tags: ['Feedback Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Feedback question deactivated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Feedback question not found'),
            new OA\Response(response: 400, description: 'Bad request - Feedback question is already inactive'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
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
