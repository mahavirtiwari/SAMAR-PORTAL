import { idFromServer } from '../database/ids';
import { getSyncedServerSteps } from '../database/repositories/assessmentsRepo';
import { executeSql } from '../database/sqlUtils';

/**
 * Offline equivalent of the server's GET /step-progress. Every assessment
 * step writes its artifact to a local table (parameters, site_pictures,
 * meetings, responses, basic_information), so the same {currentStep,
 * completionPercentage, steps[]} summary the UI gates navigation on can be
 * derived locally when the API is unreachable.
 *
 * Most steps are intentionally lenient — "the assessor captured the step's
 * artifact" — rather than re-implementing every server validation rule. The
 * bias is to UNBLOCK: a completed step is always navigable and currentStep
 * advances to the next gap, which is exactly what drives the steps list.
 * assessment_parameters is the exception: it mirrors the server's per-member
 * "every assigned question answered" rule, so the step never shows complete
 * before the assessor has actually answered their parameters' questions.
 * When the device is back online the server's authoritative progress takes
 * over again (this only runs in getStepProgressAction's catch path).
 *
 * Canonical step order matches the requiredSteps list the submit flow and
 * the steps list render against.
 */
const STEP_ORDER = [
  'parameter_allocation',
  'site_pictures',
  'opening_meeting',
  'site_tour',
  'basic_information',
  'assessment_parameters',
  'closing_meeting'
];

const countRows = async (sql, params) => {
  const result = await executeSql(sql, params);
  return result.rows.item(0)?.count ?? 0;
};

/**
 * Mirror of the server's per-member assessment_parameters check
 * (Assessment::isAssessmentParametersCompleteForMember). The step is complete
 * only when the parameters assigned to THIS assessor each have every question
 * answered with a selected option. No assigned parameters — or assigned
 * parameters carrying no questions — means the step has not started, so it must
 * not report as completed.
 *
 * Ownership is matched by the assignee's USER id, carried on each downloaded
 * parameter as assignedTeamMember.user.id. (The assessment payload's
 * team_members don't expose a membership id, so the assignedToTeamMemberId on
 * the parameter can't be mapped back to the current user — matching by user id
 * is the reliable path.) A parameter assigned offline may lack that user id; we
 * count it rather than block, and when there's no current user we fall back to
 * every assigned parameter.
 */
const isAssessmentParametersComplete = async (localId, serverAssessmentId, currentUserId) => {
  const paramRows = await executeSql(
    `SELECT id, payload_json FROM parameters WHERE assessment_id = ?`,
    [localId]
  );
  const assignedParamIds = [];
  for (let i = 0; i < paramRows.rows.length; i++) {
    const row = paramRows.rows.item(i);
    let payload;
    try {
      payload = JSON.parse(row.payload_json || '{}');
    } catch {
      continue;
    }
    if (payload?.assignedToTeamMemberId == null) {
      continue; // unassigned
    }
    const assigneeUserId = payload?.assignedTeamMember?.user?.id;
    if (currentUserId != null && assigneeUserId != null) {
      if (String(assigneeUserId) === String(currentUserId)) {
        assignedParamIds.push(row.id);
      }
    } else {
      // No current user, or this param was allocated offline without an
      // assignee user id — count it rather than block the step.
      assignedParamIds.push(row.id);
    }
  }

  if (assignedParamIds.length === 0) {
    return false;
  }

  const placeholders = assignedParamIds.map(() => '?').join(',');
  const totalQuestions = await countRows(
    `SELECT COUNT(*) AS count FROM questions WHERE parameter_id IN (${placeholders})`,
    assignedParamIds
  );
  if (totalQuestions === 0) {
    return false;
  }

  const answeredQuestions = await countRows(
    `SELECT COUNT(DISTINCT q.id) AS count FROM questions q
     JOIN responses r ON r.question_id = q.id
     WHERE q.parameter_id IN (${placeholders}) AND r.option_id IS NOT NULL`,
    assignedParamIds
  );

  return answeredQuestions >= totalQuestions;
};

