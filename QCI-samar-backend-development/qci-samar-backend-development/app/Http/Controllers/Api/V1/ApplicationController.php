<?php

namespace App\Http\Controllers\Api\V1;

use App\Contracts\GstinVerifierInterface;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ManufacturingApplicationDraftRequest;
use App\Http\Requests\Api\V1\ServicesApplicationDraftRequest;
use App\Http\Requests\Api\V1\UpdateApplicationContactPersonRequest;
use App\Http\Requests\Application\ApplicationExportRequest;
use App\Models\Application;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\Organization;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\Unit;
use App\Models\User;
use App\Services\ApplicationRenewalService;
use App\Services\FileStorageService;
use App\Services\Gst\GstinConsistencyValidator;
use App\Services\StateFilterService;
use App\Services\UnitService;
use App\Services\UserService;
use App\Support\Csv;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @OA\Tag(
 *     name="Applications",
 *     description="Application management endpoints"
 * )
 */
class ApplicationController extends Controller
{
    /**
     * File storage service instance.
     */
    protected FileStorageService $fileStorage;

    /**
     * Constructor to inject services.
     */
    public function __construct(
        private UnitService $unitService,
        private UserService $userService,
        private StateFilterService $stateFilterService,
        private ApplicationRenewalService $renewalService,
        private GstinConsistencyValidator $gstinValidator,
        private GstinVerifierInterface $gstinVerifier,
        FileStorageService $fileStorage
    ) {
        $this->fileStorage = $fileStorage;
    }

    /**
     * Handle file uploads for application, replacing public storage with private.
     *
     * @param  array  $data  Request data containing potential file uploads
     * @param  int  $applicationId  Application ID for folder organization
     * @param  Application|null  $existingApplication  For updates, to delete old files
     * @return array Modified data with file paths
     */
    protected function handleApplicationFileUploads(array $data, int $applicationId, ?Application $existingApplication = null): array
    {
        $fileFields = [
            'drdo_certificate_file' => FileStorageService::APPLICATION_CERTIFICATES,
            'site_exterior_photo' => FileStorageService::APPLICATION_ATTACHMENTS,
            'gst_certificate_file' => FileStorageService::APPLICATION_CERTIFICATES,
            'govt_registration_certificate' => FileStorageService::APPLICATION_CERTIFICATES,
            'dpiit_certificate_file' => FileStorageService::APPLICATION_CERTIFICATES,
            'udyam_certificate_file' => FileStorageService::APPLICATION_CERTIFICATES,
            'incorporation_certificate_file' => FileStorageService::APPLICATION_CERTIFICATES,
        ];

        foreach ($fileFields as $field => $subFolder) {
            if (isset($data[$field])) {
                if ($data[$field] instanceof UploadedFile) {
                    // Delete old file if exists (for updates)
                    if ($existingApplication && $existingApplication->$field) {
                        $this->fileStorage->delete($existingApplication->$field);
                    }

                    // Store new file using FileStorageService (private storage)
                    $fileData = $this->fileStorage->storeApplicationFile(
                        $data[$field],
                        $applicationId,
                        $subFolder
                    );
                    $data[$field] = $fileData['path'];
                } elseif (is_string($data[$field]) && ! $this->isValidStoragePath($data[$field])) {
                    // Invalid string value (e.g., URL instead of file path) - remove from data
                    // to preserve existing file path in database
                    unset($data[$field]);
                }
            }
        }

        return $data;
    }

    /**
     * Fold per-file upload metadata (latitude/longitude/captured_at flat keys sent
     * by the web portal alongside each file) into the file_upload_metadata JSON
     * column, keyed by file field. Server upload time is always recorded; the
     * client capture timestamp falls back to it when absent. Metadata for fields
     * without a new file is left untouched, so step-wise draft saves accumulate.
     */
    protected function applyFileUploadMetadata(array $data, ?Application $existingApplication = null): array
    {
        $fileFields = [
            'drdo_certificate_file',
            'site_exterior_photo',
            'gst_certificate_file',
            'govt_registration_certificate',
            'dpiit_certificate_file',
            'udyam_certificate_file',
            'incorporation_certificate_file',
        ];

        $metadata = $existingApplication?->file_upload_metadata ?? [];
        $hasNewMetadata = false;

        foreach ($fileFields as $field) {
            $latKey = "{$field}_latitude";
            $lngKey = "{$field}_longitude";
            $capKey = "{$field}_captured_at";

            if (isset($data[$field]) && $data[$field] instanceof UploadedFile) {
                $metadata[$field] = [
                    'latitude' => isset($data[$latKey]) ? (float) $data[$latKey] : null,
                    'longitude' => isset($data[$lngKey]) ? (float) $data[$lngKey] : null,
                    'captured_at' => $data[$capKey] ?? now()->toIso8601String(),
                    'uploaded_at' => now()->toIso8601String(),
                ];
                $hasNewMetadata = true;
            }

            unset($data[$latKey], $data[$lngKey], $data[$capKey]);
        }

        if ($hasNewMetadata) {
            $data['file_upload_metadata'] = $metadata;
        }

        return $data;
    }

    /**
     * Check if a string is a valid storage path (not a URL or invalid value).
     *
     * @param  string  $path  The path to validate
     * @return bool True if valid storage path, false otherwise
     */
    protected function isValidStoragePath(string $path): bool
    {
        // Reject URLs (http://, https://)
        if (preg_match('/^https?:\/\//i', $path)) {
            return false;
        }

        // Reject empty or whitespace-only strings
        if (trim($path) === '') {
            return false;
        }

        // Valid paths should be relative paths like "applications/3/certificates/uuid.jpg"
        // They should not contain URL-like patterns
        return true;
    }

