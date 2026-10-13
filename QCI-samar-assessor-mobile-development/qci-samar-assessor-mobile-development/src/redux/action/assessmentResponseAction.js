import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../services/api';
import { idFromServer } from '../../services/database/ids';
import { listParametersForAssessment } from '../../services/database/repositories/parametersRepo';
import {
  listEvidenceForResponse,
  listResponses
} from '../../services/database/repositories/responsesRepo';
import { mirrorResponseParameters } from '../../services/offline/downloadAssessment';
import { isPunchedInLocally } from '../../services/offline/readGate';
import { recordResponse, recordResponseEvidence } from '../../services/offline/recordResponse';
import { recordResponseEvidenceDelete } from '../../services/offline/recordResponseEvidenceDelete';
import { attachSyncStateByOpKey } from '../../services/offline/syncStateBadge';
import { Logger } from '../../utils/logger';
import { resolveTeamRole } from '../../utils/teamRole';

// Offline shape MUST match the online GET responses payload the screens read:
// { parameters: [{ id, questions: [{ ...question, response: {selectedOption,
// assessorRemarks} | null }] }] }. We rebuild it from the locally-mirrored
// parameters (each payload carries its questions) joined to the local responses
// table. Returning the old {responses} shape left assessmentResponses.parameters
// undefined offline, so every question showed 0/answered.
// `assessor` ({ id, name, role }) is the current user, used as the author for
// this device's own responses (captured offline, no author mirrored yet). For
// responses pulled down from the server the authoring assessor is persisted on
// the row (assessor_user_id/name/role) and read back here, so a co-assessor's
// remark is attributed to them and not to the viewing lead. Without an author
// the comments UI showed an empty author (and crashed on `name.split`).
const hydrateResponsesFromLocal = async (assessmentId, assessor) => {
  const localAssessmentId = idFromServer(assessmentId);
  const paramRows = await listParametersForAssessment(localAssessmentId);
  if (paramRows.length === 0) {
    return null;
  }

  const responseRows = await listResponses(localAssessmentId);
  const responseByQuestion = {};
  for (const r of responseRows) {
    responseByQuestion[r.question_id] = r;
  }

  const parameters = paramRows
    .map((row) => row.payload)
    .filter(Boolean)
    .map((p) => ({
      // Spread the payload so parameter fields (name, etc.) survive — rebuilding
      // only { id, questions } dropped the name the comments UI renders.
      ...p,
      questions: (p.questions || []).map((q) => {
        const localQuestionId = idFromServer(`${assessmentId}-q-${q.id}`);
        const r = responseByQuestion[localQuestionId];
        // Prefer the author mirrored from the server (present on rows pulled down
        // for offline viewing); fall back to the current user for this device's
        // own captures and pre-migration rows, which carry no author.
        const responseAssessor =
          r?.assessor_user_id != null
            ? { id: r.assessor_user_id, name: r.assessor_name, role: r.assessor_role }
            : assessor;
        // A response counts if it carries an option OR a remark. The answer
        // screen lets an assessor leave a remark without selecting an option, and
        // the server returns those as a non-null response. Gating on option alone
        // dropped remark-only responses offline, so a co-assessor's comment with
        // no option vanished from the comments view (present online).
        const hasResponse =
          r && (r.option_id != null || (r.remarks != null && String(r.remarks).trim() !== ''));
        return {
          ...q,
          response: hasResponse
            ? {
                selectedOption: r.option_id ?? null,
                assessorRemarks: r.remarks,
                assessor: responseAssessor
              }
            : null
        };
      })
    }));

  return { parameters, source: 'local' };
};

// Builds the current-user assessor stamp for locally-recorded responses, in the
// same { name, role } shape the online responses API emits.
const currentUserAssessor = (getState) => {
  const state = getState();
  const user = state?.account?.userData?.user;
  if (!user) {
    return null;
  }
  const assessment = state?.assessment?.assessmentData?.assessment;
  const { isLead } = resolveTeamRole(assessment, user.id);

  // Name: prefer the profile cache, but fall back to the assessment roster so the
  // author isn't blank offline when the profile cache is cold. The mirrored
  // roster carries the full name flat as `name`; leadAssessor carries `{ name }`.
  let name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (!name && assessment) {
    const member = (Array.isArray(assessment.teamMembers) ? assessment.teamMembers : []).find(
      (m) => Number(m?.userId ?? m?.user?.id) === Number(user.id)
    );
    name = (isLead ? assessment.leadAssessor?.name : member?.name) || member?.name || '';
  }

  // Role is a per-assessment team role (lead vs co). The user object only carries
  // a `roles` array of app-level slugs, never a singular `user.role` — relying on
  // it always read undefined and defaulted everyone to co_assessor. Derive from
  // the team via resolveTeamRole instead.
  return {
    id: user.id,
    name,
    role: isLead ? 'lead_assessor' : 'co_assessor'
  };
};

