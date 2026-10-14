<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BrandAsset;
use App\Support\BrandAssetDefaults;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\Response;

#[OA\Tag(
    name: 'Branding',
    description: 'Replaceable logos and their links. Public read; System Admin edit (Settings → Branding & Logos).',
)]
class BrandAssetController extends Controller
{
    #[OA\Get(
        path: '/api/v1/branding',
        operationId: 'listBranding',
        tags: ['Branding'],
        summary: 'Get the logos and their links (public)',
        description: 'image is a data: URI of the uploaded logo, or null to use the built-in one.',
        responses: [new OA\Response(response: 200, description: 'Branding retrieved successfully')],
    )]
    public function index(): JsonResponse
    {
        $assets = collect(BrandAsset::allByKey())->map(fn (BrandAsset $a) => [
            'key' => $a->key,
            'title' => $a->title,
            'link_url' => $a->link_url,
            'image' => $a->dataUri(),
            'updated_at' => $a->updated_at,
        ])->values();

        return $this->successResponse($assets, 'Branding retrieved successfully');
    }

    #[OA\Get(
        path: '/api/v1/branding/{key}/image',
        operationId: 'getBrandingImage',
        tags: ['Branding'],
        summary: 'The uploaded logo image (public; used by emails)',
        parameters: [new OA\Parameter(name: 'key', in: 'path', required: true, schema: new OA\Schema(type: 'string'))],
        responses: [
            new OA\Response(response: 200, description: 'Image'),
            new OA\Response(response: 404, description: 'No uploaded image for this logo'),
        ],
    )]
    public function image(string $key): Response
    {
        $asset = BrandAsset::allByKey()[$key] ?? null;
        if (! $asset || ! $asset->hasCustomImage()) {
            abort(404);
        }

        return response(Storage::disk(BrandAsset::DISK)->get($asset->file_path), 200, [
            'Content-Type' => $asset->mime_type,
            'Cache-Control' => 'public, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    #[OA\Get(
        path: '/api/v1/admin/branding',
        operationId: 'adminListBranding',
        tags: ['Branding'],
        summary: 'List logos with editing details (System Admin)',
        security: [['bearerAuth' => []]],
        responses: [new OA\Response(response: 200, description: 'Branding retrieved successfully')],
    )]
    public function adminIndex(): JsonResponse
    {
        $assets = BrandAsset::with('updater:id,first_name,last_name')->orderBy('id')->get()->map(fn (BrandAsset $a) => $this->detail($a));

        return $this->successResponse($assets, 'Branding retrieved successfully');
    }

    #[OA\Post(
        path: '/api/v1/admin/branding/{key}',
        operationId: 'updateBranding',
        tags: ['Branding'],
        summary: 'Replace a logo and/or change its link (System Admin)',
        description: 'multipart/form-data: image (PNG or JPG, up to 1 MB) and/or linkUrl (http/https; empty removes the link).',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'key', in: 'path', required: true, schema: new OA\Schema(type: 'string'))],
        responses: [
            new OA\Response(response: 200, description: 'Logo updated successfully'),
            new OA\Response(response: 422, description: 'Validation error'),
        ],
    )]
    public function update(Request $request, string $key): JsonResponse
    {
        $asset = BrandAsset::where('key', $key)->firstOrFail();
        $request->validate([
            'image' => ['nullable', 'file', 'mimes:png,jpg,jpeg', 'mimetypes:image/png,image/jpeg', 'max:1024', 'dimensions:min_width=16,min_height=16,max_width=4000,max_height=4000'],
            'link_url' => ['nullable', 'string', 'max:500', 'url:http,https'],
        ]);

        $changes = ['updated_by' => $request->user()->id];
        if ($request->has('link_url')) {
            $changes['link_url'] = $request->input('link_url') ?: null;
        }
        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $path = $file->storeAs('branding', $key.'-'.now()->format('YmdHis').'.'.$file->guessExtension(), BrandAsset::DISK);
            $old = $asset->file_path;
            $changes['file_path'] = $path;
            $changes['mime_type'] = $file->getMimeType();
            if ($old && $old !== $path) {
                Storage::disk(BrandAsset::DISK)->delete($old);
            }
        }

        $asset->fill($changes)->save();

        return $this->successResponse($this->detail($asset->fresh('updater')), 'Logo updated successfully');
    }

    #[OA\Post(
        path: '/api/v1/admin/branding/{key}/reset',
        operationId: 'resetBranding',
        tags: ['Branding'],
        summary: 'Restore the built-in logo and default link (System Admin)',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'key', in: 'path', required: true, schema: new OA\Schema(type: 'string'))],
        responses: [new OA\Response(response: 200, description: 'Logo reset to default')],
    )]
    public function reset(Request $request, string $key): JsonResponse
    {
        $asset = BrandAsset::where('key', $key)->firstOrFail();
        if ($asset->file_path) {
            Storage::disk(BrandAsset::DISK)->delete($asset->file_path);
        }
        $asset->fill([
            'file_path' => null,
            'mime_type' => null,
            'link_url' => BrandAssetDefaults::find($key)['link_url'] ?? null,
            'updated_by' => $request->user()->id,
        ])->save();

        return $this->successResponse($this->detail($asset->fresh('updater')), 'Logo reset to default');
    }

    private function detail(BrandAsset $asset): array
    {
        $default = BrandAssetDefaults::find($asset->key);

        return [
            'key' => $asset->key,
            'title' => $asset->title,
            'description' => $asset->description,
            'link_url' => $asset->link_url,
            'default_link_url' => $default['link_url'] ?? null,
            'image' => $asset->dataUri(),
            'is_custom' => $asset->hasCustomImage(),
            'updated_by_name' => $asset->updater ? trim($asset->updater->first_name.' '.$asset->updater->last_name) : null,
            'updated_at' => $asset->updated_at,
        ];
    }
}
