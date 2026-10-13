<?php

namespace App\Traits;

use App\Models\Assessment;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Read access to an assessment and the artefacts hanging off it.
 *
 * Two populations, two rules, because they are authorised on different grounds:
 *
 * - Applicants (unit and enterprise admins) are scoped by ownership of the
 *   underlying application. AssessmentPolicy has NO branch for these roles and
 *   returns false for them, so they must not be sent through it.
 * - Everyone else goes through AssessmentPolicy::view, which limits assessors to
 *   assessments they are on the team for and DRDO Lab to certified ones.
 *
 * This lives in a trait rather than in each controller because the duplicated
 * copy is how the original gap survived: the applicant check was pasted into two
 * controllers, neither of which called the policy, so every non-applicant role
 * fell through to "allow" and an assessor who was not on the team could read
 * another team's site photographs by guessing ids.
 *
 * The deeper fix would be an applicant branch in AssessmentPolicy::view so every
 * caller could use Gate alone. That is deliberately NOT done here: the policy has
 * many existing callers that correctly deny applicants today, and widening it
 * would grant applicants access to assessment endpoints they cannot currently
 * reach. That is a product decision, not a security patch.
 */
trait AuthorizesAssessmentAccess
{
    /**
     * Returns a 403 response when the caller may not read this assessment, or
     * null when they may. Non-applicant roles are refused by Gate::authorize,
     * which throws and is rendered as a 403 by the global handler.
     */
    protected function denyUnlessAssessmentVisible(Request $request, Assessment $assessment): ?JsonResponse
    {
        $user = $request->user();

        if ($user->hasRole(Role::UNIT_ADMIN) || $user->hasRole(Role::ENTERPRISE_ADMIN)) {
            return $assessment->isApplicantOwner($user)
                ? null
                : $this->errorResponse('You are not authorized to access this assessment', 403);
        }

        Gate::authorize('view', $assessment);

        return null;
    }
}
