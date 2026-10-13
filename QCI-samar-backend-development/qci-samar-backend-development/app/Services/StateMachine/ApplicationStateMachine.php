<?php

namespace App\Services\StateMachine;

use App\Models\Assessment;
use App\Models\Role;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Log;

class ApplicationStateMachine extends StateMachine
{
    /**
     * Get state machine configuration for Application workflow.
     *
     * Application Status Flow (per diagram):
     * - Draft → DRDO Approval Pending (if DRDO approval required) → Payment Pending
     * - Draft → Payment Pending (if DRDO approval not required)
     * - Payment Pending → Payment Completed (on successful payment)
     * - Payment Completed → In Progress (assessment scheduled)
     * - In Progress → Certified (assessment complete, all reviews done)
     * - DRDO Approval Pending → Rejected (if DRDO rejects)
     *
     * Note: Assessment sub-statuses (Scheduled, In Progress, QC, Committee Review, etc.)
     * are tracked in the Assessment model, not here.
     */
    protected function getConfig(): array
    {
        return [
            'draft' => [
                'label' => 'Draft',
                'transitions' => [
                    'submit' => 'drdo_approval_pending',
                    'submit_direct' => 'payment_pending',
                ],
                'guards' => [
                    'submit' => ['anyRole:'.Role::ENTERPRISE_ADMIN.','.Role::UNIT_ADMIN, 'isProfileComplete', 'requiresDrdoApproval'],
                    'submit_direct' => ['anyRole:'.Role::ENTERPRISE_ADMIN.','.Role::UNIT_ADMIN, 'isProfileComplete', 'doesNotRequireDrdoApproval'],
                ],
                'metadata' => [
                    'editable' => true,
                    'color' => 'gray',
                    'assessment_status' => null,
                    'payment_status' => null,
                ],
            ],

            'drdo_approval_pending' => [
                'label' => 'DRDO Approval Pending',
                'transitions' => [
                    'drdo_approve' => 'payment_pending',
                    'drdo_reject' => 'rejected',
                ],
                'guards' => [
                    'drdo_approve' => ['role:'.Role::DRDO_ADMIN],
                    'drdo_reject' => ['role:'.Role::DRDO_ADMIN],
                ],
                'metadata' => [
                    'editable' => false,
                    'color' => 'yellow',
                    'assessment_status' => null,
                    'payment_status' => null,
                ],
            ],

            'payment_pending' => [
                'label' => 'Payment Pending',
                'transitions' => [
                    'payment_success' => 'payment_completed',
                    'payment_failed' => 'payment_pending', // Stay in same state
                ],
                'guards' => [
                    'payment_success' => ['paymentCompleted'],
                    'payment_failed' => [],
                ],
                'metadata' => [
                    'editable' => false,
                    'color' => 'orange',
                    'assessment_status' => null,
                    'payment_status' => ['pending', 'failed'],
                ],
            ],

            'payment_completed' => [
                'label' => 'Payment Completed',
                'transitions' => [
                    'allocate' => 'in_progress',
                ],
                'guards' => [
                    'allocate' => ['role:'.Role::OPERATIONS_MANAGER],
                ],
                'metadata' => [
                    'editable' => false,
                    'color' => 'blue',
                    'assessment_status' => Assessment::STATUS_ALLOCATION_PENDING,
                    'payment_status' => 'success',
                ],
            ],

            'in_progress' => [
                'label' => 'In Progress',
                'transitions' => [
                    'certify' => 'certified',
                ],
                'guards' => [
                    'certify' => ['anyRole:'.Role::OPERATIONS_ADMIN, 'assessmentCertified'],
                ],
                'metadata' => [
                    'editable' => false,
                    'color' => 'blue',
                    'assessment_status' => [
                        Assessment::STATUS_SCHEDULED,
                        Assessment::STATUS_IN_PROGRESS,
                        Assessment::STATUS_SUBMITTED_FOR_QC,
                        Assessment::STATUS_QC_FEEDBACK,
                        Assessment::STATUS_READY_FOR_COMMITTEE,
                        Assessment::STATUS_COMMITTEE_REVIEW,
                        Assessment::STATUS_COMMITTEE_FEEDBACK,
                    ],
                    'payment_status' => 'success',
                ],
            ],

            'certified' => [
                'label' => 'Certified',
                'transitions' => [],
                'guards' => [],
                'metadata' => [
                    'editable' => false,
                    'color' => 'green',
                    'final' => true,
                    'assessment_status' => Assessment::STATUS_CERTIFIED,
                    'payment_status' => 'success',
                ],
            ],

            'rejected' => [
                'label' => 'Rejected',
                'transitions' => [],
                'guards' => [],
                'metadata' => [
                    'editable' => false,
                    'color' => 'red',
                    'final' => true,
                    'assessment_status' => null,
                    'payment_status' => null,
                ],
            ],
        ];
    }

    /**
     * Guard: Check if organization profile is complete.
     */
    protected function isProfileComplete(): bool
    {
        return $this->model->organization->isProfileComplete();
    }

