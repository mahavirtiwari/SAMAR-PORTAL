<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Assessment;
use App\Models\Certificate;
use App\Models\Role;
use App\Services\CertificateService;
use App\Services\StateFilterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

/**
 * @OA\Tag(
 *     name="Certificates",
 *     description="Certificate management endpoints - Issue, approve, suspend, revoke, and verify certificates"
 * )
 */
class CertificateController extends Controller
{
    /**
     * Constructor to inject services.
     */
    public function __construct(
        private StateFilterService $stateFilterService
    ) {}

    /**
     * Get all certificates.
     *
     * @OA\Get(
     *     path="/api/v1/certificates",
     *     summary="Get all certificates",
     *     description="Retrieves a paginated list of certificates. System admins see all certificates, while enterprise/unit admins only see certificates from their organization.",
     *     tags={"Certificate", "System Admin - Certificate", "DRDO Admin - Certificate", "Operations Manager - Certificate", "Operations Admin - Certificate", "Enterprise Admin - Certificate"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="applicationId",
     *         in="query",
     *         description="Filter by application ID",
     *         required=false,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         description="Filter by certificate status",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"draft", "active", "suspended", "revoked", "expired"}, example="active")
     *     ),
     *
     *     @OA\Parameter(
     *         name="certificateType",
     *         in="query",
     *         description="Filter by certificate type",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"initial", "renewal", "upgrade", "surveillance"}, example="initial")
     *     ),
     *
     *     @OA\Parameter(
     *         name="q",
     *         in="query",
     *         description="Search by certificate number",
     *         required=false,
     *
     *         @OA\Schema(type="string", example="CERT-I-2024")
     *     ),
     *
     *     @OA\Parameter(
     *         name="perPage",
     *         in="query",
     *         description="Number of items per page",
     *         required=false,
     *
     *         @OA\Schema(type="integer", example=15, default=15)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Certificates retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="certificates", type="array", @OA\Items(
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="certificate_number", type="string", example="CERT-I-2024-000001"),
     *                     @OA\Property(property="certificate_type", type="string", example="initial"),
     *                     @OA\Property(property="status", type="string", example="active"),
     *                     @OA\Property(property="valid_from", type="string", format="date", example="2024-01-01"),
     *                     @OA\Property(property="valid_until", type="string", format="date", example="2027-01-01"),
     *                     @OA\Property(property="is_valid", type="boolean", example=true),
     *                     @OA\Property(property="created_at", type="string", format="date-time", example="2024-01-01T10:00:00Z")
     *                 )),
     *                 @OA\Property(property="pagination", type="object",
     *                     @OA\Property(property="total", type="integer", example=50),
     *                     @OA\Property(property="per_page", type="integer", example=15),
     *                     @OA\Property(property="current_page", type="integer", example=1),
     *                     @OA\Property(property="last_page", type="integer", example=4)
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Assessors and DRDO Lab users cannot view certificates
        if ($user->hasAnyRole([Role::ASSESSOR, Role::DRDO_LAB])) {
            return $this->errorResponse('Unauthorized to view certificates.', 403);
        }

        $query = Certificate::with([
            'application.organization',
            'application.assessment' => function ($q) {
                $q->where('status', Assessment::STATUS_CERTIFIED);
            },
            'issuedBy',
            'approvedBy',
        ]);

        // Scope by organization (and unit, for unit admins) via parent application
        if (! $user->hasAnyRole([Role::SYSTEM_ADMIN, Role::DRDO_ADMIN, Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN])) {
            if ($user->hasRole(Role::UNIT_ADMIN)) {
                $userUnitIds = $user->assignedUnitIds();
                $query->whereHas('application', function ($q) use ($user, $userUnitIds) {
                    $q->where('organization_id', $user->organization_id)
                        ->whereIn('unit_id', $userUnitIds);
                });
            } else {
                $query->whereHas('application', function ($q) use ($user) {
                    $q->where('organization_id', $user->organization_id);
                });
            }
        }

        // Apply state-based filtering for Operations Manager
        $this->stateFilterService->applyToCertificateQuery($query, $user);

        // Apply filters
        if ($request->has('application_id')) {
            $query->where('application_id', $request->application_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('certificate_type')) {
            $query->where('certificate_type', $request->certificate_type);
        }

        // Search by certificate number
        if ($request->has('q')) {
            $query->where('certificate_number', 'like', '%'.$request->q.'%');
        }

        $perPage = $this->resolvePerPage($request, 15);
        $certificates = $query->latest()->paginate($perPage);

        // Transform certificates data
        $transformedData = $certificates->setCollection(
            $certificates->map(fn ($cert) => $this->formatCertificate($cert))
        );

        return $this->paginatedResponse($transformedData, 'Certificates retrieved successfully');
    }

    /**
     * Get a single certificate.
     *
     * @OA\Get(
     *     path="/api/v1/certificates/{id}",
     *     summary="Get certificate details",
     *     description="Retrieves detailed information about a specific certificate including application, organization, and approval information.",
     *     tags={"Certificate", "System Admin - Certificate", "DRDO Admin - Certificate", "Operations Manager - Certificate", "Operations Admin - Certificate", "Enterprise Admin - Certificate"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Certificate ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Certificate retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="certificate", type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="certificate_number", type="string", example="CERT-I-2024-000001"),
     *                     @OA\Property(property="certificate_type", type="string", example="initial"),
     *                     @OA\Property(property="status", type="string", example="active"),
     *                     @OA\Property(property="valid_from", type="string", format="date", example="2024-01-01"),
     *                     @OA\Property(property="valid_until", type="string", format="date", example="2027-01-01"),
     *                     @OA\Property(property="is_valid", type="boolean", example=true),
     *                     @OA\Property(property="scope_of_certification", type="string", example="Manufacturing of electronic components"),
     *                     @OA\Property(property="standards_covered", type="array", @OA\Items(type="string")),
     *                     @OA\Property(property="special_conditions", type="string", nullable=true),
     *                     @OA\Property(property="application", type="object",
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="application_number", type="string", example="APP-2024-0001"),
     *                         @OA\Property(property="organization", type="object",
     *                             @OA\Property(property="id", type="integer", example=1),
     *                             @OA\Property(property="name", type="string", example="Tech Corp Ltd")
     *                         )
     *                     ),
     *                     @OA\Property(property="issued_by", type="object",
     *                         @OA\Property(property="id", type="integer", example=2),
     *                         @OA\Property(property="name", type="string", example="John Doe")
     *                     ),
     *                     @OA\Property(property="approved_by", type="object", nullable=true,
     *                         @OA\Property(property="id", type="integer", example=3),
     *                         @OA\Property(property="name", type="string", example="Jane Smith")
     *                     ),
     *                     @OA\Property(property="approved_at", type="string", format="date-time", nullable=true),
     *                     @OA\Property(property="created_at", type="string", format="date-time", example="2024-01-01T10:00:00Z")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Unauthorized to view this certificate",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Unauthorized to view this certificate.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Certificate not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="No query results for model [App\\Models\\Certificate].")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     )
     * )
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $certificate = Certificate::with([
            'application.organization',
            'application.assessment' => function ($q) {
                $q->where('status', Assessment::STATUS_CERTIFIED);
            },
            'issuedBy',
            'approvedBy',
            'revokedBy',
        ])->find($id);

        if (! $certificate) {
            return $this->errorResponse('Certificate not found.', 404);
        }

        $user = $request->user();

        // Check authorization
        if (! $user->hasAnyRole([Role::SYSTEM_ADMIN, Role::DRDO_ADMIN, Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN])) {
            if ($certificate->application->organization_id !== $user->organization_id) {
                return $this->errorResponse('Unauthorized to view this certificate.', 403);
            }
        }

        return $this->successResponse(
            ['certificate' => $this->formatCertificate($certificate, true)],
            'Certificate retrieved successfully'
        );
    }

    /**
     * Verify certificate authenticity.
     *
     * @OA\Post(
     *     path="/api/verify-certificate",
     *     summary="Verify certificate authenticity (POST)",
     *     description="Verifies the authenticity of a certificate by its certificate number. Public endpoint, no auth required.",
     *     tags={"Certificates"},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"certificate_number"},
     *
     *             @OA\Property(property="certificate_number", type="string", example="CERT-I-2024-000001")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Certificate verification result",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="valid", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="certificate_number", type="string", example="CERT-I-2024-000001"),
     *                 @OA\Property(property="organization_name", type="string", example="Tech Corp Ltd"),
     *                 @OA\Property(property="status", type="string", example="active"),
     *                 @OA\Property(property="valid_from", type="string", format="date", example="2024-01-01"),
     *                 @OA\Property(property="valid_until", type="string", format="date", example="2027-01-01"),
     *                 @OA\Property(property="scope", type="string", example="Manufacturing of electronic components")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Certificate not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Certificate not found."),
     *             @OA\Property(property="valid", type="boolean", example=false)
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Validation failed",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed."),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     )
     * )
     *
     * @OA\Get(
     *     path="/api/verify-certificate",
     *     summary="Verify certificate authenticity (GET, QR-friendly)",
     *     description="GET variant for QR-code deep links. Public endpoint, no auth required.",
     *     tags={"Certificates"},
     *
     *     @OA\Parameter(
     *         name="certificate_number",
     *         in="query",
     *         required=true,
     *         description="Certificate number printed on the certificate / encoded in the QR",
     *
     *         @OA\Schema(type="string", example="CERT-I-2024-000001")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Certificate verification result",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="valid", type="boolean", example=true),
     *             @OA\Property(property="certificate_number", type="string", example="CERT-I-2024-000001"),
     *             @OA\Property(property="organization_name", type="string", example="Tech Corp Ltd"),
     *             @OA\Property(property="status", type="string", example="active"),
     *             @OA\Property(property="valid_from", type="string", format="date", example="2024-01-01"),
     *             @OA\Property(property="valid_until", type="string", format="date", example="2027-01-01"),
     *             @OA\Property(property="scope", type="string", example="Manufacturing of electronic components")
     *         )
     *     ),
     *
     *     @OA\Response(response=404, description="Certificate not found"),
     *     @OA\Response(response=400, description="Validation failed")
     * )
     */
    public function verify(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'certificate_number' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        $certificate = Certificate::where('certificate_number', $request->certificate_number)
            ->with(['application.organization', 'application.unit'])
            ->first();

        if (! $certificate) {
            return $this->errorResponse('Certificate not found.', 404, ['valid' => false]);
        }

        $isValid = $certificate->status === 'active' &&
                   $certificate->valid_from <= now() &&
                   $certificate->valid_until >= today();

        $unit = $certificate->application?->unit;
        $ratingLevel = Assessment::ratingLevelFromScore($certificate->final_score);

        return $this->successResponse([
            'valid' => $isValid,
            'certificate_number' => $certificate->certificate_number,
            'organization_name' => $certificate->application->organization->name,
            'unit_name' => $unit?->name,
            'address' => $unit?->address,
            'district' => $unit?->district,
            'state' => $unit?->state,
            'pincode' => $unit?->pincode,
            'rating_label' => $ratingLevel ? "Level {$ratingLevel}" : null,
            'status' => $certificate->effective_status,
            'valid_from' => $certificate->valid_from->format('Y-m-d'),
            'valid_until' => $certificate->valid_until->format('Y-m-d'),
            'scope' => $certificate->scope,
        ]);
    }