    /**
     * @OA\Get(
     *     path="/api/v1/applications",
     *     summary="List all applications",
     *     tags={"Application", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         description="Filter by status",
     *
     *         @OA\Schema(type="string", enum={"draft", "drdo_approval_pending", "payment_pending", "payment_completed", "in_progress", "certified", "rejected"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="enterprise_classification",
     *         in="query",
     *         description="Filter by enterprise classification",
     *
     *         @OA\Schema(type="string", enum={"startup", "micro", "small", "medium", "large"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="type",
     *         in="query",
     *         description="Filter by application type (new/renewal)",
     *
     *         @OA\Schema(type="string", enum={"new", "renewal"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="sector",
     *         in="query",
     *         description="Filter by sector",
     *
     *         @OA\Schema(type="string", enum={"manufacturing", "service"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="unitId",
     *         in="query",
     *         description="Filter to a single unit's applications",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="q",
     *         in="query",
     *         description="Search by application number",
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="applicationDateFrom",
     *         in="query",
     *         description="Filter applications submitted from this date (format: Y-m-d, e.g., 2025-01-15)",
     *
     *         @OA\Schema(type="string", format="date", example="2025-01-15")
     *     ),
     *
     *     @OA\Parameter(
     *         name="applicationDateTo",
     *         in="query",
     *         description="Filter applications submitted up to this date (format: Y-m-d, e.g., 2025-01-31)",
     *
     *         @OA\Schema(type="string", format="date", example="2025-01-31")
     *     ),
     *
     *     @OA\Parameter(
     *         name="assessmentStartFrom",
     *         in="query",
     *         description="Filter assessments starting from this date (format: Y-m-d, e.g., 2025-02-01). Uses actual_start_date if available, otherwise scheduled_start_date",
     *
     *         @OA\Schema(type="string", format="date", example="2025-02-01")
     *     ),
     *
     *     @OA\Parameter(
     *         name="assessmentStartTo",
     *         in="query",
     *         description="Filter assessments starting up to this date (format: Y-m-d, e.g., 2025-02-15). Uses actual_start_date if available, otherwise scheduled_start_date",
     *
     *         @OA\Schema(type="string", format="date", example="2025-02-15")
     *     ),
     *
     *     @OA\Parameter(
     *         name="assessmentEndFrom",
     *         in="query",
     *         description="Filter assessments ending from this date (format: Y-m-d, e.g., 2025-02-20). Uses actual_end_date if available, otherwise scheduled_end_date",
     *
     *         @OA\Schema(type="string", format="date", example="2025-02-20")
     *     ),
     *
     *     @OA\Parameter(
     *         name="assessmentEndTo",
     *         in="query",
     *         description="Filter assessments ending up to this date (format: Y-m-d, e.g., 2025-02-28). Uses actual_end_date if available, otherwise scheduled_end_date",
     *
     *         @OA\Schema(type="string", format="date", example="2025-02-28")
     *     ),
     *
     *     @OA\Parameter(
     *         name="paymentStatus",
     *         in="query",
     *         description="Filter by payment status",
     *
     *         @OA\Schema(type="string", enum={"pending", "success", "failed"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="ratingMin",
     *         in="query",
     *         description="Filter applications with minimum percentage score (0-100)",
     *
     *         @OA\Schema(type="number", format="float", minimum=0, maximum=100, example=75.0)
     *     ),
     *
     *     @OA\Parameter(
     *         name="ratingMax",
     *         in="query",
     *         description="Filter applications with maximum percentage score (0-100)",
     *
     *         @OA\Schema(type="number", format="float", minimum=0, maximum=100, example=95.0)
     *     ),
     *
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *
     *         @OA\Schema(type="integer", default=1)
     *     ),
     *
     *     @OA\Parameter(
     *         name="perPage",
     *         in="query",
     *         description="Items per page",
     *
     *         @OA\Schema(type="integer", default=15)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Applications retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            // Authorize
            if (! $user->can('viewAny', Application::class)) {
                return $this->errorResponse('Unauthorized to view applications', 403);
            }

            $query = Application::query()
                ->with([
                    'organization:id,name',
                    'unit:id,email,contact_person_name',
                    'creator:id,first_name,last_name,email',
                    // allocation_locked_at + step_progress are read by isAllocationLocked();
                    // omitting them made the column null on the eager-loaded row, so the
                    // applicant's list always reported allocation_locked=false and kept the
                    // site-picture upload gate shut even after the lead locked allocation.
                    'assessment:id,application_id,status,scheduled_start_date,scheduled_end_date,meeting_link,allocation_locked_at,step_progress',
                    // Resolves lead_punched_in without an N+1 over the paginated list.
                    'assessment.leadTeamMember:id,assessment_id,role',
                    // Columns qualified: latestOfMany adds a self-join that also exposes team_member_id.
                    'assessment.leadTeamMember.latestAttendance:application_assessment_attendances.id,application_assessment_attendances.team_member_id,application_assessment_attendances.type,application_assessment_attendances.recorded_at',
                    // Assessor names surfaced to the applicant ("View Assessor(s)").
                    'assessment.teamMembers:id,assessment_id,user_id,role',
                    'assessment.teamMembers.user:id,first_name,last_name,mobile_number,email',
                ]);

            // Apply organization/unit scope based on role
            if ($user->hasRole('enterprise_admin')) {
                $query->where('organization_id', $user->organization_id);
            } elseif ($user->hasRole('unit_admin')) {
                // Get user's accessible units
                $userUnits = $user->roles()
                    ->where('slug', 'unit_admin')
                    ->wherePivot('is_active', true)
                    ->get()
                    ->pluck('pivot.unit_id')
                    ->filter()
                    ->toArray();

                // SECURITY: Always filter by organization_id AND unit_id to prevent cross-org access
                $query->where('organization_id', $user->organization_id)
                    ->whereIn('unit_id', $userUnits);
            }

            // DRDO Admin should not see draft applications
            if ($user->hasRole('drdo_admin')) {
                $query->where('status', '!=', 'draft');
            }

            // Apply state-based filtering for Operations Manager
            $this->stateFilterService->applyToApplicationQuery($query, $user);

            // Filter by status
            if ($request->filled('status')) {
                $query->byStatus($request->status);
            }

            // Exclude status (e.g., exclude drafts for admin views). Accepts a
            // comma-separated list — the dashboard "Active Applications" card links
            // here with exclude_status=draft,certified,rejected, which a single
            // "!=" comparison silently ignored (it matched no row), so the list
            // still showed drafts and certified.
            if ($request->filled('exclude_status')) {
                $excludeStatuses = array_filter(array_map('trim', explode(',', $request->exclude_status)));
                $query->whereNotIn('status', $excludeStatuses);
            }

            // Applicant mobile sync-down: once the lead assessor submits on mobile
            // (their mobile_completed_at is set — the server only allows this after
            // every co-assessor has completed, i.e. assessment.status=mobile_complete),
            // the applicant has no remaining role, so drop it from their list. Opt-in
            // so the shared web/admin views keep seeing the assessment.
            if ($request->boolean('exclude_lead_mobile_completed')) {
                $query->whereDoesntHave('assessment.leadTeamMember', function ($q) {
                    $q->whereNotNull('mobile_completed_at');
                });
            }

            // Filter by type
            if ($request->filled('type')) {
                $query->byType($request->type);
            }

            // Filter by sector
            if ($request->filled('sector')) {
                $query->where('sector', $request->sector);
            }

            // Filter by unit — lets a unit detail screen list only that unit's applications
            // instead of every application in the organisation.
            if ($request->filled('unit_id')) {
                $query->where('unit_id', $request->unit_id);
            }

            // Filter by enterprise classification
            if ($request->filled('enterprise_classification')) {
                $query->where('enterprise_classification', $request->enterprise_classification);
            }

            // Search
            if ($request->filled('q')) {
                $search = $request->q;
                $query->where('application_number', 'like', "%{$search}%");
            }

            // Application date filter (submitted_at) - support both camelCase and snake_case
            $applicationDateFrom = $request->input('applicationDateFrom', $request->input('application_date_from'));
            $applicationDateTo = $request->input('applicationDateTo', $request->input('application_date_to'));
            if ($applicationDateFrom) {
                $query->whereDate('submitted_at', '>=', $applicationDateFrom);
            }
            if ($applicationDateTo) {
                $query->whereDate('submitted_at', '<=', $applicationDateTo);
            }

            // Payment status filter - support both camelCase and snake_case
            $paymentStatus = $request->input('paymentStatus', $request->input('payment_status'));
            if ($paymentStatus) {
                $query->where('payment_status', $paymentStatus);
            }

            // Rating filter - scores are now managed in the assessment table
            // If needed, filter via assessment relationship:
            if ($request->filled('rating_min') || $request->filled('ratingMin') || $request->filled('rating_max') || $request->filled('ratingMax')) {
                $ratingMin = $request->input('ratingMin', $request->input('rating_min'));
                $ratingMax = $request->input('ratingMax', $request->input('rating_max'));
                $query->whereHas('assessment', function ($q) use ($ratingMin, $ratingMax) {
                    if ($ratingMin !== null) {
                        $q->where('total_score', '>=', $ratingMin);
                    }
                    if ($ratingMax !== null) {
                        $q->where('total_score', '<=', $ratingMax);
                    }
                });
            }

            // Assessment start date filter (via assessment relationship)
            if ($request->filled('assessment_start_from') || $request->filled('assessment_start_to')) {
                $query->whereHas('assessment', function ($q) use ($request) {
                    if ($request->filled('assessment_start_from')) {
                        $q->where(function ($subQ) use ($request) {
                            $subQ->whereDate('actual_start_date', '>=', $request->assessment_start_from)
                                ->orWhere(function ($inner) use ($request) {
                                    $inner->whereNull('actual_start_date')
                                        ->whereDate('scheduled_start_date', '>=', $request->assessment_start_from);
                                });
                        });
                    }
                    if ($request->filled('assessment_start_to')) {
                        $q->where(function ($subQ) use ($request) {
                            $subQ->whereDate('actual_start_date', '<=', $request->assessment_start_to)
                                ->orWhere(function ($inner) use ($request) {
                                    $inner->whereNull('actual_start_date')
                                        ->whereDate('scheduled_start_date', '<=', $request->assessment_start_to);
                                });
                        });
                    }
                });
            }

            // Assessment end date filter (via assessment relationship)
            if ($request->filled('assessment_end_from') || $request->filled('assessment_end_to')) {
                $query->whereHas('assessment', function ($q) use ($request) {
                    if ($request->filled('assessment_end_from')) {
                        $q->where(function ($subQ) use ($request) {
                            $subQ->whereDate('actual_end_date', '>=', $request->assessment_end_from)
                                ->orWhere(function ($inner) use ($request) {
                                    $inner->whereNull('actual_end_date')
                                        ->whereDate('scheduled_end_date', '>=', $request->assessment_end_from);
                                });
                        });
                    }
                    if ($request->filled('assessment_end_to')) {
                        $q->where(function ($subQ) use ($request) {
                            $subQ->whereDate('actual_end_date', '<=', $request->assessment_end_to)
                                ->orWhere(function ($inner) use ($request) {
                                    $inner->whereNull('actual_end_date')
                                        ->whereDate('scheduled_end_date', '<=', $request->assessment_end_to);
                                });
                        });
                    }
                });
            }

            // Pagination
            $perPage = $this->resolvePerPage($request, 15);
            $applications = $query->orderBy('created_at', 'desc')->paginate($perPage);

            // Format response with counts and progress
            $data = $applications->through(function ($application) use ($user) {
                return $this->formatApplicationData($application, $user);
            });

            return $this->paginatedResponse($data, 'Applications retrieved successfully');

        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to retrieve applications');
        }
    }

    /**
     * @OA\Post(
     *     path="/api/v1/applications/manufacturing/draft",
     *     summary="Save partial manufacturing application as draft",
     *     description="Save a manufacturing application draft with minimal validation. All fields are optional. A unit is automatically created from application data. If a draft already exists for the organization and sector, it will be updated.",
     *     tags={"Application", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=false,
     *
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *
     *             @OA\Schema(
     *
     *                 @OA\Property(property="organizationId", type="integer", nullable=true, description="Organization ID (auto-derived from authenticated user if not provided)"),
     *                 @OA\Property(property="applicationType", type="string", enum={"new", "renewal"}, nullable=true, description="Application type"),
     *                 @OA\Property(property="isExistingDrdoVendor", type="boolean", nullable=true, description="Is existing DRDO vendor"),
     *                 @OA\Property(property="vendorCategory", type="string", maxLength=100, nullable=true, description="DRDO vendor category"),
     *                 @OA\Property(property="mfgDrdoVendorStores", type="array", @OA\Items(type="object", @OA\Property(property="storeName", type="string")), nullable=true, description="DRDO vendor stores (manufacturing only) - array of objects with storeName"),
     *                 @OA\Property(property="drdoRegistrationNumber", type="string", maxLength=255, nullable=true, description="DRDO registration number"),
     *                 @OA\Property(property="drdoCertificateFile", type="string", format="binary", nullable=true, description="DRDO certificate file"),
     *                 @OA\Property(property="enterpriseClassification", type="string", enum={"startup", "micro", "small", "medium", "large"}, nullable=true, description="Enterprise classification"),
     *                 @OA\Property(property="enterpriseName", type="string", maxLength=255, nullable=true, description="Enterprise name"),
     *                 @OA\Property(property="registeredOfficeAddress", type="string", maxLength=500, nullable=true, description="Registered office address"),
     *                 @OA\Property(property="registeredOfficeState", type="string", maxLength=100, nullable=true, description="Registered office state (used in application number generation)"),
     *                 @OA\Property(property="registeredOfficeDistrict", type="string", maxLength=100, nullable=true, description="Registered office district"),
     *                 @OA\Property(property="registeredOfficePinCode", type="string", maxLength=10, nullable=true, description="Registered office PIN code"),
     *                 @OA\Property(property="registeredOfficeMobile", type="string", maxLength=10, nullable=true, description="Registered office mobile"),
     *                 @OA\Property(property="registeredOfficeLandline", type="string", maxLength=12, nullable=true, description="Registered office landline"),
     *                 @OA\Property(property="registeredOfficeEmail", type="string", format="email", maxLength=320, nullable=true, description="Registered office email"),
     *                 @OA\Property(property="registeredOfficeAlternateEmail", type="string", format="email", maxLength=320, nullable=true, description="Registered office alternate email"),
     *                 @OA\Property(property="unitAddress", type="string", maxLength=500, nullable=true, description="Unit address"),
     *                 @OA\Property(property="unitState", type="string", maxLength=100, nullable=true, description="Unit state"),
     *                 @OA\Property(property="unitDistrict", type="string", maxLength=100, nullable=true, description="Unit district"),
     *                 @OA\Property(property="unitPinCode", type="string", maxLength=10, nullable=true, description="Unit PIN code"),
     *                 @OA\Property(property="unitMobile", type="string", maxLength=10, nullable=true, description="Unit mobile"),
     *                 @OA\Property(property="unitLandline", type="string", maxLength=12, nullable=true, description="Unit landline"),
     *                 @OA\Property(property="unitEmail", type="string", format="email", maxLength=320, nullable=true, description="Unit email"),
     *                 @OA\Property(property="unitAlternateEmail", type="string", format="email", maxLength=320, nullable=true, description="Unit alternate email"),
     *                 @OA\Property(property="unitCommencementDate", type="string", format="date", nullable=true, description="Unit commencement date (YYYY-MM-DD)"),
     *                 @OA\Property(property="siteExteriorPhoto", type="string", format="binary", nullable=true, description="Site exterior photo"),
     *                 @OA\Property(property="contactPersonName", type="string", maxLength=255, nullable=true, description="Contact person name"),
     *                 @OA\Property(property="contactPersonDesignation", type="string", maxLength=255, nullable=true, description="Contact person designation"),
     *                 @OA\Property(property="contactPersonMobile", type="string", maxLength=10, nullable=true, description="Contact person mobile"),
     *                 @OA\Property(property="contactPersonEmail", type="string", format="email", maxLength=320, nullable=true, description="Contact person email"),
     *                 @OA\Property(property="ownershipType", type="string", enum={"proprietorship", "partnership", "private_limited", "public_limited", "joint_venture", "limited_liability_partnership", "other"}, nullable=true, description="Ownership type"),

     *                 @OA\Property(property="maleEmployeesCount", type="integer", minimum=0, nullable=true, description="Number of male employees"),
     *                 @OA\Property(property="femaleEmployeesCount", type="integer", minimum=0, nullable=true, description="Number of female employees"),
     *                 @OA\Property(property="otherEmployeesCount", type="integer", minimum=0, nullable=true, description="Number of other gender employees"),
     *                 @OA\Property(property="technicalStaffCount", type="integer", minimum=0, nullable=true, description="Number of technical staff"),
     *                 @OA\Property(property="hasGst", type="boolean", nullable=true, description="Has GST registration"),
     *                 @OA\Property(property="gstNumber", type="string", maxLength=15, nullable=true, description="GST number"),
     *                 @OA\Property(property="gstCertificateFile", type="string", format="binary", nullable=true, description="GST certificate file"),
     *                 @OA\Property(property="hasGovtRegistration", type="boolean", nullable=true, description="Has government registration"),
     *                 @OA\Property(property="govtOrganisationName", type="string", maxLength=255, nullable=true, description="Government organization name"),
     *                 @OA\Property(property="govtRegistrationCertificate", type="string", format="binary", nullable=true, description="Government registration certificate"),
     *                 @OA\Property(property="dpiitRegistrationNumber", type="string", maxLength=255, nullable=true, description="DPIIT registration number"),
     *                 @OA\Property(property="dpiitCertificateFile", type="string", format="binary", nullable=true, description="DPIIT certificate file"),
     *                 @OA\Property(property="udyamRegistrationNumber", type="string", maxLength=255, nullable=true, description="Udyam registration number"),
     *                 @OA\Property(property="udyamCertificateFile", type="string", format="binary", nullable=true, description="Udyam certificate file"),
     *                 @OA\Property(property="incorporationCertificateFile", type="string", format="binary", nullable=true, description="Incorporation certificate file"),
     *                 @OA\Property(property="productionCapacity", type="number", format="float", minimum=0, nullable=true, description="Production capacity"),
     *                 @OA\Property(property="capacityUnit", type="string", maxLength=50, nullable=true, description="Capacity unit"),
     *                 @OA\Property(property="thirdPartyCertifications", type="array", @OA\Items(type="string"), nullable=true, description="List of third party certifications"),
     *                 @OA\Property(property="isBlacklisted", type="boolean", nullable=true, description="Is blacklisted by any organization"),
     *                 @OA\Property(property="blacklistedOrganizations", type="array", @OA\Items(type="string"), nullable=true, description="List of organizations that blacklisted"),
     *                 @OA\Property(property="hasOngoingEnquiry", type="boolean", nullable=true, description="Has ongoing enquiry/investigation"),
     *                 @OA\Property(
     *                     property="mfgProducts",
     *                     type="array",
     *                     nullable=true,
     *                     description="Manufacturing products array (productName required per item if provided)",
     *
     *                     @OA\Items(
     *                         type="object",
     *                         required={"productName"},
     *
     *                         @OA\Property(property="productName", type="string", maxLength=255, description="Product name (required)"),
     *                         @OA\Property(property="totalProductionCapacity", type="number", format="float", minimum=0, nullable=true, description="Total production capacity"),
     *                         @OA\Property(property="capacityUnit", type="string", maxLength=50, nullable=true, description="Capacity unit"),
     *                         @OA\Property(property="currentUtilizedCapacity", type="number", format="float", minimum=0, nullable=true, description="Current utilized capacity"),
     *                         @OA\Property(property="commencementDate", type="string", format="date", nullable=true, description="Production commencement date"),
     *                         @OA\Property(property="isExported", type="boolean", nullable=true, description="Is product exported"),
     *                         @OA\Property(property="exportCountries", type="array", @OA\Items(type="string"), nullable=true, description="Export destination countries"),
     *                         @OA\Property(property="exportPercentage", type="number", format="float", minimum=0, maximum=100, nullable=true, description="Export percentage (0-100)")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="mfgRawMaterials",
     *                     type="array",
     *                     nullable=true,
     *                     description="Manufacturing raw materials array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="materialName", type="string", maxLength=100, nullable=true, description="Material name"),
     *                         @OA\Property(property="isImported", type="boolean", nullable=true, description="Is material imported"),
     *                         @OA\Property(property="importCountry", type="string", maxLength=100, nullable=true, description="Import country name"),
     *                         @OA\Property(property="importPercentage", type="number", format="float", minimum=0, maximum=100, nullable=true, description="Import percentage (0-100)")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="mfgBoughtOutParts",
     *                     type="array",
     *                     nullable=true,
     *                     description="Manufacturing bought out parts array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="partName", type="string", maxLength=100, nullable=true, description="Part name"),
     *                         @OA\Property(property="isImported", type="boolean", nullable=true, description="Is part imported"),
     *                         @OA\Property(property="importCountry", type="string", maxLength=100, nullable=true, description="Import country name"),
     *                         @OA\Property(property="importPercentage", type="number", format="float", minimum=0, maximum=100, nullable=true, description="Import percentage (0-100)")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="mfgKeyProcesses",
     *                     type="array",
     *                     nullable=true,
     *                     description="Manufacturing key processes array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="processName", type="string", maxLength=100, nullable=true, description="Process name")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="mfgOutsourcedProcesses",
     *                     type="array",
     *                     nullable=true,
     *                     description="Manufacturing outsourced processes array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="processName", type="string", maxLength=100, nullable=true, description="Process name")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="customers",
     *                     type="array",
     *                     nullable=true,
     *                     description="Customers array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="customerName", type="string", maxLength=255, nullable=true, description="Customer name"),
     *                         @OA\Property(property="customerType", type="string", enum={"domestic", "international"}, nullable=true, description="Customer type"),
     *                         @OA\Property(property="country", type="string", maxLength=100, nullable=true, description="Country name")
     *                     )
     *                 ),
     *                 description="All fields are optional. Unit is auto-created from application data."
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Manufacturing draft created successfully"
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Manufacturing draft updated successfully"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Unauthorized to create applications"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error"
     *     )
     * )
     */
    public function storeManufacturingDraft(ManufacturingApplicationDraftRequest $request): JsonResponse
    {
        try {
            $user = Auth::user();

            // Authorize
            $canCreate = $user->can('create', Application::class);

            if (! $canCreate) {
                return $this->errorResponse('Unauthorized to create applications', 403);
            }

            $validated = $request->validated();
            $validated['sector'] = 'manufacturing';

            return $this->storeDraftApplication($validated, $user);

        } catch (ValidationException $e) {
            return $this->errorResponse('Validation failed', 400, $e->errors());
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Failed to save manufacturing draft', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->serverErrorResponse($e, 'Failed to save manufacturing draft');
        }
    }

