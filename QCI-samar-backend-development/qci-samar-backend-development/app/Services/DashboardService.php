<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\Certificate;
use App\Models\Payment;
use App\Models\SystemSetting;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    /**
     * Cache duration in seconds (10 minutes for system admin dashboard).
     */
    private const CACHE_TTL = 300;

    /**
     * Extended cache duration for system-wide aggregations (15 minutes).
     */
    private const SYSTEM_CACHE_TTL = 900;

    /**
     * Get dashboard data based on user role.
     */
    public function getDashboardForUser(User $user): array
    {
        $role = $this->determinePrimaryRole($user);

        return match ($role) {
            'system_admin' => $this->getSystemAdminDashboard($user),
            'drdo_admin' => $this->getDrdoAdminDashboard($user),
            'operations_manager' => $this->getOperationsManagerDashboard($user),
            'operations_admin' => $this->getOperationsAdminDashboard($user),
            'enterprise_admin' => $this->getEnterpriseAdminDashboard($user),
            'assessor' => $this->getAssessorDashboard($user),
            default => $this->getBasicDashboard($user),
        };
    }

    /**
     * Get Enterprise Admin dashboard data.
     */
    public function getEnterpriseAdminDashboard(User $user): array
    {
        $organizationId = $user->organization_id;

        // Summary cards - matching frontend expectations
        // Only count units that have at least one non-draft application
        $unitsCount = Unit::where('organization_id', $organizationId)
            ->whereHas('applications', function ($query) {
                $query->whereNotIn('status', ['draft']);
            })
            ->count();

        // Active applications (all non-draft, non-rejected, non-certified statuses)
        $activeApplications = Application::where('organization_id', $organizationId)
            ->whereNotIn('status', ['draft', 'rejected', 'certified'])
            ->count();

        // Current certifications: active and still within validity
        $currentCertifications = Certificate::where('organization_id', $organizationId)
            ->active()
            ->count();

        // Draft applications
        $draftApplications = Application::where('organization_id', $organizationId)
            ->where('status', 'draft')
            ->count();

        // Total applications (for reference)
        $totalApplications = Application::where('organization_id', $organizationId)->count();

        // Pending payment applications
        $pendingPayment = Application::where('organization_id', $organizationId)
            ->pendingPayment()
            ->count();

        // Active applications list (for table display) - exclude draft, rejected, certified to match count
        $activeApplicationsList = Application::where('organization_id', $organizationId)
            ->whereNotIn('status', ['draft', 'rejected', 'certified'])
            ->with(['unit:id,name,address,state,district'])
            ->orderBy('updated_at', 'desc')
            ->limit(10)
            ->get()
            ->map(function ($app) {
                return [
                    'id' => $app->id,
                    'application_number' => $app->application_number,
                    'sector' => $app->sector ? ucfirst($app->sector) : null,
                    'enterprise_classification' => $app->enterprise_classification ? ucfirst($app->enterprise_classification) : null,
                    'unit_name' => $app->unit?->name,
                    'unit_address' => $app->unit_address,
                    'unit_state' => $app->unit_state,
                    'unit_district' => $app->unit_district,
                    'status' => $app->status,
                    'status_label' => $this->getStatusLabel($app->status),
                    'payment_status' => $app->payment_status,
                    'payment_status_label' => $this->getPaymentStatusLabel($app->payment_status),
                    'submitted_at' => $app->submitted_at?->format('d M, Y'),
                    'updated_at' => $app->updated_at?->format('d M, Y'),
                    'preferred_assessment_date' => $app->preferred_assessment_date?->format('d M, Y'),
                ];
            });

        // Payment summary
        $paymentStats = Payment::where('organization_id', $organizationId)
            ->selectRaw('
                SUM(CASE WHEN status = "success" THEN amount ELSE 0 END) as total_paid,
                SUM(CASE WHEN status IN ("initiated", "pending") THEN amount ELSE 0 END) as total_pending,
                COUNT(CASE WHEN status = "success" THEN 1 END) as successful_count
            ')
            ->first();

        // Certificates needing renewal: expiring within the recertification
        // window plus those already expired. The two buckets do not overlap
        // (expiringSoon is active-only and future-dated; expired is past-dated).
        $recertificationWindow = SystemSetting::getRecertificationWindowDays();
        $expiringCertificates = Certificate::where('organization_id', $organizationId)
            ->expiringSoon($recertificationWindow)
            ->count();
        $expiredCertificates = Certificate::where('organization_id', $organizationId)
            ->expired()
            ->count();
        $renewalCount = $expiringCertificates + $expiredCertificates;

        // Status distribution for chart
        $statusDistribution = Application::where('organization_id', $organizationId)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->get()
            ->map(fn ($item) => [
                'status' => $item->status,
                'label' => $this->getStatusLabel($item->status),
                'count' => $item->count,
            ]);

        return [
            'role' => 'enterprise_admin',
            'organization_id' => $organizationId,
            'summary_cards' => [
                [
                    'key' => 'units',
                    'label' => 'Units',
                    'value' => $unitsCount,
                    'color' => 'blue',
                    'icon' => 'buildings',
                ],
                [
                    'key' => 'active_applications',
                    'label' => 'Active Applications',
                    'value' => $activeApplications,
                    'color' => 'green',
                    'icon' => 'clipboard',
                ],
                [
                    'key' => 'current_certifications',
                    'label' => 'Current Certifications',
                    'value' => $currentCertifications,
                    'color' => 'purple',
                    'icon' => 'certificate',
                ],
                [
                    'key' => 'draft_applications',
                    'label' => 'Draft Applications',
                    'value' => $draftApplications,
                    'color' => 'yellow',
                    'icon' => 'clock',
                ],
            ],
            'stats' => [
                'total_applications' => $totalApplications,
                'pending_payment' => $pendingPayment,
                'expiring_certificates' => $expiringCertificates,
            ],
            'charts' => [
                [
                    'type' => 'bar',
                    'title' => 'Applications by Status',
                    'data' => $statusDistribution,
                ],
            ],
            'active_applications' => $activeApplicationsList,
            'payment_summary' => [
                'total_paid' => (float) ($paymentStats->total_paid ?? 0),
                'total_pending' => (float) ($paymentStats->total_pending ?? 0),
                'successful_count' => $paymentStats->successful_count ?? 0,
            ],
            'alerts' => $renewalCount > 0 ? [
                [
                    'type' => 'certificate_renewal',
                    'key' => 'certificate_renewal',
                    'value' => $renewalCount,
                    'expired' => $expiredCertificates,
                    'expiring_soon' => $expiringCertificates,
                    'message' => "{$renewalCount} certificate(s) need renewal",
                ],
            ] : [],
            'quick_actions' => [
                ['label' => 'New Application', 'action' => 'create_application', 'route' => '/applications'],
                ['label' => 'Contact Support', 'action' => 'contact_support', 'route' => '/support'],
            ],
        ];
    }

    /**
     * Get human-readable status label.
     *
     * Labels mirror the application status enum and ApplicationStateMachine config,
     * which is the source of truth for status labels.
     */
    protected function getStatusLabel(?string $status): string
    {
        return match ($status) {
            'draft' => 'Draft',
            'drdo_approval_pending' => 'DRDO Approval Pending',
            'payment_pending' => 'Payment Pending',
            'payment_completed' => 'Payment Completed',
            'in_progress' => 'In Progress',
            'certified' => 'Certified',
            'rejected' => 'Rejected',
            default => $status ? ucwords(str_replace('_', ' ', $status)) : 'Unknown',
        };
    }

    /**
     * Get human-readable payment status label.
     *
     * payment_status enum: pending, success, failed (see applications migration).
     */
    protected function getPaymentStatusLabel(?string $status): string
    {
        return match ($status) {
            'pending' => 'Yet to Pay',
            'success' => 'Paid',
            'failed' => 'Payment Failed',
            default => $status ? ucwords(str_replace('_', ' ', $status)) : 'Yet to Pay',
        };
    }

    /**
     * Get Operations Manager dashboard data.
     * Matches System Admin dashboard structure for frontend consistency.
     */
    public function getOperationsManagerDashboard(User $user): array
    {
        $states = $user->getAssignedStatesArray();
        $cacheKey = "dashboard:om:{$user->id}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($states) {
            // Application stats for summary cards — filtered by state if OM has restrictions
            $applicationQuery = Application::query();
            if (! empty($states)) {
                $applicationQuery->forStates($states);
            }
            $applicationStats = $applicationQuery->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN status NOT IN ("draft", "certified", "rejected") THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = "payment_pending" THEN 1 ELSE 0 END) as pending_payment,
                SUM(CASE WHEN status = "drdo_approval_pending" THEN 1 ELSE 0 END) as pending_approval
            ')->first();

            // Assessment counts for OM-specific cards — filtered by state if OM has restrictions
            $assessmentQuery = Assessment::query();
            if (! empty($states)) {
                $assessmentQuery->forStates($states);
            }
            $allocationPending = (clone $assessmentQuery)->where('status', Assessment::STATUS_ALLOCATION_PENDING)->count();
            $qualityCheck = (clone $assessmentQuery)->where('status', Assessment::STATUS_SUBMITTED_FOR_QC)->count();

            // Get same analytics data as System Admin dashboard — pass states for filtering
            $enterpriseDistribution = $this->getEnterpriseDistribution($states);
            $certifiedVendorsByLevel = $this->getCertifiedVendorsByLevel($states);
            $assessmentStatusFlow = $this->getAssessmentStatusFlowOptimized($states);
            $stateWiseVendors = $this->getStateWiseVendors($states);

            return [
                'role' => 'operations_manager',
                'summary_cards' => [
                    [
                        'label' => 'Total Applications',
                        'value' => (int) ($applicationStats->total ?? 0),
                        'color' => 'blue',
                        'icon' => 'document',
                        'route' => '/applications',
                    ],
                    [
                        'label' => 'Active Applications',
                        'value' => (int) ($applicationStats->active ?? 0),
                        'color' => 'green',
                        'icon' => 'clipboard',
                        'route' => '/applications?exclude_status=draft,certified,rejected',
                    ],
                    [
                        'label' => 'Payment Pending',
                        'value' => (int) ($applicationStats->pending_payment ?? 0),
                        'color' => 'orange',
                        'icon' => 'clock',
                        'route' => '/applications?status=payment_pending',
                    ],
                    [
                        'label' => 'Pending Approval',
                        'value' => (int) ($applicationStats->pending_approval ?? 0),
                        'color' => 'blue',
                        'icon' => 'document',
                        'route' => '/applications?status=drdo_approval_pending',
                    ],
                    [
                        'label' => 'Pending Allocation',
                        'value' => $allocationPending,
                        'color' => 'yellow',
                        'icon' => 'allocation',
                        'route' => '/allocation-pending',
                    ],
                    [
                        'label' => 'Quality Check',
                        'value' => $qualityCheck,
                        'color' => 'purple',
                        'icon' => 'quality',
                        'route' => '/quality-check',
                    ],
                ],
                'enterprise_distribution' => $enterpriseDistribution,
                'certified_vendors_by_level' => $certifiedVendorsByLevel,
                'assessment_status_flow' => $assessmentStatusFlow,
                'state_wise_vendors' => $stateWiseVendors,
            ];
        });
    }

    /**
     * Get Operations Admin dashboard data.
     * Same structure as Operations Manager for frontend consistency.
     */
    public function getOperationsAdminDashboard(User $user): array
    {
        $cacheKey = "dashboard:oa:{$user->id}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () {
            // Application stats for summary cards
            $applicationStats = Application::selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN status NOT IN ("draft", "certified", "rejected") THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = "payment_pending" THEN 1 ELSE 0 END) as pending_payment,
                SUM(CASE WHEN status = "drdo_approval_pending" THEN 1 ELSE 0 END) as pending_approval,
                SUM(CASE WHEN status = "in_progress" THEN 1 ELSE 0 END) as in_progress
            ')->first();

            // Assessment count for OA-specific card
            $readyForCommittee = Assessment::where('status', Assessment::STATUS_READY_FOR_COMMITTEE)->count();

            // Get analytics data
            $enterpriseDistribution = $this->getEnterpriseDistribution();
            $certifiedVendorsByLevel = $this->getCertifiedVendorsByLevel();
            $assessmentStatusFlow = $this->getAssessmentStatusFlowOptimized();
            $stateWiseVendors = $this->getStateWiseVendors();

            return [
                'role' => 'operations_admin',
                'summary_cards' => [
                    [
                        'label' => 'Total Applications',
                        'value' => (int) ($applicationStats->total ?? 0),
                        'color' => 'blue',
                        'icon' => 'document',
                        'route' => '/applications',
                    ],
                    [
                        'label' => 'Active Applications',
                        'value' => (int) ($applicationStats->active ?? 0),
                        'color' => 'green',
                        'icon' => 'clipboard',
                        'route' => '/applications?exclude_status=draft,certified,rejected',
                    ],
                    [
                        'label' => 'Payment Pending',
                        'value' => (int) ($applicationStats->pending_payment ?? 0),
                        'color' => 'orange',
                        'icon' => 'clock',
                        'route' => '/applications?status=payment_pending',
                    ],
                    [
                        'label' => 'Pending Approval',
                        'value' => (int) ($applicationStats->pending_approval ?? 0),
                        'color' => 'blue',
                        'icon' => 'document',
                        'route' => '/applications?status=drdo_approval_pending',
                    ],
                    [
                        'label' => 'In Progress Applications',
                        'value' => (int) ($applicationStats->in_progress ?? 0),
                        'color' => 'teal',
                        'icon' => 'progress',
                        'route' => '/applications?status=in_progress',
                    ],
                    [
                        'label' => 'Ready for Committee Review',
                        'value' => $readyForCommittee,
                        'color' => 'purple',
                        'icon' => 'committee',
                        'route' => '/ready-for-committee-review',
                    ],
                ],
                'enterprise_distribution' => $enterpriseDistribution,
                'certified_vendors_by_level' => $certifiedVendorsByLevel,
                'assessment_status_flow' => $assessmentStatusFlow,
                'state_wise_vendors' => $stateWiseVendors,
            ];
        });
    }

    /**
     * Get DRDO Admin dashboard data.
     * Separate implementation for DRDO Admin role.
     */
    public function getDrdoAdminDashboard(User $user): array
    {
        $cacheKey = "dashboard:dr:{$user->id}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () {
            // Application stats for summary cards
            $applicationStats = Application::selectRaw('
                SUM(CASE WHEN status NOT IN ("draft", "certified", "rejected") THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = "drdo_approval_pending" THEN 1 ELSE 0 END) as pending_approval,
                SUM(CASE WHEN status = "in_progress" THEN 1 ELSE 0 END) as in_progress
            ')->first();

            // Same rule as the Certified page (assessments with status certified), so the
            // card and the list agree even after a certificate's validity has lapsed.
            $certifiedVendors = Assessment::where('status', Assessment::STATUS_CERTIFIED)->count();

            // Assessment count for DRDO-specific card
            $committeeReview = Assessment::where('status', Assessment::STATUS_COMMITTEE_REVIEW)->count();

            // Get analytics data
            $enterpriseDistribution = $this->getEnterpriseDistribution();
            $certifiedVendorsByLevel = $this->getCertifiedVendorsByLevel();
            $assessmentStatusFlow = $this->getAssessmentStatusFlowOptimized();
            $userDistribution = $this->getUserDistribution();
            $stateWiseVendors = $this->getStateWiseVendors();

            return [
                'role' => 'drdo_admin',
                'summary_cards' => [
                    [
                        'label' => 'Active Applications',
                        'value' => (int) ($applicationStats->active ?? 0),
                        'color' => 'green',
                        'icon' => 'clipboard',
                        'route' => '/applications?exclude_status=draft,certified,rejected',
                    ],
                    [
                        'label' => 'Pending Approval',
                        'value' => (int) ($applicationStats->pending_approval ?? 0),
                        'color' => 'blue',
                        'icon' => 'document',
                        'route' => '/pending-approval',
                    ],
                    [
                        'label' => 'In Progress Applications',
                        'value' => (int) ($applicationStats->in_progress ?? 0),
                        'color' => 'teal',
                        'icon' => 'progress',
                        'route' => '/applications?status=in_progress',
                    ],
                    [
                        'label' => 'Certified',
                        'value' => $certifiedVendors,
                        'color' => 'purple',
                        'icon' => 'certificate',
                        'route' => '/certified-vendors',
                    ],
                    [
                        'label' => 'Committee Review Scheduled',
                        'value' => $committeeReview,
                        'color' => 'brown',
                        'icon' => 'committee',
                        'route' => '/committee-review-scheduled',
                    ],
                ],
                'enterprise_distribution' => $enterpriseDistribution,
                'certified_vendors_by_level' => $certifiedVendorsByLevel,
                'assessment_status_flow' => $assessmentStatusFlow,
                'user_distribution' => $userDistribution,
                'state_wise_vendors' => $stateWiseVendors,
            ];
        });
    }

    /**
     * Get Assessor dashboard data.
     */
    public function getAssessorDashboard(User $user): array
    {
        $cacheKey = "dashboard:assessor:{$user->id}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($user) {
            // Assigned assessments - using forAssessor scope
            $assignedCount = Assessment::forAssessor($user->id)
                ->whereIn('status', [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS, Assessment::STATUS_MOBILE_COMPLETE])
                ->count();

            // Pending responses (questions without responses)
            $pendingResponses = Assessment::forAssessor($user->id)
                ->whereIn('status', [Assessment::STATUS_IN_PROGRESS, Assessment::STATUS_MOBILE_COMPLETE])
                ->whereHas('questions', function ($q) {
                    $q->whereDoesntHave('response', function ($r) {
                        $r->whereNotNull('selected_option');
                    });
                })
                ->count();

            // Completed assessments
            $completedCount = Assessment::forAssessor($user->id)
                ->whereIn('status', [Assessment::STATUS_SUBMITTED_FOR_QC, Assessment::STATUS_READY_FOR_COMMITTEE, Assessment::STATUS_COMMITTEE_REVIEW, Assessment::STATUS_CERTIFIED])
                ->count();

            // Current assignments
            $currentAssignments = Assessment::forAssessor($user->id)
                ->whereIn('status', [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS, Assessment::STATUS_MOBILE_COMPLETE])
                ->with(['application:id,application_number,organization_id', 'application.organization:id,name', 'teamMembers'])
                ->orderBy('scheduled_start_date', 'asc')
                ->get()
                ->map(function ($assessment) use ($user) {
                    $teamMember = $assessment->teamMembers->firstWhere('user_id', $user->id);

                    return [
                        'id' => $assessment->id,
                        'application_number' => $assessment->application?->application_number,
                        'organization' => $assessment->application?->organization?->name,
                        'status' => $assessment->status,
                        'role' => $teamMember ? ucwords(str_replace('_', ' ', $teamMember->role)) : 'Assessor',
                        'scheduled_start_date' => $assessment->scheduled_start_date?->format('Y-m-d'),
                        'scheduled_end_date' => $assessment->scheduled_end_date?->format('Y-m-d'),
                    ];
                });

            // Assessment history (completed)
            $assessmentHistory = Assessment::forAssessor($user->id)
                ->whereIn('status', [Assessment::STATUS_SUBMITTED_FOR_QC, Assessment::STATUS_READY_FOR_COMMITTEE, Assessment::STATUS_COMMITTEE_REVIEW, Assessment::STATUS_CERTIFIED])
                ->with(['application:id,application_number'])
                ->orderBy('completed_at', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($assessment) {
                    return [
                        'id' => $assessment->id,
                        'application_number' => $assessment->application?->application_number,
                        'status' => $assessment->status,
                        'completed_at' => $assessment->completed_at?->format('Y-m-d'),
                        'total_score' => $assessment->total_score,
                    ];
                });

            return [
                'role' => 'assessor',
                'summary_cards' => [
                    [
                        'label' => 'Active Assessments',
                        'value' => $assignedCount,
                        'trend' => null,
                        'color' => 'blue',
                        'icon' => 'clipboard-list',
                    ],
                    [
                        'label' => 'Pending Responses',
                        'value' => $pendingResponses,
                        'trend' => null,
                        'color' => 'orange',
                        'icon' => 'document',
                    ],
                    [
                        'label' => 'Completed',
                        'value' => $completedCount,
                        'trend' => null,
                        'color' => 'green',
                        'icon' => 'check-circle',
                    ],
                ],
                'current_assignments' => $currentAssignments,
                'assessment_history' => $assessmentHistory,
                'quick_actions' => [
                    ['label' => 'View Assignments', 'action' => 'view_assignments'],
                    ['label' => 'Submit Assessment', 'action' => 'submit_assessment'],
                    ['label' => 'View Schedule', 'action' => 'view_schedule'],
                ],
            ];
        });
    }

    /**
     * Get System Admin dashboard data.
     * Uses extended cache TTL and optimized single-query aggregations.
     */
    public function getSystemAdminDashboard(User $user): array
    {
        // System admin dashboard is global, not user-specific - use shared cache key
        $cacheKey = 'dashboard:sa:global';

        return Cache::remember($cacheKey, self::SYSTEM_CACHE_TTL, function () {
            // Application stats for summary cards
            $applicationStats = Application::selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN status NOT IN ("draft", "certified", "rejected") THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = "payment_pending" THEN 1 ELSE 0 END) as pending_payment
            ')->first();

            // Same rule as the Certified page (assessments with status certified), so the
            // card and the list agree even after a certificate's validity has lapsed.
            $certifiedVendors = Assessment::where('status', Assessment::STATUS_CERTIFIED)->count();

            // Fetch all aggregated data with optimized queries
            $enterpriseDistribution = $this->getEnterpriseDistribution();
            $certifiedVendorsByLevel = $this->getCertifiedVendorsByLevel();
            $assessmentStatusFlow = $this->getAssessmentStatusFlowOptimized();
            $userDistribution = $this->getUserDistribution();
            $stateWiseVendors = $this->getStateWiseVendors();

            return [
                'role' => 'system_admin',
                'summary_cards' => [
                    [
                        'label' => 'Total Applications',
                        'value' => (int) ($applicationStats->total ?? 0),
                        'color' => 'blue',
                        'icon' => 'document',
                        'route' => '/applications',
                    ],
                    [
                        'label' => 'Active Applications',
                        'value' => (int) ($applicationStats->active ?? 0),
                        'color' => 'green',
                        'icon' => 'clipboard',
                        'route' => '/applications?exclude_status=draft,certified,rejected',
                    ],
                    [
                        'label' => 'Pending Payment',
                        'value' => (int) ($applicationStats->pending_payment ?? 0),
                        'color' => 'orange',
                        'icon' => 'clock',
                        'route' => '/applications?status=payment_pending',
                    ],
                    [
                        'label' => 'Certified',
                        'value' => $certifiedVendors,
                        'color' => 'purple',
                        'icon' => 'certificate',
                        'route' => '/certified-vendors',
                    ],
                ],
                'enterprise_distribution' => $enterpriseDistribution,
                'certified_vendors_by_level' => $certifiedVendorsByLevel,
                'assessment_status_flow' => $assessmentStatusFlow,
                'user_distribution' => $userDistribution,
                'state_wise_vendors' => $stateWiseVendors,
            ];
        });
    }

    /**
     * Get enterprise distribution by type and size.
     *
     * @param  array  $states  Optional state filter (empty = no filter)
     */
    protected function getEnterpriseDistribution(array $states = []): array
    {
        $query = Application::selectRaw('
                applications.sector,
                applications.enterprise_classification,
                COUNT(*) as registered,
                SUM(CASE WHEN applications.status = "certified" THEN 1 ELSE 0 END) as certified
            ')
            ->join('organizations', 'applications.organization_id', '=', 'organizations.id')
            ->where('organizations.is_profile_completed', true)
            ->whereNotNull('applications.sector')
            ->whereNotNull('applications.enterprise_classification');

        if (! empty($states)) {
            $query->whereIn('applications.unit_state', $states);
        }

        $applications = $query->groupBy('applications.sector', 'applications.enterprise_classification')->get();

        $distribution = [
            'Manufacturing' => [],
            'Service' => [],
        ];

        $sizes = ['Startup', 'Micro', 'Small', 'Medium', 'Large'];

        // Initialize with zeros
        foreach ($sizes as $size) {
            $distribution['Manufacturing'][] = ['name' => $size, 'registered' => 0, 'certified' => 0];
            $distribution['Service'][] = ['name' => $size, 'registered' => 0, 'certified' => 0];
        }

        // Fill in actual counts
        foreach ($applications as $app) {
            $sector = ucfirst($app->sector ?? 'Manufacturing');
            $classification = ucfirst($app->enterprise_classification ?? 'Micro');

            if (isset($distribution[$sector])) {
                $index = array_search($classification, $sizes);
                if ($index !== false) {
                    $distribution[$sector][$index]['registered'] += (int) $app->registered;
                    $distribution[$sector][$index]['certified'] += (int) $app->certified;
                }
            }
        }

        return $distribution;
    }

    /**
     * Get certified vendors by level and type.
     *
     * @param  array  $states  Optional state filter (empty = no filter)
     */
    protected function getCertifiedVendorsByLevel(array $states = []): array
    {
        $query = Certificate::where('certificates.status', 'active')
            ->where('certificates.valid_until', '>=', today())
            ->join('applications', 'certificates.application_id', '=', 'applications.id')
            ->join('organizations', 'certificates.organization_id', '=', 'organizations.id')
            ->where('organizations.is_profile_completed', true)
            ->selectRaw('
                applications.sector,
                certificates.grade as level,
                COUNT(DISTINCT certificates.unit_id) as count
            ')
            ->whereNotNull('applications.sector')
            ->whereNotNull('certificates.grade');

        if (! empty($states)) {
            $query->whereIn('organizations.registered_state', $states);
        }

        $certificates = $query->groupBy('applications.sector', 'certificates.grade')->get();

        $byLevel = [
            'Manufacturing' => [],
            'Service' => [],
        ];

        // Group by sector and level
        foreach ($certificates as $cert) {
            $sector = ucfirst($cert->sector ?? 'manufacturing');
            // Normalize sector name
            if (strtolower($sector) === 'manufacturing') {
                $sector = 'Manufacturing';
            } elseif (strtolower($sector) === 'service') {
                $sector = 'Service';
            }

            $level = $cert->level ?? 'Level 1';

            if (isset($byLevel[$sector])) {
                $byLevel[$sector][] = [
                    'level' => $level,
                    'count' => (int) $cert->count,
                ];
            }
        }

        // Sort by level
        foreach ($byLevel as $sector => &$levels) {
            usort($levels, function ($a, $b) {
                return strcmp($a['level'], $b['level']);
            });
        }

        return $byLevel;
    }

    /**
     * Get assessment status flow counts - OPTIMIZED version.
     * Uses 2 queries instead of 10 separate queries.
     *
     * @param  array  $states  Optional state filter (empty = no filter)
     */
    protected function getAssessmentStatusFlowOptimized(array $states = []): array
    {
        // Single query for all assessment statuses
        $assessmentQuery = Assessment::selectRaw('status, COUNT(*) as count');
        if (! empty($states)) {
            $assessmentQuery->whereHas('application', function ($q) use ($states) {
                $q->whereIn('unit_state', $states);
            });
        }
        $assessmentCounts = $assessmentQuery->groupBy('status')->pluck('count', 'status')->toArray();

        // Single query for application statuses we need
        $applicationQuery = Application::selectRaw('status, COUNT(*) as count')
            ->whereIn('status', ['payment_completed', 'certified']);
        if (! empty($states)) {
            $applicationQuery->whereIn('unit_state', $states);
        }
        $applicationCounts = $applicationQuery->groupBy('status')->pluck('count', 'status')->toArray();

        // For allocation pending, we need payment_completed apps without allocated assessments
        // This is still a subquery but more efficient than whereDoesntHave
        $allocationPendingQuery = DB::table('applications')
            ->where('applications.status', 'payment_completed')
            ->whereNotExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('application_assessments')
                    ->whereColumn('application_assessments.application_id', 'applications.id')
                    ->whereNotNull('application_assessments.allocated_at');
            });

        if (! empty($states)) {
            $allocationPendingQuery->whereIn('applications.unit_state', $states);
        }

        $allocationPending = $allocationPendingQuery->count();

        return [
            ['label' => 'Allocation Pending', 'count' => $allocationPending],
            ['label' => 'Scheduled', 'count' => $assessmentCounts[Assessment::STATUS_SCHEDULED] ?? 0],
            // mobile_complete is still in-progress work (lead finishing on web), not a funnel stage of its own
            ['label' => 'In Progress', 'count' => ($assessmentCounts[Assessment::STATUS_IN_PROGRESS] ?? 0) + ($assessmentCounts[Assessment::STATUS_MOBILE_COMPLETE] ?? 0)],
            ['label' => 'Quality Check', 'count' => $assessmentCounts[Assessment::STATUS_SUBMITTED_FOR_QC] ?? 0],
            ['label' => 'Quality Check Feedback', 'count' => $assessmentCounts[Assessment::STATUS_QC_FEEDBACK] ?? 0],
            ['label' => 'Ready for Committee Review', 'count' => $assessmentCounts[Assessment::STATUS_READY_FOR_COMMITTEE] ?? 0],
            ['label' => 'Committee Review Scheduled', 'count' => $assessmentCounts['committee_scheduled'] ?? 0],
            ['label' => 'Committee Review Feedback', 'count' => $assessmentCounts[Assessment::STATUS_COMMITTEE_FEEDBACK] ?? 0],
            ['label' => 'Certified', 'count' => $applicationCounts['certified'] ?? 0],
        ];
    }

    /**
     * Get user distribution by role.
     */
    protected function getUserDistribution(): array
    {
        $roleDistribution = DB::table('user_role')
            ->join('roles', 'user_role.role_id', '=', 'roles.id')
            ->where('user_role.is_active', true)
            ->selectRaw('roles.name as role_name, COUNT(DISTINCT user_role.user_id) as count')
            ->groupBy('roles.name')
            ->get();

        $distribution = [];
        foreach ($roleDistribution as $role) {
            $distribution[] = [
                'name' => $role->role_name,
                'value' => (int) $role->count,
            ];
        }

        return $distribution;
    }

    /**
     * Get state-wise vendors (registered vs certified).
     *
     * @param  array  $states  Optional state filter (empty = no filter)
     */
    protected function getStateWiseVendors(array $states = []): array
    {
        // Get all applications with their unit state and certification status
        $query = DB::table('applications')
            ->join('organizations', 'applications.organization_id', '=', 'organizations.id')
            ->where('organizations.is_profile_completed', true)
            ->leftJoin('certificates', function ($join) {
                $join->on('applications.id', '=', 'certificates.application_id')
                    ->where('certificates.status', '=', 'active')
                    ->whereRaw('certificates.valid_until >= CURDATE()');
            })
            ->selectRaw("
                applications.unit_state as state,
                COUNT(DISTINCT CASE WHEN applications.status != 'draft' THEN applications.id END) as registered,
                COUNT(DISTINCT CASE WHEN applications.status = 'draft' THEN applications.id END) as draft,
                COUNT(DISTINCT certificates.id) as certified
            ")
            ->whereNotNull('applications.unit_state');

        if (! empty($states)) {
            $query->whereIn('applications.unit_state', $states);
        }

        $stateData = $query->groupBy('applications.unit_state')
            ->orderBy('registered', 'desc')
            ->get();

        $vendors = [];
        foreach ($stateData as $data) {
            $vendors[] = [
                'state' => $data->state ?? 'Unknown',
                'registered' => (int) $data->registered,
                'draft' => (int) $data->draft,
                'certified' => (int) $data->certified,
            ];
        }

        return $vendors;
    }

    /**
     * Get basic dashboard for other roles.
     */
    protected function getBasicDashboard(User $user): array
    {
        return [
            'role' => 'user',
            'summary_cards' => [],
            'message' => 'Welcome to QCI SAMAR Portal',
        ];
    }

    /**
     * Determine primary role for dashboard.
     */
    protected function determinePrimaryRole(User $user): string
    {
        $roles = $user->activeRoles->pluck('slug')->toArray();

        // Priority order
        $rolePriority = [
            'system_admin',
            'drdo_admin',
            'operations_manager',
            'operations_admin',
            'enterprise_admin',
            'assessor',
            'unit_admin',
        ];

        foreach ($rolePriority as $role) {
            if (in_array($role, $roles)) {
                return $role;
            }
        }

        return 'user';
    }

    /**
     * Clear cache for specific user/role.
     */
    public function clearCache(User $user): void
    {
        $role = $this->determinePrimaryRole($user);

        $cacheKeys = [
            "dashboard:{$role}:{$user->id}",
            "dashboard:ea:{$user->organization_id}",
            "dashboard:om:{$user->id}",
            "dashboard:oa:{$user->id}",
            "dashboard:dr:{$user->id}",
            'dashboard:sa:global', // System admin uses global cache
            "dashboard:assessor:{$user->id}",
        ];

        foreach ($cacheKeys as $key) {
            Cache::forget($key);
        }
    }

    /**
     * Clear system admin dashboard cache.
     * Call this when application/assessment data changes significantly.
     */
    public function clearSystemAdminCache(): void
    {
        Cache::forget('dashboard:sa:global');
    }

    /**
     * Clear all dashboard caches.
     */
    public function clearAllCaches(): void
    {
        Cache::flush();
    }
}
