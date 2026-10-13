import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../services/api';
import { idFromServer } from '../../services/database/ids';
import { getAssessmentByServerId } from '../../services/database/repositories/assessmentsRepo';
import {
  applyLocalAllocations,
  listParametersForAssessment,
  updateParameterAllocationsFromServer
} from '../../services/database/repositories/parametersRepo';
import { isPunchedInLocally } from '../../services/offline/readGate';
import { checkInternetConnection } from '../../utils/checkInternetConnection';
import { Logger } from '../../utils/logger';
import { normalizeTeamMembers } from '../../utils/teamRole';

// Pre-flight download stored the full parameters response under
// payload_json on each parameters row. Reading them back is a 1:1
// passthrough — the original API shape is preserved verbatim.
const hydrateParametersFromLocal = async (assessmentId) => {
  const rows = await listParametersForAssessment(idFromServer(assessmentId));
  if (rows.length === 0) {
    return null;
  }
  const all = rows.map((r) => r.payload).filter(Boolean);
  const mandatory = all.filter((p) => p.isMandatory);
  const optional = all.filter((p) => !p.isMandatory);

  // teamMembers isn't stored on parameter rows — the online parameters
  // response carries it at the top level, and the same list also rides on the
  // mirrored assessment payload (assessmentData.assessment.teamMembers). Pull
  // it from there so the allocation/assignment screens render assessors
  // offline instead of an empty list. The mirrored payload stores members flat
  // ({ id, userId, name, role }) — normalize into the parameters-API shape
  // ({ id, role, user: { firstName, lastName } }) the screens render, else
  // names show blank offline.
  let teamMembers = [];
  let allocationLocked = false;
  try {
    const assessment = await getAssessmentByServerId(assessmentId);
    teamMembers = normalizeTeamMembers(
      assessment?.payload?.teamMembers || assessment?.payload?.team_members || []
    );
    allocationLocked =
      assessment?.payload?.allocationLocked === true ||
      assessment?.payload?.allocation_locked === true;
  } catch (error) {
    Logger.warn('Local teamMembers lookup failed:', error?.message);
  }

  return {
    teamMembers,
    allocationLocked,
    mandatoryParameters: mandatory,
    optionalParameters: optional,
    summary: {
      total: all.length,
      mandatoryCount: mandatory.length,
      optionalCount: optional.length,
      assignedCount: all.filter((p) => p.assignedToTeamMemberId || p.assignedTeamMember).length
    },
    source: 'local'
  };
};

// Offline shape for "my assignments" MUST match the online GET my-assignments
// payload the response-step screen reads: { parameters: [...], count }. The old
// fallback reused hydrateParametersFromLocal (which returns mandatory/optional),
// so myAssessments.parameters was undefined offline and the screen showed
// "No Parameters Assigned". Here we return the parameters assigned to the
// current user (each payload already carries its questions).
const hydrateMyAssignmentsFromLocal = async (serverAssessmentId, getState) => {
  const localAssessmentId = idFromServer(serverAssessmentId);
  const rows = await listParametersForAssessment(localAssessmentId);
  if (rows.length === 0) {
    return null;
  }

  // Return only the current user's assigned parameters (matching the online
  // my-assignments endpoint). Ownership is matched by the assignee's USER id,
  // carried on each parameter as assignedTeamMember.user.id (server downloads
  // eager-load it; offline allocations write it via applyLocalAllocations).
  // When the user id is missing, fall back to matching the membership id
  // against the current user's own team-member row — and EXCLUDE the
  // parameter when neither resolves. The old behaviour treated "assignee
  // unknown" as "mine", which exposed every assessor's parameters to everyone
  // after an offline allocation. With no current user, return every assigned
  // param (caller has no identity to scope by).
  const userId = getState()?.account?.userData?.user?.id;
  let myTeamMemberId = null;
  if (userId != null) {
    try {
      const assessment = await getAssessmentByServerId(serverAssessmentId);
      const members = assessment?.payload?.teamMembers || assessment?.payload?.team_members || [];
      const me = members.find(
        (m) => String(m?.userId ?? m?.user_id ?? m?.user?.id) === String(userId)
      );
      myTeamMemberId = me?.id ?? null;
    } catch (error) {
      Logger.warn('Local team member lookup failed:', error?.message);
    }
  }
  const all = rows
    .map((r) => r.payload)
    .filter(Boolean)
    .map((p) => ({ ...p, assessmentId: serverAssessmentId }));
  const parameters =
    userId != null
      ? all.filter((p) => {
          if (p.assignedToTeamMemberId == null) {
            return false;
          }
          const assigneeUserId = p?.assignedTeamMember?.user?.id;
          if (assigneeUserId != null) {
            return String(assigneeUserId) === String(userId);
          }
          return (
            myTeamMemberId != null && String(p.assignedToTeamMemberId) === String(myTeamMemberId)
          );
        })
      : all.filter((p) => p.assignedToTeamMemberId != null);

  return { parameters, count: parameters.length, source: 'local' };
};