    /**
     * @OA\Post(
     *     path="/api/v1/applications/services/draft",
     *     summary="Save partial services application as draft",
     *     description="Save a services application draft with minimal validation. All fields are optional. A unit is automatically created from application data. If a draft already exists for the organization and sector, it will be updated.",
     *     tags={"Application", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=false,
     *
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *
     *             @OA\Schema(
     *
     *                 @OA\Property(property="organizationId", type="integer", nullable=true, description="Organization ID (auto-derived from authenticated user if not provided)"),
     *                 @OA\Property(property="serviceProviderType", type="string", enum={"annual_maintenance_contract", "critical_service_provider", "civil_works_contractor"}, nullable=true, description="Service provider type"),
     *                 @OA\Property(property="applicationType", type="string", enum={"new", "renewal"}, nullable=true, description="Application type"),
     *                 @OA\Property(property="isExistingDrdoVendor", type="boolean", nullable=true, description="Is existing DRDO vendor"),
     *                 @OA\Property(property="vendorCategory", type="string", maxLength=100, nullable=true, description="DRDO vendor category"),
     *                 @OA\Property(property="drdoRegistrationNumber", type="string", maxLength=255, nullable=true, description="DRDO registration number"),
     *                 @OA\Property(property="drdoCertificateFile", type="string", format="binary", nullable=true, description="DRDO certificate file"),
     *                 @OA\Property(property="enterpriseClassification", type="string", enum={"startup", "micro", "small", "medium", "large"}, nullable=true, description="Enterprise classification"),
     *                 @OA\Property(property="enterpriseName", type="string", maxLength=255, nullable=true, description="Enterprise name"),
     *                 @OA\Property(property="registeredOfficeAddress", type="string", maxLength=500, nullable=true, description="Registered office address"),
     *                 @OA\Property(property="registeredOfficeState", type="string", maxLength=100, nullable=true, description="Registered office state (used in application number generation)"),
     *                 @OA\Property(property="registeredOfficeDistrict", type="string", maxLength=100, nullable=true, description="Registered office district"),
     *                 @OA\Property(property="registeredOfficePinCode", type="string", maxLength=10, nullable=true, description="Registered office PIN code"),
     *                 @OA\Property(property="registeredOfficeMobile", type="string", maxLength=10, nullable=true, description="Registered office mobile"),
     *                 @OA\Property(property="registeredOfficeLandline", type="string", maxLength=12, nullable=true, description="Registered office landline"),
     *                 @OA\Property(property="registeredOfficeEmail", type="string", format="email", maxLength=320, nullable=true, description="Registered office email"),
     *                 @OA\Property(property="registeredOfficeAlternateEmail", type="string", format="email", maxLength=320, nullable=true, description="Registered office alternate email"),
     *                 @OA\Property(property="unitAddress", type="string", maxLength=500, nullable=true, description="Unit address"),
     *                 @OA\Property(property="unitState", type="string", maxLength=100, nullable=true, description="Unit state"),
     *                 @OA\Property(property="unitDistrict", type="string", maxLength=100, nullable=true, description="Unit district"),
     *                 @OA\Property(property="unitPinCode", type="string", maxLength=10, nullable=true, description="Unit PIN code"),
     *                 @OA\Property(property="unitMobile", type="string", maxLength=10, nullable=true, description="Unit mobile"),
     *                 @OA\Property(property="unitLandline", type="string", maxLength=12, nullable=true, description="Unit landline"),
     *                 @OA\Property(property="unitEmail", type="string", format="email", maxLength=320, nullable=true, description="Unit email"),
     *                 @OA\Property(property="unitAlternateEmail", type="string", format="email", maxLength=320, nullable=true, description="Unit alternate email"),
     *                 @OA\Property(property="unitCommencementDate", type="string", format="date", nullable=true, description="Unit commencement date (YYYY-MM-DD)"),
     *                 @OA\Property(property="siteExteriorPhoto", type="string", format="binary", nullable=true, description="Site exterior photo"),
     *                 @OA\Property(property="contactPersonName", type="string", maxLength=255, nullable=true, description="Contact person name"),
     *                 @OA\Property(property="contactPersonDesignation", type="string", maxLength=255, nullable=true, description="Contact person designation"),
     *                 @OA\Property(property="contactPersonMobile", type="string", maxLength=10, nullable=true, description="Contact person mobile"),
     *                 @OA\Property(property="contactPersonEmail", type="string", format="email", maxLength=320, nullable=true, description="Contact person email"),
     *                 @OA\Property(property="ownershipType", type="string", enum={"proprietorship", "partnership", "private_limited", "public_limited", "joint_venture", "limited_liability_partnership", "other"}, nullable=true, description="Ownership type"),

     *                 @OA\Property(property="maleEmployeesCount", type="integer", minimum=0, nullable=true, description="Number of male employees"),
     *                 @OA\Property(property="femaleEmployeesCount", type="integer", minimum=0, nullable=true, description="Number of female employees"),
     *                 @OA\Property(property="otherEmployeesCount", type="integer", minimum=0, nullable=true, description="Number of other gender employees"),
     *                 @OA\Property(property="technicalStaffCount", type="integer", minimum=0, nullable=true, description="Number of technical staff"),
     *                 @OA\Property(property="hasGst", type="boolean", nullable=true, description="Has GST registration"),
     *                 @OA\Property(property="gstNumber", type="string", maxLength=15, nullable=true, description="GST number"),
     *                 @OA\Property(property="gstCertificateFile", type="string", format="binary", nullable=true, description="GST certificate file"),
     *                 @OA\Property(property="hasGovtRegistration", type="boolean", nullable=true, description="Has government registration"),
     *                 @OA\Property(property="govtOrganisationName", type="string", maxLength=255, nullable=true, description="Government organization name"),
     *                 @OA\Property(property="govtRegistrationCertificate", type="string", format="binary", nullable=true, description="Government registration certificate"),
     *                 @OA\Property(property="dpiitRegistrationNumber", type="string", maxLength=255, nullable=true, description="DPIIT registration number"),
     *                 @OA\Property(property="dpiitCertificateFile", type="string", format="binary", nullable=true, description="DPIIT certificate file"),
     *                 @OA\Property(property="udyamRegistrationNumber", type="string", maxLength=255, nullable=true, description="Udyam registration number"),
     *                 @OA\Property(property="udyamCertificateFile", type="string", format="binary", nullable=true, description="Udyam certificate file"),
     *                 @OA\Property(property="incorporationCertificateFile", type="string", format="binary", nullable=true, description="Incorporation certificate file"),
     *                 @OA\Property(property="thirdPartyCertifications", type="array", @OA\Items(type="string"), nullable=true, description="List of third party certifications"),
     *                 @OA\Property(property="isBlacklisted", type="boolean", nullable=true, description="Is blacklisted by any organization"),
     *                 @OA\Property(property="blacklistedOrganizations", type="array", @OA\Items(type="string"), nullable=true, description="List of organizations that blacklisted"),
     *                 @OA\Property(property="hasOngoingEnquiry", type="boolean", nullable=true, description="Has ongoing enquiry/investigation"),
     *                 @OA\Property(
     *                     property="svcServices",
     *                     type="array",
     *                     nullable=true,
     *                     description="Services array (serviceName required per item if provided)",
     *
     *                     @OA\Items(
     *                         type="object",
     *                         required={"serviceName"},
     *
     *                         @OA\Property(property="serviceName", type="string", maxLength=255, description="Service name (required)"),
     *                         @OA\Property(property="totalServicesCapacity", type="number", format="float", minimum=0, nullable=true, description="Total services capacity"),
     *                         @OA\Property(property="capacityUnit", type="string", maxLength=50, nullable=true, description="Capacity unit"),
     *                         @OA\Property(property="currentUtilizedCapacity", type="number", format="float", minimum=0, nullable=true, description="Current utilized capacity"),
     *                         @OA\Property(property="commencementDate", type="string", format="date", nullable=true, description="Service commencement date"),
     *                         @OA\Property(property="isSuppliedInternationally", type="boolean", nullable=true, description="Is service supplied internationally"),
     *                         @OA\Property(property="destinationCountries", type="array", @OA\Items(type="string"), nullable=true, description="Destination countries"),
     *                         @OA\Property(property="supplyPercentage", type="number", format="float", minimum=0, maximum=100, nullable=true, description="Supply percentage (0-100)")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="svcKeyResources",
     *                     type="array",
     *                     nullable=true,
     *                     description="Service key resources array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="resourceName", type="string", maxLength=100, nullable=true, description="Resource name"),
     *                         @OA\Property(property="isImported", type="boolean", nullable=true, description="Is resource imported"),
     *                         @OA\Property(property="importCountry", type="string", maxLength=100, nullable=true, description="Import country name"),
     *                         @OA\Property(property="importPercentage", type="number", format="float", minimum=0, maximum=100, nullable=true, description="Import percentage (0-100)")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="svcKeyProcesses",
     *                     type="array",
     *                     nullable=true,
     *                     description="Service key processes array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="processName", type="string", maxLength=100, nullable=true, description="Process name")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="svcOutsourcedProcesses",
     *                     type="array",
     *                     nullable=true,
     *                     description="Service outsourced processes array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="processName", type="string", maxLength=100, nullable=true, description="Process name")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="customers",
     *                     type="array",
     *                     nullable=true,
     *                     description="Customers array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="customerName", type="string", maxLength=255, nullable=true, description="Customer name"),
     *                         @OA\Property(property="customerType", type="string", enum={"domestic", "international"}, nullable=true, description="Customer type"),
     *                         @OA\Property(property="country", type="string", maxLength=100, nullable=true, description="Country name")
     *                     )
     *                 ),
     *                 description="All fields are optional. Unit is auto-created from application data."
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Services draft created successfully"
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Services draft updated successfully"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Unauthorized to create applications"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error"
     *     )
     * )
     */
    public function storeServicesDraft(ServicesApplicationDraftRequest $request): JsonResponse
    {
        try {
            $user = Auth::user();

            // Authorize
            $canCreate = $user->can('create', Application::class);

            if (! $canCreate) {
                return $this->errorResponse('Unauthorized to create applications', 403);
            }

            $validated = $request->validated();
            $validated['sector'] = 'service';

            return $this->storeDraftApplication($validated, $user);

        } catch (ValidationException $e) {
            return $this->errorResponse('Validation failed', 400, $e->errors());
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to save services draft');
        }
    }