    /**
     * Format certificate data for response.
     */
    private function formatCertificate(Certificate $certificate, bool $detailed = false): array
    {
        $data = [
            'id' => $certificate->id,
            'certificate_number' => $certificate->certificate_number,
            'certificate_type' => $certificate->certificate_type,
            'status' => $certificate->status,
            'issue_date' => $certificate->issue_date?->format('Y-m-d'),
            'valid_from' => $certificate->valid_from?->format('Y-m-d'),
            'valid_until' => $certificate->valid_until?->format('Y-m-d'),
            'is_valid' => $certificate->status === 'active' &&
                         $certificate->valid_from <= now() &&
                         $certificate->valid_until >= today(),
            'certificate_pdf_path' => $certificate->certificate_pdf_path,
            'application' => $certificate->application ? [
                'id' => $certificate->application->id,
                'application_number' => $certificate->application->application_number,
                'unit_id' => $certificate->application->unit_id,
                'assessment' => $certificate->application->assessment ? [
                    'id' => $certificate->application->assessment->id,
                ] : null,
            ] : null,
            'created_at' => $certificate->created_at->toIso8601String(),
        ];

        if ($detailed) {
            // Extend application with organization details in detailed view
            if ($certificate->application) {
                $data['application']['organization'] = [
                    'id' => $certificate->application->organization->id,
                    'name' => $certificate->application->organization->name,
                ];
            }

            $data['scope_of_certification'] = $certificate->scope;

            $data['issued_by'] = $certificate->issuedBy ? [
                'id' => $certificate->issuedBy->id,
                'name' => $certificate->issuedBy->full_name,
            ] : null;

            $data['approved_by'] = $certificate->approvedBy ? [
                'id' => $certificate->approvedBy->id,
                'name' => $certificate->approvedBy->full_name,
            ] : null;

            $data['approved_at'] = $certificate->approved_at?->toIso8601String();

            if ($certificate->status === 'suspended') {
                $data['suspension_reason'] = $certificate->suspension_reason;
                $data['suspended_from'] = $certificate->suspended_from?->toDateString();
                $data['suspended_until'] = $certificate->suspended_until?->toDateString();
            }

            if ($certificate->status === 'revoked') {
                $data['revocation_reason'] = $certificate->revocation_reason;
                $data['revoked_by'] = $certificate->revokedBy ? [
                    'id' => $certificate->revokedBy->id,
                    'name' => $certificate->revokedBy->full_name,
                ] : null;
                $data['revoked_at'] = $certificate->revoked_at?->toIso8601String();
            }
        }

        return $data;
    }

