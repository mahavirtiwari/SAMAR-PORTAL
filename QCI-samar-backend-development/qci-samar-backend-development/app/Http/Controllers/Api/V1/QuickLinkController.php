<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\QuickLink;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Quick links under the login page picture (Settings → Quick Links). Each
 * opens a web address or downloads an uploaded PDF.
 */
class QuickLinkController extends Controller
{
    private const MAX_FILE_KB = 10240;

    #[OA\Get(
        path: '/api/v1/quick-links',
        operationId: 'listQuickLinks',
        tags: ['Quick Links'],
        summary: 'Active quick links for the login page (public)',
        responses: [new OA\Response(response: 200, description: 'Quick links retrieved successfully')],
    )]
    public function index(): JsonResponse
    {
        $links = QuickLink::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->limit(QuickLink::MAX_ACTIVE)
            ->get()
            ->map(fn (QuickLink $link) => [
                'id' => $link->id,
                'label' => $link->label,
                'href' => $link->href(),
                'is_file' => $link->file_path !== null,
            ])
            ->filter(fn (array $link) => $link['href'] !== null)
            ->values();

        return $this->successResponse($links, 'Quick links retrieved successfully');
    }

    #[OA\Get(
        path: '/api/v1/quick-links/{id}/file',
        operationId: 'downloadQuickLinkFile',
        tags: ['Quick Links'],
        summary: 'Download the PDF of an active quick link (public)',
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'PDF'),
            new OA\Response(response: 404, description: 'No such active link with a file'),
        ],
    )]
    public function file(int $id): StreamedResponse
    {
        $link = QuickLink::query()->where('is_active', true)->find($id);
        if (! $link || ! $link->hasFile()) {
            abort(404);
        }

        return Storage::disk(QuickLink::DISK)->download($link->file_path, $link->file_name ?: 'document.pdf', [
            'Content-Type' => 'application/pdf',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    #[OA\Get(
        path: '/api/v1/admin/quick-links',
        operationId: 'adminListQuickLinks',
        tags: ['Quick Links'],
        summary: 'All quick links with editing details (System Admin)',
        security: [['bearerAuth' => []]],
        responses: [new OA\Response(response: 200, description: 'Quick links retrieved successfully')],
    )]
    public function adminIndex(): JsonResponse
    {
        $links = QuickLink::with('updater:id,first_name,last_name')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (QuickLink $link) => $this->detail($link));

        return $this->successResponse(['links' => $links, 'max_active' => QuickLink::MAX_ACTIVE], 'Quick links retrieved successfully');
    }

    #[OA\Post(
        path: '/api/v1/admin/quick-links',
        operationId: 'createQuickLink',
        tags: ['Quick Links'],
        summary: 'Add a quick link (System Admin)',
        description: 'multipart/form-data: label, and either url (http/https address or a path on this site such as /assets/...) or file (PDF up to 10 MB); optional sortOrder, isActive.',
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 201, description: 'Quick link added'),
            new OA\Response(response: 422, description: 'Validation error'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, null);

        $link = new QuickLink;
        $this->apply($link, $request, $data);

        return $this->successResponse($this->detail($link->fresh('updater')), 'Quick link added', 201);
    }

    #[OA\Post(
        path: '/api/v1/admin/quick-links/{id}',
        operationId: 'updateQuickLink',
        tags: ['Quick Links'],
        summary: 'Change a quick link (System Admin)',
        description: 'multipart/form-data with the same fields as create; a new file replaces the old one, and a url clears the file.',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Quick link updated'),
            new OA\Response(response: 422, description: 'Validation error'),
        ],
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $link = QuickLink::findOrFail($id);
        $data = $this->validated($request, $link);
        $this->apply($link, $request, $data);

        return $this->successResponse($this->detail($link->fresh('updater')), 'Quick link updated');
    }

    #[OA\Delete(
        path: '/api/v1/admin/quick-links/{id}',
        operationId: 'deleteQuickLink',
        tags: ['Quick Links'],
        summary: 'Remove a quick link (System Admin)',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Quick link removed')],
    )]
    public function destroy(int $id): JsonResponse
    {
        $link = QuickLink::findOrFail($id);
        if ($link->file_path) {
            Storage::disk(QuickLink::DISK)->delete($link->file_path);
        }
        $link->delete();

        return $this->successResponse(null, 'Quick link removed');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?QuickLink $link): array
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'url' => ['nullable', 'string', 'max:500', function (string $attribute, mixed $value, Closure $fail) {
                // An http(s) address, or a path on this site (e.g. /assets/document/manual.pdf).
                $isWeb = filter_var($value, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $value);
                $isSitePath = preg_match('#^/(?!/)[A-Za-z0-9._~/%-]*$#', $value);
                if (! $isWeb && ! $isSitePath) {
                    $fail('Enter a web address starting with http:// or https://, or a path on this site starting with /.');
                }
            }],
            'file' => ['nullable', 'file', 'mimes:pdf', 'mimetypes:application/pdf', 'max:'.self::MAX_FILE_KB],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:999'],
            'is_active' => ['nullable', 'boolean'],
        ], [
            'file.max' => 'The PDF must be 10 MB or smaller.',
            'file.mimes' => 'Please upload a PDF file.',
        ]);

        // An edit that leaves the target out keeps the existing address or file.
        $keepsTarget = $link && ($link->file_path || $link->url) && ! $request->exists('url');
        $hasTarget = $request->hasFile('file') || filled($data['url'] ?? null) || $keepsTarget;
        if (! $hasTarget) {
            throw ValidationException::withMessages(['url' => 'Give a web address or upload a PDF.']);
        }

        $willBeActive = array_key_exists('is_active', $data) && $data['is_active'] !== null ? (bool) $data['is_active'] : ($link ? $link->is_active : true);
        if ($willBeActive && ! ($link?->is_active)) {
            $active = QuickLink::where('is_active', true)->count();
            if ($active >= QuickLink::MAX_ACTIVE) {
                throw ValidationException::withMessages(['is_active' => 'At most '.QuickLink::MAX_ACTIVE.' quick links can be shown. Hide one first.']);
            }
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function apply(QuickLink $link, Request $request, array $data): void
    {
        $link->label = trim($data['label']);
        $link->sort_order = $data['sort_order'] ?? ($link->exists ? $link->sort_order : (int) QuickLink::max('sort_order') + 1);
        if (array_key_exists('is_active', $data) && $data['is_active'] !== null) {
            $link->is_active = (bool) $data['is_active'];
        } elseif (! $link->exists) {
            $link->is_active = true;
        }
        $link->updated_by = $request->user()->id;

        $oldFile = $link->file_path;
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $link->file_path = $file->storeAs('quick-links', 'link-'.now()->format('YmdHisv').'.pdf', QuickLink::DISK);
            $link->file_name = mb_substr(preg_replace('/[^\w.\- ]+/u', '_', $file->getClientOriginalName()) ?: 'document.pdf', 0, 200);
            $link->url = null;
        } elseif (filled($data['url'] ?? null)) {
            $link->url = $data['url'];
            $link->file_path = null;
            $link->file_name = null;
        }
        $link->save();

        if ($oldFile && $oldFile !== $link->file_path) {
            Storage::disk(QuickLink::DISK)->delete($oldFile);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function detail(QuickLink $link): array
    {
        return [
            'id' => $link->id,
            'label' => $link->label,
            'url' => $link->url,
            'file_name' => $link->file_name,
            'href' => $link->href(),
            'is_file' => $link->file_path !== null,
            'sort_order' => $link->sort_order,
            'is_active' => $link->is_active,
            'updated_by_name' => $link->updater ? trim($link->updater->first_name.' '.$link->updater->last_name) : null,
            'updated_at' => $link->updated_at,
        ];
    }
}
