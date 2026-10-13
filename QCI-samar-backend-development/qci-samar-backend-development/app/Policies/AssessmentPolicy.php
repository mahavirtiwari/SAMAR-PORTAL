<?php

namespace App\Policies;

use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\Role;
use App\Models\User;

class AssessmentPolicy
{
    /**
     * Determine if the user can view any assessments.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole([
            Role::OPERATIONS_MANAGER,
            Role::OPERATIONS_ADMIN,
            Role::SYSTEM_ADMIN,
            Role::DRDO_ADMIN,
            Role::DRDO_LAB,
            Role::ASSESSOR,
        ]);
    }

    /**
     * Determine if the user can view the assessment.
     */
    public function view(User $user, Assessment $assessment): bool
    {
        // System roles can view all
        if ($user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::DRDO_ADMIN,
        ])) {
            return true;
        }

        // DRDO Lab can only view certified assessments
        if ($user->hasRole(Role::DRDO_LAB)) {
            return $assessment->status === Assessment::STATUS_CERTIFIED;
        }

        // Assessors can view assessments assigned to them (via team members)
        if ($user->hasRole(Role::ASSESSOR)) {
            return $assessment->teamMembers()->where('user_id', $user->id)->exists();
        }

        return false;
    }

    /**
     * Determine if the user can allocate assessors.
     */
    public function allocate(User $user): bool
    {
        return $user->hasRole(Role::OPERATIONS_MANAGER);
    }

    /**
     * Determine if the user can conduct the assessment.
     */
    public function conduct(User $user, Assessment $assessment): bool
    {
        if (! $user->hasRole(Role::ASSESSOR)) {
            return false;
        }

        // Must be assigned to this assessment (via team members)
        return $assessment->teamMembers()->where('user_id', $user->id)->exists();
    }

    /**
     * Determine if the user can submit the assessment for QC.
     */
    public function submit(User $user, Assessment $assessment): bool
    {
        if (! $user->hasRole(Role::ASSESSOR)) {
            return false;
        }

        // Must be the lead assessor (via team members)
        return $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
            ->exists();
    }

    /**
     * Determine if the user can perform QC review.
     */
    public function qcReview(User $user, Assessment $assessment): bool
    {
        return $user->hasRole(Role::OPERATIONS_MANAGER) &&
               $assessment->status === Assessment::STATUS_SUBMITTED_FOR_QC;
    }

    /**
     * Determine if the user can approve QC.
     */
    public function qcApprove(User $user, Assessment $assessment): bool
    {
        return $user->hasRole(Role::OPERATIONS_MANAGER) &&
               $assessment->status === Assessment::STATUS_SUBMITTED_FOR_QC;
    }

    /**
     * Determine if the user can schedule an assessment for committee review.
     */
    public function scheduleCommittee(User $user, Assessment $assessment): bool
    {
        return $user->hasAnyRole([Role::OPERATIONS_MANAGER, Role::OPERATIONS_ADMIN]);
    }

    /**
     * Determine if the user can record committee decision.
     */
    public function committeeDecision(User $user, Assessment $assessment): bool
    {
        return $user->hasRole(Role::OPERATIONS_ADMIN);
    }
}