    /**
     * Download certificate PDF.
     *
     * @OA\Get(
     *     path="/api/v1/certificates/{certificateNumber}/download",
     *     summary="Download certificate PDF",
     *     description="Generates and downloads the certificate PDF by certificate number. System admins, DRDO admins, Operations Manager, and Operations Admin can download any certificate. Enterprise admins can only download certificates from their organization.",
     *     tags={"Certificates", "System Admin - Certificate", "DRDO Admin - Certificate", "Operations Manager - Certificate", "Operations Admin - Certificate", "Enterprise Admin - Certificate"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="certificateNumber",
     *         in="path",
     *         description="Certificate number (e.g., CERT-I-2024-000001)",
     *         required=true,
     *
     *         @OA\Schema(type="string", example="CERT-I-2024-000001")
     *     ),
     *
     *     @OA\Parameter(
     *         name="download",
     *         in="query",
     *         description="Force download instead of inline display",
     *         required=false,
     *
     *         @OA\Schema(type="boolean", example=true)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Certificate PDF generated successfully",
     *
     *         @OA\MediaType(
     *             mediaType="application/pdf",
     *
     *             @OA\Schema(
     *                 type="string",
     *                 format="binary",
     *                 description="PDF file containing the certificate"
     *             )
     *         ),
     *
     *         @OA\Header(
     *             header="Content-Disposition",
     *             description="Attachment filename",
     *
     *             @OA\Schema(type="string", example="attachment; filename=certificate_CERT-I-2024-000001.pdf")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Unauthorized to download this certificate",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Unauthorized to download this certificate.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Certificate not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Certificate not found.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=500,
     *         description="Internal server error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="An error occurred while generating the certificate PDF.")
     *         )
     *     )
     * )
     *
     * @return Response
     */
    public function download(Request $request, string $certificateNumber, CertificateService $certificateService)
    {
        $certificate = Certificate::with(['application.organization'])
            ->where('certificate_number', $certificateNumber)
            ->first();

        if (! $certificate) {
            return $this->errorResponse('Certificate not found.', 404);
        }

        return $this->processDownload($request, $certificate, $certificateService);
    }

