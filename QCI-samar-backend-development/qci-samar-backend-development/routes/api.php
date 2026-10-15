<?php

use App\Http\Controllers\Api\V1\ApplicationAssessmentAttendanceController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentBasicInformationController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentMeetingController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentMobileCompletionController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentParameterAllocationController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentQuestionFeedbackController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentResetController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentResponseController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentSitePictureController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentSiteTourPictureController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentStepProgressController;
use App\Http\Controllers\Api\V1\ApplicationAssessmentSummaryController;
use App\Http\Controllers\Api\V1\ApplicationController;
use App\Http\Controllers\Api\V1\ApplicationFeedbackController;
use App\Http\Controllers\Api\V1\AssessmentController;
use App\Http\Controllers\Api\V1\AssessmentParameterController;
use App\Http\Controllers\Api\V1\AssessmentQuestionController;
use App\Http\Controllers\Api\V1\AssessorDomainsController;
use App\Http\Controllers\Api\V1\AssessorOffTimeController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\Auth\CaptchaController;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\PasswordController;
use App\Http\Controllers\Api\V1\Auth\RegisterController;
use App\Http\Controllers\Api\V1\Auth\TwoFactorController;
use App\Http\Controllers\Api\V1\BrandAssetController;
use App\Http\Controllers\Api\V1\CertificateController;
use App\Http\Controllers\Api\V1\CommitteeMeetingController;
use App\Http\Controllers\Api\V1\CommitteeMemberController;
use App\Http\Controllers\Api\V1\ContentBlockController;
use App\Http\Controllers\Api\V1\CountryController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DisciplineController;
use App\Http\Controllers\Api\V1\DistrictController;
use App\Http\Controllers\Api\V1\DocumentController;
use App\Http\Controllers\Api\V1\EmailTemplateController;
use App\Http\Controllers\Api\V1\Erp\ErpDocumentController;
use App\Http\Controllers\Api\V1\Erp\ErpTokenController;
use App\Http\Controllers\Api\V1\ErrorGroupController;
use App\Http\Controllers\Api\V1\ErrorLogController;
use App\Http\Controllers\Api\V1\FeeConfigurationController;
use App\Http\Controllers\Api\V1\FeedbackQuestionController;
use App\Http\Controllers\Api\V1\IntegrationFailureController;
use App\Http\Controllers\Api\V1\InvoiceController;
use App\Http\Controllers\Api\V1\MailConfigurationController;
use App\Http\Controllers\Api\V1\ManufacturingBoughtOutPartsController;
use App\Http\Controllers\Api\V1\ManufacturingKeyProcessesController;
use App\Http\Controllers\Api\V1\ManufacturingRawMaterialsController;
use App\Http\Controllers\Api\V1\ManufacturingStoresMasterController;
use App\Http\Controllers\Api\V1\ManufacturingVendorCategoriesController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\PaymentWebhookController;
use App\Http\Controllers\Api\V1\PincodeController;
use App\Http\Controllers\Api\V1\QuickLinkController;
use App\Http\Controllers\Api\V1\ServiceKeyProcessesController;
use App\Http\Controllers\Api\V1\ServiceKeyResourcesController;
use App\Http\Controllers\Api\V1\ServiceOutsourcedComponentsController;
use App\Http\Controllers\Api\V1\ServiceVendorCategoriesController;
use App\Http\Controllers\Api\V1\ServiceVendorLabsController;
use App\Http\Controllers\Api\V1\StateController;
use App\Http\Controllers\Api\V1\SupportTicketController;
use App\Http\Controllers\Api\V1\SystemSettingsController;
use App\Http\Controllers\Api\V1\SystemStatusController;
use App\Http\Controllers\Api\V1\ThirdPartyCertController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Middleware\ConvertRequestToSnakeCase;
use App\Http\Middleware\ConvertResponseToCamelCase;
use App\Models\Role;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
 * Before removing any route, check the frontend repos for callers:
 *   - /Users/webority-admin/Code/qci-samar-web (rg the path in src/services/api/)
 *   - /Users/webority-admin/Code/qci-samar-assessor-mobile
 * A grep of this backend repo alone is NOT sufficient — three separate
 * cleanups (20a88c9, see also 7852fd6, d04c022, b0946cb) had to be reverted
 * because the route was still being called by the frontend.
 */

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Health check endpoint (no auth required)
Route::get('/health', function () {
    $dbConnected = false;
    try {
        DB::connection()->getPdo();
        $dbConnected = true;
    } catch (Exception $e) {
        // DB is down
    }

    $stampPath = public_path('deployed-commit.txt');

    return response()->json([
        'success' => true,
        'message' => 'QCI Samar API is running',
        'version' => config('app.api_version'),
        'environment' => config('app.env'),
        'deployed_commit' => is_readable($stampPath) ? (trim((string) file_get_contents($stampPath)) ?: null) : null,
        'database' => $dbConnected ? 'connected' : 'disconnected',
        'timestamp' => now()->toIso8601String(),
    ]);
});

