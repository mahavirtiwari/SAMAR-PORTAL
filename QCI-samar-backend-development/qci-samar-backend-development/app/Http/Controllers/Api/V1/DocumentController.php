<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\DocumentListRequest;
use App\Http\Requests\Api\V1\UploadDocumentRequest;
use App\Http\Resources\DocumentResource;
use App\Models\Document;
use App\Services\DocumentService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Documents', description: 'Document management endpoints')]
class DocumentController extends Controller
{
    protected DocumentService $documentService;

    public function __construct(DocumentService $documentService)
    {
        $this->documentService = $documentService;
    }

    /**
     * List documents with pagination and filtering.
     */
    #[OA\Get(
        path: '/api/v1/documents',
        summary: 'List documents',
        description: 'Retrieves a paginated list of documents with optional filtering and sorting. Admins see all documents, other users see only their own.',
        tags: ['Documents', 'System Admin - Documents'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by title, name, or original filename',
                required: false,
                schema: new OA\Schema(type: 'string', minLength: 2, maxLength: 100, example: 'contract'),
            ),
            new OA\Parameter(
                name: 'mimeType',
                in: 'query',
                description: 'Filter by MIME type',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'application/pdf'),
            ),
            new OA\Parameter(
                name: 'extension',
                in: 'query',
                description: 'Filter by file extension',
                required: false,
                schema: new OA\Schema(type: 'string', example: 'pdf'),
            ),
            new OA\Parameter(
                name: 'isActive',
                in: 'query',
                description: 'Filter by active status',
                required: false,
                schema: new OA\Schema(type: 'boolean'),
            ),
            new OA\Parameter(
                name: 'sortBy',
                in: 'query',
                description: 'Sort by field',
                required: false,
                schema: new OA\Schema(
                    type: 'string',
                    enum: ['created_at', 'size', 'original_filename'],
                    default: 'created_at',
                ),
            ),
            new OA\Parameter(
                name: 'sortOrder',
                in: 'query',
                description: 'Sort order',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'desc'),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Number of items per page',
                required: false,
                schema: new OA\Schema(type: 'integer', minimum: 5, maximum: 100, default: 15),
            ),
            new OA\Parameter(
                name: 'page',
                in: 'query',
                description: 'Page number',
                required: false,
                schema: new OA\Schema(type: 'integer', minimum: 1, default: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Documents retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Documents retrieved successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'id', type: 'string', format: 'uuid'),
                                    new OA\Property(
                                        property: 'title',
                                        type: 'string',
                                        example: 'Project Contract Document',
                                    ),
                                    new OA\Property(property: 'name', type: 'string', example: 'document.pdf'),
                                    new OA\Property(
                                        property: 'original_filename',
                                        type: 'string',
                                        example: 'original.pdf',
                                    ),
                                    new OA\Property(
                                        property: 'mime_type',
                                        type: 'string',
                                        example: 'application/pdf',
                                    ),
                                    new OA\Property(property: 'size', type: 'integer', example: 1024000),
                                    new OA\Property(property: 'is_active', type: 'boolean', example: true),
                                    new OA\Property(property: 'size_human', type: 'string', example: '1.00 MB'),
                                    new OA\Property(property: 'extension', type: 'string', example: 'pdf'),
                                    new OA\Property(
                                        property: 'uploaded_by',
                                        type: 'object',
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer', example: 1),
                                            new OA\Property(property: 'name', type: 'string', example: 'John Doe'),
                                            new OA\Property(
                                                property: 'email',
                                                type: 'string',
                                                example: 'john@example.com',
                                            ),
                                        ],
                                    ),
                                    new OA\Property(property: 'uploaded_at', type: 'string', format: 'date-time'),
                                ],
                            ),
                        ),
                        new OA\Property(
                            property: 'pagination',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'total', type: 'integer', example: 100),
                                new OA\Property(property: 'per_page', type: 'integer', example: 15),
                                new OA\Property(property: 'current_page', type: 'integer', example: 1),
                                new OA\Property(property: 'last_page', type: 'integer', example: 7),
                                new OA\Property(property: 'from', type: 'integer', example: 1),
                                new OA\Property(property: 'to', type: 'integer', example: 15),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Forbidden',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'This action is unauthorized.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 400,
                description: 'Validation failed',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation failed.'),
                        new OA\Property(
                            property: 'errors',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'search',
                                    type: 'array',
                                    items: new OA\Items(
                                        type: 'string',
                                        example: 'Search term must be at least 2 characters.',
                                    ),
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 500,
                description: 'Server error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Failed to retrieve documents.',
                        ),
                    ],
                ),
            ),
        ],
    )]
    public function index(DocumentListRequest $request): JsonResponse
    {
        // Outside the try: the sole catch below is \Exception, which would turn a
        // denied request into a 500 "Failed to..." instead of a 403.
        Gate::authorize('viewAny', Document::class);

        try {
            $user = $request->user();
            $query = Document::with('uploader');

            // Role-based filtering: Admins see all, others see only their own
            // $isAdmin = $user->hasAnyRole([
            //     Role::SYSTEM_ADMIN,
            //     Role::OPERATIONS_ADMIN,
            //     Role::OPERATIONS_MANAGER,
            //     Role::DRDO_ADMIN,
            // ]);

            // if (!$isAdmin) {
            //     $query->where('uploaded_by', $user->id);
            // }

            // Apply search filter
            if ($request->filled('search')) {
                $search = trim($request->input('search'));
                // Escape LIKE wildcards to prevent SQL injection
                $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
                $query->where(function ($q) use ($search) {
                    $q->where('title', 'LIKE', "%{$search}%")
                        ->orWhere('name', 'LIKE', "%{$search}%")
                        ->orWhere('original_filename', 'LIKE', "%{$search}%");
                });
            }

            // Apply mime_type filter
            if ($request->filled('mime_type')) {
                $query->where('mime_type', $request->input('mime_type'));
            }

            // Apply extension filter
            if ($request->filled('extension')) {
                $query->where('extension', $request->input('extension'));
            }

            // Apply active status filter
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            // Apply sorting
            $sortBy = $request->input('sort_by', 'created_at');
            $sortOrder = $request->input('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            // Paginate results
            $perPage = $this->resolvePerPage($request, 15);
            $documents = $query->paginate($perPage);

            return $this->paginatedResponse(
                DocumentResource::collection($documents),
                'Documents retrieved successfully'
            );
        } catch (\Exception $e) {
            Log::error('Failed to retrieve documents', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to retrieve documents', 500);
        }
    }

    /**
     * Upload a document.
     */
    #[OA\Post(
        path: '/api/v1/documents',
        summary: 'Upload a document',
        tags: [
            'Document',
            'System Admin - Document',
            'DRDO Admin - Document',
            'Operations Manager - Document',
            'Operations Admin - Document',
            'Assessor - Document',
            'Unit Admin - Document',
            'Enterprise Admin - Document',
        ],
        security: [['bearerAuth' => []]],
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
                                description: 'File to upload (Maximum size: 50 MB. Allowed types: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, ZIP)',
                            ),
                            new OA\Property(
                                property: 'title',
                                type: 'string',
                                example: 'Project Plan',
                                description: 'Optional title for the document',
                            ),
                            new OA\Property(
                                property: 'name',
                                type: 'string',
                                example: 'project_plan.pdf',
                                description: 'Optional client-specified name for the document',
                            ),
                            new OA\Property(
                                property: 'is_active',
                                type: 'boolean',
                                example: true,
                                description: 'Active status (defaults to true)',
                            ),
                        ],
                    ),
                ),
            ],
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Document uploaded successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Document uploaded successfully',
                        ),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(property: 'uuid', type: 'string', format: 'uuid'),
                                new OA\Property(property: 'title', type: 'string', example: 'Project Plan'),
                                new OA\Property(property: 'name', type: 'string', example: 'project_plan.pdf'),
                                new OA\Property(
                                    property: 'original_filename',
                                    type: 'string',
                                    example: 'project_plan_original.pdf',
                                ),
                                new OA\Property(
                                    property: 'file_path',
                                    type: 'string',
                                    example: 'documents/2025/11/project_plan.pdf',
                                ),
                                new OA\Property(property: 'disk', type: 'string', example: 'private'),
                                new OA\Property(property: 'mime_type', type: 'string', example: 'application/pdf'),
                                new OA\Property(property: 'size', type: 'integer', example: 1024000),
                                new OA\Property(property: 'extension', type: 'string', example: 'pdf'),
                                new OA\Property(property: 'is_active', type: 'boolean', example: true),
                                new OA\Property(property: 'uploaded_by', type: 'integer', example: 1),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Invalid file or validation error'),
            new OA\Response(response: 401, description: 'Unauthorized'),
        ],
    )]
    public function store(UploadDocumentRequest $request): JsonResponse
    {
        // Outside the try, same reason as index().
        Gate::authorize('create', Document::class);

        try {
            $metadata = [
                'title' => $request->input('title'),
                'name' => $request->input('name'),
                'is_active' => $request->input('is_active', true),
            ];

            $document = $this->documentService->upload(
                $request->file('file'),
                $metadata,
                $request->user()
            );

            return $this->successResponse(
                new DocumentResource($document),
                'Document uploaded successfully',
                201
            );
        } catch (\Exception $e) {
            Log::error('Document upload failed', [
                'error' => $e->getMessage(),
                'user_id' => $request->user()->id,
            ]);

            return $this->serverErrorResponse($e, 'Failed to upload document', 400);
        }
    }

    /**
     * Download or view a document.
     */
    #[OA\Get(
        path: '/api/v1/documents/{uuid}',
        summary: 'View or download a document',
        description: 'Serves document inline by default (viewable in browser). Use ?download=true to force download.',
        tags: ['Documents'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'uuid',
                in: 'path',
                required: true,
                description: 'Document UUID',
                schema: new OA\Schema(type: 'string', format: 'uuid'),
            ),
            new OA\Parameter(
                name: 'download',
                in: 'query',
                required: false,
                description: 'Set to true to force download instead of inline view',
                schema: new OA\Schema(type: 'boolean', default: false, example: true),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Document file stream',
                content: [
                    new OA\MediaType(mediaType: 'application/octet-stream'),
                ],
            ),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Document not found'),
        ],
    )]
    public function show(Request $request, Document $document)
    {
        // Same gap as download(): route-model-bound, auth-only middleware, and no
        // policy call. Metadata for any document was readable by any signed-in user.
        // Deliberately OUTSIDE the try: the catch below turns everything into a 500,
        // which would report a denied request as a server fault.
        Gate::authorize('view', $document);

        try {
            // Check if document file exists
            if (! $document->exists()) {
                return $this->errorResponse('Document file not found', 404);
            }

            // Log document access
            Log::info('Document accessed', [
                'document_id' => $document->id,
                'uuid' => $document->uuid,
                'user_id' => $request->user()->id,
            ]);

            // Check if download parameter is present
            $download = $request->query('download', false);

            // Get file path and validate existence
            $storage = Storage::disk($document->disk);
            $filePath = $storage->path($document->file_path);

            if (! file_exists($filePath)) {
                return $this->errorResponse('Document file not found in storage', 404);
            }

            // If download parameter is true, force download
            if ($download) {
                return response()->download($filePath, $document->original_filename);
            }

            // Otherwise, serve inline (viewable in browser)
            $mimeType = $document->mime_type ?: mime_content_type($filePath) ?: 'application/octet-stream';
            $fileSize = filesize($filePath);

            $stream = fopen($filePath, 'rb');

            return response()->stream(function () use ($stream) {
                fpassthru($stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }, 200, [
                'Content-Type' => $mimeType,
                'Content-Length' => $fileSize,
                'Content-Disposition' => 'inline; filename="'.basename($document->original_filename).'"',
                'Cache-Control' => 'public, max-age=3600',
            ]);
        } catch (\Exception $e) {
            Log::error('Document serve failed', [
                'document_id' => $document->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->serverErrorResponse($e, 'Failed to serve document');
        }
    }

    /**
     * Force-download a document.
     *
     * Backs the api.v1.documents.download route, which Document::download_url
     * points every API consumer at. Without this method the route resolved to
     * nothing and returned a 500.
     */
    public function download(Request $request, Document $document)
    {
        // Without this the route was an IDOR: the model is route-bound and the group
        // only requires authentication, so ANY signed-in user could pull any document
        // by guessing an id. DocumentPolicy::download already existed and was simply
        // never called. Outside the try so a denial renders 403, not a 500.
        Gate::authorize('download', $document);

        try {
            if (! $document->exists()) {
                return $this->errorResponse('Document file not found', 404);
            }

            $filePath = Storage::disk($document->disk)->path($document->file_path);

            if (! file_exists($filePath)) {
                return $this->errorResponse('Document file not found in storage', 404);
            }

            Log::info('Document downloaded', [
                'document_id' => $document->id,
                'uuid' => $document->uuid,
                'user_id' => $request->user()->id,
            ]);

            return response()->download($filePath, $document->original_filename);
        } catch (\Exception $e) {
            Log::error('Document download failed', [
                'document_id' => $document->id,
                'error' => $e->getMessage(),
            ]);

            return $this->serverErrorResponse($e, 'Failed to download document');
        }
    }

    /**
     * Activate a document (set is_active = true).
     */
    #[OA\Post(
        path: '/api/v1/documents/{id}/activate',
        summary: 'Activate a document',
        tags: [
            'Document',
            'System Admin - Document',
            'DRDO Admin - Document',
            'Operations Manager - Document',
            'Operations Admin - Document',
            'Assessor - Document',
            'Unit Admin - Document',
            'Enterprise Admin - Document',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Document ID or UUID',
                schema: new OA\Schema(type: 'string'),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Document activated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Document not found'),
        ],
    )]
    public function activate(Request $request, $id): JsonResponse
    {
        try {
            $document = Document::find($id) ?? Document::where('uuid', $id)->firstOrFail();

            Gate::authorize('changeStatus', $document);

            if ($document->is_active) {
                return $this->errorResponse('Document is already active.', 400);
            }

            $document->update(['is_active' => true]);

            Log::info('Document activated', [
                'document_id' => $document->id,
                'activated_by' => $request->user()?->id,
            ]);

            return $this->successResponse(new DocumentResource($document->fresh()), 'Document activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Document not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to activate document', [
                'id' => $id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Failed to activate document.', 500);
        }
    }

    /**
     * Deactivate a document (set is_active = false).
     */
    #[OA\Post(
        path: '/api/v1/documents/{id}/deactivate',
        summary: 'Deactivate a document',
        tags: [
            'Document',
            'System Admin - Document',
            'DRDO Admin - Document',
            'Operations Manager - Document',
            'Operations Admin - Document',
            'Assessor - Document',
            'Unit Admin - Document',
            'Enterprise Admin - Document',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                required: true,
                description: 'Document ID or UUID',
                schema: new OA\Schema(type: 'string'),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Document deactivated successfully'),
            new OA\Response(response: 401, description: 'Unauthorized'),
            new OA\Response(response: 403, description: 'Forbidden'),
            new OA\Response(response: 404, description: 'Document not found'),
        ],
    )]
    public function deactivate(Request $request, $id): JsonResponse
    {
        try {
            $document = Document::find($id) ?? Document::where('uuid', $id)->firstOrFail();

            Gate::authorize('changeStatus', $document);

            if (! $document->is_active) {
                return $this->errorResponse('Document is already inactive.', 400);
            }

            $document->update(['is_active' => false]);

            Log::info('Document deactivated', [
                'document_id' => $document->id,
                'deactivated_by' => $request->user()?->id,
            ]);

            return $this->successResponse(new DocumentResource($document->fresh()), 'Document deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Document not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to deactivate document', [
                'id' => $id,
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('Failed to deactivate document.', 500);
        }
    }
}