    /**
     * Process certificate PDF download (shared logic).
     */
    private function processDownload(Request $request, Certificate $certificate, CertificateService $certificateService)
    {
        try {
            $user = $request->user();

            // Check authorization: admins can download any, enterprise admins only their org's
            if (! $user->hasAnyRole([Role::SYSTEM_ADMIN, Role::DRDO_ADMIN, Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN])) {
                if ($certificate->application->organization_id !== $user->organization_id) {
                    return $this->errorResponse('Unauthorized to download this certificate.', 403);
                }
            }

            // Check if download parameter is set (true = force download, false/null = inline view)
            $forceDownload = filter_var($request->query('download', false), FILTER_VALIDATE_BOOLEAN);

            // If certificate has stored PDF, try to use it
            if ($certificate->certificate_pdf_path) {
                try {
                    if ($forceDownload) {
                        return $certificateService->downloadStoredPdf($certificate);
                    } else {
                        return $certificateService->streamStoredPdf($certificate);
                    }
                } catch (\RuntimeException $e) {
                    // Stored PDF not found, fall through to on-the-fly generation
                    Log::warning('Stored certificate PDF not found, generating on-the-fly', [
                        'certificate_id' => $certificate->id,
                        'path' => $certificate->certificate_pdf_path,
                    ]);
                }
            }

            // Generate on-the-fly
            $pdfContent = $certificateService->generateCertificatePdf($certificate);
            $filename = "certificate-{$certificate->certificate_number}.pdf";

            return response($pdfContent, 200)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', ($forceDownload ? 'attachment' : 'inline')."; filename=\"{$filename}\"");

        } catch (\RuntimeException $e) {
            Log::error('Certificate download error: '.$e->getMessage(), [
                'certificate_id' => $certificate->id,
                'user_id' => $request->user()?->id,
            ]);

            return $this->errorResponse('Failed to generate certificate PDF.', 500);
        } catch (\Exception $e) {
            Log::error('Certificate download error: '.$e->getMessage(), [
                'certificate_id' => $certificate->id,
                'user_id' => $request->user()?->id,
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResponse('An error occurred while generating the certificate PDF.', 500);
        }
    }
}
