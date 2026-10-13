<?php

namespace App\Policies;

use App\Models\Application;
use App\Models\ApplicationFeedback;
use App\Models\Assessment;
use App\Models\Role;
use App\Models\User;

class ApplicationFeedbackPolicy
{
    /**
     * Determine if the user can view any feedbacks for an application.
     */
    public function viewAny(User $user, Application $application): bool
    {
        return $this->canAccessApplicationFeedback($user, $application);
    }

    /**
     * Determine if the user can view a specific feedback.
     */
    public function view(User $user, ApplicationFeedback $feedback): bool
    {
        $application = $feedback->application;

        if (! $application) {
            return false;
        }

        return $this->canAccessApplicationFeedback($user, $application);
    }

    /**
     * Determine if the user can create feedback for an application.
     */
    public function create(User $user, Application $application): bool
    {
        // Check if assessment has reached submitted_for_qc or later
        $assessment = $application->assessment;
        if (! $assessment || ! in_array($assessment->status, Assessment::FEEDBACK_ELIGIBLE_STATES)) {
            return false;
        }

        // Only enterprise admin and unit admin can submit feedback for their applications
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) && $user->organization_id === $application->organization_id) {
            return true;
        }

        if ($user->hasRole(Role::UNIT_ADMIN)) {
            $userUnits = $this->getUserUnits($user);

            return in_array($application->unit_id, $userUnits);
        }

        return false;
    }

    /**
     * Determine if the user can update feedback.
     */
    public function update(User $user, ApplicationFeedback $feedback): bool
    {
        $application = $feedback->application;

        if (! $application) {
            return false;
        }

        // Same rules as create - only the application owner can update feedback
        return $this->create($user, $application);
    }

    /**
     * Determine if the user can delete feedback.
     */
    public function delete(User $user, ApplicationFeedback $feedback): bool
    {
        // System admin can delete any feedback
        if ($user->hasRole(Role::SYSTEM_ADMIN)) {
            return true;
        }

        $application = $feedback->application;

        if (! $application) {
            return false;
        }

        // Same rules as create - only the application owner can delete their feedback
        return $this->create($user, $application);
    }

    /**
     * Check if user can access application feedback (view operations).
     */
    private function canAccessApplicationFeedback(User $user, Application $application): bool
    {
        // System admins and operations can view all
        if ($user->hasAnyRole([
            Role::SYSTEM_ADMIN,
            Role::OPERATIONS_ADMIN,
            Role::OPERATIONS_MANAGER,
            Role::DRDO_ADMIN,
        ])) {
            return true;
        }

        // Enterprise admin can view their organization's application feedbacks
        if ($user->hasRole(Role::ENTERPRISE_ADMIN) && $user->organization_id === $application->organization_id) {
            return true;
        }

        // Unit admin can view only their unit's application feedbacks
        if ($user->hasRole(Role::UNIT_ADMIN)) {
            $userUnits = $this->getUserUnits($user);

            return in_array($application->unit_id, $userUnits);
        }

        return false;
    }

    /**
     * Get unit IDs assigned to a user with unit_admin role.
     */
    private function getUserUnits(User $user): array
    {
        return $user->roles()
            ->where('slug', Role::UNIT_ADMIN)
            ->wherePivot('is_active', true)
            ->get()
            ->pluck('pivot.unit_id')
            ->filter()
            ->toArray();
    }
}
