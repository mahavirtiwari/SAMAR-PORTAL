<?php

namespace App\Services;

use App\Models\Assessment;
use App\Models\Certificate;
use Barryvdh\Snappy\Facades\SnappyPdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Certificate Service
 *
 * Handles certificate PDF generation, QR codes, and certificate metadata.
 * Uses private storage disk for secure file storage.
 */
class CertificateService
{
    /**
     * The storage disk to use (same as FileStorageService).
     */
    protected const DISK = 'private';

    protected FileStorageService $fileStorageService;

    public function __construct(FileStorageService $fileStorageService)
    {
        $this->fileStorageService = $fileStorageService;
    }

    /**
     * Get the storage disk instance.
     */
    protected function disk()
    {
        return Storage::disk(self::DISK);
    }

    /**
     * Generate certificate PDF content.
     *
     * @return string PDF content
     */
    public function generateCertificatePdf(Certificate $certificate): string
    {
        // Load relationships needed for the certificate
        $certificate->load([
            'application.organization',
            'application.unit',
        ]);

        $application = $certificate->application;

        // Generate QR code for verification
        $qrCode = $this->generateQrCode($certificate->verification_url ?? $this->buildVerificationUrl($certificate));

        // Get rating information (Level 1-5)
        $ratingInfo = $this->calculateRating($certificate->final_score);

        // Validity is locked to what this certificate was issued with — never the current setting.
        $validityYears = $certificate->validity_months
            ? (int) round($certificate->validity_months / 12)
            : 3;

        // Prepare data for the view
        $data = [
            'certificate' => $certificate,
            'application' => $application,
            'qrCode' => $qrCode,
            'ratingInfo' => $ratingInfo,
            'validityYears' => $validityYears,
            'pages' => ['frontPage', 'backPage'],
        ];

        // Generate PDF using SnappyPdf (wkhtmltopdf)
        $pdf = SnappyPdf::loadView('certificates.certificate', $data);

        $pdf->setOption('enable-local-file-access', true);
        $pdf->setOption('page-size', 'A4');
        $pdf->setOption('orientation', 'Portrait');
        $pdf->setOption('margin-top', 0);
        $pdf->setOption('margin-right', 0);
        $pdf->setOption('margin-bottom', 0);
        $pdf->setOption('margin-left', 0);
        $pdf->setOption('image-quality', 94);
        $pdf->setOption('image-dpi', 300);

        return $pdf->output();
    }

    /**
     * Generate QR code as base64 PNG image.
     *
     * @return string Base64 encoded PNG image
     */
    public function generateQrCode(string $verificationUrl): string
    {
        // Generate QR code as SVG (no imagick extension required)
        $qrCodeSvg = QrCode::format('svg')
            ->size(200)
            ->generate($verificationUrl);

        // Convert to base64 for embedding in PDF
        return 'data:image/svg+xml;base64,'.base64_encode($qrCodeSvg);
    }

    /**
     * Calculate rating level based on score.
     *
     * Rating levels:
     * - 0 to 1.5: Level 1
     * - >1.5 to 2.5: Level 2
     * - >2.5 to 3.5: Level 3
     * - >3.5 to 4.5: Level 4
     * - >4.5 to 5.0: Level 5
     *
     * @return array{rating: string, level: int}
     */
    public function calculateRating(?float $score): array
    {
        $level = Assessment::ratingLevelFromScore($score);

        if ($level === null) {
            return [
                'rating' => 'N/A',
                'level' => 0,
            ];
        }

        return [
            'rating' => "Level {$level}",
            'level' => $level,
        ];
    }

    /**
     * Build verification URL for QR code.
     *
     * Format: {frontend_url}/certified-enterprises?certificateNumber={certificate_number}
     * Param MUST be camelCase — the backend ConvertRequestToSnakeCase middleware
     * rejects snake_case keys with HTTP 400, so snake_case in the QR would break
     * the verify call the frontend page makes.
     *
     * @return string Verification URL
     */
    protected function buildVerificationUrl(Certificate $certificate): string
    {
        $baseUrl = config('app.frontend_url', 'http://localhost:3000');

        return "{$baseUrl}/certified-enterprises?certificateNumber={$certificate->certificate_number}";
    }

    /**
     * Generate and store certificate PDF to private storage.
     *
     * Storage path: applications/{application_id}/certificates/{uuid}.pdf
     *
     * @return array ['path' => string, 'filename' => string, 'disk' => string]
     */
    public function generateAndStorePdf(Certificate $certificate): array
    {
        $pdfContent = $this->generateCertificatePdf($certificate);

        // Generate secure filename using UUID (following FileStorageService pattern)
        $secureFilename = Str::uuid().'.pdf';

        // Build path following project pattern: applications/{app_id}/certificates/
        $applicationId = $certificate->application_id;
        $path = FileStorageService::CATEGORY_APPLICATIONS
            ."/{$applicationId}/"
            .FileStorageService::APPLICATION_CERTIFICATES
            ."/{$secureFilename}";

        // Store PDF in private storage
        $this->disk()->put($path, $pdfContent);

        // Update certificate with PDF path and disk
        $certificate->update([
            'certificate_pdf_path' => $path,
        ]);

        return [
            'path' => $path,
            'filename' => $secureFilename,
            'disk' => self::DISK,
        ];
    }

    /**
     * Download certificate PDF from storage.
     *
     * @return StreamedResponse
     */
    public function downloadStoredPdf(Certificate $certificate)
    {
        $path = $certificate->certificate_pdf_path;

        if (! $path || ! $this->fileStorageService->exists($path)) {
            throw new \RuntimeException('Certificate PDF not found in storage.');
        }

        $filename = "certificate-{$certificate->certificate_number}.pdf";

        return $this->fileStorageService->download($path, $filename);
    }

    /**
     * Stream certificate PDF for inline viewing.
     *
     * @return StreamedResponse
     */
    public function streamStoredPdf(Certificate $certificate)
    {
        $path = $certificate->certificate_pdf_path;

        if (! $path || ! $this->fileStorageService->exists($path)) {
            throw new \RuntimeException('Certificate PDF not found in storage.');
        }

        $filename = "certificate-{$certificate->certificate_number}.pdf";

        return $this->fileStorageService->stream($path, $filename);
    }

    /**
     * Delete stored certificate PDF.
     */
    public function deleteStoredPdf(Certificate $certificate): bool
    {
        $path = $certificate->certificate_pdf_path;

        if (! $path) {
            return true;
        }

        $deleted = $this->fileStorageService->delete($path);

        if ($deleted) {
            $certificate->update(['certificate_pdf_path' => null]);
        }

        return $deleted;
    }
}
