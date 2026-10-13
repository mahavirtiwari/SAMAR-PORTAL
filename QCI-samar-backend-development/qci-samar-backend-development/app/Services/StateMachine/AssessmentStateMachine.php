<?php

namespace App\Services\StateMachine;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\Certificate;
use App\Models\Role;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AssessmentStateMachine extends StateMachine
{
    /**
     * Get state machine configuration for Assessment workflow.
     *
     * Assessment Status Flow (per diagram):
     * - Allocation Pending (created when payment completed)
     * - Scheduled (assessor assigned, date set)
     * - In Progress (assessment started)
     * - Submitted for Quality Check
     * - Quality Check Feedback (loop back if issues)
     * - Ready for Committee Review
     * - Committee Review
     * - Committee Review Feedback (loop back if issues)
     * - Certified (final)
     */
    protected function getConfig(): array
    {
        return [
            Assessment::STATUS_ALLOCATION_PENDING => [
                'label' => 'Allocation Pending',
                'transitions' => [
                    'schedule' => Assessment::STATUS_SCHEDULED,
                ],
                'guards' => [
                    'schedule' => ['anyRole:'.Role::OPERATIONS_MANAGER.','.Role::OPERATIONS_ADMIN],
                ],
                'metadata' => [
                    'color' => 'gray',
                ],
            ],

            Assessment::STATUS_SCHEDULED => [
                'label' => 'Scheduled',
                'transitions' => [
                    'start' => Assessment::STATUS_IN_PROGRESS,
                    'reschedule' => Assessment::STATUS_SCHEDULED,
                ],
                'guards' => [
                    'start' => ['isTeamMember'],
                    'reschedule' => ['anyRole:'.Role::OPERATIONS_MANAGER.','.Role::OPERATIONS_ADMIN],
                ],
                'metadata' => [
                    'color' => 'yellow',
                ],
            ],

            Assessment::STATUS_IN_PROGRESS => [
                'label' => 'In Progress',
                'transitions' => [
                    'complete_mobile' => Assessment::STATUS_MOBILE_COMPLETE,
                ],
                'guards' => [
                    'complete_mobile' => ['isLeadAssessor', 'allTeamMembersMobileComplete'],
                ],
                'metadata' => [
                    'color' => 'blue',
                ],
            ],

            Assessment::STATUS_MOBILE_COMPLETE => [
                'label' => 'Field Work Complete',
                'transitions' => [
                    'submit_for_qc' => Assessment::STATUS_SUBMITTED_FOR_QC,
                ],
                'guards' => [
                    'submit_for_qc' => ['isLeadAssessor', 'allQuestionsAnswered', 'scoreCalculated'],
                ],
                'metadata' => [
                    'color' => 'blue',
                ],
            ],

            Assessment::STATUS_SUBMITTED_FOR_QC => [
                'label' => 'Quality Check',
                'transitions' => [
                    'qc_feedback' => Assessment::STATUS_QC_FEEDBACK,
                    'qc_approve' => Assessment::STATUS_READY_FOR_COMMITTEE,
                ],
                'guards' => [
                    'qc_feedback' => ['role:'.Role::OPERATIONS_MANAGER],
                    'qc_approve' => ['role:'.Role::OPERATIONS_MANAGER],
                ],
                'metadata' => [
                    'color' => 'orange',
                ],
            ],

            Assessment::STATUS_QC_FEEDBACK => [
                'label' => 'Quality Check Feedback',
                'transitions' => [
                    'address_qc_feedback' => Assessment::STATUS_READY_FOR_COMMITTEE,
                ],
                'guards' => [
                    'address_qc_feedback' => ['isLeadAssessor'],
                ],
                'metadata' => [
                    'color' => 'orange',
                ],
            ],

            Assessment::STATUS_READY_FOR_COMMITTEE => [
                'label' => 'Ready for Committee Review',
                'transitions' => [
                    'schedule_committee' => Assessment::STATUS_COMMITTEE_REVIEW,
                ],
                'guards' => [
                    'schedule_committee' => ['anyRole:'.Role::OPERATIONS_MANAGER.','.Role::OPERATIONS_ADMIN],
                ],
                'metadata' => [
                    'color' => 'purple',
                ],
            ],

            Assessment::STATUS_COMMITTEE_REVIEW => [
                'label' => 'Committee Review Scheduled',
                'transitions' => [
                    'committee_feedback' => Assessment::STATUS_COMMITTEE_FEEDBACK,
                    'certify' => Assessment::STATUS_CERTIFIED,
                    'unschedule_committee' => Assessment::STATUS_READY_FOR_COMMITTEE,
                ],
                'guards' => [
                    'committee_feedback' => ['anyRole:'.Role::OPERATIONS_ADMIN, 'committeeSendBackLimitNotReached'],
                    'certify' => ['anyRole:'.Role::OPERATIONS_ADMIN],
                    'unschedule_committee' => ['anyRole:'.Role::OPERATIONS_ADMIN],
                ],
                'metadata' => [
                    'color' => 'purple',
                ],
            ],

            Assessment::STATUS_COMMITTEE_FEEDBACK => [
                'label' => 'Committee Review Feedback',
                'transitions' => [
                    'address_committee_feedback' => Assessment::STATUS_SUBMITTED_FOR_QC,
                ],
                'guards' => [
                    'address_committee_feedback' => ['isLeadAssessor', 'allQuestionsAnswered', 'scoreCalculated'],
                ],
                'metadata' => [
                    'color' => 'orange',
                ],
            ],

            Assessment::STATUS_CERTIFIED => [
                'label' => 'Certified',
                'transitions' => [],
                'guards' => [],
                'metadata' => [
                    'color' => 'green',
                    'final' => true,
                ],
            ],
        ];
    }

    /**
     * Guard: Check if user is a team member of this assessment.
     */
    protected function isTeamMember(): bool
    {
        if (! $this->user) {
            return false;
        }

        return $this->model->teamMembers()
            ->where('user_id', $this->user->id)
            ->exists();
    }

    /**
     * Guard: Check if user is the lead assessor for this assessment.
     */
    protected function isLeadAssessor(): bool
    {
        if (! $this->user) {
            return false;
        }

        return $this->model->teamMembers()
            ->where('user_id', $this->user->id)
            ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
            ->exists();
    }

    /**
     * Guard: Check that every team member has done their mobile cutover.
     */
    protected function allTeamMembersMobileComplete(): bool
    {
        return $this->model->areAllTeamMembersMobileComplete();
    }

    /**
     * Guard: every parameter that must be complete (mandatory, assigned, or started) is
     * fully answered. The rule lives on the model so this guard and the pre-submit
     * validation can never disagree.
     */
    protected function allQuestionsAnswered(): bool
    {
        return $this->model->incompleteParameters()->isEmpty();
    }

    /**
     * Guard: Check if score is calculated.
     */
    protected function scoreCalculated(): bool
    {
        return $this->model->total_score !== null;
    }

    /**
     * Guard: Block a committee send-back once the limit of prior send-backs is hit.
     * Counts prior APPLIED committee send-backs from status history (each successful
     * committee_review -> committee_feedback transition). Guards run before the transition
     * is logged, so the in-flight round is never counted -- giving the same answer whether
     * the decision is checked at record time or applied at meeting close. QC send-backs use
     * a different transition and are excluded by design.
     */
    protected function committeeSendBackLimitNotReached(): bool
    {
        return $this->model->statusHistories()
            ->where('to_status', Assessment::STATUS_COMMITTEE_FEEDBACK)
            ->count() < Assessment::MAX_COMMITTEE_SEND_BACKS;
    }

    /**
     * The incomplete-parameter reason is built from live data, so it is resolved here
     * rather than in the static message map.
     */
    protected function getGuardFailureReason(string $guard): string
    {
        if ($guard === 'allQuestionsAnswered') {
            $incomplete = $this->model->incompleteParameters()
                ->map(fn (array $parameter) => Assessment::describeIncompleteParameter($parameter));

            return 'Cannot proceed until every started, assigned or mandatory parameter is fully answered: '
                .$incomplete->implode('; ');
        }

        return parent::getGuardFailureReason($guard);
    }

    /**
     * Human-readable reasons for custom guard failures.
     */
    protected function getGuardMessages(): array
    {
        return [
            'committeeSendBackLimitNotReached' => 'This assessment has already been sent back '
                .Assessment::MAX_COMMITTEE_SEND_BACKS.' times by the committee and cannot be sent back again. It can only be certified.',
        ];
    }

    /**
     * Business transitions surfaced in the System Admin activity log.
     */
    protected function auditableTransitions(): array
    {
        return [
            'schedule' => 'assessment_scheduled',
            'start' => 'assessment_in_progress',
            'complete_mobile' => 'assessment_mobile_complete',
            'submit_for_qc' => 'assessment_submitted_for_qc',
            'qc_approve' => 'assessment_qc_approved',
            'qc_feedback' => 'assessment_qc_sent_back',
            'address_qc_feedback' => 'assessment_qc_feedback_addressed',
            'schedule_committee' => 'assessment_committee_scheduled',
            'committee_feedback' => 'assessment_committee_sent_back',
            'address_committee_feedback' => 'assessment_committee_feedback_addressed',
            'certify' => 'assessment_certified',
            'reschedule' => 'assessment_rescheduled',
        ];
    }

    /**
     * Hook: After transition.
     */
    protected function afterTransition(string $transition, string $fromState, string $toState, array $data): void
    {
        $updates = [];

        switch ($toState) {
            case Assessment::STATUS_SCHEDULED:
                // Only the initial allocation stamps allocated_at and pushes the
                // application to in_progress. A reschedule is a self-loop on
                // 'scheduled': it keeps the original allocation timestamp and the
                // application already sits at in_progress, so neither applies.
                if ($transition === 'schedule') {
                    $updates['allocated_at'] = now();
                    if (isset($data['scheduled_start_date'])) {
                        $updates['scheduled_start_date'] = $data['scheduled_start_date'];
                    }
                    if (isset($data['scheduled_end_date'])) {
                        $updates['scheduled_end_date'] = $data['scheduled_end_date'];
                    }
                    $this->syncApplicationToInProgress();
                }
                break;
            case Assessment::STATUS_IN_PROGRESS:
                if (! $this->model->started_at) {
                    $updates['started_at'] = now();
                    $updates['actual_start_date'] = now()->toDateString();
                }
                // Initialize step progress tracking so all steps begin as 'pending'
                $this->model->initializeStepProgress();
                break;
            case Assessment::STATUS_SUBMITTED_FOR_QC:
                $updates['submitted_at'] = now();
                // Score is calculated by the controller before transition (guard requires it)
                break;
            case Assessment::STATUS_CERTIFIED:
                $updates['completed_at'] = now();
                $updates['actual_end_date'] = now()->toDateString();
                // Sync application to certified
                $this->syncApplicationToCertified();
                break;
        }

        if (! empty($updates)) {
            $this->model->update($updates);
        }

        $this->triggerNotification($transition, $toState);
    }

    /**
     * Transition application status to in_progress when assessment is scheduled.
     *
     * This is an automated transition triggered when the assessment moves to 'scheduled'
     * status (after assessor allocation). The application should move from 'payment_completed'
     * to 'in_progress' at this point.
     *
     * @throws void - Exceptions are caught and logged; assessment scheduling continues
     */
    protected function syncApplicationToInProgress(): void
    {
        if (! $this->model->application) {
            \Log::warning('Cannot auto-transition application: no application found', [
                'assessment_id' => $this->model->id,
            ]);

            return;
        }

        // Only transition if application is in payment_completed status
        if ($this->model->application->status !== 'payment_completed') {
            \Log::info('Application not in payment_completed status, skipping auto-transition', [
                'assessment_id' => $this->model->id,
                'application_id' => $this->model->application->id,
                'expected_status' => 'payment_completed',
                'actual_status' => $this->model->application->status,
            ]);

            return;
        }

        // Verify user has required role for application transition
        if (! $this->user || ! $this->user->hasAnyRole([Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN])) {
            \Log::error('User lacks OPERATIONS_MANAGER or OPERATIONS_ADMIN role for application transition', [
                'assessment_id' => $this->model->id,
                'application_id' => $this->model->application->id,
                'user_id' => $this->user?->id,
                'user_email' => $this->user?->email,
                'user_roles' => $this->user?->activeRoles->pluck('slug')->toArray(),
            ]);

            // Don't throw - assessment scheduling should not fail due to application sync issues
            return;
        }

        try {
            $applicationStateMachine = new ApplicationStateMachine($this->model->application, $this->user);

            // Check if the 'allocate' transition is available
            if ($applicationStateMachine->canTransition('allocate')) {
                $applicationStateMachine->transition('allocate', [
                    'remarks' => 'Automated: Assessment scheduled with assessor allocation',
                    'metadata' => [
                        'automated' => true,
                        'triggered_by' => 'assessment_scheduling',
                        'assessment_id' => $this->model->id,
                    ],
                ]);

                \Log::info('Application status auto-transitioned to in_progress', [
                    'assessment_id' => $this->model->id,
                    'application_id' => $this->model->application->id,
                    'from_status' => 'payment_completed',
                    'to_status' => 'in_progress',
                ]);
            } else {
                \Log::warning('Cannot auto-transition application: allocate transition not available', [
                    'assessment_id' => $this->model->id,
                    'application_id' => $this->model->application->id,
                    'application_status' => $this->model->application->status,
                    'available_transitions' => $applicationStateMachine->getAvailableTransitions(),
                    'user_id' => $this->user?->id,
                    'user_roles' => $this->user?->activeRoles->pluck('slug')->toArray(),
                ]);
            }
        } catch (\Exception $e) {
            \Log::critical('Application failed to sync to in_progress after assessment scheduled', [
                'assessment_id' => $this->model->id,
                'application_id' => $this->model->application->id,
                'error' => $e->getMessage(),
            ]);
            // Don't throw - assessment scheduling should not fail if application status update fails
        }
    }

    /**
     * Sync application status to certified when assessment is certified.
     * Also creates a certificate record for the certified assessment.
     */
    protected function syncApplicationToCertified(): void
    {
        if (! $this->model->application) {
            \Log::warning('Cannot sync to certified: no application found', [
                'assessment_id' => $this->model->id,
            ]);

            return;
        }

        try {
            // Create certificate first
            $this->createCertificate();

            // An application must never be marked certified without a certificate:
            // its expiry date and certificate download URL are read from that row,
            // so a certified application with no certificate is invalid data. If
            // certificate creation did not produce one, leave the application in
            // its prior state so the failure is visible and recoverable instead
            // of a silent "certified with no certificate" record.
            $hasCertificate = Certificate::where('application_id', $this->model->application->id)
                ->whereIn('status', ['active', 'suspended'])
                ->exists();

            if (! $hasCertificate) {
                \Log::critical('Application not marked certified: certificate creation produced no certificate', [
                    'assessment_id' => $this->model->id,
                    'application_id' => $this->model->application->id,
                ]);

                return;
            }

            // Then sync application status
            $applicationStateMachine = new ApplicationStateMachine($this->model->application, $this->user);
            if ($applicationStateMachine->canTransition('certify')) {
                $applicationStateMachine->transition('certify', [
                    'metadata' => [
                        'automated' => true,
                        'triggered_by' => 'assessment_certification',
                        'assessment_id' => $this->model->id,
                    ],
                ]);
            }
        } catch (\Exception $e) {
            \Log::error('Failed to sync application to certified: '.$e->getMessage(), [
                'assessment_id' => $this->model->id,
                'application_id' => $this->model->application->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Create a certificate record when assessment is certified.
     */
    protected function createCertificate(): void
    {
        $application = $this->model->application;

        if (! $application) {
            \Log::warning('Cannot create certificate: no application found', [
                'assessment_id' => $this->model->id,
            ]);

            return;
        }

        // Check if certificate already exists for this application to avoid duplicates
        $existingCertificate = Certificate::where('application_id', $application->id)
            ->whereIn('status', ['active', 'suspended'])
            ->first();

        if ($existingCertificate) {
            \Log::info('Certificate already exists for application, skipping creation', [
                'assessment_id' => $this->model->id,
                'application_id' => $application->id,
                'certificate_id' => $existingCertificate->id,
                'certificate_number' => $existingCertificate->certificate_number,
            ]);

            return;
        }

        try {
            $certificateNumber = $this->generateCertificateNumber($application);

            $certificateType = $this->determineCertificateType($application);

            $validityMonths = SystemSetting::getCertificateValidityYears() * 12;

            // A renewal continues validity from the previous certificate's
            // expiry date (no gap); an initial certification starts today.
            $previousCertificate = $application->previousApplication?->certificate;
            $isRenewal = $application->application_type === 'renewal' && $previousCertificate;

            $issueDate = now()->toDateString();
            $validFrom = $isRenewal
                ? Carbon::parse($previousCertificate->valid_until)->toDateString()
                : now()->toDateString();
            $validUntil = Carbon::parse($validFrom)->addMonths($validityMonths)->subDay()->toDateString();

            $scope = $application->sector === 'service' ? 'Service' : 'Manufacturing';

            $certificate = DB::transaction(function () use (
                $application, $certificateNumber, $certificateType, $scope,
                $issueDate, $validFrom, $validUntil, $validityMonths, $isRenewal, $previousCertificate
            ) {
                $certificate = Certificate::create([
                    'application_id' => $application->id,
                    'organization_id' => $application->organization_id,
                    'unit_id' => $application->unit_id,
                    'certificate_number' => $certificateNumber,
                    'certificate_type' => $certificateType,
                    'scheme' => 'SAMAR',
                    'scope' => $scope,
                    'issue_date' => $issueDate,
                    'valid_from' => $validFrom,
                    'valid_until' => $validUntil,
                    'validity_months' => $validityMonths,
                    'status' => 'active',
                    'final_score' => $this->model->total_score,
                    'grade' => $this->determineGrade($this->model->total_score),
                    'issued_by' => $this->user?->id,
                    'issued_at' => now(),
                    'is_public' => true,
                    'allow_verification' => true,
                    'renews_certificate_id' => $isRenewal ? $previousCertificate->id : null,
                    'remarks' => 'Certificate auto-generated upon assessment certification',
                ]);

                // Retire the predecessor: link forward and mark as renewed.
                if ($isRenewal) {
                    $previousCertificate->update([
                        'renewed_by_certificate_id' => $certificate->id,
                        'status' => 'renewed',
                    ]);
                }

                $application->certificate_expiry_at = $validUntil;
                $application->save();

                return $certificate;
            });

            \Log::info('Certificate created successfully', [
                'assessment_id' => $this->model->id,
                'application_id' => $application->id,
                'certificate_id' => $certificate->id,
                'certificate_number' => $certificate->certificate_number,
                'certificate_type' => $certificate->certificate_type,
                'final_score' => $this->model->total_score,
                'grade' => $certificate->grade,
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to create certificate: '.$e->getMessage(), [
                'assessment_id' => $this->model->id,
                'application_id' => $application->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            // Don't throw - assessment certification should not fail if certificate creation fails
        }
    }

    /**
     * Generate certificate number in legacy format: DDMMYYYY_{samar_id tail}
     * e.g. issue date 03-Jan-2025 + creator samar_id SAMAR-030125-11111 -> 03012025_030125-11111
     */
    protected function generateCertificateNumber(Application $application): string
    {
        $creator = $application->creator;

        if (! $creator) {
            throw new \RuntimeException(
                "Cannot generate certificate number: application {$application->id} has no creator (created_by is null)."
            );
        }

        if (empty($creator->samar_id)) {
            throw new \RuntimeException(
                "Cannot generate certificate number: user {$creator->id} has no samar_id."
            );
        }

        $samarTail = substr($creator->samar_id, strpos($creator->samar_id, '-') + 1);
        $base = now()->format('dmY').'_'.$samarTail;

        // The base number is unique only per (creator, day). When the same
        // creator has more than one application certified on the same day it
        // collides on the certificate_number unique index, which previously
        // failed certificate creation silently. Disambiguate with a -N suffix,
        // keeping the legacy format for the first certificate of the day.
        $number = $base;
        $suffix = 1;
        while (Certificate::where('certificate_number', $number)->exists()) {
            $suffix++;
            $number = $base.'-'.$suffix;
        }

        return $number;
    }

    /**
     * Determine certificate type based on whether this is a renewal.
     */
    protected function determineCertificateType(Application $application): string
    {
        // If ANY previous certificate exists for this organization/unit, it is a renewal.
        // The previous condition (`status != active`) was inverted and would incorrectly
        // treat active certs as initial and expired/revoked certs as renewal.
        $previousCertificate = Certificate::where('organization_id', $application->organization_id)
            ->where('unit_id', $application->unit_id)
            ->orderBy('created_at', 'desc')
            ->first();

        return $previousCertificate ? 'renewal' : 'initial';
    }

    /**
     * Determine certification grade/level based on total score.
     *
     * Rating scale:
     * - 0.0 to 1.5 → Level 1
     * - >1.5 to 2.5 → Level 2
     * - >2.5 to 3.5 → Level 3
     * - >3.5 to 4.5 → Level 4
     * - >4.5 to 5.0 → Level 5
     */
    protected function determineGrade(?float $score): ?string
    {
        $level = Assessment::ratingLevelFromScore($score);

        return $level === null ? null : "Level {$level}";
    }

    /**
     * Trigger notification based on transition.
     */
    protected function triggerNotification(string $transition, string $toState): void
    {
        $event = "assessment.{$toState}";

        event('assessment.status.changed', [
            'assessment' => $this->model,
            'event' => $event,
            'transition' => $transition,
            'user' => $this->user,
        ]);
    }

    protected function logStatusChange(string $fromStatus, string $toStatus, array $data): void
    {
        $this->model->statusHistories()->create([
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'changed_by' => $this->user?->id,
            'changed_by_role' => $this->user?->activeRoles->pluck('slug')->first(),
            'remarks' => $data['remarks'] ?? $this->defaultRemarksFor($fromStatus, $toStatus),
            'metadata' => $data['metadata'] ?? null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }

    private function defaultRemarksFor(?string $fromStatus, string $toStatus): string
    {
        return match ($toStatus) {
            Assessment::STATUS_ALLOCATION_PENDING => 'Assessment pending allocation',
            Assessment::STATUS_SCHEDULED => 'Assessment allocated to assessor',
            Assessment::STATUS_IN_PROGRESS => 'Assessment started by assessor',
            Assessment::STATUS_MOBILE_COMPLETE => 'All team members completed on mobile',
            Assessment::STATUS_SUBMITTED_FOR_QC => 'Assessment submitted for QC review',
            Assessment::STATUS_QC_FEEDBACK => 'QC feedback provided to assessor',
            Assessment::STATUS_READY_FOR_COMMITTEE => 'Assessment marked ready for committee review',
            Assessment::STATUS_COMMITTEE_REVIEW => 'Committee review scheduled',
            Assessment::STATUS_COMMITTEE_FEEDBACK => 'Committee feedback provided',
            Assessment::STATUS_CERTIFIED => 'Assessment certified',
            default => $fromStatus
                ? sprintf('Status changed from %s to %s', $fromStatus, $toStatus)
                : 'Assessment created',
        };
    }
}
