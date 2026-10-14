<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Settings\UpdateContentBlockRequest;
use App\Models\ContentBlock;
use App\Support\ContentBlockDefaults;
use App\Support\HtmlSanitizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Content Blocks',
    description: 'Instructions, declarations and disclaimers shown in the portal. Public read; System Admin edit (Settings → Content & Disclaimers).',
)]
class ContentBlockController extends Controller
{
    public function __construct(private HtmlSanitizer $sanitizer) {}

    #[OA\Get(
        path: '/api/v1/content-blocks',
        operationId: 'listContentBlocks',
        tags: ['Content Blocks'],
        summary: 'Get content blocks (public)',
        description: 'Returns the current text of the requested blocks, or of all blocks when no keys are given.',
        parameters: [new OA\Parameter(name: 'keys', in: 'query', required: false, description: 'Comma-separated block keys', schema: new OA\Schema(type: 'string'))],
        responses: [new OA\Response(response: 200, description: 'Content blocks retrieved successfully')],
    )]
    public function index(Request $request): JsonResponse
    {
        $query = ContentBlock::query()->select(['key', 'title', 'format', 'body', 'updated_at']);
        if ($request->filled('keys')) {
            $query->whereIn('key', array_filter(array_map('trim', explode(',', (string) $request->query('keys')))));
        }

        return $this->successResponse($query->orderBy('key')->get(), 'Content blocks retrieved successfully');
    }

    #[OA\Get(
        path: '/api/v1/content-blocks/{key}',
        operationId: 'getContentBlock',
        tags: ['Content Blocks'],
        summary: 'Get one content block (public)',
        parameters: [new OA\Parameter(name: 'key', in: 'path', required: true, schema: new OA\Schema(type: 'string'))],
        responses: [
            new OA\Response(response: 200, description: 'Content block retrieved successfully'),
            new OA\Response(response: 404, description: 'Content block not found'),
        ],
    )]
    public function show(string $key): JsonResponse
    {
        $block = ContentBlock::query()->select(['key', 'title', 'format', 'body', 'updated_at'])->where('key', $key)->first();

        return $block
            ? $this->successResponse($block, 'Content block retrieved successfully')
            : $this->errorResponse('Content block not found', 404);
    }

    #[OA\Get(
        path: '/api/v1/admin/content-blocks',
        operationId: 'adminListContentBlocks',
        tags: ['Content Blocks'],
        summary: 'List content blocks with editing details (System Admin)',
        security: [['bearerAuth' => []]],
        responses: [new OA\Response(response: 200, description: 'Content blocks retrieved successfully')],
    )]
    public function adminIndex(): JsonResponse
    {
        $blocks = ContentBlock::with('updater:id,first_name,last_name')
            ->orderBy('group')
            ->orderBy('title')
            ->get()
            ->map(fn (ContentBlock $b) => $this->detail($b));

        return $this->successResponse($blocks, 'Content blocks retrieved successfully');
    }

    #[OA\Put(
        path: '/api/v1/admin/content-blocks/{key}',
        operationId: 'updateContentBlock',
        tags: ['Content Blocks'],
        summary: 'Update a content block (System Admin)',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'key', in: 'path', required: true, schema: new OA\Schema(type: 'string'))],
        requestBody: new OA\RequestBody(content: new OA\JsonContent(required: ['body'], properties: [
            new OA\Property(property: 'title', type: 'string'),
            new OA\Property(property: 'body', type: 'string'),
        ])),
        responses: [
            new OA\Response(response: 200, description: 'Content block updated successfully'),
            new OA\Response(response: 404, description: 'Content block not found'),
            new OA\Response(response: 422, description: 'Validation error'),
        ],
    )]
    public function update(UpdateContentBlockRequest $request, string $key): JsonResponse
    {
        $block = ContentBlock::where('key', $key)->firstOrFail();
        $data = $request->validated();

        $body = $block->format === 'html'
            ? $this->sanitizer->clean($data['body'])
            : trim(strip_tags($data['body']));
        if ($body === '') {
            return $this->errorResponse('Validation failed.', 422, ['body' => ['The content cannot be empty.']]);
        }

        $block->fill([
            'title' => $data['title'] ?? $block->title,
            'body' => $body,
            'updated_by' => $request->user()->id,
        ])->save();

        return $this->successResponse($this->detail($block->fresh('updater')), 'Content block updated successfully');
    }

    #[OA\Post(
        path: '/api/v1/admin/content-blocks/{key}/reset',
        operationId: 'resetContentBlock',
        tags: ['Content Blocks'],
        summary: 'Restore a content block to its original text (System Admin)',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'key', in: 'path', required: true, schema: new OA\Schema(type: 'string'))],
        responses: [new OA\Response(response: 200, description: 'Content block reset to default')],
    )]
    public function reset(Request $request, string $key): JsonResponse
    {
        $block = ContentBlock::where('key', $key)->firstOrFail();
        $default = ContentBlockDefaults::find($key);
        if ($default === null) {
            return $this->errorResponse('This content block has no built-in default.', 422);
        }

        $block->fill([
            'title' => $default['title'],
            'body' => $default['body'],
            'updated_by' => $request->user()->id,
        ])->save();

        return $this->successResponse($this->detail($block->fresh('updater')), 'Content block reset to default');
    }

    private function detail(ContentBlock $block): array
    {
        return [
            'key' => $block->key,
            'group' => $block->group,
            'title' => $block->title,
            'description' => $block->description,
            'format' => $block->format,
            'body' => $block->body,
            'is_default' => $block->isDefault(),
            'updated_by_name' => $block->updater ? trim($block->updater->first_name.' '.$block->updater->last_name) : null,
            'updated_at' => $block->updated_at,
        ];
    }
}