// Offline fallback for a single question's evidence list. Online returns
// { evidences: [...] }; we mirror that from the local response_evidence rows,
// surfacing the durable local file path as the image uri so captured evidence
// is visible with no connectivity.
const hydrateEvidencesFromLocal = async (assessmentId, questionServerId) => {
  if (!assessmentId || !questionServerId) {
    return null;
  }
  const responseLocalId = idFromServer(`${assessmentId}-r-${questionServerId}`);
  const rows = await listEvidenceForResponse(responseLocalId);
  const evidences = rows.map((e) => ({
    id: e.server_id || e.id,
    fileUrl: e.file_path,
    uri: e.file_path,
    latitude: e.latitude,
    longitude: e.longitude,
    capturedAt: e.captured_at,
    description: e.description,
    sourceSiteTourPictureId: e.source_site_tour_picture_id,
    questionId: questionServerId,
    isSynced: e.local_status === 'synced'
  }));
  // Per-image badge state, same mechanism as site pictures. Unsynced rows carry
  // no server_id, so `id` is the local id the outbox op_key is built from; synced
  // rows short-circuit to 'synced'. Remote evidence carries no isSynced/op_key
  // and reads as 'synced'.
  return {
    evidences: await attachSyncStateByOpKey(evidences, (e) => `responseEvidence:${e.id}`)
  };
};

// The server neither persists nor returns the site-tour linkage
// (sourceSiteTourPictureId), so a remote evidence list arrives without it. The
// offline mirror recorded that link at capture time, so restore it by joining
// remote evidences to local rows on server id. Without this, reopening the site
// tour picker online can't recognise already-attached pictures — they show
// unselected and get miscounted against the per-question image cap, letting the
// count climb past the limit.
const backfillSiteTourLinkFromLocal = async (assessmentId, questionServerId, data) => {
  const evidences = data?.evidences;
  if (!assessmentId || !questionServerId || !Array.isArray(evidences) || evidences.length === 0) {
    return data;
  }
  try {
    const responseLocalId = idFromServer(`${assessmentId}-r-${questionServerId}`);
    const rows = await listEvidenceForResponse(responseLocalId);
    const linkByServerId = new Map();
    for (const row of rows) {
      if (row.server_id != null && row.source_site_tour_picture_id != null) {
        linkByServerId.set(String(row.server_id), row.source_site_tour_picture_id);
      }
    }
    if (linkByServerId.size === 0) {
      return data;
    }
    return {
      ...data,
      evidences: evidences.map((ev) =>
        ev.sourceSiteTourPictureId == null && linkByServerId.has(String(ev.id))
          ? { ...ev, sourceSiteTourPictureId: linkByServerId.get(String(ev.id)) }
          : ev
      )
    };
  } catch (error) {
    Logger.warn('Could not backfill site-tour link from local evidence:', error);
    return data;
  }
};

const getAssessmentResponsesAction = createAsyncThunk(
  'AssessmentResponse/GetAssessmentResponses',
  async (arg, { rejectWithValue, getState }) => {
    // Accept either a bare assessmentId or { assessmentId, forceRemote }.
    const assessmentId = arg?.assessmentId ?? arg;
    const forceRemote = arg?.forceRemote === true;
    const assessor = currentUserAssessor(getState);
    // SQLite-only inside the punch-in window — no server attempt at all. But the
    // local mirror holds only THIS device's responses, each stamped with the
    // current user as author. The team-wide "View All Comments" needs every
    // assessor's remarks, which only the server has, so it forces a remote fetch.
    if (!forceRemote && (await isPunchedInLocally(assessmentId))) {
      const local = await hydrateResponsesFromLocal(assessmentId, assessor);
      if (local) {
        return local;
      }
    }
    try {
      const response = await Api.AssessmentResponseApi.getAssessmentResponses(assessmentId);
      // Backfill the offline mirror from this fresh read so a later offline view
      // (e.g. team-wide comments) holds every assessor's latest responses, not
      // just this device's. Fire-and-forget — never delays the live data.
      mirrorResponseParameters(
        assessmentId,
        idFromServer(assessmentId),
        response?.data?.parameters || []
      ).catch((mirrorErr) => Logger.warn('Responses mirror backfill failed:', mirrorErr?.message));
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to local responses');
      const local = await hydrateResponsesFromLocal(assessmentId, assessor);
      if (local) {
        return local;
      }
      return rejectWithValue(error.response?.data || 'Failed to get assessment responses');
    }
  }
);

