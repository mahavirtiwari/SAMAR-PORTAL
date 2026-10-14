<?php

namespace Tests\Feature;

use App\Services\FileStorageService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * ?size=thumb serves a small JPEG instead of the original photo, and with
 * X-Accel-Redirect on, nginx sends the file instead of PHP.
 */
class ImageStreamingTest extends TestCase
{
    private function putImage(string $path, int $width, int $height): void
    {
        Storage::disk('private')->put($path, UploadedFile::fake()->image('photo.jpg', $width, $height)->getContent());
    }

    private function streamAs(string $query, string $path)
    {
        $this->app->instance('request', Request::create('/download'.$query));

        return app(FileStorageService::class)->stream($path, 'photo.jpg');
    }

    public function test_a_thumbnail_is_a_small_jpeg_and_is_reused(): void
    {
        Storage::fake('private');
        $this->putImage('assessments/1/site-pictures/big.jpg', 2400, 1600);
        $service = app(FileStorageService::class);

        $thumb = $service->thumbnailFor('assessments/1/site-pictures/big.jpg');

        $this->assertNotNull($thumb);
        [$width, $height] = getimagesizefromstring(Storage::disk('private')->get($thumb));
        $this->assertSame(FileStorageService::THUMBNAIL_MAX_SIZE, max($width, $height));
        $this->assertSame($thumb, $service->thumbnailFor('assessments/1/site-pictures/big.jpg'));
    }

    public function test_non_images_have_no_thumbnail_and_stream_unchanged(): void
    {
        Storage::fake('private');
        Storage::disk('private')->put('documents/report.pdf', '%PDF-1.4 test');

        $this->assertNull(app(FileStorageService::class)->thumbnailFor('documents/report.pdf'));
        $this->assertSame('inline; filename="photo.jpg"', $this->streamAs('?size=thumb', 'documents/report.pdf')->headers->get('Content-Disposition'));
    }

    public function test_x_accel_redirect_hands_the_file_to_nginx(): void
    {
        config(['filesystems.x_accel_redirect' => true]);
        $path = 'testing-x-accel/'.uniqid().'/a photo.jpg';
        $this->putImage($path, 100, 100);

        try {
            $response = $this->streamAs('', $path);

            $this->assertSame('/_protected_files/'.str_replace(' ', '%20', $path), $response->headers->get('X-Accel-Redirect'));
            $this->assertSame('', (string) $response->getContent());
        } finally {
            Storage::disk('private')->deleteDirectory(dirname($path));
            Storage::disk('private')->deleteDirectory('testing-x-accel');
        }
    }
}