export const computeLocalStepProgress = async (serverAssessmentId, currentUserId) => {
  const localId = idFromServer(serverAssessmentId);

  // Sequential, not Promise.all: the whole app shares one SQLite connection
  // (services/database/connection.js), and concurrent executeSql calls on a
  // single handle can sporadically interleave or throw "database is locked".
  // Every other repo here awaits one query at a time — match that.
  const allocatedCount = await countRows(
    `SELECT COUNT(*) AS count FROM parameters
     WHERE assessment_id = ? AND allocated_to_user_id IS NOT NULL`,
    [localId]
  );
  // Scoped to THIS assessor, mirroring the server's isSitePicturesCompleteForMember,
  // which lets a member submit only when they have pictures of their own. Once an
  // assessment is seeded for offline viewing this table holds the whole team's pictures,
  // so an unscoped count ticked the step for a co-assessor who had captured none and
  // submission then refused them. A null owner is this device's own capture, or a row
  // written before the owner was recorded, and counts as mine. With no current user we
  // count everything rather than block the step. [BUG-08929]
  const sitePictureCount = await countRows(
    currentUserId != null
      ? `SELECT COUNT(*) AS count FROM site_pictures
         WHERE assessment_id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)`
      : `SELECT COUNT(*) AS count FROM site_pictures WHERE assessment_id = ?`,
    currentUserId != null ? [localId, currentUserId] : [localId]
  );
  const openingMeetingCount = await countRows(
    `SELECT COUNT(*) AS count FROM meetings
     WHERE assessment_id = ? AND type = 'opening' AND image_path IS NOT NULL`,
    [localId]
  );
  // Same scoping, same reason. A local capture records no owner, so null is this
  // device's own. [BUG-08929]
  const siteTourCount = await countRows(
    currentUserId != null
      ? `SELECT COUNT(*) AS count FROM site_tour_pictures
         WHERE assessment_id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)`
      : `SELECT COUNT(*) AS count FROM site_tour_pictures WHERE assessment_id = ?`,
    currentUserId != null ? [localId, currentUserId] : [localId]
  );
  const basicInfoCount = await countRows(
    `SELECT COUNT(*) AS count FROM basic_information WHERE assessment_id = ?`,
    [localId]
  );
  const assessmentParametersComplete = await isAssessmentParametersComplete(
    localId,
    serverAssessmentId,
    currentUserId
  );
  const closingMeetingCount = await countRows(
    `SELECT COUNT(*) AS count FROM meetings
     WHERE assessment_id = ? AND type = 'closing' AND image_path IS NOT NULL`,
    [localId]
  );

  // Parameter allocation also counts when the downloaded payload already
  // carries an assignment (assignedToTeamMemberId) — the lead may have
  // allocated before the co-assessor went offline, which the bundle mirrors
  // onto each parameter row's payload rather than the allocated_to_user_id
  // column.
  let assignedFromPayload = 0;
  if (allocatedCount === 0) {
    const result = await executeSql(`SELECT payload_json FROM parameters WHERE assessment_id = ?`, [
      localId
    ]);
    for (let i = 0; i < result.rows.length; i++) {
      try {
        const payload = JSON.parse(result.rows.item(i).payload_json || '{}');
        if (payload?.assignedToTeamMemberId != null) {
          assignedFromPayload += 1;
          break;
        }
      } catch {
        // ignore an unparseable row
      }
    }
  }

  const completedByStep = {
    parameter_allocation: allocatedCount > 0 || assignedFromPayload > 0,
    site_pictures: sitePictureCount > 0,
    opening_meeting: openingMeetingCount > 0,
    site_tour: siteTourCount > 0,
    basic_information: basicInfoCount > 0,
    assessment_parameters: assessmentParametersComplete,
    closing_meeting: closingMeetingCount > 0
  };

  // A step's artifact may exist only on the server: captured by another
  // assessor (team-global steps like the lead's opening meeting), or captured
  // on this device, synced, and later wiped (logout clears all local data).
  // Fold in the statuses last synced from the server — they are viewer-scoped
  // (the step-progress endpoint reports site_pictures, site_tour and
  // assessment_parameters for the requesting assessor only, never another
  // member's), and the fold only ever upgrades pending -> completed, so a
  // fresh local capture always wins.
  const syncedSteps = await getSyncedServerSteps(localId);
  STEP_ORDER.forEach((step) => {
    if (!completedByStep[step] && syncedSteps[step] === 'completed') {
      completedByStep[step] = true;
    }
  });

  const steps = STEP_ORDER.map((step) => ({
    step,
    status: completedByStep[step] ? 'completed' : 'pending'
  }));
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const currentStep = STEP_ORDER.find((step) => !completedByStep[step]) ?? null;

  return {
    data: {
      currentStep,
      completionPercentage: Math.round((completedCount / STEP_ORDER.length) * 100),
      steps
    },
    source: 'local'
  };
};
