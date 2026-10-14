<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssessmentParameter\BulkImportAssessmentParameterRequest;
use App\Http\Requests\AssessmentParameter\BulkUpdateAssessmentParameterRequest;
use App\Http\Requests\AssessmentParameter\StoreAssessmentParameterRequest;
use App\Http\Requests\AssessmentParameter\UpdateAssessmentParameterRequest;
use App\Models\AssessmentParameter;
use App\Services\AssessmentParameterImportService;
use App\Support\Csv;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[OA\Tag(name: 'Assessment Parameters', description: 'Assessment parameter/criteria management endpoints')]
class AssessmentParameterController extends Controller
{
    #[OA\Get(
        path: '/api/v1/assessment-parameters',
        summary: 'List all assessment parameters',
        tags: [
            'Assessment Parameters',
            'System Admin - Assessment Parameters',
            'DRDO Admin - Assessment Parameters',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by parameter name',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'Quality'),
            ),
            new OA\Parameter(
                name: 'disciplineId',
                in: 'query',
                description: 'Filter by discipline ID',
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'sector',
                in: 'query',
                description: 'Filter by sector (manufacturing/service)',
                schema: new OA\Schema(type: 'string', enum: ['manufacturing', 'service']),
            ),
            new OA\Parameter(
                name: 'enterpriseSize',
                in: 'query',
                description: 'Filter by enterprise size',
                schema: new OA\Schema(type: 'string', enum: ['startup', 'micro', 'small', 'medium', 'large']),
            ),
            new OA\Parameter(
                name: 'serviceProviderType',
                in: 'query',
                description: 'Filter by service provider type (only for service sector)',
                schema: new OA\Schema(type: 'string', enum: ['annual_maintenance_contract', 'critical_service_provider']),
            ),
            new OA\Parameter(
                name: 'isActive',
                in: 'query',
                description: 'Filter by active status',
                schema: new OA\Schema(type: 'boolean'),
            ),
            new OA\Parameter(
                name: 'isMandatory',
                in: 'query',
                description: 'Filter by mandatory status',
                schema: new OA\Schema(type: 'boolean'),
            ),
            new OA\Parameter(
                name: 'vendorCategoryId',
                in: 'query',
                description: 'Filter by DRDO vendor category ID',
                schema: new OA\Schema(type: 'integer'),
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
            new OA\Response(response: 200, description: 'Parameters retrieved successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        try {
            $perPage = $this->resolvePerPage($request, 15);
            $query = AssessmentParameter::query()
                ->withCount('questions')
                ->withSum('questions', 'weightage')
                ->with(['discipline', 'manufacturingVendorCategory', 'serviceVendorCategory']);

            // Apply search filter
            if ($request->filled('search')) {
                $search = trim($request->input('search'));
                $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
                $query->where('name', 'LIKE', "%{$search}%");
            }

            // Apply filters
            if ($request->filled('discipline_id')) {
                $query->byDiscipline($request->discipline_id);
            }

            if ($request->filled('sector')) {
                $query->bySector($request->sector);
            }

            if ($request->filled('enterprise_size')) {
                $query->byEnterpriseSize($request->enterprise_size);
            }

            if ($request->filled('service_provider_type')) {
                $query->byServiceProviderType($request->service_provider_type);
            }

            if ($request->filled('is_active')) {
                $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
                if ($isActive) {
                    $query->active();
                } else {
                    $query->where('is_active', false);
                }
            }

            if ($request->filled('is_mandatory')) {
                $isMandatory = filter_var($request->is_mandatory, FILTER_VALIDATE_BOOLEAN);
                if ($isMandatory) {
                    $query->mandatory();
                } else {
                    $query->where('is_mandatory', false);
                }
            }

            if ($request->filled('vendor_category_id')) {
                $query->where('vendor_category_id', $request->vendor_category_id);
            }

            // Order by most recent first
            $query->orderBy('created_at', 'desc');

            $parameters = $query->paginate($perPage);

            return $this->paginatedResponse($parameters, 'Parameters retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to retrieve parameters');
        }
    }