const getAssessmentResponseByIdAction = createAsyncThunk(
  'AssessmentResponse/GetAssessmentResponseById',
  async (val, { rejectWithValue }) => {
    try {
      Logger.info(
        'Fetching assessment response ID:',
        val.responseId,
        'for assessment ID:',
        val.assessmentId
      );
      const response = await Api.AssessmentResponseApi.getAssessmentResponseById(val);
      Logger.info('Assessment response retrieved successfully');
      return response.data;
    } catch (error) {
      Logger.error('Failed to get assessment response by ID:', error);
      return rejectWithValue(error.response?.data || 'Failed to get assessment response by ID');
    }
  }
);

const AddAssessmentResponse = createAsyncThunk(
  'AssessmentResponse/AddAssessmentResponse',
  async (val, { rejectWithValue }) => {
    // Offline-first: persists the response locally + outbox and hands it to the drain.
    try {
      const result = await recordResponse({
        serverAssessmentId: val.assessmentId,
        questionServerId: val.questionId,
        optionId: val?.data?.optionId,
        remarks: val?.data?.remarks,
        latitude: val?.data?.latitude,
        longitude: val?.data?.longitude
      });
      return result;
    } catch (error) {
      Logger.error('Failed to record assessment response:', error);
      return rejectWithValue(error?.message || 'Failed to add assessment response');
    }
  }
);

const getResponseEvidencesAction = createAsyncThunk(
  'AssessmentResponse/GetResponseEvidences',
  async (val, { rejectWithValue }) => {
    // SQLite-only inside the punch-in window — no server attempt at all.
    if (await isPunchedInLocally(val.assessmentId)) {
      const local = await hydrateEvidencesFromLocal(val.assessmentId, val.questionId);
      if (local) {
        return local;
      }
    }
    try {
      Logger.info(
        'Fetching response evidences for response ID:',
        val.responseId,
        'in assessment ID:',
        val.assessmentId
      );
      const response = await Api.AssessmentResponseApi.getResponseEvidences(val);
      Logger.info('Response evidences retrieved successfully');
      return await backfillSiteTourLinkFromLocal(val.assessmentId, val.questionId, response.data);
    } catch (error) {
      Logger.warn('Remote evidences fetch failed, falling back to local evidence');
      const local = await hydrateEvidencesFromLocal(val.assessmentId, val.questionId);
      if (local) {
        return local;
      }
      return rejectWithValue(error.response?.data || 'Failed to get response evidences');
    }
  }
);

const addResponseEvidenceAction = createAsyncThunk(
  'AssessmentResponse/AddResponseEvidence',
  async (val, { rejectWithValue }) => {
    // Offline-first: persists the evidence locally + outbox and hands it to the drain.
    try {
      const result = await recordResponseEvidence({
        serverAssessmentId: val.assessmentId,
        questionServerId: val.questionId,
        uri: val.uri,
        latitude: val.latitude,
        longitude: val.longitude,
        capturedAt: val.capturedAt,
        description: val.description,
        sourceSiteTourPictureId: val.sourceSiteTourPictureId
      });
      return result;
    } catch (error) {
      Logger.error('Failed to record response evidence:', error);
      return rejectWithValue(error?.message || 'Failed to add response evidence');
    }
  }
);

const deleteResponseEvidenceAction = createAsyncThunk(
  'AssessmentResponse/DeleteResponseEvidence',
  async (val, { rejectWithValue }) => {
    // Offline-first: removes locally + queues the server delete (or cancels the
    // queued create for an unsynced capture) and hands it to the drain.
    try {
      const result = await recordResponseEvidenceDelete({
        serverAssessmentId: val.assessmentId,
        questionServerId: val.questionId,
        evidenceId: val.evidenceId
      });
      return { ...result, evidenceId: val.evidenceId };
    } catch (error) {
      Logger.error('Failed to delete response evidence:', error);
      return rejectWithValue(error?.message || 'Failed to delete response evidence');
    }
  }
);

export {
  AddAssessmentResponse,
  addResponseEvidenceAction,
  deleteResponseEvidenceAction,
  getAssessmentResponseByIdAction,
  getAssessmentResponsesAction,
  getResponseEvidencesAction
};