    /**
     * Guard: Check if DRDO approval is required.
     * Based solely on the system-wide DRDO approval setting.
     */
    protected function requiresDrdoApproval(): bool
    {
        return SystemSetting::isDrdoApprovalRequired();
    }

    /**
     * Guard: Check if DRDO approval is NOT required.
     * Based solely on the system-wide DRDO approval setting.
     */
    protected function doesNotRequireDrdoApproval(): bool
    {
        return ! SystemSetting::isDrdoApprovalRequired();
    }

    /**
     * Guard: Check if payment is completed.
     */
    protected function paymentCompleted(): bool
    {
        return $this->model->payment_status === 'success';
    }

    /**
     * Guard: Check if assessment is certified (all reviews complete).
     */
    protected function assessmentCertified(): bool
    {
        return $this->model->assessment &&
               $this->model->assessment->status === Assessment::STATUS_CERTIFIED;
    }

    /**
     * Get custom messages for guard failures.
     */
    protected function getGuardMessages(): array
    {
        return [
            'isProfileComplete' => 'Organization profile is incomplete. Please complete all required profile information (PAN, GST, Incorporation Certificate) before submitting.',
            'requiresDrdoApproval' => 'DRDO approval is not enabled for this submission path.',
            'doesNotRequireDrdoApproval' => 'DRDO approval is required for this application.',
            'paymentCompleted' => 'Payment has not been completed yet.',
            'assessmentCertified' => 'Assessment has not been certified yet.',
        ];
    }

    /**
     * Business transitions surfaced in the System Admin activity log.
     */
    protected function auditableTransitions(): array
    {
        return [
            'submit' => 'application_submitted',
            'submit_direct' => 'application_submitted',
            'drdo_approve' => 'application_drdo_approved',
            'drdo_reject' => 'application_drdo_rejected',
            'payment_success' => 'application_payment_completed',
            'allocate' => 'application_in_progress',
            'certify' => 'application_certified',
        ];
    }

    /**
     * Hook: After transition.
     */
    protected function afterTransition(string $transition, string $fromState, string $toState, array $data): void
    {
        $updates = [];

        switch ($toState) {
            case 'drdo_approval_pending':
                $updates['submitted_at'] = now();
                break;
            case 'payment_pending':
                if ($fromState === 'draft') {
                    $updates['submitted_at'] = now();
                }
                if ($fromState === 'drdo_approval_pending') {
                    $updates['drdo_approved_at'] = now();
                    if (isset($data['remarks'])) {
                        $updates['drdo_approval_remarks'] = $data['remarks'];
                    }
                }
                break;
            case 'payment_completed':
                $updates['payment_completed_at'] = now();
                // Create assessment for this application
                $this->createAssessment();
                break;
            case 'in_progress':
                $updates['allocated_at'] = now();
                break;
            case 'certified':
                $updates['certified_at'] = now();
                break;
            case 'rejected':
                $updates['rejected_at'] = now();
                if (isset($data['reason'])) {
                    $updates['rejection_reason'] = $data['reason'];
                }
                break;
        }

        if (! empty($updates)) {
            $this->model->update($updates);
        }

        $this->triggerNotification($transition, $toState);
    }

    /**
     * Create an assessment record for the application.
     *
     * This is called when payment is completed, creating an assessment
     * in 'allocation_pending' status for the Operations Manager to allocate.
     */
    protected function createAssessment(): ?Assessment
    {
        try {
            // Check if assessment already exists for this application
            $existingAssessment = Assessment::where('application_id', $this->model->id)->first();
            if ($existingAssessment) {
                Log::info('Assessment already exists for application', [
                    'application_id' => $this->model->id,
                    'assessment_id' => $existingAssessment->id,
                ]);

                return $existingAssessment;
            }

            $assessment = Assessment::create([
                'application_id' => $this->model->id,
                'organization_id' => $this->model->organization_id,
                'unit_id' => $this->model->unit_id,
                'status' => Assessment::STATUS_ALLOCATION_PENDING,
                'created_by' => $this->user?->id,
            ]);

            Log::info('Assessment created for application after payment', [
                'application_id' => $this->model->id,
                'assessment_id' => $assessment->id,
            ]);

            // Copy parameters and questions from master tables to assessment
            $assessment->copyAssessmentData();

            return $assessment;
        } catch (\Exception $e) {
            Log::error('Assessment creation failed after payment', [
                'application_id' => $this->model->id,
                'error' => $e->getMessage(),
            ]);
            // Notify operations team so they can manually trigger assessment creation
            Log::critical('MANUAL INTERVENTION REQUIRED: Assessment creation failed after payment', [
                'application_id' => $this->model->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'action_required' => 'Manually create assessment record for this application',
            ]);

            // Don't throw - assessment creation failure shouldn't block payment completion
            return null;
        }
    }

    /**
     * Trigger notification based on transition.
     */
    protected function triggerNotification(string $transition, string $toState): void
    {
        $event = "application.{$toState}";

        event('application.status.changed', [
            'application' => $this->model,
            'event' => $event,
            'transition' => $transition,
            'user' => $this->user,
        ]);
    }
}