    #[OA\Post(
        path: '/api/v1/assessment-parameters',
        summary: 'Create new assessment parameter(s)',
        description: 'Creates one assessment parameter per combination of enterprise_size × vendor_category_id. Both fields accept a single value or an array of values for batch creation. Combinations that already exist are skipped (not an error) and reported in the \'skipped\' list.',
        tags: [
            'Assessment Parameters',
            'System Admin - Assessment Parameters',
            'DRDO Admin - Assessment Parameters',
        ],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'sector', 'enterprise_size'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Quality Management System'),
                    new OA\Property(property: 'discipline_id', type: 'integer', example: 1),
                    new OA\Property(
                        property: 'vendor_category_id',
                        description: 'Single ID or array of IDs (from manufacturing_vendor_categories or service_vendor_categories based on sector)',
                        oneOf: [
                            new OA\Schema(type: 'integer', nullable: true, example: 1),
                            new OA\Schema(type: 'array', example: [1, 2], items: new OA\Items(type: 'integer')),
                        ],
                    ),
                    new OA\Property(
                        property: 'sector',
                        type: 'string',
                        enum: ['manufacturing', 'service'],
                        example: 'manufacturing',
                    ),
                    new OA\Property(
                        property: 'enterprise_size',
                        description: 'Single size or array of sizes',
                        oneOf: [
                            new OA\Schema(
                                type: 'string',
                                enum: ['startup', 'micro', 'small', 'medium', 'large'],
                                example: 'medium',
                            ),
                            new OA\Schema(
                                type: 'array',
                                example: ['small', 'medium'],
                                items: new OA\Items(
                                    type: 'string',
                                    enum: ['startup', 'micro', 'small', 'medium', 'large'],
                                ),
                            ),
                        ],
                    ),
                    new OA\Property(
                        property: 'service_provider_type',
                        type: 'string',
                        enum: ['annual_maintenance_contract', 'critical_service_provider'],
                        nullable: true,
                    ),
                    new OA\Property(property: 'is_mandatory', type: 'boolean', example: true),
                ],
            ),
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'One or more parameters created successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: '2 parameter(s) created successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'created',
                                    type: 'array',
                                    items: new OA\Items(type: 'object'),
                                ),
                                new OA\Property(
                                    property: 'skipped',
                                    type: 'array',
                                    items: new OA\Items(type: 'string'),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 422, description: 'All combinations already exist'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function store(StoreAssessmentParameterRequest $request): JsonResponse
    {
        try {
            $user = Auth::user();

            // Check authorization
            if (! $user->hasAnyRole(['system_admin', 'drdo_admin'])) {
                return $this->errorResponse('Unauthorized to create parameters', 403);
            }

            $data = $request->validated();

            // Normalize enterprise_size and vendor_category_id to arrays.
            // prepareForValidation() already wraps scalars into arrays before
            // validation, so validated() will always return arrays here.
            $enterpriseSizes = (array) ($data['enterprise_size'] ?? []);
            $vendorCategoryIds = isset($data['vendor_category_id'])
                ? (array) $data['vendor_category_id']
                : [null];

            // If vendor_category_id was not submitted at all, treat as [null]
            if (empty($vendorCategoryIds)) {
                $vendorCategoryIds = [null];
            }

            $created = [];
            $skipped = [];

            DB::beginTransaction();

            foreach ($enterpriseSizes as $size) {
                foreach ($vendorCategoryIds as $vendorCategoryId) {
                    // Check for an existing parameter with this combination
                    $query = AssessmentParameter::query()
                        ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($data['name']))])
                        ->where('sector', $data['sector'])
                        ->where('enterprise_size', $size)
                        ->where('is_mandatory', filter_var($data['is_mandatory'] ?? false, FILTER_VALIDATE_BOOLEAN));

                    if (isset($data['discipline_id'])) {
                        $query->where('discipline_id', $data['discipline_id']);
                    } else {
                        $query->whereNull('discipline_id');
                    }

                    if ($vendorCategoryId === null) {
                        $query->whereNull('vendor_category_id');
                    } else {
                        $query->where('vendor_category_id', $vendorCategoryId);
                    }

                    if ($data['sector'] === 'service') {
                        if (empty($data['service_provider_type'])) {
                            $query->whereNull('service_provider_type');
                        } else {
                            $query->where('service_provider_type', $data['service_provider_type']);
                        }
                    }

                    if ($query->exists()) {
                        $skippedDesc = "enterprise_size={$size}";
                        if ($vendorCategoryId !== null) {
                            $skippedDesc .= ", vendor_category_id={$vendorCategoryId}";
                        }
                        $skipped[] = $skippedDesc;

                        continue;
                    }

                    // A new parameter has no questions, so it cannot satisfy the 100% rule
                    // and is never born active; the activate endpoint is the only door in.
                    $paramData = array_merge($data, [
                        'enterprise_size' => $size,
                        'vendor_category_id' => $vendorCategoryId,
                        'is_active' => false,
                        'code' => AssessmentParameter::generateCode($data['sector']),
                    ]);

                    $parameter = AssessmentParameter::create($paramData);
                    $parameter->load(['questions', 'discipline', 'manufacturingVendorCategory', 'serviceVendorCategory']);
                    $created[] = $parameter;
                }
            }

            DB::commit();

            if (empty($created)) {
                return $this->errorResponse(
                    'All requested combinations already exist. No parameters were created.',
                    422,
                    ['skipped' => $skipped]
                );
            }

            $count = count($created);

            Log::info('Assessment parameters created', [
                'count' => $count,
                'skipped' => count($skipped),
                'user_id' => $user->id,
            ]);

            return $this->successResponse(
                ['created' => $created, 'skipped' => $skipped],
                "{$count} parameter(s) created successfully",
                201
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to create parameter');
        }
    }

    #[OA\Get(
        path: '/api/v1/assessment-parameters/{id}',
        summary: 'Get assessment parameter details',
        description: 'Returns parameter details with questions_count. Use GET /api/v1/assessment-parameters/{parameterId}/questions for paginated questions.',
        tags: [
            'Assessment Parameters',
            'System Admin - Assessment Parameters',
            'DRDO Admin - Assessment Parameters',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Parameter retrieved successfully'),
            new OA\Response(response: 404, description: 'Parameter not found'),
        ],
    )]
    public function show(int $id): JsonResponse
    {
        try {
            $parameter = AssessmentParameter::withCount('questions')
                ->withSum('questions', 'weightage')
                ->with(['discipline', 'manufacturingVendorCategory', 'serviceVendorCategory'])
                ->findOrFail($id);

            return $this->successResponse($parameter, 'Parameter retrieved successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Parameter not found', 404);
        }
    }

    #[OA\Put(
        path: '/api/v1/assessment-parameters/{id}',
        summary: 'Update an assessment parameter',
        tags: [
            'Assessment Parameters',
            'System Admin - Assessment Parameters',
            'DRDO Admin - Assessment Parameters',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'discipline_id', type: 'integer'),
                    new OA\Property(
                        property: 'vendor_category_id',
                        type: 'integer',
                        nullable: true,
                        description: 'DRDO vendor category ID (from manufacturing_vendor_categories or service_vendor_categories based on sector)',
                    ),
                    new OA\Property(property: 'sector', type: 'string', enum: ['manufacturing', 'service']),
                    new OA\Property(
                        property: 'enterprise_size',
                        type: 'string',
                        enum: ['startup', 'micro', 'small', 'medium', 'large'],
                    ),
                    new OA\Property(
                        property: 'service_provider_type',
                        type: 'string',
                        enum: ['annual_maintenance_contract', 'critical_service_provider'],
                    ),
                    new OA\Property(property: 'is_mandatory', type: 'boolean'),
                ],
            ),
        ),
        responses: [
            new OA\Response(response: 200, description: 'Parameter updated successfully'),
            new OA\Response(response: 404, description: 'Parameter not found'),
            new OA\Response(response: 403, description: 'Forbidden'),
        ],
    )]
    public function update(UpdateAssessmentParameterRequest $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            // Check authorization
            if (! $user->hasAnyRole(['system_admin', 'drdo_admin'])) {
                return $this->errorResponse('Unauthorized to update parameters', 403);
            }

            $parameter = AssessmentParameter::findOrFail($id);

            $data = $request->validated();

            // An active parameter is read-only, the same rule every question and option
            // endpoint enforces. It was missing here, so the parameter's own fields stayed
            // editable while its questions were locked — and the UI shows a "Read-only"
            // state that the API did not actually hold anyone to. Reactivating is still
            // allowed, since that is how a parameter is put back into service.
            $changesBeyondActivation = collect($data)->except('is_active')->isNotEmpty();

            if ($parameter->is_active && $changesBeyondActivation) {
                return $this->errorResponse(
                    'Cannot modify an active parameter. Please deactivate the parameter first.',
                    400
                );
            }

            $parameter->update($data);
            $parameter->load(['questions', 'discipline', 'manufacturingVendorCategory', 'serviceVendorCategory']);

            return $this->successResponse($parameter, 'Parameter updated successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to update parameter');
        }
    }

    #[OA\Get(
        path: '/api/v1/assessment-parameters/export',
        summary: 'Export assessment parameters to CSV',
        description: 'Exports active assessment parameters and their active questions/options to a CSV file matching the bulk-import format exactly. One row is output per question; parameters without questions produce a single row with empty question/option fields.',
        tags: ['Assessment Parameters', 'System Admin - Assessment Parameters'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'sector',
                in: 'query',
                required: true,
                description: 'Filter by sector',
                schema: new OA\Schema(type: 'string', enum: ['manufacturing', 'service']),
            ),
            new OA\Parameter(
                name: 'enterprise_size',
                in: 'query',
                required: false,
                description: 'Filter by enterprise size (optional)',
                schema: new OA\Schema(type: 'string', enum: ['startup', 'micro', 'small', 'medium', 'large']),
            ),
            new OA\Parameter(
                name: 'service_provider_type',
                in: 'query',
                required: false,
                description: 'Filter by service provider type (optional)',
                schema: new OA\Schema(type: 'string', enum: ['annual_maintenance_contract', 'critical_service_provider']),
            ),
            new OA\Parameter(
                name: 'vendor_category_id',
                in: 'query',
                required: false,
                description: 'Filter by vendor category ID (optional)',
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'CSV file download',
                content: [
                    new OA\MediaType(mediaType: 'text/csv'),
                ],
            ),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 422, description: 'Validation error'),
        ],
    )]
    public function export(Request $request): StreamedResponse|JsonResponse
    {
        $validated = $request->validate([
            'sector' => ['required', 'string', 'in:manufacturing,service'],
            'enterprise_size' => ['nullable', 'string', 'in:startup,micro,small,medium,large'],
            'service_provider_type' => ['nullable', 'string', 'in:annual_maintenance_contract,critical_service_provider'],
            'vendor_category_id' => ['nullable', 'integer', 'min:1'],
            'search' => ['nullable', 'string', 'max:255'],
            'is_mandatory' => ['nullable', 'string'],
            'discipline_id' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'string'],
        ]);

        $sector = $validated['sector'];
        $enterpriseSize = $validated['enterprise_size'] ?? null;
        $serviceProviderType = $validated['service_provider_type'] ?? null;
        $vendorCategoryId = isset($validated['vendor_category_id']) ? (int) $validated['vendor_category_id'] : null;
        $search = $validated['search'] ?? null;
        $disciplineId = isset($validated['discipline_id']) ? (int) $validated['discipline_id'] : null;

        // Build the query matching the same filters as the list (index) endpoint,
        // eagerly loading discipline + active questions (ordered) with their active options.
        $parameters = AssessmentParameter::query()
            ->with([
                'discipline',
                'questions' => function ($q) {
                    $q->where('is_active', true)
                        ->whereNull('deleted_at')
                        ->orderBy('category')
                        ->orderBy('question_text');
                },
                'questions.options' => function ($q) {
                    $q->where('is_active', true)
                        ->whereNull('deleted_at')
                        ->orderBy('score');
                },
            ])
            ->where('assessment_parameters.sector', $sector)
            ->when($enterpriseSize, fn ($q) => $q->where('assessment_parameters.enterprise_size', $enterpriseSize))
            ->when($vendorCategoryId, fn ($q) => $q->where('assessment_parameters.vendor_category_id', $vendorCategoryId))
            ->when($serviceProviderType, fn ($q) => $q->where('assessment_parameters.service_provider_type', $serviceProviderType))
            ->when($disciplineId, fn ($q) => $q->where('assessment_parameters.discipline_id', $disciplineId))
            ->when($search, function ($q) use ($search) {
                $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($search));
                $q->where('assessment_parameters.name', 'LIKE', "%{$search}%");
            })
            ->when($request->filled('is_mandatory'), function ($q) use ($request) {
                $isMandatory = filter_var($request->input('is_mandatory'), FILTER_VALIDATE_BOOLEAN);
                $q->where('assessment_parameters.is_mandatory', $isMandatory);
            })
            ->when($request->filled('is_active'), function ($q) use ($request) {
                $isActive = filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN);
                $q->where('assessment_parameters.is_active', $isActive);
            })
            ->whereNull('assessment_parameters.deleted_at')
            ->join('disciplines', 'disciplines.id', '=', 'assessment_parameters.discipline_id')
            ->orderBy('disciplines.name')
            ->orderBy('assessment_parameters.name')
            ->select('assessment_parameters.*')
            ->get();

        $filename = 'assessment_parameters_export_'.now()->format('Y-m-d').'.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-store, no-cache',
            'Pragma' => 'no-cache',
        ];

        $csvHeaders = [
            'Parameter ID',
            'Question ID',
            'Discipline',
            'Parameter Name',
            'Parameter Type',
            'Question Category',
            'Question Text',
            'Weightage (%)',
            'Option 1 Text',
            'Option 2 Text',
            'Option 3 Text',
            'Option 4 Text',
            'Option 5 Text',
        ];

        $callback = function () use ($parameters, $csvHeaders): void {
            $handle = fopen('php://output', 'w');

            // UTF-8 BOM so Excel opens without encoding issues
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, $csvHeaders);

            foreach ($parameters as $parameter) {
                $parameterCode = $parameter->code ?? '';
                $disciplineName = $parameter->discipline?->name ?? '';
                $parameterName = $parameter->name;
                $parameterType = $parameter->is_mandatory ? 'Mandatory' : 'Optional';

                $questions = $parameter->questions;

                if ($questions->isEmpty()) {
                    // Output one row with empty question/option fields so the
                    // parameter still appears in the export.
                    Csv::putRow($handle, [
                        $parameterCode,
                        '',
                        $disciplineName,
                        $parameterName,
                        $parameterType,
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                    ]);

                    continue;
                }

                foreach ($questions as $question) {
                    $questionCategory = ucfirst(strtolower($question->category));
                    $questionText = $question->question_text;
                    $weightage = $question->weightage;

                    // Options ordered by score ASC (scores 1–5); pad to exactly 5 slots.
                    $options = $question->options->values();
                    $row = [
                        $parameterCode,
                        $question->code ?? '',
                        $disciplineName,
                        $parameterName,
                        $parameterType,
                        $questionCategory,
                        $questionText,
                        $weightage,
                        $options->get(0)?->option_text ?? '',
                        $options->get(1)?->option_text ?? '',
                        $options->get(2)?->option_text ?? '',
                        $options->get(3)?->option_text ?? '',
                        $options->get(4)?->option_text ?? '',
                    ];

                    Csv::putRow($handle, $row);
                }
            }

            fclose($handle);
        };

        Log::info('Assessment parameters CSV export generated', [
            'sector' => $sector,
            'enterprise_size' => $enterpriseSize,
            'service_provider_type' => $serviceProviderType,
            'vendor_category_id' => $vendorCategoryId,
            'parameter_count' => $parameters->count(),
            'user_id' => Auth::id(),
        ]);

        return response()->stream($callback, 200, $headers);
    }

    #[OA\Get(
        path: '/api/v1/assessment-parameters/template',
        summary: 'Download the bulk-import template (sample CSV)',
        description: 'Returns a ready-to-edit sample CSV in the exact format expected by the bulk-import endpoint. Use this as the starting point for new imports.',
        tags: ['Assessment Parameters', 'System Admin - Assessment Parameters'],
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'CSV template download',
                content: [
                    new OA\MediaType(mediaType: 'text/csv'),
                ],
            ),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Template file missing on server'),
        ],
    )]
    public function downloadImportTemplate(): BinaryFileResponse|JsonResponse
    {
        $path = storage_path('app/templates/assessment_parameters_sample.csv');

        if (! is_file($path)) {
            return $this->errorResponse('Import template file is missing on the server.', 404);
        }

        return response()->download($path, 'assessment_parameters_import_template.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }

    #[OA\Post(
        path: '/api/v1/assessment-parameters/bulk-import',
        summary: 'Bulk import assessment parameters with questions and options from Excel/CSV',
        description: 'Import assessment parameters with full hierarchy (disciplines, parameters, questions, options) from Excel file. Expected columns: Discipline, Parameter Code, Parameter Name, Parameter Type, Question Category, Question Code, Question Text, Weightage (%), Option 1-5 Text. Weightage must sum to 100% per parameter. All imports are transactional (all-or-nothing).',
        tags: [
            'Assessment Parameters',
            'System Admin - Assessment Parameters',
            'DRDO Admin - Assessment Parameters',
        ],
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: [
                new OA\MediaType(
                    mediaType: 'multipart/form-data',
                    schema: new OA\Schema(
                        required: ['file', 'sector', 'enterprise_size', 'vendor_category_id'],
                        properties: [
                            new OA\Property(
                                property: 'file',
                                type: 'string',
                                format: 'binary',
                                description: 'Excel or CSV file with assessment parameters (max 5MB)',
                            ),
                            new OA\Property(
                                property: 'sector',
                                type: 'string',
                                enum: ['manufacturing', 'service'],
                                description: 'Sector for all parameters in this import',
                            ),
                            new OA\Property(
                                property: 'enterprise_size',
                                type: 'string',
                                enum: ['startup', 'micro', 'small', 'medium', 'large'],
                                description: 'Enterprise size for all parameters in this import',
                            ),
                            new OA\Property(
                                property: 'service_provider_type',
                                type: 'string',
                                enum: ['annual_maintenance_contract', 'critical_service_provider'],
                                nullable: true,
                                description: 'Service provider type (required only if sector is service)',
                            ),
                            new OA\Property(
                                property: 'vendor_category_id',
                                type: 'integer',
                                description: 'DRDO vendor category ID (must exist in manufacturing_vendor_categories or service_vendor_categories based on sector)',
                            ),
                        ],
                    ),
                ),
            ],
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Import completed successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Import completed successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'disciplines',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'created', type: 'integer', example: 2),
                                        new OA\Property(property: 'existing', type: 'integer', example: 1),
                                    ],
                                ),
                                new OA\Property(
                                    property: 'parameters',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'created', type: 'integer', example: 5),
                                        new OA\Property(property: 'updated', type: 'integer', example: 2),
                                    ],
                                ),
                                new OA\Property(
                                    property: 'questions',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'created', type: 'integer', example: 15),
                                        new OA\Property(property: 'updated', type: 'integer', example: 6),
                                    ],
                                ),
                                new OA\Property(
                                    property: 'options',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'created', type: 'integer', example: 105),
                                    ],
                                ),
                            ],
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
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Import failed with validation errors',
                        ),
                        new OA\Property(
                            property: 'errors',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'row', type: 'integer', example: 5),
                                    new OA\Property(
                                        property: 'parameter_code',
                                        type: 'string',
                                        example: 'TECH-002',
                                    ),
                                    new OA\Property(
                                        property: 'errors',
                                        type: 'array',
                                        items: new OA\Items(
                                            type: 'string',
                                            example: 'Weightage sums to 85%, must be 100%',
                                        ),
                                    ),
                                ],
                            ),
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 500, description: 'Internal server error'),
        ],
    )]
    public function bulkImport(BulkImportAssessmentParameterRequest $request, AssessmentParameterImportService $importService): JsonResponse
    {
        try {
            $validated = $request->validated();
            $file = $request->file('file');

            // Perform import with context parameters. enterprise_size and vendor_category_id
            // are arrays (multi-select); the service fans out across every size × category cell.
            $result = $importService->import(
                $file,
                $validated['sector'],
                (array) $validated['enterprise_size'],
                $validated['service_provider_type'] ?? null,
                (array) $validated['vendor_category_id']
            );

            // Check if import was successful
            if ($result['success']) {
                return $this->successResponse($result['data'], $result['message'], 200);
            } else {
                return $this->errorResponse($result['message'], 400, $result['data']['errors'] ?? []);
            }
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to import parameters');
        }
    }

    /**
     * Bulk-update existing parameters from an uploaded file keyed by Parameter ID (code).
     * Full-replace per parameter; identity (sector/size/category) is immutable; all-or-nothing.
     */
    public function bulkUpdate(BulkUpdateAssessmentParameterRequest $request, AssessmentParameterImportService $importService): JsonResponse
    {
        try {
            $validated = $request->validated();

            $result = $importService->bulkUpdate($request->file('file'), $validated['sector']);

            if ($result['success']) {
                return $this->successResponse($result['data'], $result['message'], 200);
            }

            return $this->errorResponse($result['message'], 400, $result['data']['errors'] ?? []);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to bulk update parameters');
        }
    }

    /**
     * Download the Bulk Update template — identical columns to the export (with the Parameter ID
     * column) so an exported file can be edited and re-uploaded interchangeably.
     */
    public function downloadBulkUpdateTemplate(Request $request): StreamedResponse
    {
        $sector = $request->query('sector');
        $filenameSector = in_array($sector, ['manufacturing', 'service'], true) ? $sector.'_' : '';
        $filename = 'assessment_parameters_bulk_update_template_'.$filenameSector.now()->format('Y-m-d').'.csv';

        $csvHeaders = [
            'Parameter ID',
            'Question ID',
            'Discipline',
            'Parameter Name',
            'Parameter Type',
            'Question Category',
            'Question Text',
            'Weightage (%)',
            'Option 1 Text',
            'Option 2 Text',
            'Option 3 Text',
            'Option 4 Text',
            'Option 5 Text',
        ];

        $callback = function () use ($csvHeaders): void {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, $csvHeaders);
            fclose($handle);
        };

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-store, no-cache',
            'Pragma' => 'no-cache',
        ]);
    }

    #[OA\Post(
        path: '/api/v1/assessment-parameters/{id}/activate',
        summary: 'Activate assessment parameter',
        tags: ['Assessment Parameters', 'System Admin - Assessment Parameters'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Assessment parameter activated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Assessment parameter not found'),
            new OA\Response(response: 400, description: 'Assessment parameter is already active'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function activate(int $id): JsonResponse
    {
        try {
            $parameter = AssessmentParameter::findOrFail($id);
            Gate::authorize('changeStatus', $parameter);

            if ($parameter->is_active === true) {
                return $this->errorResponse('Assessment parameter is already active.', 400);
            }

            // Validate that total weightage of active questions equals exactly 100%
            $totalWeightage = $parameter->getActiveQuestionsWeightage();
            $questionsCount = $parameter->questions()->where('is_active', true)->count();

            if ($questionsCount === 0) {
                return $this->errorResponse(
                    'Cannot activate: This parameter has no active questions. Please add and activate questions before activating the parameter.',
                    400
                );
            }

            if ($totalWeightage !== 100) {
                $remaining = 100 - $totalWeightage;
                $message = $totalWeightage < 100
                    ? "Cannot activate: Active questions weightage is {$totalWeightage}%. Please adjust question weightages to reach 100%."
                    : "Cannot activate: Active questions weightage is {$totalWeightage}%, which exceeds 100%. Please adjust question weightages.";

                return $this->errorResponse($message, 400);
            }

            $parameter->update(['is_active' => true]);

            Log::info('Assessment parameter activated', [
                'parameter_id' => $parameter->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($parameter, 'Assessment parameter activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Assessment parameter not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to activate assessment parameter', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'parameter_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate assessment parameter.', 500);
        }
    }

    #[OA\Post(
        path: '/api/v1/assessment-parameters/{id}/deactivate',
        summary: 'Deactivate assessment parameter',
        tags: ['Assessment Parameters', 'System Admin - Assessment Parameters'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Assessment parameter deactivated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Assessment parameter not found'),
            new OA\Response(response: 400, description: 'Assessment parameter is already inactive'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function deactivate(int $id): JsonResponse
    {
        try {
            $parameter = AssessmentParameter::findOrFail($id);
            Gate::authorize('changeStatus', $parameter);

            if ($parameter->is_active === false) {
                return $this->errorResponse('Assessment parameter is already inactive.', 400);
            }

            $parameter->update(['is_active' => false]);

            Log::info('Assessment parameter deactivated', [
                'parameter_id' => $parameter->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($parameter, 'Assessment parameter deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Assessment parameter not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to deactivate assessment parameter', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'parameter_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate assessment parameter.', 500);
        }
    }
}