    /**
     * @OA\Get(
     *     path="/api/v1/applications/{id}",
     *     summary="Get application details",
     *     tags={"Application", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Application retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Application not found"
     *     )
     * )
     */
    public function show(int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            // First, find the application to determine sector
            $application = Application::findOrFail($id);

            // Load relationships (JSON columns are auto-loaded as attributes, not relationships)
            $relations = [
                'organization',
                'unit',
                'creator',
                // documents are managed via separate endpoints; not loaded here
                'assessment',
                'payments',
                'certificate',
                'previousApplication',
                'statusHistories' => function ($query) {
                    $query->orderBy('changed_at', 'desc')->limit(10);
                },
            ];

            $application->load($relations);

            // Authorize
            if (! $user->can('view', $application)) {
                return $this->errorResponse('Unauthorized to view this application', 403);
            }

            return $this->successResponse(
                $this->formatApplicationData($application, $user, true),
                'Application retrieved successfully'
            );

        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Application not found', 404);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to retrieve application');
        }
    }

    /**
     * @OA\Post(
     *     path="/api/v1/applications/{id}/renew",
     *     summary="Initiate a certificate renewal",
     *     description="Clones a certified application into a fresh, fully editable renewal draft prefilled from the source. Enterprise Admin only. Idempotent: returns the existing renewal draft if one already exists.",
     *     tags={"Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, description="Certified source application id", @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=201, description="Renewal draft created"),
     *     @OA\Response(response=200, description="Existing renewal draft returned (idempotent)"),
     *     @OA\Response(response=403, description="Forbidden - not authorized to renew this application"),
     *     @OA\Response(response=404, description="Application not found"),
     *     @OA\Response(response=422, description="Not eligible for renewal (outside renewal window or an application is already in progress)")
     * )
     */
    public function renew(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            $sourceApplication = Application::findOrFail($id);

            // Policy: Enterprise Admin of the owning org, source must be certified.
            if (! $user->can('renew', $sourceApplication)) {
                return $this->errorResponse('Unauthorized to renew this application', 403);
            }

            // Idempotency: never create a second renewal for the same source.
            $existingDraft = Application::where('previous_application_id', $sourceApplication->id)
                ->where('status', '!=', 'rejected')
                ->orderByDesc('id')
                ->first();

            if ($existingDraft) {
                $existingDraft->load(['organization', 'unit', 'creator', 'previousApplication']);

                return $this->successResponse(
                    $this->formatApplicationData($existingDraft, $user, true),
                    'Existing renewal draft returned',
                    200
                );
            }

            // Eligibility: recertification window + one-active-application rule
            // (shared with the create flow).
            $eligibility = Application::canUnitApply($sourceApplication->unit_id);
            if (! $eligibility['allowed']) {
                return $this->errorResponse($eligibility['reason'], 422);
            }

            $draft = $this->renewalService->createRenewalDraft($sourceApplication, $user->id);
            $draft->load(['organization', 'unit', 'creator', 'previousApplication']);

            return $this->successResponse(
                $this->formatApplicationData($draft, $user, true),
                'Renewal draft created successfully',
                201
            );
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Application not found', 404);
        } catch (\Exception $e) {
            Log::error('Failed to initiate renewal', ['application_id' => $id, 'error' => $e->getMessage()]);

            return $this->serverErrorResponse($e, 'Failed to initiate renewal');
        }
    }

    /**
     * @OA\Put(
     *     path="/api/v1/applications/{id}",
     *     summary="Update application",
     *     tags={"Application", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="sector", type="string", enum={"manufacturing", "service"}),
     *             @OA\Property(property="mfgProducts", type="array", @OA\Items(type="object"), description="Manufacturing products (for manufacturing sector)"),
     *             @OA\Property(property="mfgRawMaterials", type="array", @OA\Items(type="object"), description="Manufacturing raw materials (for manufacturing sector)"),
     *             @OA\Property(property="mfgBoughtOutParts", type="array", @OA\Items(type="object"), description="Manufacturing bought out parts (for manufacturing sector)"),
     *             @OA\Property(property="mfgKeyProcesses", type="array", @OA\Items(type="object"), description="Manufacturing key processes (for manufacturing sector)"),
     *             @OA\Property(property="mfgOutsourcedProcesses", type="array", @OA\Items(type="object"), description="Manufacturing outsourced processes (for manufacturing sector)"),
     *             @OA\Property(property="mfgDrdoVendorStores", type="array", @OA\Items(type="object"), description="Manufacturing DRDO vendor stores (for manufacturing sector)"),
     *             @OA\Property(property="svcServices", type="array", @OA\Items(type="object"), description="Services (for services sector)"),
     *             @OA\Property(property="svcKeyResources", type="array", @OA\Items(type="object"), description="Service key resources (for services sector)"),
     *             @OA\Property(property="svcKeyProcesses", type="array", @OA\Items(type="object"), description="Service key processes (for services sector)"),
     *             @OA\Property(property="svcOutsourcedProcesses", type="array", @OA\Items(type="object"), description="Service outsourced processes (for services sector)"),
     *             @OA\Property(property="customers", type="array", @OA\Items(type="object"), description="Customers (common to both sectors)")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Application updated successfully"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Application cannot be edited in current status"
     *     )
     * )
     */

    /**
     * @OA\Delete(
     *     path="/api/v1/applications/{id}",
     *     summary="Delete application",
     *     tags={"Application", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Application deleted successfully"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Only draft applications can be deleted"
     *     )
     * )
     */

    /**
     * @OA\Get(
     *     path="/api/v1/applications/{id}/files/{field}",
     *     summary="Download an application file from private storage",
     *     description="Streams a whitelisted application file inline. Pass ?download=1 to force attachment.",
     *     tags={"Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *     @OA\Parameter(
     *         name="field",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="string", enum={
     *             "drdo_certificate_file",
     *             "site_exterior_photo",
     *             "gst_certificate_file",
     *             "govt_registration_certificate",
     *             "dpiit_certificate_file",
     *             "udyam_certificate_file",
     *             "incorporation_certificate_file"
     *         })
     *     ),
     *
     *     @OA\Parameter(name="download", in="query", required=false, @OA\Schema(type="boolean")),
     *
     *     @OA\Response(response=200, description="File stream"),
     *     @OA\Response(response=400, description="Invalid file field"),
     *     @OA\Response(response=403, description="No access to this application"),
     *     @OA\Response(response=404, description="Application or file not found")
     * )
     */
    public function downloadFile(Request $request, int $id, string $field)
    {
        $allowedFields = [
            'drdo_certificate_file',
            'site_exterior_photo',
            'gst_certificate_file',
            'govt_registration_certificate',
            'dpiit_certificate_file',
            'udyam_certificate_file',
            'incorporation_certificate_file',
        ];

        if (! in_array($field, $allowedFields)) {
            return $this->errorResponse('Invalid file field specified.', 400);
        }

        $user = Auth::user();
        $application = Application::find($id);

        if (! $application) {
            return $this->errorResponse('Application not found.', 404);
        }

        $hasAccess = false;

        if ($user->hasRole('system_admin') ||
            $user->hasRole('drdo_admin') ||
            $user->hasRole('drdo_lab') ||
            $user->hasRole('operations_manager') ||
            $user->hasRole('operations_admin')) {
            $hasAccess = true;
        }

        if (! $hasAccess && $user->hasRole('assessor')) {
            $hasAccess = AssessmentTeamMember::where('user_id', $user->id)
                ->whereHas('assessment', fn ($query) => $query->where('application_id', $application->id))
                ->exists();
        }

        if (! $hasAccess && $application->organization_id === $user->organization_id) {
            $hasAccess = true;
        }

        if (! $hasAccess) {
            return $this->errorResponse('You do not have access to this application.', 403);
        }

        $filePath = $application->$field;

        if (! $filePath) {
            return $this->errorResponse('No file uploaded for this field.', 404);
        }

        if (! $this->fileStorage->exists($filePath)) {
            return $this->errorResponse('File not found in storage.', 404);
        }

        $forceDownload = $request->boolean('download', false);
        $filename = basename($filePath);

        if ($forceDownload) {
            return $this->fileStorage->download($filePath, $filename);
        }

        return $this->fileStorage->stream($filePath, $filename);
    }

    /**
     * @OA\Post(
     *     path="/api/v1/applications/{id}/submit",
     *     summary="Submit application for review",
     *     tags={"Application", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Application submitted successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation failed - missing required data"
     *     )
     * )
     */
    public function submit(int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            $application = Application::with(['organization'])->findOrFail($id);

            // Authorize
            if (! $user->can('submit', $application)) {
                return $this->errorResponse('Unauthorized to submit this application', 403);
            }

            // Check if application submission is currently open
            if (! SystemSetting::isApplicationSubmissionOpen()) {
                return $this->errorResponse('Application submission is currently closed. Please try again later.', 403);
            }

            if ($application->status !== 'draft') {
                return $this->errorResponse('Only draft applications can be submitted', 400);
            }

            // Block submission when a supplied GSTIN is inconsistent with the
            // organisation's registered state / PAN, so the customer is told at
            // submit time instead of the data failing silently at BC push.
            $gstinError = $this->gstinValidator->validate(
                $application->gst_number,
                $application->organization->pan ?? null,
                $application->organization->registered_state ?? null,
            );
            if ($gstinError !== null) {
                return $this->errorResponse(
                    $gstinError->message,
                    422,
                    ['gstNumber' => [$gstinError->message]],
                    ['errorCode' => $gstinError->code],
                );
            }

            // Live registry verification (after the offline checksum). Hard gate:
            // when verification is enabled and a GSTIN is present, a GSTIN that is
            // not confirmed by the registry — whether a genuine rejection or a
            // technical failure — blocks submission with a 422.
            $gstin = trim((string) $application->gst_number);
            if ($gstin !== '' && $this->gstinVerifier->isEnabled()) {
                $verification = $this->gstinVerifier->verify($gstin);
                if (! $verification->verified) {
                    return $this->errorResponse(
                        $verification->customerMessage(),
                        422,
                        ['gstNumber' => [$verification->customerMessage()]],
                        ['errorCode' => $verification->errorCode ?? $verification->status],
                    );
                }
            }

            DB::beginTransaction();

            // Determine correct transition based on DRDO approval system setting
            // - 'submit' → goes to drdo_approval_pending (when DRDO approval is enabled)
            // - 'submit_direct' → goes to payment_pending (when DRDO approval is disabled)
            $isDrdoApprovalRequired = SystemSetting::isDrdoApprovalRequired();
            $transition = $isDrdoApprovalRequired ? 'submit' : 'submit_direct';

            // Store the DRDO approval requirement at submission time
            // This captures the setting state when the application was submitted,
            // ensuring the status stepper shows correctly even if the setting changes later
            $application->is_drdo_approval_required = $isDrdoApprovalRequired;
            $application->save();

            // Attempt to transition using state machine
            $application->transitionTo($transition, ['remarks' => 'Application submitted for review'], $user);

            DB::commit();

            $application->load(['organization:id,name', 'unit:id,email,contact_person_name', 'creator:id,first_name,last_name,email']);

            return $this->successResponse(
                $this->formatApplicationData($application, $user),
                'Application submitted successfully'
            );

        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to submit application', 400);
        }
    }

    /**
     * @OA\Post(
     *     path="/api/v1/applications/{id}/drdo-approve",
     *     summary="Approve application (DRDO Admin only)",
     *     tags={"Application", "DRDO Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=false,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="remarks", type="string", maxLength=500, description="Optional approval remarks")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Application approved successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Application cannot be approved"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function drdoApprove(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            $application = Application::with(['organization'])->findOrFail($id);

            // Check if application is in the correct status
            if ($application->status !== 'drdo_approval_pending') {
                return $this->errorResponse('Only applications pending DRDO approval can be approved', 400);
            }

            // Validate optional remarks
            $validator = Validator::make($request->all(), [
                'remarks' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse($validator->errors()->first(), 422);
            }

            DB::beginTransaction();

            // Execute the state machine transition
            $application->transitionTo('drdo_approve', [
                'remarks' => $request->input('remarks'),
            ], $user);

            DB::commit();

            $application->load(['organization:id,name', 'unit:id,email,contact_person_name', 'creator:id,first_name,last_name,email']);

            return $this->successResponse(
                $this->formatApplicationData($application, $user),
                'Application approved successfully'
            );

        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('DRDO approval failed due to database error', [
                'application_id' => $id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('An unexpected error occurred. Please try again.', 500);
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to approve application', 422);
        }
    }

    /**
     * @OA\Post(
     *     path="/api/v1/applications/{id}/drdo-reject",
     *     summary="Reject application (DRDO Admin only)",
     *     tags={"Application", "DRDO Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"reason"},
     *
     *             @OA\Property(property="reason", type="string", minLength=10, maxLength=500, description="Reason for rejection")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Application rejected successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Application cannot be rejected"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function drdoReject(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            $application = Application::with(['organization'])->findOrFail($id);

            // Check if application is in the correct status
            if ($application->status !== 'drdo_approval_pending') {
                return $this->errorResponse('Only applications pending DRDO approval can be rejected', 400);
            }

            // Validate required reason
            $validator = Validator::make($request->all(), [
                'reason' => 'required|string|min:10|max:500',
            ]);

            if ($validator->fails()) {
                return $this->errorResponse($validator->errors()->first(), 422);
            }

            DB::beginTransaction();

            // Execute the state machine transition
            $application->transitionTo('drdo_reject', [
                'reason' => $request->input('reason'),
            ], $user);

            DB::commit();

            $application->load(['organization:id,name', 'unit:id,email,contact_person_name', 'creator:id,first_name,last_name,email']);

            return $this->successResponse(
                $this->formatApplicationData($application, $user),
                'Application rejected successfully'
            );

        } catch (QueryException $e) {
            DB::rollBack();
            Log::error('DRDO rejection failed due to database error', [
                'application_id' => $id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return $this->errorResponse('An unexpected error occurred. Please try again.', 500);
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to reject application', 422);
        }
    }

    /**
     * Update manufacturing application.
     *
     * @param  User  $user
     */
    private function updateManufacturingApplication(Application $application, array $data, $user): JsonResponse
    {
        try {
            DB::beginTransaction();

            // Frontend now sends data with DB column names directly (mfg_ prefix)
            // No field mapping needed - data is saved directly via model casts

            // Handle file uploads using FileStorageService (private storage)
            $data = $this->handleApplicationFileUploads($data, $application->id, $application);

            // Update application - JSON columns are updated directly via model casts
            $application->update(array_merge($data, ['updated_by' => $user->id]));

            DB::commit();

            // Load relationships for response
            $application->load([
                'organization:id,name',
                'unit:id,email,contact_person_name',
                'creator:id,first_name,last_name,email',
            ]);

            return $this->successResponse(
                $this->formatApplicationData($application, $user),
                'Manufacturing application updated successfully'
            );

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Update services application.
     *
     * @param  User  $user
     */
    private function updateServicesApplication(Application $application, array $data, $user): JsonResponse
    {
        try {
            DB::beginTransaction();

            // Frontend now sends data with DB column names directly (svc_ prefix)
            // svc_key_resources may contain mixed types - split into key_resources and outsourced_components
            // Only extract svc_outsourced_components from svc_key_resources if NOT already provided separately
            if (isset($data['svc_key_resources']) && is_array($data['svc_key_resources'])) {
                $allResources = $data['svc_key_resources'];
                $data['svc_key_resources'] = array_values(array_filter($allResources, fn ($r) => ($r['resource_type'] ?? 'serviceResource') === 'serviceResource'));
                // Only set svc_outsourced_components from svc_key_resources if not already provided
                if (! isset($data['svc_outsourced_components']) || ! is_array($data['svc_outsourced_components'])) {
                    $data['svc_outsourced_components'] = array_values(array_filter($allResources, fn ($r) => ($r['resource_type'] ?? '') === 'serviceComponent'));
                }
            }

            // Handle file uploads using FileStorageService (private storage)
            $data = $this->handleApplicationFileUploads($data, $application->id, $application);

            // Update application - JSON columns are updated directly via model casts
            $application->update(array_merge($data, ['updated_by' => $user->id]));

            DB::commit();

            // Load relationships for response
            $application->load([
                'organization:id,name',
                'unit:id,email,contact_person_name',
                'creator:id,first_name,last_name,email',
            ]);

            return $this->successResponse(
                $this->formatApplicationData($application, $user),
                'Services application updated successfully'
            );

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Generate unique application number.
     *
     * Format: SAMAR-{{XX}}-{{MMYY}}
     * - XX: Sequence number (next application ID)
     * - MMYY: Month + Year (2-digit format, e.g., 0326 for March 2026)
     */
    private function generateApplicationNumber(): string
    {
        return Application::generateApplicationNumber();
    }

    /**
     * Format application data for response.
     *
     * @param  User  $user
     */
    /**
     * Applicant-facing status label.
     *
     * The application status moves to in_progress when the assessor is allocated,
     * long before any on-site work. For the applicant we instead reflect the
     * assessment's real state: "Assessment Scheduled" until the lead saves the
     * opening meeting (assessment.status -> in_progress), then "Assessment In
     * Progress" through the remaining review stages. Every other application
     * status falls back to its normal label.
     */
    private function getApplicantStatusLabel(Application $application): string
    {
        if ($application->status !== 'in_progress' || ! $application->assessment) {
            return $application->getStatusLabel();
        }

        return in_array($application->assessment->status, [
            Assessment::STATUS_ALLOCATION_PENDING,
            Assessment::STATUS_SCHEDULED,
        ], true)
            ? 'Assessment Scheduled'
            : 'Assessment In Progress';
    }

    private function formatApplicationData(Application $application, $user, bool $includeDetails = false): array
    {
        // Build counts based on sector (using JSON columns)
        $counts = [
            'customers' => is_array($application->customers) ? count($application->customers) : 0,
        ];

        // Add sector-specific counts
        if ($application->sector === 'manufacturing') {
            $counts['products'] = is_array($application->mfg_products) ? count($application->mfg_products) : 0;
            $counts['raw_materials'] = is_array($application->mfg_raw_materials) ? count($application->mfg_raw_materials) : 0;
            $counts['bought_out_parts'] = is_array($application->mfg_bought_out_parts) ? count($application->mfg_bought_out_parts) : 0;
            $counts['processes'] = is_array($application->mfg_key_processes) ? count($application->mfg_key_processes) : 0;
            $counts['outsourced_processes'] = is_array($application->mfg_outsourced_processes) ? count($application->mfg_outsourced_processes) : 0;
        } elseif ($application->sector === 'service') {
            $counts['services'] = is_array($application->svc_services) ? count($application->svc_services) : 0;
            $counts['key_resources'] = is_array($application->svc_key_resources) ? count($application->svc_key_resources) : 0;
            $counts['outsourced_components'] = is_array($application->svc_outsourced_components) ? count($application->svc_outsourced_components) : 0;
            $counts['processes'] = is_array($application->svc_key_processes) ? count($application->svc_key_processes) : 0;
            $counts['outsourced_processes'] = is_array($application->svc_outsourced_processes) ? count($application->svc_outsourced_processes) : 0;
        }

        $data = [
            'id' => $application->id,
            'application_number' => $application->application_number,
            'sector' => $application->sector,
            'service_provider_type' => $application->sector === 'service' ? $application->svc_provider_type : null,
            'organization_id' => $application->organization_id,
            'organization_name' => $application->organization_name,
            'unit_id' => $application->unit_id,
            'unit_name' => $application->unit_name,
            'unit_address' => $application->unit_address,
            'full_unit_address' => $application->full_unit_address,
            'cin' => $application->cin,
            'enterprise_classification' => $application->enterprise_classification,
            'is_existing_drdo_vendor' => $application->is_existing_drdo_vendor,
            'application_type' => $application->application_type,
            'previous_application_id' => $application->previous_application_id,
            'previous_application_number' => $application->relationLoaded('previousApplication')
                ? $application->previousApplication?->application_number
                : null,
            'status' => $application->status,
            'status_label' => $application->getStatusLabel(),
            'status_metadata' => $application->getStatusMetadata(),
            // Applicant-facing label: the stored application status flips to
            // in_progress at assessor allocation, but the applicant (a service-sector
            // participant) should only see "In Progress" once the assessment actually
            // starts — i.e. the lead saves the opening meeting (assessment.status=in_progress).
            'assessment_status' => $application->assessment?->status,
            'applicant_status_label' => $this->getApplicantStatusLabel($application),
            'payment_status' => $application->payment_status,
            'progress_percentage' => round($application->getProgress(), 2),
            'counts' => $counts,
            'can_edit' => $application->canEdit($user),
            'available_transitions' => $application->getAvailableTransitions($user),
            'assessment_id' => $application->assessment?->id,
            'assessment_scheduled_start_date' => $application->assessment?->scheduled_start_date?->toIso8601String(),
            'assessment_scheduled_end_date' => $application->assessment?->scheduled_end_date?->toIso8601String(),
            'assessment_meeting_link' => $application->assessment?->meeting_link,
            // Applicant site-picture upload opens only once the lead assessor is
            // on site (punched in) AND has locked parameter allocation.
            'lead_punched_in' => $application->assessment?->hasLeadPunchedIn() ?? false,
            'allocation_locked' => $application->assessment?->isAllocationLocked() ?? false,
            // Assessor roster for the applicant's "View Assessor(s)". Lead first.
            'assessors' => $application->assessment
                ? $application->assessment->teamMembers
                    ->sortByDesc(fn ($member) => $member->role === AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
                    ->map(fn ($member) => [
                        'id' => $member->user_id,
                        'name' => trim(($member->user?->first_name ?? '').' '.($member->user?->last_name ?? '')),
                        'mobile_number' => $member->user?->mobile_number,
                        'email' => $member->user?->email,
                        'role' => $member->role,
                        'is_lead' => $member->role === AssessmentTeamMember::ROLE_LEAD_ASSESSOR,
                    ])
                    ->values()
                    ->all()
                : [],
            'submitted_at' => $application->submitted_at?->toIso8601String(),
            'created_at' => $application->created_at->toIso8601String(),
            'updated_at' => $application->updated_at->toIso8601String(),
        ];

        if ($includeDetails) {
            // Return full application attributes (including relations already loaded) merged
            // with computed helper fields. Use toArray() to include casts and relations.
            // Frontend now uses DB column names directly (mfg_, svc_ prefixes)
            // ConvertResponseToCamelCase middleware converts snake_case to camelCase
            $appArray = $application->toArray();

            // Add computed helper fields
            $appArray['status_label'] = $application->getStatusLabel();
            $appArray['status_metadata'] = $application->getStatusMetadata();
            $appArray['progress_percentage'] = round($application->getProgress(), 2);
            $appArray['can_edit'] = $application->canEdit($user);
            $appArray['available_transitions'] = $application->getAvailableTransitions($user);

            // Ensure counts are present (toArray includes relations but not counts)
            $appArray['counts'] = $counts;

            // Explicitly include file URLs in detail views (not appended on every serialization)
            $appArray['gst_certificate_file_url'] = $application->gst_certificate_file_url;
            $appArray['govt_registration_certificate_url'] = $application->govt_registration_certificate_url;
            $appArray['drdo_certificate_file_url'] = $application->drdo_certificate_file_url;
            $appArray['dpiit_certificate_file_url'] = $application->dpiit_certificate_file_url;
            $appArray['udyam_certificate_file_url'] = $application->udyam_certificate_file_url;
            $appArray['incorporation_certificate_file_url'] = $application->incorporation_certificate_file_url;
            $appArray['site_exterior_photo_url'] = $application->site_exterior_photo_url;

            // Keep compatibility: preserve top-level id, application_number etc. from $data
            $data = array_merge($data, $appArray);
        }

        return $data;
    }

    /**
     * Store draft application (create or update).
     * Allows multiple drafts per organization - one per unit per sector.
     *
     * @param  User  $user
     */
    private function storeDraftApplication(array $data, $user): JsonResponse
    {
        // Derive organization_id from authenticated user's token
        if (! $user->organization_id) {
            return $this->errorResponse('User must be associated with an organization to create applications', 400);
        }

        // Set organization_id in data for unit creation
        $organizationId = $user->organization_id;
        $data['organization_id'] = $organizationId;
        $applicationId = $data['application_id'] ?? null;

        // Wrap entire operation in transaction to prevent orphaned units
        return DB::transaction(function () use ($data, $user, $organizationId, $applicationId) {
            // CASE 1: application_id is provided → Update existing draft.
            // Resolve the unit WITHOUT creating one: an address edit must not fork a new
            // unit and orphan the draft from the Unit Admin who owns it (visibility is
            // unit-scoped). Re-point only when the address matches a different existing
            // unit; otherwise update the draft's current unit address in place.
            if (! empty($applicationId)) {
                $targetDraft = Application::where('id', $applicationId)
                    ->where('organization_id', $organizationId)
                    ->where('status', 'draft')
                    ->lockForUpdate()
                    ->first();

                if (! $targetDraft) {
                    return $this->errorResponse(
                        'Draft application not found or already submitted',
                        404
                    );
                }

                $matchedUnit = $this->unitService->findByAddress($organizationId, $data);

                if ($matchedUnit && $matchedUnit->id !== $targetDraft->unit_id) {
                    // Address now belongs to a DIFFERENT existing unit. Block if that unit
                    // already holds a non-rejected application for this sector.
                    $conflict = Application::where('unit_id', $matchedUnit->id)
                        ->where('sector', $data['sector'])
                        ->whereNotIn('status', ['rejected'])
                        ->where('id', '!=', $targetDraft->id)
                        ->lockForUpdate()
                        ->first();

                    if ($conflict) {
                        Log::warning('Address already used by another application', [
                            'requested_application_id' => $applicationId,
                            'existing_application_id' => $conflict->id,
                            'existing_status' => $conflict->status,
                            'unit_id' => $matchedUnit->id,
                            'sector' => $data['sector'],
                        ]);

                        return $this->errorResponse(
                            'An application already exists for this address. A new application for the same address is not allowed.',
                            409 // Conflict
                        );
                    }

                    $targetDraft->unit_id = $matchedUnit->id;
                } else {
                    // Address matches the draft's current unit, or matches no unit at all:
                    // keep the draft on its current unit and update that unit in place.
                    $this->unitService->updateUnitAddress($targetDraft->unit_id, $data);
                }

                $data['unit_id'] = $targetDraft->unit_id;

                Log::info('Updating existing draft by application_id', [
                    'application_id' => $targetDraft->id,
                    'organization_id' => $organizationId,
                    'unit_id' => $targetDraft->unit_id,
                ]);

                return $this->updateDraftApplication($targetDraft, $data, $user);
            }

            // CASE 2: No application_id → Creating a new draft.
            // Find or create the unit based on address data.
            $unit = $this->unitService->findOrCreateByAddress($organizationId, $data);
            $data['unit_id'] = $unit->id;

            Log::info('Unit resolved for new draft application', [
                'unit_id' => $unit->id,
                'organization_id' => $organizationId,
            ]);

            // Reject if any non-rejected application already exists for this unit + sector.
            // Rejected applications are allowed to be re-applied for at the same address.
            $existingApplicationForUnit = Application::where('unit_id', $unit->id)
                ->where('sector', $data['sector'])
                ->whereNotIn('status', ['rejected'])
                ->lockForUpdate()
                ->first();

            if ($existingApplicationForUnit) {
                Log::warning('Duplicate application creation rejected - application already exists for this unit', [
                    'existing_application_id' => $existingApplicationForUnit->id,
                    'existing_status' => $existingApplicationForUnit->status,
                    'unit_id' => $unit->id,
                    'sector' => $data['sector'],
                ]);

                $message = $existingApplicationForUnit->status === 'draft'
                    ? 'A draft application already exists for this address. Please edit the existing draft instead of creating a new one.'
                    : 'An application already exists for this address. A new application for the same address is not allowed.';

                return $this->errorResponse($message, 409);
            }

            Log::info('Creating new draft application', [
                'unit_id' => $unit->id,
                'sector' => $data['sector'],
            ]);

            return $this->createDraftApplication($data, $user);
        });
    }

    /**
     * Create new draft application.
     *
     * @param  User  $user
     */
    private function createDraftApplication(array $data, $user): JsonResponse
    {
        try {
            DB::beginTransaction();

            $unitId = $data['unit_id'];
            $organizationId = $data['organization_id'];
            $sector = $data['sector'] ?? 'manufacturing';

            // Check if the unit is permitted to submit a new application (not just a draft)
            $canApply = Application::canUnitApply($unitId);
            if (! $canApply['allowed']) {
                DB::rollBack();

                return $this->errorResponse($canApply['reason'] ?? 'Unit cannot apply at this time.', 422);
            }

            // Generate application number up front so the Unit Admin invitation email
            // (contact-person-authorized) can include it.
            $applicationNumber = $this->generateApplicationNumber();

            // Handle Unit Admin creation if contact person email is provided
            if (! empty($data['contact_person_email'])) {
                $this->handleUnitAdminCreation(
                    $data['contact_person_email'],
                    [
                        'email' => $data['contact_person_email'],
                        'name' => $data['contact_person_name'] ?? '',
                        'designation' => $data['contact_person_designation'] ?? null,
                        'mobile' => $data['contact_person_mobile'] ?? null,
                    ],
                    $organizationId,
                    $unitId,
                    $user,
                    $applicationNumber
                );
            }

            // Frontend now sends data with DB column names directly (mfg_, svc_ prefixes)
            // For services, svc_key_resources may contain mixed types - split into key_resources and outsourced_components
            // Only extract svc_outsourced_components from svc_key_resources if NOT already provided separately
            if ($sector === 'service' && isset($data['svc_key_resources']) && is_array($data['svc_key_resources'])) {
                $allResources = $data['svc_key_resources'];
                $data['svc_key_resources'] = array_values(array_filter($allResources, fn ($r) => ($r['resource_type'] ?? 'serviceResource') === 'serviceResource'));
                // Only set svc_outsourced_components from svc_key_resources if not already provided
                if (! isset($data['svc_outsourced_components']) || ! is_array($data['svc_outsourced_components'])) {
                    $data['svc_outsourced_components'] = array_values(array_filter($allResources, fn ($r) => ($r['resource_type'] ?? '') === 'serviceComponent'));
                }
            }

            $data = $this->applyFileUploadMetadata($data);

            // Extract file uploads from data (to handle after application is created)
            $fileUploads = [];
            $fileFields = [
                'drdo_certificate_file',
                'site_exterior_photo',
                'gst_certificate_file',
                'govt_registration_certificate',
                'dpiit_certificate_file',
                'udyam_certificate_file',
                'incorporation_certificate_file',
            ];

            foreach ($fileFields as $field) {
                if (isset($data[$field]) && $data[$field] instanceof UploadedFile) {
                    $fileUploads[$field] = $data[$field];
                    unset($data[$field]);
                }
            }

            // Fetch organization name for denormalized storage
            $organizationName = Organization::where('id', $organizationId)->value('name');

            // Create application - JSON columns are saved directly via model casts
            $application = Application::create(array_merge($this->withoutUnansweredDefaults($data), [
                'organization_id' => $organizationId,
                'organization_name' => $organizationName,
                'application_number' => $applicationNumber,
                'status' => 'draft',
                'payment_status' => 'pending',
                'created_by' => $user->id,
            ]));

            // Handle file uploads using FileStorageService (private storage)
            if (! empty($fileUploads)) {
                $fileData = $this->handleApplicationFileUploads($fileUploads, $application->id);
                $application->update($fileData);
            }

            DB::commit();

            // Load relationships for response
            $application->load([
                'organization:id,name',
                'unit:id,email,contact_person_name',
                'creator:id,first_name,last_name,email',
            ]);

            return $this->successResponse(
                $this->formatApplicationData($application, $user),
                ucfirst($sector).' draft created successfully',
                201,
                $this->draftGstWarning($application),
            );

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Update existing draft application.
     *
     * @param  User  $user
     */
    private function updateDraftApplication(Application $application, array $data, $user): JsonResponse
    {
        // CRITICAL: Verify user can edit this draft
        if (! $application->canEdit($user)) {
            return $this->errorResponse(
                'Unauthorized to edit this draft application',
                403
            );
        }

        try {
            DB::beginTransaction();

            $data = $this->applyFileUploadMetadata($data, $application);

            // Handle file uploads using FileStorageService (private storage)
            $data = $this->handleApplicationFileUploads($data, $application->id, $application);

            // Determine sector from existing application or incoming data
            $sector = $data['sector'] ?? $application->sector;

            // Frontend now sends data with DB column names directly (mfg_, svc_ prefixes)
            // For services, svc_key_resources may contain mixed types - split into key_resources and outsourced_components
            // Only extract svc_outsourced_components from svc_key_resources if NOT already provided separately
            if ($sector === 'service' && isset($data['svc_key_resources']) && is_array($data['svc_key_resources'])) {
                $allResources = $data['svc_key_resources'];
                $data['svc_key_resources'] = array_values(array_filter($allResources, fn ($r) => ($r['resource_type'] ?? 'serviceResource') === 'serviceResource'));
                // Only set svc_outsourced_components from svc_key_resources if not already provided
                if (! isset($data['svc_outsourced_components']) || ! is_array($data['svc_outsourced_components'])) {
                    $data['svc_outsourced_components'] = array_values(array_filter($allResources, fn ($r) => ($r['resource_type'] ?? '') === 'serviceComponent'));
                }
            }

            // Ensure organization_name stays in sync
            $orgId = $data['organization_id'] ?? $application->organization_id;
            if ($orgId && ! $application->organization_name) {
                $data['organization_name'] = Organization::where('id', $orgId)->value('name');
            }

            // Update application with all data (JSON columns are auto-serialized via $casts)
            $application->update(array_merge($this->withoutUnansweredDefaults($data), ['updated_by' => $user->id]));

            // Create Unit Admin if contact person email is present and the unit has none yet.
            // Required because a draft can be saved without contact info, then completed via update.
            $unitId = $data['unit_id'] ?? $application->unit_id;
            if (! empty($data['contact_person_email']) && $unitId) {
                $this->handleUnitAdminCreation(
                    $data['contact_person_email'],
                    [
                        'email' => $data['contact_person_email'],
                        'name' => $data['contact_person_name'] ?? '',
                        'designation' => $data['contact_person_designation'] ?? null,
                        'mobile' => $data['contact_person_mobile'] ?? null,
                    ],
                    $application->organization_id,
                    $unitId,
                    $user,
                    $application->application_number
                );
            }

            DB::commit();

            // Load relationships for response
            $application->load([
                'organization:id,name',
                'unit:id,email,contact_person_name',
                'creator:id,first_name,last_name,email',
            ]);

            $formattedData = $this->formatApplicationData($application, $user);

            return $this->successResponse(
                $formattedData,
                ucfirst($application->sector).' draft updated successfully',
                200,
                $this->draftGstWarning($application),
            );

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Failed to update draft application', [
                'application_id' => $application->id ?? 'unknown',
                'user_id' => $user->id ?? 'unknown',
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Non-blocking GSTIN ↔ registered-state ↔ PAN consistency result for a draft
     * response. A draft always saves (it is a scratchpad); this lets the customer
     * portal surface the same message the submit gate would raise, on the GST step
     * itself, instead of only discovering it at submission. Returns `['gstWarning'
     * => [...]]` to spread into the response envelope, or `[]` when consistent/empty.
     *
     * The org's pan/registered_state are read directly because the draft response
     * only eager-loads organization:id,name.
     */
    private function draftGstWarning(Application $application): array
    {
        $org = Organization::where('id', $application->organization_id)->first(['pan', 'registered_state']);

        $result = $this->gstinValidator->validate(
            $application->gst_number,
            $org->pan ?? null,
            $org->registered_state ?? null,
        );

        if ($result !== null) {
            return ['gstWarning' => ['message' => $result->message, 'errorCode' => $result->code]];
        }

        // Consistency passed — surface the live registry result too, so the GST
        // step warns before submit if the GSTIN will not verify. Non-blocking:
        // a draft always saves.
        $gstin = trim((string) $application->gst_number);
        if ($gstin !== '' && $this->gstinVerifier->isEnabled()) {
            $verification = $this->gstinVerifier->verify($gstin);
            if (! $verification->verified) {
                return ['gstWarning' => [
                    'message' => $verification->customerMessage(),
                    'errorCode' => $verification->errorCode ?? $verification->status,
                ]];
            }
        }

        return [];
    }

    /**
     * Live GSTIN ↔ registered-state ↔ PAN consistency check for the create flow.
     * The portal calls this when the GST field loses focus so the same rule the submit
     * gate enforces is surfaced inline immediately, instead of only at draft-save/submit.
     * Validates the supplied GSTIN against the authenticated user's own organisation.
     *
     * @OA\Post(
     *     path="/api/v1/applications/validate-gstin",
     *     summary="Live GSTIN consistency check (blur-time)",
     *     tags={"Enterprise Admin - Application", "Unit Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="gstNumber", type="string", example="06AAAAA0000A1Z5")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Consistency checked (valid=false with errorCode/message when inconsistent)"
     *     )
     * )
     */
    public function validateGstin(Request $request): JsonResponse
    {
        // Incoming keys are snake_cased by the ConvertRequestToSnakeCase middleware, so the
        // portal's `gstNumber` reaches the controller as `gst_number` (same as the draft request).
        $validated = $request->validate([
            'gst_number' => 'nullable|string|max:20',
        ]);

        $user = Auth::user();
        $org = $user->organization_id
            ? Organization::where('id', $user->organization_id)->first(['pan', 'registered_state'])
            : null;

        $result = $this->gstinValidator->validate(
            $validated['gst_number'] ?? null,
            $org->pan ?? null,
            $org->registered_state ?? null,
        );

        // Only run the live registry check once the offline consistency check
        // passes and a GSTIN is present — the same order the submit gate uses.
        $gstin = trim((string) ($validated['gst_number'] ?? ''));
        if ($result === null && $gstin !== '' && $this->gstinVerifier->isEnabled()) {
            $verification = $this->gstinVerifier->verify($gstin);
            if (! $verification->verified) {
                return $this->successResponse([
                    'valid' => false,
                    'errorCode' => $verification->errorCode ?? $verification->status,
                    'message' => $verification->customerMessage(),
                ], 'GSTIN consistency checked');
            }
        }

        return $this->successResponse([
            'valid' => $result === null,
            'errorCode' => $result?->code,
            'message' => $result?->message,
        ], 'GSTIN consistency checked');
    }

    /**
     * @OA\Get(
     *     path="/api/v1/applications/{id}/scorecard",
     *     summary="Get application scorecard",
     *     tags={"Application", "System Admin - Application", "Unit Admin - Application", "Enterprise Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Scorecard retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Application not found"
     *     )
     * )
     */

    /**
     * Create a Unit Admin for the unit.
     *
     * Identity model: SAMAR ID is the identifier; email is a notification channel only
     * (no lookup, no "reuse if email exists"). Idempotency is unit-scoped: if the unit
     * already has any active Unit Admin, this is a no-op. Failures bubble up so the
     * outer transaction rolls back the application draft.
     */
    private function handleUnitAdminCreation(
        string $email,
        array $contactData,
        int $organizationId,
        int $unitId,
        $performedBy,
        ?string $applicationNumber = null
    ): ?User {
        // A login needs a mobile number (users.mobile_number is NOT NULL). The per-field
        // autosave can deliver the email before the mobile is typed; wait for the next
        // save rather than fail the whole draft.
        if (empty($contactData['mobile'])) {
            Log::info('Contact person incomplete; deferring Unit Admin provisioning until the mobile is supplied', [
                'unit_id' => $unitId,
                'organization_id' => $organizationId,
            ]);

            return null;
        }

        // A Unit Admin must not provision accounts. When a Unit Admin initiates the
        // application, the contact person is themselves — no separate login is created.
        if ($performedBy && $performedBy->hasRole(Role::UNIT_ADMIN)) {
            Log::info('Unit Admin initiated application; skipping contact-person account provisioning', [
                'unit_id' => $unitId,
                'organization_id' => $organizationId,
                'performed_by_user_id' => $performedBy->id,
            ]);

            return null;
        }

        $hasActiveUnitAdmin = \DB::table('user_role')
            ->where('unit_id', $unitId)
            ->where('is_active', true)
            ->whereIn('role_id', function ($q) {
                $q->select('id')->from('roles')->where('slug', Role::UNIT_ADMIN);
            })
            ->exists();

        if ($hasActiveUnitAdmin) {
            $syncedUnitAdminId = $this->syncUnitAdminContactDetails($unitId, $organizationId, $contactData, $applicationNumber);
            Log::info('Unit already has an active Unit Admin; synced contact details', [
                'unit_id' => $unitId,
                'organization_id' => $organizationId,
                'synced_unit_admin_user_id' => $syncedUnitAdminId,
            ]);

            return null;
        }

        return $this->userService->createUnitAdminFromContactPerson(
            $contactData,
            $organizationId,
            $unitId,
            $performedBy,
            $applicationNumber
        );
    }

    /**
     * Drop null values for NOT NULL columns that carry a database default, so an
     * unanswered question in a partial draft save never reaches the INSERT/UPDATE.
     */
    private function withoutUnansweredDefaults(array $data): array
    {
        foreach (Application::DRAFT_DEFAULTED_COLUMNS as $column) {
            if (array_key_exists($column, $data) && $data[$column] === null) {
                unset($data[$column]);
            }
        }

        return $data;
    }

    /**
     * Sync the linked Unit Admin from contact-person data.
     *
     * A unit has one Unit Admin login keyed by SAMAR id, not by email. This refreshes that
     * same account's name/designation/mobile, and when the contact email changes it hands
     * the account to the new address (re-issuing login credentials) so all communications
     * follow the current contact. No new Unit Admin is created here. Delegates to
     * UserService; returns the updated user id, or null when no admin exists.
     */
    private function syncUnitAdminContactDetails(
        int $unitId,
        int $organizationId,
        array $contactData,
        ?string $applicationNumber = null
    ): ?int {
        $unitAdmin = $this->userService->updateUnitAdminContactPerson(
            $unitId,
            $organizationId,
            $contactData,
            $applicationNumber,
            auth()->user()
        );

        return $unitAdmin?->id;
    }

    /**
     * Export applications data.
     *
     * @OA\Get(
     *     path="/api/v1/applications/export",
     *     summary="Export applications data",
     *     description="Exports applications data as CSV. Supports filtering by search, status, and sector.",
     *     tags={"Application", "System Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search by application number",
     *         required=false,
     *
     *         @OA\Schema(type="string", minLength=2, maxLength=100)
     *     ),
     *
     *     @OA\Parameter(
     *         name="status",
     *         in="query",
     *         description="Filter by application status",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"draft", "drdo_approval_pending", "payment_pending", "payment_completed", "in_progress", "certified", "rejected"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="sector",
     *         in="query",
     *         description="Filter by sector",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"manufacturing", "service"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="type",
     *         in="query",
     *         description="Filter by application type (Fresh = new / Renewal = renewal)",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"new", "renewal"})
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="CSV file download",
     *
     *         @OA\MediaType(
     *             mediaType="text/csv",
     *
     *             @OA\Schema(type="string", format="binary")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden - Insufficient permissions"
     *     ),
     *     @OA\Response(
     *         response=500,
     *         description="Server error"
     *     )
     * )
     */
    public function export(ApplicationExportRequest $request): StreamedResponse|JsonResponse
    {
        $user = Auth::user();

        // Authorize
        if (! $user->can('viewAny', Application::class)) {
            return $this->errorResponse('Unauthorized to export applications', 403);
        }

        try {
            $query = Application::query()
                ->with(['organization:id,name', 'unit:id,email,contact_person_name', 'creator:id,first_name,last_name,email']);

            // Apply organization/unit scope based on role
            if ($user->hasRole('enterprise_admin')) {
                $query->where('organization_id', $user->organization_id);
            } elseif ($user->hasRole('unit_admin')) {
                $userUnits = $user->roles()
                    ->where('slug', 'unit_admin')
                    ->wherePivot('is_active', true)
                    ->get()
                    ->pluck('pivot.unit_id')
                    ->filter()
                    ->toArray();

                // SECURITY: Always filter by organization_id AND unit_id to prevent cross-org access
                $query->where('organization_id', $user->organization_id)
                    ->whereIn('unit_id', $userUnits);
            }

            // Apply state-based filtering for Operations Manager
            $this->stateFilterService->applyToApplicationQuery($query, $user);

            // Apply search filter
            if ($request->filled('search')) {
                $search = trim($request->input('search'));
                $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
                $query->where('application_number', 'LIKE', "%{$search}%");
            }

            // Apply status filter
            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            // Apply sector filter
            if ($request->filled('sector')) {
                $query->where('sector', $request->input('sector'));
            }

            // Apply application type filter (Fresh = new / Renewal = renewal)
            if ($request->filled('type')) {
                $query->byType($request->input('type'));
            }

            // Enterprise size, offered on the list screens alongside sector.
            if ($request->filled('enterprise_classification')) {
                $query->where('enterprise_classification', $request->input('enterprise_classification'));
            }

            // Statuses the calling screen hides. The DRDO Admin list excludes drafts,
            // so without this its export would hand back rows the screen never shows.
            if ($request->filled('exclude_status')) {
                $excludeStatuses = array_filter(array_map('trim', explode(',', $request->input('exclude_status'))));
                $query->whereNotIn('status', $excludeStatuses);
            }

            // Generate CSV. Rows are streamed in chunks rather than collected up front, so
            // memory stays flat however many applications match. chunkById drives the order,
            // so no orderBy is set here.
            $exportQuery = clone $query;

            $filename = 'applications_export_'.now()->format('Y-m-d_His').'.csv';

            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ];

            $callback = function () use ($exportQuery) {
                $file = fopen('php://output', 'w');

                // Add BOM for UTF-8 Excel compatibility
                fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

                // CSV Headers
                fputcsv($file, [
                    'ID',
                    'Application Number',
                    'Application Type',
                    'Sector',
                    'Status',
                    'Organization Name',
                    'Enterprise Name',
                    'DRDO Vendor Category',
                    'Contact Person Name',
                    'Contact Person Email',
                    'Contact Person Mobile',
                    'Unit State',
                    'Unit District',
                    'Payment Status',
                    'Submitted At',
                    'Created At',
                ]);

                $exportQuery->chunkById(500, function ($applications) use ($file) {
                    foreach ($applications as $application) {
                        Csv::putRow($file, [
                            $application->id,
                            $application->application_number,
                            $application->application_type,
                            $application->sector,
                            $application->status,
                            $application->organization?->name ?? '',
                            $application->enterprise_name ?? '',
                            $application->vendor_category ?? '',
                            $application->contact_person_name ?? '',
                            $application->contact_person_email ?? '',
                            $application->contact_person_mobile ?? '',
                            $application->unit_state ?? '',
                            $application->unit_district ?? '',
                            $application->payment_status ?? '',
                            $application->submitted_at?->toDateTimeString() ?? '',
                            $application->created_at->toDateTimeString(),
                        ]);
                    }
                });

                fclose($file);
            };

            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            Log::error('Failed to export applications', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to export applications.', 500);
        }
    }

    /**
     * Set preferred assessment date for an application.
     *
     * @OA\Put(
     *     path="/api/v1/applications/{id}/preferred-assessment-date",
     *     summary="Set preferred assessment date",
     *     description="Allows enterprise admin and unit admin to set the preferred assessment date after payment",
     *     operationId="setPreferredAssessmentDate",
     *     tags={"Applications"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Application ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"preferredAssessmentDate"},
     *
     *             @OA\Property(property="preferredAssessmentDate", type="string", format="date", example="2025-12-15")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Preferred assessment date updated successfully"
     *     ),
     *     @OA\Response(response=403, description="Forbidden"),
     *     @OA\Response(response=404, description="Application not found"),
     *     @OA\Response(response=422, description="Validation error")
     * )
     */
    public function setPreferredAssessmentDate(Request $request, int $id): JsonResponse
    {
        $application = Application::find($id);

        if (! $application) {
            return $this->errorResponse('Application not found.', 404);
        }

        // Check authorization - only an admin from the org that owns this application can set the date
        // (role enforcement is handled by the route middleware)
        $user = auth()->user();
        if ($user->organization_id !== $application->organization_id) {
            return $this->errorResponse('You are not authorized to update this application.', 403);
        }

        // Validate request (middleware converts camelCase to snake_case)
        $validated = $request->validate([
            'preferred_assessment_date' => 'required|date_format:Y-m-d|after_or_equal:today',
        ]);

        // Update the application
        $application->preferred_assessment_date = $validated['preferred_assessment_date'];
        $application->save();

        return $this->successResponse([
            'message' => 'Preferred assessment date updated successfully.',
            'preferredAssessmentDate' => $application->preferred_assessment_date?->format('Y-m-d'),
        ]);
    }

    /**
     * Update application contact person details.
     *
     * @OA\Put(
     *     path="/api/v1/applications/{id}/contact-person",
     *     summary="Update application contact person",
     *     description="Allows enterprise admin and unit admin to update contact person details for applications in editable status (draft, drdo_approval_pending, payment_pending)",
     *     operationId="updateContactPerson",
     *     tags={"Application", "Enterprise Admin - Application", "Unit Admin - Application"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Application ID",
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="contactPersonName", type="string", maxLength=255, nullable=true, example="John Doe"),
     *             @OA\Property(property="contactPersonDesignation", type="string", maxLength=255, nullable=true, example="Manager"),
     *             @OA\Property(property="contactPersonMobile", type="string", maxLength=10, nullable=true, example="9876543210"),
     *             @OA\Property(property="contactPersonEmail", type="string", format="email", maxLength=320, nullable=true, example="john.doe@example.com")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Contact person updated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Contact person updated successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="applicationNumber", type="string", example="APP-2025-001"),
     *                 @OA\Property(property="contactPersonName", type="string", example="John Doe"),
     *                 @OA\Property(property="contactPersonDesignation", type="string", example="Manager"),
     *                 @OA\Property(property="contactPersonMobile", type="string", example="9876543210"),
     *                 @OA\Property(property="contactPersonEmail", type="string", example="john.doe@example.com"),
     *                 @OA\Property(property="updatedAt", type="string", format="date-time", example="2025-02-07T10:30:00.000000Z")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Application cannot be edited in current status"),
     *     @OA\Response(response=403, description="Forbidden - User not authorized to update this application"),
     *     @OA\Response(response=404, description="Application not found"),
     *     @OA\Response(response=422, description="Validation error")
     * )
     */
    public function updateContactPerson(UpdateApplicationContactPersonRequest $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            // Find the application
            $application = Application::find($id);

            if (! $application) {
                return $this->errorResponse('Application not found', 404);
            }

            // Only enterprise admin can update contact person, and only for their org's applications
            if (! $user->hasRole(Role::ENTERPRISE_ADMIN) ||
                $user->organization_id !== $application->organization_id) {
                return $this->errorResponse('Unauthorized to update this application', 403);
            }

            // Update only the validated contact person fields
            $validatedData = $request->validated();

            $updatedFields = array_keys($validatedData);
            $syncedUnitAdminId = null;

            DB::transaction(function () use ($application, $validatedData, &$syncedUnitAdminId) {
                foreach ($validatedData as $key => $value) {
                    $application->$key = $value;
                }
                $application->save();

                if (! $application->unit_id) {
                    return;
                }

                $contactData = [];
                if (array_key_exists('contact_person_name', $validatedData)) {
                    $contactData['name'] = $validatedData['contact_person_name'];
                }
                if (array_key_exists('contact_person_designation', $validatedData)) {
                    $contactData['designation'] = $validatedData['contact_person_designation'];
                }
                if (array_key_exists('contact_person_mobile', $validatedData)) {
                    $contactData['mobile'] = $validatedData['contact_person_mobile'];
                }
                if (array_key_exists('contact_person_email', $validatedData)) {
                    $contactData['email'] = $validatedData['contact_person_email'];
                }

                $syncedUnitAdminId = $this->syncUnitAdminContactDetails(
                    $application->unit_id,
                    $application->organization_id,
                    $contactData,
                    $application->application_number
                );
            });

            // Log the update
            Log::info('Application contact person updated', [
                'application_id' => $application->id,
                'user_id' => $user->id,
                'updated_fields' => $updatedFields,
                'synced_unit_admin_user_id' => $syncedUnitAdminId,
            ]);

            // Return success response with camelCase data
            return $this->successResponse([
                'id' => $application->id,
                'applicationNumber' => $application->application_number,
                'contactPersonName' => $application->contact_person_name,
                'contactPersonDesignation' => $application->contact_person_designation,
                'contactPersonMobile' => $application->contact_person_mobile,
                'contactPersonEmail' => $application->contact_person_email,
                'updatedAt' => $application->updated_at,
            ], 'Contact person updated successfully');

        } catch (\Exception $e) {
            Log::error('Failed to update application contact person', [
                'application_id' => $id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->serverErrorResponse($e, 'Failed to update contact person');
        }
    }
}
