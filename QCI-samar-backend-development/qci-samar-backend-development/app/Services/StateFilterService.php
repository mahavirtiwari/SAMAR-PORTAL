<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class StateFilterService
{
    /**
     * Determine if state-based filtering should be applied for the given user.
     */
    public function shouldFilter(User $user): bool
    {
        return $user->hasRole(Role::OPERATIONS_MANAGER) && $user->hasStateRestrictions();
    }

    /**
     * Get the assigned states for an Operations Manager user.
     * Returns an empty array for non-OM users or unrestricted OMs.
     */
    public function getStates(User $user): array
    {
        if (! $user->hasRole(Role::OPERATIONS_MANAGER)) {
            return [];
        }

        return $user->getAssignedStatesArray();
    }

    /**
     * Apply state filter to an organization query builder.
     */
    public function applyToOrganizationQuery(Builder $query, User $user): Builder
    {
        $states = $this->getStates($user);

        if (empty($states)) {
            return $query;
        }

        return $query->inStates($states);
    }

    /**
     * Apply state filter to an application query builder.
     */
    public function applyToApplicationQuery(Builder $query, User $user): Builder
    {
        $states = $this->getStates($user);

        if (empty($states)) {
            return $query;
        }

        return $query->forStates($states);
    }

    /**
     * Apply state filter to an assessment query builder.
     */
    public function applyToAssessmentQuery(Builder $query, User $user): Builder
    {
        $states = $this->getStates($user);

        if (empty($states)) {
            return $query;
        }

        return $query->forStates($states);
    }

    /**
     * Apply state filter to a certificate query builder.
     */
    public function applyToCertificateQuery(Builder $query, User $user): Builder
    {
        $states = $this->getStates($user);

        if (empty($states)) {
            return $query;
        }

        return $query->forStates($states);
    }

    /**
     * Apply state filter to a payment query builder.
     */
    public function applyToPaymentQuery(Builder $query, User $user): Builder
    {
        $states = $this->getStates($user);

        if (empty($states)) {
            return $query;
        }

        return $query->whereHas('application', function ($q) use ($states) {
            Application::applyStateVisibility($q, $states);
        });
    }

    /**
     * Check if a specific assessment falls within the user's assigned states.
     * Returns true if the user has no state restrictions (sees everything).
     */
    public function assessmentInStates(User $user, Assessment $assessment): bool
    {
        $states = $this->getStates($user);

        if (empty($states)) {
            return true;
        }

        $unitState = $assessment->application?->unit_state;

        // Matches Application::applyStateVisibility: an unassigned state is visible to
        // everyone. Without this the list and the record would disagree, so a manager
        // would see the assessment and then be refused when opening it. [BUG-08934]
        if ($unitState === null) {
            return true;
        }

        return in_array($unitState, $states);
    }

    /**
     * Check if a specific organization falls within the user's assigned states.
     * Returns true if the user has no state restrictions (sees everything).
     */
    public function organizationInStates(User $user, Organization $organization): bool
    {
        $states = $this->getStates($user);

        if (empty($states)) {
            return true;
        }

        return in_array($organization->registered_state, $states);
    }
}