const getAssessmentParametersAction = createAsyncThunk(
  'AssessmentParameter/GetAssessmentParameters',
  async (assessmentId, { rejectWithValue }) => {
    // We used to serve SQLite ONLY inside the punch-in window and never re-fetch,
    // so an allocation the lead made AFTER a co-assessor punched in never reached
    // their device — leaving them with no assigned parameters. Allocations are
    // lead-authored and online-only (the server is authoritative), so refresh
    // from the server whenever there is a connection; serve the local snapshot
    // straight away only when offline, to avoid a network wait during fieldwork.
    if (!(await checkInternetConnection()) && (await isPunchedInLocally(assessmentId))) {
      const local = await hydrateParametersFromLocal(assessmentId);
      if (local) {
        return local;
      }
    }
    try {
      const response = await Api.AssessmentParameterApi.getAssessmentParameters(assessmentId);
      // Write the fresh allocations through to the offline mirror. The
      // parameters table is otherwise only refreshed by a full re-download,
      // so an allocation made after the initial download never reached the
      // offline fallback and the co-assessor's punch-in stayed blocked
      // offline. Update-only, so a never-downloaded assessment isn't
      // half-populated. Awaited (not fire-and-forget) so the thunk resolves
      // only once the local rows carry the allocation — the step-progress
      // recompute keyed on this thunk then reads parameter_allocation as
      // complete and unlocks the site-assessment list without a manual refresh.
      try {
        const localId = idFromServer(assessmentId);
        const fresh = [
          ...(response.data?.mandatoryParameters || []),
          ...(response.data?.optionalParameters || [])
        ];
        await updateParameterAllocationsFromServer(localId, assessmentId, fresh);
      } catch (mirrorError) {
        Logger.warn('Parameter allocation mirror failed:', mirrorError?.message);
      }
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to local parameters');
      const local = await hydrateParametersFromLocal(assessmentId);
      if (local) {
        return local;
      }
      return rejectWithValue(error.response?.data || 'Failed to get assessment parameters');
    }
  }
);

const getMyAssessmentsAction = createAsyncThunk(
  'AssessmentParameter/GetMyAssessments',
  async (assessmentId, { rejectWithValue, getState }) => {
    // Refresh from the server whenever online so a late allocation (made after
    // this assessor punched in) still reaches them; serve the local snapshot
    // straight away only when offline. See getAssessmentParametersAction.
    if (!(await checkInternetConnection()) && (await isPunchedInLocally(assessmentId))) {
      const local = await hydrateMyAssignmentsFromLocal(assessmentId, getState);
      if (local) {
        return local;
      }
    }
    try {
      const response = await Api.AssessmentParameterApi.getMyAssessments(assessmentId);
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to local my-assignments');
      const local = await hydrateMyAssignmentsFromLocal(assessmentId, getState);
      if (local) {
        return local;
      }
      return rejectWithValue(error.response?.data || 'Failed to get my assessments');
    }
  }
);

const bulkAssignParametersAction = createAsyncThunk(
  'AssessmentParameter/BulkAssignParameters',
  async (val, { rejectWithValue, getState }) => {
    // Parameter allocation is ONLINE-ONLY by design. A co-assessor's device
    // can only learn about allocations through the server, so an offline
    // allocation could never unblock them — and a failed background sync
    // stranded it silently. Require connectivity, save synchronously, then
    // mirror the result onto the local parameter rows so the allocation
    // stays readable offline for the rest of the assessment.
    try {
      Logger.info('Bulk assigning parameters for assessment ID:', val.assessmentId);
      if (!(await checkInternetConnection())) {
        return rejectWithValue(
          'Parameter allocation needs an internet connection. Reconnect and try again.'
        );
      }
      // Allocation runs before the opening meeting (which is what starts the
      // assessment), so it happens while the assessment is still scheduled.
      const response = await Api.AssessmentParameterApi.bulkAssignParameters({
        assessmentId: val.assessmentId,
        data: val.data
      });
      try {
        // The roster gives applyLocalAllocations each assignee's user id —
        // without it the local rows carry only a bare team-member id and the
        // my-assignments ownership filter can't scope them per assessor.
        const state = getState();
        const teamMembers =
          state?.assessmentParameter?.assessmentParameters?.teamMembers ||
          state?.assessment?.assessmentData?.assessment?.teamMembers ||
          [];
        await applyLocalAllocations(
          idFromServer(val.assessmentId),
          val.assessmentId,
          val.data?.assignments || [],
          teamMembers
        );
      } catch (mirrorError) {
        Logger.warn('Allocation mirror to local rows failed:', mirrorError?.message);
      }
      Logger.info('Parameters allocation saved (online)');
      return { synced: true, data: response };
    } catch (error) {
      Logger.error('Failed to save parameter allocation:', error);
      return rejectWithValue(
        error?.response?.data || error?.message || 'Failed to bulk assign parameters'
      );
    }
  }
);

export { bulkAssignParametersAction, getAssessmentParametersAction, getMyAssessmentsAction };
