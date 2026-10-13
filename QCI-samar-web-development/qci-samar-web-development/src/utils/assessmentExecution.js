/**
 * Shared logic for the web assessor's assessment-execution flow (service sector).
 * Mirrors the mobile app's team-role resolution and step-progress gating so the
 * web console gates steps identically to the app.
 */

// Canonical step order — shared by the mobile UI, the backend submit gate, and
// the local progress computation. Do not reorder.
export const CANONICAL_STEP_ORDER = Object.freeze(['parameter_allocation', 'site_pictures', 'opening_meeting', 'site_tour', 'basic_information', 'assessment_parameters', 'closing_meeting']);

// Steps a co-assessor is responsible for; the rest are lead-only. For service
// sector site_pictures/site_tour auto-complete from the applicant's uploads.
const CO_ASSESSOR_STEPS = Object.freeze(['site_pictures', 'site_tour', 'assessment_parameters']);

export const STEP_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

/**
 * Resolve the current user's team role on an assessment.
 * @param {object} assessmentData - the unwrapped assessment (assessment.data.assessment)
 * @param {number|string} userId - current user's id
 */
const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && `${a}` === `${b}`;

/** The current user's membership row, matched on the user id it carries. */
export const findMyTeamMember = (teamMembers, userId) => (teamMembers || []).find(member => sameId(member?.userId, userId) || sameId(member?.user?.id, userId)) || null;

export const resolveTeamRole = (assessmentData, userId) => {
  const teamMember = findMyTeamMember(assessmentData?.teamMembers, userId);
  const isLead = sameId(assessmentData?.leadAssessor?.id, userId) || teamMember?.role === 'lead_assessor';
  const isCoAssessor = !isLead && teamMember?.role === 'co_assessor';
  return {
    teamMember,
    // The id of the membership row — this is what the API's `teamMemberId`
    // fields mean (parameter allocation, attendance). It is NOT the user id.
    teamMemberId: teamMember?.id ?? null,
    isLead,
    isCoAssessor,
    isTeamMember: !!teamMember || isLead,
  };
};

/** True when a parameter is allocated to the given user, matched across both id spaces. */
export const isParameterAssignedToUser = (parameter, userId, myTeamMemberId) =>
  sameId(parameter?.assignedTeamMember?.user?.id, userId) ||
  sameId(parameter?.assignedTeamMember?.userId, userId) ||
  (myTeamMemberId !== null && myTeamMemberId !== undefined && sameId(parameter?.assignedToTeamMemberId, myTeamMemberId));

export const isServiceSector = assessmentData => assessmentData?.application?.sector === 'service';

/** Steps the given role must complete, in canonical order. */
export const getRoleRequiredSteps = isLead => (isLead ? [...CANONICAL_STEP_ORDER] : CANONICAL_STEP_ORDER.filter(step => CO_ASSESSOR_STEPS.includes(step)));

/**
 * Read a step's status from the step-progress payload.
 * Accepts either the raw step-progress response or its inner `stepProgress` map.
 */
const normalizeStatus = status =>
  String(status ?? '')
    .trim()
    .toLowerCase();
const normalizeStepKey = step =>
  String(step)
    .trim()
    .replace(/_([a-z])/g, (_, char) => char.toUpperCase());

/**
 * The step-progress endpoint reports `steps: [{ step, status }]` (the shape the
 * mobile client consumes). Older/local payloads carry a plain `{ step: status }`
 * map instead, so both are folded into one map here.
 */
const toStatusMap = stepProgress => {
  const steps = stepProgress?.steps || stepProgress?.data?.steps;
  if (Array.isArray(steps)) {
    return steps.reduce((map, entry) => {
      if (entry?.step) {
        map[entry.step] = entry.status;
      }
      return map;
    }, {});
  }
  return stepProgress?.stepProgress || stepProgress?.step_progress || stepProgress || {};
};

export const getStepStatus = (stepProgress, step) => {
  const map = toStatusMap(stepProgress);
  const rawStatus = map?.[step] ?? map?.[normalizeStepKey(step)] ?? map?.[step.replace(/([A-Z])/g, '_$1').toLowerCase()];
  return normalizeStatus(rawStatus) || STEP_STATUS.PENDING;
};

const isCompleted = status => normalizeStatus(status) === STEP_STATUS.COMPLETED || normalizeStatus(status) === 'complete';

/** The role's first not-yet-completed step, in canonical order (or null when all done). */
export const getNextIncompleteStep = (stepProgress, roleRequiredSteps) => roleRequiredSteps.find(step => !isCompleted(getStepStatus(stepProgress, step))) || null;

/**
 * A step is actionable when it belongs to the role and is either already
 * completed (editable/re-viewable) or the role's own next-incomplete step.
 * Lead-only steps interleave the co-assessor's, so gating keys off the role's
 * own next-incomplete step, not the global current step.
 */
export const isStepActionable = (stepProgress, roleRequiredSteps, step) => {
  if (!roleRequiredSteps.includes(step)) {
    return false;
  }
  if (isCompleted(getStepStatus(stepProgress, step))) {
    return true;
  }
  return getNextIncompleteStep(stepProgress, roleRequiredSteps) === step;
};

/** True when every step of the assessment is completed, for any role. */
export const areAllStepsComplete = stepProgress => !!stepProgress && CANONICAL_STEP_ORDER.every(step => isCompleted(getStepStatus(stepProgress, step)));

/** True when every step the role owns is completed. */
export const areRoleStepsComplete = (stepProgress, roleRequiredSteps) => roleRequiredSteps.every(step => isCompleted(getStepStatus(stepProgress, step)));

/**
 * True once the current member has submitted their own field work — the mobile
 * cutover (mobileCompletedAt) or, for a co-assessor, the web submit
 * (webSubmittedAt). Mirrors the mobile app, where completing field work ends
 * editing and punch-in for that member. Keys off the per-member stamp, not the
 * whole-assessment status, which only advances once every member is done — so a
 * member who submits first is locked immediately instead of staying editable
 * until teammates finish.
 */
export const isMemberExecutionLocked = (assessmentData, userId) => {
  const { teamMember } = resolveTeamRole(assessmentData, userId);
  return !!(teamMember?.mobileCompletedAt || teamMember?.webSubmittedAt);
};