// API version 1 routes
Route::prefix('v1')->group(function () {

    // System status endpoint (public, no auth required)
    // Frontend can check this to show maintenance page before/after login
    Route::get('/system/status', [SystemStatusController::class, 'status']);

    // Public certificate verification (no auth required)
    // GET supports QR-code deep links from certificate PDFs; POST kept for form/body callers.
    Route::match(['get', 'post'], '/verify-certificate', [CertificateController::class, 'verify']);

    // Instructions, declarations and disclaimers (public: the login, register
    // and policy pages read them before anyone is signed in)
    Route::middleware('throttle:120,1')->group(function () {
        Route::get('/content-blocks', [ContentBlockController::class, 'index']);
        Route::get('/content-blocks/{key}', [ContentBlockController::class, 'show']);
        Route::get('/branding', [BrandAssetController::class, 'index']);
        Route::get('/branding/{key}/image', [BrandAssetController::class, 'image']);
        Route::get('/quick-links', [QuickLinkController::class, 'index']);
        Route::get('/quick-links/{id}/file', [QuickLinkController::class, 'file'])->where('id', '[0-9]+');
    });

    // Public routes (no authentication required)
    Route::prefix('auth')->group(function () {
        // Registration & OTP
        Route::post('/register', [RegisterController::class, 'register'])
            ->middleware('throttle:auth.register');
        Route::post('/verify-otp', [RegisterController::class, 'verifyOtp'])
            ->middleware('throttle:auth.verify');
        Route::post('/resend-otp', [RegisterController::class, 'resendOtp'])
            ->middleware('throttle:auth.resend');

        // CAPTCHA challenge for the browser auth forms. Deliberately not on the
        // auth.login limiter — refreshing the image must not consume a user's
        // login attempts.
        Route::get('/captcha', [CaptchaController::class, 'show'])
            ->middleware('throttle:60,1');

        // Login (2FA with OTP)
        Route::post('/check-active-session', [LoginController::class, 'checkActiveSession'])
            ->middleware('throttle:auth.login');
        Route::post('/login', [LoginController::class, 'login'])
            ->middleware('throttle:auth.login');
        Route::post('/verify-login-otp', [LoginController::class, 'verifyLoginOtp'])
            ->middleware('throttle:auth.login');
        Route::post('/resend-login-otp', [LoginController::class, 'resendLoginOtp'])
            ->middleware('throttle:auth.login');

        // Password Reset
        Route::post('/forgot-password', [PasswordController::class, 'forgot'])
            ->middleware('throttle:auth.password');
        Route::post('/resend-password-otp', [PasswordController::class, 'resendOtp'])
            ->middleware('throttle:auth.resend.password');
        Route::post('/verify-password-otp', [PasswordController::class, 'verifyResetOtp'])
            ->middleware('throttle:auth.password');
        Route::post('/reset-password', [PasswordController::class, 'reset'])
            ->middleware('throttle:auth.password');

        // Token Refresh (public, but validates refresh token)
        Route::post('/refresh', [LoginController::class, 'refresh'])
            ->middleware(['validate.token.type:refresh', 'throttle:auth.refresh']);
    });

    // ERP (Business Central) inbound — machine-to-machine push of invoice and
    // receipt PDFs. Deliberately outside the 'maintenance' middleware group so
    // the ERP's scheduled batches are not 503'd during maintenance windows; the
    // upload is idempotent on (invstr, pdffor), so replays are safe.
    Route::middleware([
        'auth:api',
        'validate.token.type:access',
        'validate.session',
        'role:'.Role::ERP_INTEGRATION,
        'throttle:erp.ingest',
    ])->prefix('erp')->group(function () {
        // QCI's vendor contract uses snake_case field names (erp_invstr), so the
        // camelCase input gate/converter is excluded — keys must arrive verbatim.
        Route::post('/documents/upload', [ErpDocumentController::class, 'upload'])
            ->withoutMiddleware([ConvertRequestToSnakeCase::class]);
    });

    // ERP document-sync token endpoint. Request contract is fixed by QCI's
    // vendor reference (userName/password/grant_type/refreshToken), so the
    // case-conversion middleware is excluded — field casing must arrive and
    // return verbatim for BC's parser.
    Route::post('/erp/tokens', [ErpTokenController::class, 'token'])
        ->middleware('throttle:auth.login')
        ->withoutMiddleware([
            ConvertRequestToSnakeCase::class,
            ConvertResponseToCamelCase::class,
        ]);

    // Protected routes (require authentication)
    // The 'maintenance' middleware blocks enterprise_admin and unit_admin when maintenance mode is enabled
    Route::middleware(['auth:api', 'validate.token.type:access', 'validate.session', 'maintenance'])->group(function () {

        // Auth endpoints
        Route::prefix('auth')->group(function () {
            Route::post('/logout', [LoginController::class, 'logout']);
            Route::get('/me', [LoginController::class, 'me']);
            Route::post('/change-password', [PasswordController::class, 'change'])
                ->middleware('throttle:auth.sensitive');

            // Two-factor authentication management
            Route::get('/2fa-status', [TwoFactorController::class, 'status']);
            Route::post('/2fa/enable', [TwoFactorController::class, 'enable']);
            Route::post('/2fa/disable', [TwoFactorController::class, 'disable'])
                ->middleware('throttle:auth.sensitive');
        });

        // Admin operations
        Route::prefix('admin')->group(function () {
            // Authentication audit trail (login, password change, password reset)
            Route::get('/audit-logs', [AuditLogController::class, 'index'])
                ->middleware('role:system_admin');

            // Full audit/activity trail (data changes + authentication + security)
            Route::get('/activity-logs', [AuditLogController::class, 'activity'])
                ->middleware('role:system_admin');

            // Settings → Email Templates
            Route::prefix('email-templates')->middleware('role:system_admin')->group(function () {
                Route::get('/', [EmailTemplateController::class, 'index']);
                Route::get('/{id}', [EmailTemplateController::class, 'show'])->whereNumber('id');
                Route::put('/{id}', [EmailTemplateController::class, 'update'])->whereNumber('id');
                Route::post('/{id}/preview', [EmailTemplateController::class, 'preview'])->whereNumber('id');
                Route::post('/{id}/test', [EmailTemplateController::class, 'sendTest'])
                    ->whereNumber('id')
                    ->middleware('throttle:10,1');
                Route::post('/{id}/reset', [EmailTemplateController::class, 'reset'])->whereNumber('id');
            });

            // Settings → Email Server
            Route::prefix('mail-settings')->middleware('role:system_admin')->group(function () {
                Route::get('/', [MailConfigurationController::class, 'show']);
                Route::put('/', [MailConfigurationController::class, 'update']);
                Route::post('/test', [MailConfigurationController::class, 'test'])->middleware('throttle:10,1');
            });

            // Settings → Branding & Logos
            Route::prefix('branding')->middleware('role:system_admin')->group(function () {
                Route::get('/', [BrandAssetController::class, 'adminIndex']);
                Route::post('/{key}', [BrandAssetController::class, 'update']);
                Route::post('/{key}/reset', [BrandAssetController::class, 'reset']);
            });

            // Settings → Quick Links (login page)
            Route::prefix('quick-links')->middleware('role:system_admin')->group(function () {
                Route::get('/', [QuickLinkController::class, 'adminIndex']);
                Route::post('/', [QuickLinkController::class, 'store']);
                Route::post('/{id}', [QuickLinkController::class, 'update'])->where('id', '[0-9]+');
                Route::delete('/{id}', [QuickLinkController::class, 'destroy'])->where('id', '[0-9]+');
            });

            // Settings → Content & Disclaimers
            Route::prefix('content-blocks')->middleware('role:system_admin')->group(function () {
                Route::get('/', [ContentBlockController::class, 'adminIndex']);
                Route::put('/{key}', [ContentBlockController::class, 'update']);
                Route::post('/{key}/reset', [ContentBlockController::class, 'reset']);
            });
        });

        // Organization profile management (for authenticated user's own organization)
        Route::prefix('organization')->group(function () {
            Route::put('/', [OrganizationController::class, 'update']);
        });

        // Organization routes - view single organization (enterprise_admin can view their own)
        Route::get('/organizations/{id}', [OrganizationController::class, 'showById'])
            ->where('id', '[0-9]+');

        // System Admin organization management routes
        Route::prefix('organizations')->middleware('role:system_admin,operations_admin,operations_manager,drdo_admin,drdo_lab')->group(function () {
            Route::get('/', [OrganizationController::class, 'index']);
            Route::get('/export', [OrganizationController::class, 'export'])->middleware('throttle:exports');
            Route::get('/{id}/journey', [OrganizationController::class, 'journey'])->where('id', '[0-9]+');

            // Organization status management (System Admin, Operations Admin only)
            Route::post('/{id}/activate', [OrganizationController::class, 'activate'])
                ->middleware('role:system_admin,operations_admin');
            Route::post('/{id}/deactivate', [OrganizationController::class, 'deactivate'])
                ->middleware('role:system_admin,operations_admin');
        });

        // Unit management
        Route::prefix('units')->group(function () {
            // Used by web: services/api/unitAdmin/unit/Unit.js (UnitAdmin UI - list units)
            Route::get('/', [UnitController::class, 'index']);
            // Used by web: services/api/unitAdmin/unit/Unit.js (UnitAdmin UI - view unit)
            Route::get('/{id}', [UnitController::class, 'show']);
            // Change the spoke (Unit Admin) for a unit — Enterprise Admin only.
            Route::post('/{id}/change-spoke', [UnitController::class, 'changeSpoke'])
                ->middleware('role:enterprise_admin');
        });

        // User management
        Route::prefix('users')->group(function () {
            // Off-time for several assessors in one call. Registered before the
            // /{id} routes below, which would otherwise match "off-times" as an id.
            // Used by web: the scheduling modal, which previously fired one
            // /{id}/off-times request per assessor and exhausted the caller's
            // request allowance on a large assessor list. [BUG-08860]
            Route::get('/off-times', [AssessorOffTimeController::class, 'forAssessors'])
                ->middleware('role:operations_manager,operations_admin');

            // List and create users (role-restricted)
            Route::get('/', [UserController::class, 'index'])
                ->middleware('role:system_admin,enterprise_admin,operations_manager,operations_admin');
            Route::post('/', [UserController::class, 'store'])
                ->middleware('role:system_admin,enterprise_admin,operations_manager,operations_admin');

            // View and update specific user (authorization in controller/policy)
            Route::get('/{id}', [UserController::class, 'show']);
            Route::put('/{id}', [UserController::class, 'update']);

            // User status management (role-restricted)
            Route::post('/{id}/activate', [UserController::class, 'activate'])
                ->middleware('role:system_admin,enterprise_admin,operations_manager,operations_admin');
            Route::post('/{id}/deactivate', [UserController::class, 'deactivate'])
                ->middleware('role:system_admin,enterprise_admin,operations_manager,operations_admin');
            Route::post('/{id}/resend-credentials', [UserController::class, 'resendCredentials'])
                ->where('id', '[0-9]+')
                ->middleware(['role:system_admin,operations_manager,operations_admin', 'throttle:10,1']);

            // Used by web: services/api/unitAdmin/unitAdmin/unitAdminServices.js (UnitAdmin UI - assessor districts)
            Route::get('/{id}/assessor-districts', [UserController::class, 'getAssessorDistricts']);

            // Operations Manager read-only view of an assessor's logged off-time
            Route::get('/{id}/off-times', [AssessorOffTimeController::class, 'forAssessor'])
                ->middleware('role:operations_manager,operations_admin');
        });

        // Application management
        Route::prefix('applications')->group(function () {
            // Main application CRUD
            Route::get('/', [ApplicationController::class, 'index']);
            // Used by web: services/api/systemAdmin/ApplicationService.js (System Admin - export applications)
            Route::get('/export', [ApplicationController::class, 'export'])->middleware('throttle:exports');
            Route::post('/manufacturing/draft', [ApplicationController::class, 'storeManufacturingDraft'])
                ->middleware('file.security');
            Route::post('/services/draft', [ApplicationController::class, 'storeServicesDraft'])
                ->middleware('file.security');
            // Live GSTIN ↔ registered-state ↔ PAN consistency check for the create flow, so the
            // portal can flag an inconsistent GSTIN inline on blur (like format validation) instead
            // of waiting for draft-save or submit. Validates against the caller's own organisation.
            Route::post('/validate-gstin', [ApplicationController::class, 'validateGstin'])
                ->middleware('role:enterprise_admin,unit_admin');
            // Applications pending feedback (must be before {id} routes)
            Route::get('/feedback-pending', [ApplicationFeedbackController::class, 'pendingFeedback'])
                ->middleware('role:enterprise_admin,unit_admin');
            // Applications with submitted feedback — admin listing (must be before {id} routes)
            Route::get('/feedback-submissions', [ApplicationFeedbackController::class, 'submittedFeedback'])
                ->middleware('role:system_admin,operations_admin,operations_manager');
            // Bulk "all feedback" CSV export — same 3-role gate (must be before {id} routes)
            Route::get('/feedback-submissions/export', [ApplicationFeedbackController::class, 'export'])
                ->middleware(['role:system_admin,operations_admin,operations_manager', 'throttle:exports']);
            // Fee quote — the payment screen renders this rather than deriving the amount
            Route::get('/{applicationId}/fee', [PaymentController::class, 'fee']);

            Route::get('/{id}', [ApplicationController::class, 'show']);

            // Application file downloads (private storage)
            Route::get('/{id}/files/{field}', [ApplicationController::class, 'downloadFile']);

            // Application workflow actions
            Route::post('/{id}/submit', [ApplicationController::class, 'submit']);

            // Renewal initiation (enterprise admin only) — clones a certified
            // application into a fresh prefilled draft.
            Route::post('/{id}/renew', [ApplicationController::class, 'renew'])
                ->middleware('role:enterprise_admin');

            // Preferred assessment date (enterprise admin and unit admin)
            Route::put('/{id}/preferred-assessment-date', [ApplicationController::class, 'setPreferredAssessmentDate'])
                ->middleware('role:enterprise_admin,unit_admin');

            // Contact person update (enterprise admin and unit admin)
            Route::put('/{id}/contact-person', [ApplicationController::class, 'updateContactPerson'])
                ->middleware('role:enterprise_admin,unit_admin');

            // DRDO approval actions (DRDO Admin only)
            Route::post('/{id}/drdo-approve', [ApplicationController::class, 'drdoApprove'])
                ->middleware('role:drdo_admin');
            Route::post('/{id}/drdo-reject', [ApplicationController::class, 'drdoReject'])
                ->middleware('role:drdo_admin');

            // Application Feedbacks sub-resource
            Route::prefix('{applicationId}/feedbacks')->group(function () {
                // Feedback Application View + individual export — restricted to Ops Manager /
                // Ops Admin / System Admin only; 403 for every other role. Submission (form/store/
                // submit) stays open to enterprise_admin/unit_admin below.
                Route::get('/', [ApplicationFeedbackController::class, 'index'])
                    ->middleware('role:system_admin,operations_admin,operations_manager');
                Route::get('/export', [ApplicationFeedbackController::class, 'exportForApplication'])
                    ->middleware(['role:system_admin,operations_admin,operations_manager', 'throttle:exports']);
                Route::get('/form', [ApplicationFeedbackController::class, 'form']);
                Route::post('/submit', [ApplicationFeedbackController::class, 'submitAll'])
                    ->middleware('role:enterprise_admin,unit_admin');
                Route::post('/', [ApplicationFeedbackController::class, 'store']);
            });

            // Application Assessment Summary (read-only for Enterprise Admin and Unit Admin)
            Route::get('/{applicationId}/assessment-summary', [ApplicationAssessmentSummaryController::class, 'show'])
                ->name('applications.assessment-summary');
            Route::get('/{applicationId}/assessment-summary/evidences/{evidenceId}/download', [ApplicationAssessmentSummaryController::class, 'downloadEvidence'])
                ->name('applications.assessment-summary.evidences.download');

        });

        // Assessment management (main assessment CRUD and workflow)
        Route::prefix('assessments')->group(function () {
            // Main assessment CRUD
            Route::get('/', [AssessmentController::class, 'index']);
            // CSV export of the assessment list, same filters as index.
            // Used by web: services/api/common/AssessmentService.js (exportAssessments)
            Route::get('/export', [AssessmentController::class, 'export'])
                ->middleware(['role:operations_admin,operations_manager,system_admin,drdo_admin,drdo_lab', 'throttle:exports']);
            Route::get('/{id}', [AssessmentController::class, 'show']);

            // Assessment workflow actions (role-restricted)
            Route::post('/{id}/schedule', [AssessmentController::class, 'allocate'])
                ->middleware('role:operations_manager');
            Route::post('/{id}/start', [AssessmentController::class, 'start'])
                ->middleware('role:assessor');
            Route::post('/{id}/submit-for-qc', [AssessmentController::class, 'submitForQc'])
                ->middleware('role:assessor');
            Route::post('/{id}/co-assessor-submit', [AssessmentController::class, 'coAssessorSubmit'])
                ->middleware('role:assessor');
            Route::post('/{id}/qc-decision', [AssessmentController::class, 'qcDecision'])
                ->middleware('role:operations_manager');
            Route::post('/{id}/address-qc-feedback', [AssessmentController::class, 'addressQcFeedback'])
                ->middleware('role:assessor');
            Route::post('/{id}/schedule-committee', [AssessmentController::class, 'scheduleCommittee'])
                ->middleware('role:operations_admin');
            Route::post('/{id}/committee-decision', [AssessmentController::class, 'committeeDecision'])
                ->middleware('role:operations_admin');
            Route::put('/{id}/rc-scores', [AssessmentController::class, 'updateRcScores'])
                ->middleware('role:operations_admin');
            Route::post('/{id}/address-committee-feedback', [AssessmentController::class, 'addressCommitteeFeedback'])
                ->middleware('role:assessor');
            Route::get('/{id}/available-transitions', [AssessmentController::class, 'availableTransitions']);
            Route::get('/{id}/can-submit-for-qc', [AssessmentController::class, 'canSubmitForQc'])
                ->middleware('role:assessor,operations_manager,operations_admin,system_admin,drdo_admin');
            Route::get('/{identifier}/assessment-report/download', [AssessmentController::class, 'downloadAssessmentReport'])
                ->where('identifier', '[0-9]+|ASS-[0-9]{4}-[0-9]+')
                ->middleware(['role:enterprise_admin,unit_admin,operations_manager,operations_admin,system_admin,drdo_admin', 'throttle:exports']);
        });

        // Assessor off-time (unavailability) self-service
        Route::prefix('off-times')->middleware('role:assessor')->group(function () {
            Route::get('/', [AssessorOffTimeController::class, 'index']);
            Route::post('/', [AssessorOffTimeController::class, 'store']);
            Route::delete('/{id}', [AssessorOffTimeController::class, 'destroy']);
        });

        // =========================================================================
        // APPLICATION ASSESSMENT ENDPOINTS (Application-specific assessment data)
        // Separate from master assessment routes for clear naming convention
        // =========================================================================
        Route::prefix('application-assessments/{assessmentId}')->group(function () {

            // Assessment Responses sub-resource (answers to assessment questions)
            Route::prefix('responses')->group(function () {
                Route::get('/', [ApplicationAssessmentResponseController::class, 'index']);
                Route::get('/{questionId}', [ApplicationAssessmentResponseController::class, 'show']);
                Route::put('/{questionId}', [ApplicationAssessmentResponseController::class, 'update'])
                    ->middleware('role:assessor');

                // Evidence upload for responses
                Route::get('/{questionId}/evidences', [ApplicationAssessmentResponseController::class, 'listEvidences']);
                Route::post('/{questionId}/evidences', [ApplicationAssessmentResponseController::class, 'uploadEvidence'])
                    ->middleware(['role:assessor', 'file.security']);
                Route::delete('/{questionId}/evidences/{evidenceId}', [ApplicationAssessmentResponseController::class, 'deleteEvidence'])
                    ->middleware('role:assessor');
                Route::get('/{questionId}/evidences/{evidenceId}/download', [ApplicationAssessmentResponseController::class, 'downloadEvidence'])
                    ->name('api.v1.application-assessments.responses.evidences.download');
            });

            // Attendance (Punch-in/Punch-out) - Not a step, runs parallel
            Route::prefix('attendance')->group(function () {
                Route::get('/', [ApplicationAssessmentAttendanceController::class, 'index'])
                    ->middleware('role:assessor,operations_manager,operations_admin,system_admin,drdo_admin');
                Route::post('/punch-in', [ApplicationAssessmentAttendanceController::class, 'punchIn'])
                    ->middleware(['role:assessor', 'file.security']);
                Route::post('/punch-out', [ApplicationAssessmentAttendanceController::class, 'punchOut'])
                    ->middleware('role:assessor');
                Route::get('/my-status', [ApplicationAssessmentAttendanceController::class, 'myStatus'])
                    ->middleware('role:assessor');
                Route::get('/{attendanceId}/selfie', [ApplicationAssessmentAttendanceController::class, 'selfie'])
                    ->middleware('role:assessor,operations_manager,operations_admin,system_admin,drdo_admin')
                    ->name('api.v1.application-assessments.attendance.selfie');
            });

            // Mobile cutover - per-assessor "field work done" signal
            Route::post('/mobile-complete', [ApplicationAssessmentMobileCompletionController::class, 'complete'])
                ->middleware('role:assessor');
            Route::get('/mobile-completion-status', [ApplicationAssessmentMobileCompletionController::class, 'status'])
                ->middleware('role:assessor');

            // Reset (restart) — wipe assessor-captured execution data on the
            // server so the assessment can begin again from the start. Guarded
            // to team members and to pre-QC statuses inside the controller.
            Route::delete('/reset', [ApplicationAssessmentResetController::class, 'reset'])
                ->middleware('role:assessor');

            // Committee Feedback & Review
            Route::prefix('questions/{questionId}')->group(function () {
                Route::get('/feedback-history', [ApplicationAssessmentQuestionFeedbackController::class, 'feedbackHistory'])
                    ->middleware('role:operations_manager,operations_admin,system_admin,drdo_admin,assessor');
                Route::put('/response', [ApplicationAssessmentQuestionFeedbackController::class, 'updateResponse'])
                    ->middleware('role:operations_admin');
                Route::post('/clarification', [ApplicationAssessmentQuestionFeedbackController::class, 'submitClarification'])
                    ->middleware(['role:assessor', 'file.security']);
                Route::post('/clarification/{feedbackId}', [ApplicationAssessmentQuestionFeedbackController::class, 'updateClarification'])
                    ->middleware(['role:assessor', 'file.security']);
                Route::get('/feedback/{feedbackId}/attachments/{attachmentId}/download', [ApplicationAssessmentQuestionFeedbackController::class, 'downloadAttachment'])
                    ->middleware('role:operations_manager,operations_admin,system_admin,drdo_admin,assessor')
                    ->name('api.v1.application-assessments.questions.feedback.attachments.download');
            });

            // Step Progress tracking
            Route::prefix('step-progress')->group(function () {
                Route::get('/', [ApplicationAssessmentStepProgressController::class, 'show']);
            });

            // Step 1: Parameter Allocation
            Route::prefix('parameters')->group(function () {
                Route::get('/', [ApplicationAssessmentParameterAllocationController::class, 'index']);
                Route::get('/my-assignments', [ApplicationAssessmentParameterAllocationController::class, 'myAssignments'])
                    ->middleware('role:assessor');
                Route::post('/bulk-assign', [ApplicationAssessmentParameterAllocationController::class, 'bulkAssign'])
                    ->middleware('role:assessor');
            });

            // Step 2: Site Pictures
            Route::prefix('site-pictures')->group(function () {
                Route::get('/', [ApplicationAssessmentSitePictureController::class, 'index'])
                    ->middleware('role:assessor,operations_manager,operations_admin,system_admin,drdo_admin,unit_admin,enterprise_admin');
                Route::get('/mine', [ApplicationAssessmentSitePictureController::class, 'mine'])
                    ->middleware('role:assessor,unit_admin,enterprise_admin');
                Route::post('/', [ApplicationAssessmentSitePictureController::class, 'store'])
                    ->middleware(['role:assessor,unit_admin,enterprise_admin', 'file.security']);
                Route::delete('/{pictureId}', [ApplicationAssessmentSitePictureController::class, 'destroy'])
                    ->middleware('role:assessor,unit_admin,enterprise_admin');
                Route::get('/{pictureId}/download', [ApplicationAssessmentSitePictureController::class, 'download'])
                    ->middleware('role:assessor,operations_manager,operations_admin,system_admin,drdo_admin,unit_admin,enterprise_admin')
                    ->name('api.v1.application-assessments.site-pictures.download');
            });

            // Steps 3 & 7: Meetings (Opening & Closing)
            Route::prefix('meetings')->group(function () {
                Route::get('/{type}', [ApplicationAssessmentMeetingController::class, 'show'])
                    ->where('type', 'opening|closing')
                    ->middleware('role:assessor,operations_manager,operations_admin,system_admin,drdo_admin');
                Route::post('/{type}', [ApplicationAssessmentMeetingController::class, 'store'])
                    ->where('type', 'opening|closing')
                    ->middleware(['role:assessor', 'file.security']);
                Route::post('/{type}/participants', [ApplicationAssessmentMeetingController::class, 'addParticipant'])
                    ->where('type', 'opening|closing')
                    ->middleware('role:assessor');
                Route::delete('/{type}/participants/{participantId}', [ApplicationAssessmentMeetingController::class, 'removeParticipant'])
                    ->where('type', 'opening|closing')
                    ->middleware('role:assessor');
                Route::post('/{type}/comments', [ApplicationAssessmentMeetingController::class, 'addComment'])
                    ->where('type', 'opening|closing')
                    ->middleware('role:assessor');
                Route::get('/{type}/image', [ApplicationAssessmentMeetingController::class, 'image'])
                    ->where('type', 'opening|closing')
                    ->middleware('role:assessor,operations_manager,operations_admin,system_admin,drdo_admin')
                    ->name('api.v1.application-assessments.meetings.image');
            });

            // Step 4: Site Tour Pictures
            Route::prefix('site-tour-pictures')->group(function () {
                Route::get('/', [ApplicationAssessmentSiteTourPictureController::class, 'index'])
                    ->middleware('role:assessor,operations_manager,operations_admin,system_admin,drdo_admin,drdo_lab,unit_admin,enterprise_admin');
                Route::get('/mine', [ApplicationAssessmentSiteTourPictureController::class, 'mine'])
                    ->middleware('role:assessor,unit_admin,enterprise_admin');
                Route::post('/', [ApplicationAssessmentSiteTourPictureController::class, 'store'])
                    ->middleware(['role:assessor,unit_admin,enterprise_admin', 'file.security']);
                Route::delete('/{pictureId}', [ApplicationAssessmentSiteTourPictureController::class, 'destroy'])
                    ->middleware('role:assessor,unit_admin,enterprise_admin');
                Route::get('/{pictureId}/download', [ApplicationAssessmentSiteTourPictureController::class, 'download'])
                    ->middleware('role:assessor,operations_manager,operations_admin,system_admin,drdo_admin,drdo_lab,enterprise_admin,unit_admin')
                    ->name('api.v1.application-assessments.site-tour-pictures.download');
            });

            // Step 5: Basic Information (matches Application model structure)
            // All data stored as JSON columns (mfg_* for manufacturing, svc_* for services)
            Route::prefix('basic-information')->group(function () {
                Route::get('/', [ApplicationAssessmentBasicInformationController::class, 'show']);
                Route::post('/', [ApplicationAssessmentBasicInformationController::class, 'store'])
                    ->middleware('role:assessor');
            });
        });

        // Payment management
        Route::prefix('payments')->group(function () {
            Route::get('/', [PaymentController::class, 'index']);
            // CSV export of the payment list, same filters and scoping as index.
            // Must stay above /{id} or "export" is read as a payment id.
            // Used by web: services/api/payment/PaymentService.js (exportPayments)
            Route::get('/export', [PaymentController::class, 'export'])
                ->middleware('throttle:exports');
            Route::get('/{id}', [PaymentController::class, 'show']);
            Route::post('/initiate', [PaymentController::class, 'initiate']);
        });

        // Invoices, including the invoice/receipt PDFs pushed back by the ERP.
        // PDF access is authorised through the invoice (organisation scoped).
        Route::prefix('invoices')->group(function () {
            Route::get('/', [InvoiceController::class, 'index']);
            Route::get('/{id}', [InvoiceController::class, 'show']);
            Route::get('/{id}/invoice-pdf', [InvoiceController::class, 'downloadInvoicePdf']);
            Route::get('/{id}/receipt-pdf', [InvoiceController::class, 'downloadReceiptPdf']);
        });

        // Committee Members (pool of members for meetings)
        Route::prefix('committee-members')->middleware('role:system_admin,drdo_admin,operations_manager,operations_admin')->group(function () {
            Route::get('/', [CommitteeMemberController::class, 'index']);
            Route::get('/{id}', [CommitteeMemberController::class, 'show']);
            Route::post('/', [CommitteeMemberController::class, 'store'])
                ->middleware('role:operations_manager,operations_admin');
            Route::put('/{id}', [CommitteeMemberController::class, 'update'])
                ->middleware('role:operations_manager,operations_admin');
            Route::delete('/{id}', [CommitteeMemberController::class, 'destroy'])
                ->middleware('role:operations_manager,operations_admin,system_admin,drdo_admin');
        });

        // Committee Meetings (scheduled events)
        // System Admin is deliberately excluded from meetings; the controller enforced that
        // too, so requests were admitted here only to be refused later.
        Route::prefix('committee-meetings')->middleware('role:drdo_admin,operations_manager,operations_admin')->group(function () {
            Route::get('/', [CommitteeMeetingController::class, 'index']);
            Route::get('/{id}', [CommitteeMeetingController::class, 'show']);
            Route::post('/', [CommitteeMeetingController::class, 'store'])
                ->middleware('role:operations_manager,operations_admin');
            Route::put('/{id}', [CommitteeMeetingController::class, 'update'])
                ->middleware('role:operations_manager,operations_admin');
            Route::delete('/{id}', [CommitteeMeetingController::class, 'destroy'])
                ->middleware('role:operations_manager,operations_admin,drdo_admin');
            Route::post('/{id}/start', [CommitteeMeetingController::class, 'start'])
                ->middleware('role:operations_manager,operations_admin');
            Route::post('/{id}/complete', [CommitteeMeetingController::class, 'complete'])
                ->middleware('role:operations_manager,operations_admin');
            Route::post('/{id}/cancel', [CommitteeMeetingController::class, 'cancel'])
                ->middleware('role:operations_admin');

            // Meeting members management
            Route::get('/{meetingId}/members', [CommitteeMeetingController::class, 'getMembers']);
            Route::post('/{meetingId}/members', [CommitteeMeetingController::class, 'addMember'])
                ->middleware('role:operations_manager,operations_admin');
            Route::put('/{meetingId}/members/{memberId}', [CommitteeMeetingController::class, 'updateMember'])
                ->middleware('role:operations_manager,operations_admin');
            Route::delete('/{meetingId}/members/{memberId}', [CommitteeMeetingController::class, 'deleteMember'])
                ->middleware('role:operations_manager,operations_admin');
        });

        // Certificate management
        Route::prefix('certificates')->group(function () {
            Route::get('/', [CertificateController::class, 'index']);
            Route::get('/{id}', [CertificateController::class, 'show']);
            Route::get('/{certificateNumber}/download', [CertificateController::class, 'download']);
        });

        // Document management (general purpose - used by assessments, certificates, etc.)
        Route::prefix('documents')->group(function () {
            Route::get('/', [DocumentController::class, 'index']);
            Route::post('/', [DocumentController::class, 'store'])
                ->middleware('file.security');
            Route::get('/{document}', [DocumentController::class, 'show']);
            Route::get('/{document}/download', [DocumentController::class, 'download'])
                ->name('api.v1.documents.download');
            Route::post('/{id}/activate', [DocumentController::class, 'activate']);
            Route::post('/{id}/deactivate', [DocumentController::class, 'deactivate']);
        });

        // Master Data management (authorization via policies)
        Route::prefix('master-data')->group(function () {

            // Manufacturing Sector Master Data
            Route::prefix('manufacturing')->group(function () {
                // Bought-Out Parts
                Route::prefix('bought-out-parts')->group(function () {
                    Route::get('/', [ManufacturingBoughtOutPartsController::class, 'index']);
                    Route::post('/', [ManufacturingBoughtOutPartsController::class, 'store']);
                    Route::get('/{boughtOutPart}', [ManufacturingBoughtOutPartsController::class, 'show']);
                    Route::put('/{boughtOutPart}', [ManufacturingBoughtOutPartsController::class, 'update']);
                    Route::post('/{boughtOutPart}/activate', [ManufacturingBoughtOutPartsController::class, 'activate']);
                    Route::post('/{boughtOutPart}/deactivate', [ManufacturingBoughtOutPartsController::class, 'deactivate']);
                });

                // Key Processes
                Route::prefix('key-processes')->group(function () {
                    Route::get('/', [ManufacturingKeyProcessesController::class, 'index']);
                    Route::post('/', [ManufacturingKeyProcessesController::class, 'store']);
                    Route::get('/{keyProcess}', [ManufacturingKeyProcessesController::class, 'show']);
                    Route::put('/{keyProcess}', [ManufacturingKeyProcessesController::class, 'update']);
                    Route::post('/{keyProcess}/activate', [ManufacturingKeyProcessesController::class, 'activate']);
                    Route::post('/{keyProcess}/deactivate', [ManufacturingKeyProcessesController::class, 'deactivate']);
                });

                // Stores
                Route::prefix('stores')->group(function () {
                    Route::get('/', [ManufacturingStoresMasterController::class, 'index']);
                    Route::post('/', [ManufacturingStoresMasterController::class, 'store']);
                    Route::get('/{manufacturingStore}', [ManufacturingStoresMasterController::class, 'show']);
                    Route::put('/{manufacturingStore}', [ManufacturingStoresMasterController::class, 'update']);
                    Route::post('/{manufacturingStore}/activate', [ManufacturingStoresMasterController::class, 'activate']);
                    Route::post('/{manufacturingStore}/deactivate', [ManufacturingStoresMasterController::class, 'deactivate']);
                });

                // DRDO Vendor Categories
                Route::prefix('vendor-categories')->group(function () {
                    Route::get('/', [ManufacturingVendorCategoriesController::class, 'index']);
                    Route::post('/', [ManufacturingVendorCategoriesController::class, 'store']);
                    Route::get('/{vendorCategory}', [ManufacturingVendorCategoriesController::class, 'show']);
                    Route::put('/{vendorCategory}', [ManufacturingVendorCategoriesController::class, 'update']);
                    Route::post('/{vendorCategory}/activate', [ManufacturingVendorCategoriesController::class, 'activate']);
                    Route::post('/{vendorCategory}/deactivate', [ManufacturingVendorCategoriesController::class, 'deactivate']);
                });

                // Raw Materials
                Route::prefix('raw-materials')->group(function () {
                    Route::get('/', [ManufacturingRawMaterialsController::class, 'index']);
                    Route::post('/', [ManufacturingRawMaterialsController::class, 'store']);
                    Route::get('/{rawMaterial}', [ManufacturingRawMaterialsController::class, 'show']);
                    Route::put('/{rawMaterial}', [ManufacturingRawMaterialsController::class, 'update']);
                    Route::post('/{rawMaterial}/activate', [ManufacturingRawMaterialsController::class, 'activate']);
                    Route::post('/{rawMaterial}/deactivate', [ManufacturingRawMaterialsController::class, 'deactivate']);
                });
            });

            // Service Sector Master Data
            Route::prefix('service')->group(function () {
                // DRDO Vendor Categories
                Route::prefix('vendor-categories')->group(function () {
                    Route::get('/', [ServiceVendorCategoriesController::class, 'index']);
                    Route::post('/', [ServiceVendorCategoriesController::class, 'store']);
                    Route::get('/{serviceVendorCategory}', [ServiceVendorCategoriesController::class, 'show']);
                    Route::put('/{serviceVendorCategory}', [ServiceVendorCategoriesController::class, 'update']);
                    Route::post('/{serviceVendorCategory}/activate', [ServiceVendorCategoriesController::class, 'activate']);
                    Route::post('/{serviceVendorCategory}/deactivate', [ServiceVendorCategoriesController::class, 'deactivate']);
                });

                // Vendor Labs
                Route::prefix('vendor-labs')->group(function () {
                    Route::get('/', [ServiceVendorLabsController::class, 'index']);
                    Route::post('/', [ServiceVendorLabsController::class, 'store']);
                    Route::get('/{serviceVendorLab}', [ServiceVendorLabsController::class, 'show']);
                    Route::put('/{serviceVendorLab}', [ServiceVendorLabsController::class, 'update']);
                    Route::post('/{serviceVendorLab}/activate', [ServiceVendorLabsController::class, 'activate']);
                    Route::post('/{serviceVendorLab}/deactivate', [ServiceVendorLabsController::class, 'deactivate']);
                });

                // Key Processes
                Route::prefix('key-processes')->group(function () {
                    Route::get('/', [ServiceKeyProcessesController::class, 'index']);
                    Route::post('/', [ServiceKeyProcessesController::class, 'store']);
                    Route::get('/{serviceKeyProcess}', [ServiceKeyProcessesController::class, 'show']);
                    Route::put('/{serviceKeyProcess}', [ServiceKeyProcessesController::class, 'update']);
                    Route::post('/{serviceKeyProcess}/activate', [ServiceKeyProcessesController::class, 'activate']);
                    Route::post('/{serviceKeyProcess}/deactivate', [ServiceKeyProcessesController::class, 'deactivate']);
                });

                // Key Resources
                Route::prefix('key-resources')->group(function () {
                    Route::get('/', [ServiceKeyResourcesController::class, 'index']);
                    Route::post('/', [ServiceKeyResourcesController::class, 'store']);
                    Route::get('/{serviceKeyResource}', [ServiceKeyResourcesController::class, 'show']);
                    Route::put('/{serviceKeyResource}', [ServiceKeyResourcesController::class, 'update']);
                    Route::post('/{serviceKeyResource}/activate', [ServiceKeyResourcesController::class, 'activate']);
                    Route::post('/{serviceKeyResource}/deactivate', [ServiceKeyResourcesController::class, 'deactivate']);
                });

                // Outsourced Components
                Route::prefix('outsourced-components')->group(function () {
                    Route::get('/', [ServiceOutsourcedComponentsController::class, 'index']);
                    Route::post('/', [ServiceOutsourcedComponentsController::class, 'store']);
                    Route::get('/{serviceOutsourcedComponent}', [ServiceOutsourcedComponentsController::class, 'show']);
                    Route::put('/{serviceOutsourcedComponent}', [ServiceOutsourcedComponentsController::class, 'update']);
                    Route::post('/{serviceOutsourcedComponent}/activate', [ServiceOutsourcedComponentsController::class, 'activate']);
                    Route::post('/{serviceOutsourcedComponent}/deactivate', [ServiceOutsourcedComponentsController::class, 'deactivate']);
                });
            });

            // Assessor Domains (not sector-specific)
            Route::prefix('assessor-domains')->group(function () {
                Route::get('/', [AssessorDomainsController::class, 'index']);
                Route::post('/', [AssessorDomainsController::class, 'store']);
                Route::get('/{assessorDomain}', [AssessorDomainsController::class, 'show']);
                Route::put('/{assessorDomain}', [AssessorDomainsController::class, 'update']);
                Route::post('/{assessorDomain}/activate', [AssessorDomainsController::class, 'activate']);
                Route::post('/{assessorDomain}/deactivate', [AssessorDomainsController::class, 'deactivate']);
            });

            // Countries
            Route::get('countries', [CountryController::class, 'index']);

            // States
            Route::get('states', [StateController::class, 'index']);

            // Districts
            Route::get('districts', [DistrictController::class, 'index']);

            // Pincodes
            Route::get('pincodes', [PincodeController::class, 'index']);

            // Third-Party Certifications
            Route::prefix('third-party-certs')->group(function () {
                Route::get('/', [ThirdPartyCertController::class, 'index']);
                Route::post('/', [ThirdPartyCertController::class, 'store']);
                Route::get('/{id}', [ThirdPartyCertController::class, 'show']);
                Route::put('/{id}', [ThirdPartyCertController::class, 'update']);
                Route::post('/{id}/activate', [ThirdPartyCertController::class, 'activate']);
                Route::post('/{id}/deactivate', [ThirdPartyCertController::class, 'deactivate']);
            });

        });

        // Feedback Questions (Master Data)
        Route::prefix('feedback-questions')->group(function () {
            Route::get('/', [FeedbackQuestionController::class, 'index']);
            Route::get('/options', [FeedbackQuestionController::class, 'options']);
            Route::get('/active', [FeedbackQuestionController::class, 'activeQuestions']);
            Route::post('/', [FeedbackQuestionController::class, 'store'])
                ->middleware('role:system_admin,operations_admin');
            Route::get('/{id}', [FeedbackQuestionController::class, 'show']);
            Route::put('/{id}', [FeedbackQuestionController::class, 'update'])
                ->middleware('role:system_admin,operations_admin');
            Route::post('/{id}/activate', [FeedbackQuestionController::class, 'activate'])
                ->middleware('role:system_admin');
            Route::post('/{id}/deactivate', [FeedbackQuestionController::class, 'deactivate'])
                ->middleware('role:system_admin');
        });

        // Fee Configurations
        Route::prefix('fee-configurations')->group(function () {
            Route::get('/', [FeeConfigurationController::class, 'index']);
            Route::get('/{id}', [FeeConfigurationController::class, 'show']);
            Route::post('/', [FeeConfigurationController::class, 'store'])
                ->middleware('role:system_admin,operations_admin');
            Route::put('/{id}', [FeeConfigurationController::class, 'update'])
                ->middleware('role:system_admin,operations_admin');
        });

        // System Settings
        Route::prefix('system-settings')->group(function () {
            // Read - accessible to all authenticated users
            Route::get('/', [SystemSettingsController::class, 'index']);
            Route::get('/{key}', [SystemSettingsController::class, 'show']);
            // Write - System Admin only
            Route::post('/', [SystemSettingsController::class, 'store'])
                ->middleware('role:system_admin');
            Route::put('/{key}', [SystemSettingsController::class, 'update'])
                ->middleware('role:system_admin');
        });

        // Discipline management
        Route::prefix('disciplines')->group(function () {
            // Public - List and view disciplines
            Route::get('/', [DisciplineController::class, 'index']);
            // Used by web: services/api/systemAdmin/DisciplinesService.js (System Admin - export disciplines)
            Route::get('/export', [DisciplineController::class, 'export'])->middleware('throttle:exports');
            Route::get('/{id}', [DisciplineController::class, 'show']);

            // Restricted - Create, update, delete (SA, DR only)
            Route::post('/', [DisciplineController::class, 'store'])
                ->middleware('role:system_admin,drdo_admin');
            Route::put('/{id}', [DisciplineController::class, 'update'])
                ->middleware('role:system_admin,drdo_admin');
            Route::post('/{id}/activate', [DisciplineController::class, 'activate'])
                ->middleware('role:system_admin,drdo_admin');
            Route::post('/{id}/deactivate', [DisciplineController::class, 'deactivate'])
                ->middleware('role:system_admin,drdo_admin');
        });

        // Assessment Parameter management
        Route::prefix('assessment-parameters')->group(function () {
            // Public - List and view parameters
            Route::get('/', [AssessmentParameterController::class, 'index']);
            Route::get('/export', [AssessmentParameterController::class, 'export'])
                ->middleware(['role:system_admin', 'throttle:exports']);
            Route::get('/template', [AssessmentParameterController::class, 'downloadImportTemplate'])
                ->middleware('role:system_admin');
            Route::get('/bulk-update-template', [AssessmentParameterController::class, 'downloadBulkUpdateTemplate'])
                ->middleware('role:system_admin');
            Route::get('/{id}', [AssessmentParameterController::class, 'show']);
            Route::get('/{id}/questions', [AssessmentQuestionController::class, 'index']);

            // Restricted - Create, update, delete (SA, DR only)
            Route::post('/', [AssessmentParameterController::class, 'store'])
                ->middleware('role:system_admin,drdo_admin');
            Route::put('/{id}', [AssessmentParameterController::class, 'update'])
                ->middleware('role:system_admin,drdo_admin');
            Route::post('/bulk-import', [AssessmentParameterController::class, 'bulkImport'])
                ->middleware(['role:system_admin', 'file.security']);
            Route::post('/bulk-update', [AssessmentParameterController::class, 'bulkUpdate'])
                ->middleware(['role:system_admin', 'file.security']);
            Route::post('/{id}/activate', [AssessmentParameterController::class, 'activate'])
                ->middleware('role:system_admin');
            Route::post('/{id}/deactivate', [AssessmentParameterController::class, 'deactivate'])
                ->middleware('role:system_admin');
        });

        // Assessment Question management
        Route::prefix('assessment-questions')->middleware('role:system_admin,drdo_admin')->group(function () {
            Route::post('/', [AssessmentQuestionController::class, 'store']);
            Route::get('/{id}', [AssessmentQuestionController::class, 'show']);
            Route::put('/{id}', [AssessmentQuestionController::class, 'update']);
            Route::post('/{id}/activate', [AssessmentQuestionController::class, 'activate'])->middleware('role:system_admin');
            Route::post('/{id}/deactivate', [AssessmentQuestionController::class, 'deactivate'])->middleware('role:system_admin');

            // Question options
            Route::get('/{id}/options', [AssessmentQuestionController::class, 'options']);
            Route::post('/{id}/options', [AssessmentQuestionController::class, 'addOption']);
            Route::put('/{id}/options/{optionId}', [AssessmentQuestionController::class, 'updateOption']);
            Route::post('/{id}/options/{optionId}/activate', [AssessmentQuestionController::class, 'activateOption'])->middleware('role:system_admin');
            Route::post('/{id}/options/{optionId}/deactivate', [AssessmentQuestionController::class, 'deactivateOption'])->middleware('role:system_admin');
        });

        // Reports (read-only analytics)
        Route::prefix('reports')->middleware('role:system_admin,drdo_admin,operations_manager,enterprise_admin')->group(function () {
            // Report routes will be added here as needed
        });

        // Dashboards (role-specific views)
        Route::prefix('dashboards')->group(function () {
            Route::get('/ea', [DashboardController::class, 'enterpriseAdmin'])
                ->middleware('role:enterprise_admin');
            Route::get('/om', [DashboardController::class, 'operationsManager'])
                ->middleware('role:operations_manager');
            Route::get('/oa', [DashboardController::class, 'operationsAdmin'])
                ->middleware('role:operations_admin');
            Route::get('/dr', [DashboardController::class, 'drdoAdmin'])
                ->middleware('role:drdo_admin');
            Route::get('/sa', [DashboardController::class, 'systemAdmin'])
                ->middleware('role:system_admin');
            Route::get('/assessor', [DashboardController::class, 'assessor'])
                ->middleware('role:assessor');
        });

        // Support Ticket Management
        Route::prefix('support/tickets')->group(function () {
            Route::get('/', [SupportTicketController::class, 'index']);
            Route::post('/', [SupportTicketController::class, 'store']);
            Route::get('/{id}', [SupportTicketController::class, 'show']);
            Route::put('/{id}', [SupportTicketController::class, 'update'])
                ->middleware('role:system_admin,operations_manager,operations_admin');
        });

        // Error Logging Management (System Admin only)
        Route::prefix('admin/error-logs')->middleware('role:system_admin')->group(function () {
            Route::get('/stats', [ErrorLogController::class, 'statistics']);
            Route::get('/', [ErrorLogController::class, 'index']);
            Route::get('/{id}', [ErrorLogController::class, 'show']);
            Route::patch('/{id}', [ErrorLogController::class, 'update']);
            Route::post('/archive', [ErrorLogController::class, 'bulkArchive']);
        });

        // Error Groups Management (System Admin only)
        Route::prefix('admin/error-groups')->middleware('role:system_admin')->group(function () {
            Route::get('/', [ErrorGroupController::class, 'index']);
            Route::get('/{id}', [ErrorGroupController::class, 'show']);
            Route::patch('/{id}', [ErrorGroupController::class, 'update']);
        });

        // Integration Failures monitor — read-only ops feed of non-HTTP failures (System Admin only)
        Route::prefix('admin/integration-failures')->middleware('role:system_admin')->group(function () {
            Route::get('/categories', [IntegrationFailureController::class, 'categories']);
            Route::get('/', [IntegrationFailureController::class, 'index']);
        });
    });
});

// Payment webhooks (public routes, verified by signature)
Route::prefix('webhooks/payments')->group(function () {
    Route::post('/icici-eazypay', [PaymentWebhookController::class, 'iciciEazyPay']);
});

// Payment callback routes (return URLs from payment gateways)
// ICICI EazyPay sends POST for callbacks, so we need to accept both GET and POST
// These routes are excluded from ConvertRequestToSnakeCase middleware because
// payment gateways send data in their own format (not camelCase)
Route::prefix('payments')->withoutMiddleware([
    ConvertRequestToSnakeCase::class,
    ConvertResponseToCamelCase::class,
])->group(function () {
    Route::match(['get', 'post'], '/icici-eazypay/callback', [PaymentWebhookController::class, 'iciciEazyPayCallback']);
});

// Swagger documentation is available at /api/documentation (provided by L5-Swagger package)
