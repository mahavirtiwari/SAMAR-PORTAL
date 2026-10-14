<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssessmentQuestion\StoreAssessmentQuestionRequest;
use App\Http\Requests\AssessmentQuestion\UpdateAssessmentQuestionRequest;
use App\Models\AssessmentParameter;
use App\Models\AssessmentQuestion;
use App\Models\AssessmentQuestionOption;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Assessment Questions', description: 'Assessment question management endpoints')]
class AssessmentQuestionController extends Controller
{
    #[OA\Get(
        path: '/api/v1/assessment-parameters/{parameterId}/questions',
        summary: 'List assessment questions for a parameter (paginated)',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions', 'DRDO Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'parameterId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by question text',
                required: false,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'category',
                in: 'query',
                description: 'Filter by question category',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['planning', 'deployment', 'monitoring']),
            ),
            new OA\Parameter(
                name: 'isActive',
                in: 'query',
                description: 'Filter by active status',
                required: false,
                schema: new OA\Schema(type: 'boolean'),
            ),
            new OA\Parameter(
                name: 'page',
                in: 'query',
                description: 'Page number',
                schema: new OA\Schema(type: 'integer', default: 1),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Items per page',
                schema: new OA\Schema(type: 'integer', default: 15),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Questions retrieved successfully'),
            new OA\Response(response: 404, description: 'Parameter not found'),
        ],
    )]
    public function index(Request $request, int $parameterId): JsonResponse
    {
        try {
            $parameter = AssessmentParameter::findOrFail($parameterId);
            $perPage = $this->resolvePerPage($request, 15);
            $query = $parameter->questions()->with('options');

            // Apply search filter
            if ($request->filled('search')) {
                $search = trim($request->input('search'));
                $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
                $query->where('question_text', 'LIKE', "%{$search}%");
            }

            // Apply category filter
            if ($request->filled('category')) {
                $query->where('category', $request->category);
            }

            // Apply is_active filter
            if ($request->has('is_active')) {
                $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
                $query->where('is_active', $isActive);
            }

            // Order by display_order or id
            $query->orderBy('id');

            $questions = $query->paginate($perPage);

            return $this->paginatedResponse($questions, 'Questions retrieved successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Parameter not found', 404);
        }
    }

    #[OA\Post(
        path: '/api/v1/assessment-questions',
        summary: 'Create a new assessment question',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions', 'DRDO Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['parameter_id', 'question_text'],
                properties: [
                    new OA\Property(property: 'parameter_id', type: 'integer'),
                    new OA\Property(property: 'question_text', type: 'string'),
                    new OA\Property(
                        property: 'category',
                        type: 'string',
                        enum: ['planning', 'deployment', 'monitoring'],
                    ),
                    new OA\Property(property: 'weightage', type: 'number', format: 'float'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Question created successfully'),
            new OA\Response(response: 400, description: 'Validation error'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function store(StoreAssessmentQuestionRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();

            // Check if the parent parameter is active - active parameters are read-only
            $parameter = AssessmentParameter::find($data['parameter_id']);
            if ($parameter && $parameter->is_active) {
                return $this->errorResponse(
                    'Cannot add questions to an active parameter. Please deactivate the parameter first.',
                    400
                );
            }

            $data['is_active'] = true;

            $question = AssessmentQuestion::create($data);
            $question->load(['parameter', 'options']);

            return $this->successResponse($question, 'Question created successfully', 201);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to create question');
        }
    }

    #[OA\Get(
        path: '/api/v1/assessment-questions/{id}',
        summary: 'Get assessment question details with options',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions', 'DRDO Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Question retrieved successfully'),
            new OA\Response(response: 404, description: 'Question not found'),
        ],
    )]
    public function show(int $id): JsonResponse
    {
        try {
            $question = AssessmentQuestion::with(['parameter', 'options'])->findOrFail($id);

            return $this->successResponse($question, 'Question retrieved successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Question not found', 404);
        }
    }

    #[OA\Put(
        path: '/api/v1/assessment-questions/{id}',
        summary: 'Update an assessment question',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions', 'DRDO Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'question_text', type: 'string'),
                    new OA\Property(
                        property: 'category',
                        type: 'string',
                        enum: ['planning', 'deployment', 'monitoring'],
                    ),
                    new OA\Property(property: 'weightage', type: 'number'),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Question updated successfully'),
            new OA\Response(response: 404, description: 'Question not found'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function update(UpdateAssessmentQuestionRequest $request, int $id): JsonResponse
    {
        try {
            $question = AssessmentQuestion::findOrFail($id);

            // Check if the parent parameter is active - active parameters are read-only
            $parameter = $question->parameter;
            if ($parameter && $parameter->is_active) {
                return $this->errorResponse(
                    'Cannot modify questions of an active parameter. Please deactivate the parameter first.',
                    400
                );
            }

            $question->update($request->validated());
            $question->load(['parameter', 'options']);

            return $this->successResponse($question, 'Question updated successfully.');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to update question');
        }
    }

    #[OA\Get(
        path: '/api/v1/assessment-questions/{id}/options',
        summary: 'Get answer options for an assessment question',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions', 'DRDO Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Options retrieved successfully'),
            new OA\Response(response: 404, description: 'Question not found'),
        ],
    )]
    public function options(int $id): JsonResponse
    {
        try {
            $question = AssessmentQuestion::findOrFail($id);
            $options = $question->options()->get();

            return $this->successResponse($options, 'Options retrieved successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Question not found', 404);
        }
    }

    #[OA\Post(
        path: '/api/v1/assessment-questions/{id}/options',
        summary: 'Add an answer option to an assessment question',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions', 'DRDO Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['option_text', 'score'],
                properties: [
                    new OA\Property(property: 'option_text', type: 'string'),
                    new OA\Property(property: 'score', type: 'number', format: 'float', example: 1.00),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 201, description: 'Option added successfully'),
            new OA\Response(response: 400, description: 'Validation error'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function addOption(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            // Check authorization
            if (! $user->hasAnyRole(['system_admin', 'drdo_admin'])) {
                return $this->errorResponse('Unauthorized to add options', 403);
            }

            $question = AssessmentQuestion::findOrFail($id);

            // Check if the parent parameter is active - active parameters are read-only
            $parameter = $question->parameter;
            if ($parameter && $parameter->is_active) {
                return $this->errorResponse(
                    'Cannot add options to questions of an active parameter. Please deactivate the parameter first.',
                    400
                );
            }

            // Validate request
            $validator = Validator::make($request->all(), [
                'option_text' => 'required|string|max:1000',
                // Invariant enforced system-wide: option position N has integer score N (1-5).
                // FE assigns score = position; UIs derive the RC's option pick from rc_score by integer match.
                'score' => 'required|integer|in:1,2,3,4,5',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            // Guards the position-N-scores-N invariant the whole scoring path assumes:
            // five options, each holding a distinct score. The portal enforces this,
            // so without these checks the API is the only way to corrupt it.
            if (AssessmentQuestionOption::where('question_id', $question->id)->count() >= 5) {
                return $this->errorResponse('Validation failed', 400, [
                    'option_text' => ['A question cannot have more than 5 options.'],
                ]);
            }

            $scoreTaken = AssessmentQuestionOption::where('question_id', $question->id)
                ->where('score', $request->input('score'))
                ->exists();

            if ($scoreTaken) {
                return $this->errorResponse('Validation failed', 400, [
                    'score' => ['Another option on this question already uses this score.'],
                ]);
            }

            // Check for duplicate option text within the same question (case insensitive, trimmed)
            $optionText = trim($request->input('option_text'));
            $duplicateExists = AssessmentQuestionOption::where('question_id', $question->id)
                ->whereRaw('LOWER(TRIM(option_text)) = ?', [strtolower($optionText)])
                ->exists();

            if ($duplicateExists) {
                return $this->errorResponse('Validation failed', 400, [
                    'option_text' => ['This option already exists in this question.'],
                ]);
            }

            $data = $validator->validated();
            $data['question_id'] = $question->id;
            $data['is_active'] = true;

            $option = AssessmentQuestionOption::create($data);

            return $this->successResponse($option, 'Option added successfully', 201);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to add option');
        }
    }

    #[OA\Put(
        path: '/api/v1/assessment-questions/{id}/options/{optionId}',
        summary: 'Update an answer option',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions', 'DRDO Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'optionId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'option_text', type: 'string'),
                    new OA\Property(property: 'score', type: 'number'),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Option updated successfully'),
            new OA\Response(response: 404, description: 'Option not found'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function updateOption(Request $request, int $id, int $optionId): JsonResponse
    {
        try {
            $user = Auth::user();

            // Check authorization
            if (! $user->hasAnyRole(['system_admin', 'drdo_admin'])) {
                return $this->errorResponse('Unauthorized to update options', 403);
            }

            $question = AssessmentQuestion::findOrFail($id);

            // Check if the parent parameter is active - active parameters are read-only
            $parameter = $question->parameter;
            if ($parameter && $parameter->is_active) {
                return $this->errorResponse(
                    'Cannot modify options of questions in an active parameter. Please deactivate the parameter first.',
                    400
                );
            }

            $option = AssessmentQuestionOption::where('question_id', $question->id)->find($optionId);

            if (! $option) {
                return $this->errorResponse('Option not found.', 404);
            }

            // Validate request
            $validator = Validator::make($request->all(), [
                'option_text' => 'sometimes|string|max:1000',
                // Invariant: option position N has integer score N (1-5).
                'score' => 'nullable|integer|in:1,2,3,4,5',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse('Validation failed', 400, $validator->errors()->toArray());
            }

            // Check for duplicate option text within the same question (case insensitive, trimmed)
            // Exclude the current option being updated
            if ($request->has('option_text')) {
                $optionText = trim($request->input('option_text'));
                $duplicateExists = AssessmentQuestionOption::where('question_id', $question->id)
                    ->where('id', '!=', $optionId)
                    ->whereRaw('LOWER(TRIM(option_text)) = ?', [strtolower($optionText)])
                    ->exists();

                if ($duplicateExists) {
                    return $this->errorResponse('Validation failed', 400, [
                        'option_text' => ['This option already exists in this question.'],
                    ]);
                }
            }

            $option->update($validator->validated());

            return $this->successResponse($option, 'Option updated successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to update option');
        }
    }

    #[OA\Post(
        path: '/api/v1/assessment-questions/{id}/activate',
        summary: 'Activate assessment question',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Assessment question activated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Assessment question not found'),
            new OA\Response(response: 400, description: 'Assessment question is already active'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activate(int $id): JsonResponse
    {
        try {
            $question = AssessmentQuestion::findOrFail($id);
            Gate::authorize('changeStatus', $question);

            if ($question->is_active === true) {
                return $this->errorResponse('Assessment question is already active.', 400);
            }

            // Check that activating this question won't push active weightage above 100
            $parameter = $question->parameter;
            $currentActiveWeightage = $parameter->getActiveQuestionsWeightage();
            $totalAfterActivation = $currentActiveWeightage + (int) $question->weightage;

            if ($totalAfterActivation > 100) {
                $remaining = max(0, 100 - $currentActiveWeightage);

                return $this->errorResponse(
                    "Cannot activate: This question has {$question->weightage}% weightage, but only {$remaining}% is available. Current active total is {$currentActiveWeightage}%.",
                    400
                );
            }

            $question->update(['is_active' => true]);

            Log::info('Assessment question activated', [
                'question_id' => $question->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($question, 'Assessment question activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Assessment question not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to activate assessment question', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'question_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate assessment question.', 500);
        }
    }

    #[OA\Post(
        path: '/api/v1/assessment-questions/{id}/deactivate',
        summary: 'Deactivate assessment question',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Assessment question deactivated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Assessment question not found'),
            new OA\Response(response: 400, description: 'Assessment question is already inactive'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivate(int $id): JsonResponse
    {
        try {
            $question = AssessmentQuestion::findOrFail($id);
            Gate::authorize('changeStatus', $question);

            if ($question->is_active === false) {
                return $this->errorResponse('Assessment question is already inactive.', 400);
            }

            $parameterWasActive = (bool) $question->parameter?->is_active;

            // The AssessmentQuestion observer deactivates the parameter when its active
            // weightage no longer totals 100%; the warning reports what it did.
            $question->update(['is_active' => false]);

            Log::info('Assessment question deactivated', [
                'question_id' => $question->id,
                'deactivated_by' => auth()->id(),
            ]);

            $question->load(['parameter']);

            $message = 'Assessment question deactivated successfully.';
            if ($parameterWasActive && ! $question->parameter->is_active) {
                $message .= ' Warning: Parameter has been auto-deactivated because active questions weightage no longer equals 100%.';
            }

            return $this->successResponse($question, $message);
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Assessment question not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to deactivate assessment question', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'question_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate assessment question.', 500);
        }
    }

    #[OA\Post(
        path: '/api/v1/assessment-questions/{id}/options/{optionId}/activate',
        summary: 'Activate assessment question option',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'optionId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Option activated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Option not found'),
            new OA\Response(response: 400, description: 'Option is already active'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activateOption(int $id, int $optionId): JsonResponse
    {
        try {
            $question = AssessmentQuestion::find($id);
            if (! $question) {
                return $this->errorResponse('Question not found.', 404);
            }

            $option = AssessmentQuestionOption::where('question_id', $question->id)->find($optionId);
            if (! $option) {
                return $this->errorResponse('Option not found.', 404);
            }

            Gate::authorize('changeStatus', $option);

            if ($option->is_active === true) {
                return $this->errorResponse('Option is already active.', 400);
            }

            $option->update(['is_active' => true]);

            Log::info('Assessment question option activated', [
                'option_id' => $option->id,
                'question_id' => $question->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($option, 'Option activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Option not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to activate option', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'option_id' => $optionId,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate option.', 500);
        }
    }

    #[OA\Post(
        path: '/api/v1/assessment-questions/{id}/options/{optionId}/deactivate',
        summary: 'Deactivate assessment question option',
        tags: ['Assessment Questions', 'System Admin - Assessment Questions'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'optionId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Option deactivated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Option not found'),
            new OA\Response(response: 400, description: 'Option is already inactive'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivateOption(int $id, int $optionId): JsonResponse
    {
        try {
            $question = AssessmentQuestion::find($id);
            if (! $question) {
                return $this->errorResponse('Question not found.', 404);
            }

            $option = AssessmentQuestionOption::where('question_id', $question->id)->find($optionId);
            if (! $option) {
                return $this->errorResponse('Option not found.', 404);
            }

            Gate::authorize('changeStatus', $option);

            if ($option->is_active === false) {
                return $this->errorResponse('Option is already inactive.', 400);
            }

            $option->update(['is_active' => false]);

            Log::info('Assessment question option deactivated', [
                'option_id' => $option->id,
                'question_id' => $question->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($option, 'Option deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Option not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to deactivate option', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'option_id' => $optionId,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate option.', 500);
        }
    }
}
