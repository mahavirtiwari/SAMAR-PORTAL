import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../services/api';
import { idFromServer } from '../../services/database/ids';
import {
  clearMobileTerminalFlags,
  getAssessmentByServerId,
  listMirroredAssessments,
  mirrorAssessmentListItem,
  reconcileMirrorAgainstServer,
  setSyncedServerSteps,
  upsertAssessmentFromServer
} from '../../services/database/repositories/assessmentsRepo';
import { executeSql } from '../../services/database/sqlUtils';
import { computeLocalStepProgress } from '../../services/offline/computeStepProgress';
import { downloadAssessmentForOffline } from '../../services/offline/downloadAssessment';
import { isPunchedInLocally } from '../../services/offline/readGate';
import { recordPunchIn } from '../../services/offline/recordPunchIn';
import { recordPunchOut } from '../../services/offline/recordPunchOut';
import { wipeIfRescheduled } from '../../services/offline/rescheduleWipe';
import { Logger } from '../../utils/logger';
import { showWarningToast } from '../../utils/toast';

// Server sync-down for the Home list: fetch, mirror, reconcile, then publish
// the refreshed local list. Home never waits on this first; the list action
// below serves the mirror and runs this behind it. The server intentionally
// stops returning an assessment once this assessor has cut over on mobile
// (excludeMobileCompleted), and that must not hide the local copy, so the
// published result is always the mirror when it can be scoped to the user.
const syncAssessmentsFromServerAction = createAsyncThunk(
  'Assessment/SyncAssessmentsFromServer',
  async (_, { rejectWithValue, getState }) => {
    const currentUserId = getState()?.account?.userData?.user?.id;
    let serverList;
    try {
      Logger.info('Fetching all assessments');
      const response = await Api.AssessmentApi.getAllAssessments();
      serverList = Array.isArray(response?.data) ? response.data : [];
    } catch (error) {
      Logger.warn('Remote list fetch failed, local mirror stands:', error?.message);
      return rejectWithValue(error?.message || 'Remote list fetch failed');
    }
    for (const item of serverList) {
      try {
        // An assessment the server still offers this assessor, with no
        // cutover of their own, must not stay hidden behind this device's
        // terminal markers — the list is fetched with excludeMobileCompleted,
        // so its reappearance means the cutover was cleared server-side
        // (reset / re-assign). Clear before mirroring so the same pass
        // re-renders and re-downloads it.
        if (item?.id && item?.myMobileCompletedAt == null) {
          await clearMobileTerminalFlags(idFromServer(item.id));
        }
        await mirrorAssessmentListItem(item);
      } catch (dbError) {
        Logger.warn(`List mirror failed for assessment ${item?.id}:`, dbError?.message);
      }
    }
    // Reconcile: drop mirror rows the server no longer returns for this
    // assessor (e.g. reassigned away) so they stop showing/opening on refresh
    // instead of lingering until logout. Guarded inside to keep cut-over and
    // unsynced rows.
    if (currentUserId != null) {
      try {
        await reconcileMirrorAgainstServer(
          currentUserId,
          serverList.map((a) => a?.id)
        );
      } catch (reconcileError) {
        Logger.warn('Mirror reconcile failed:', reconcileError?.message);
      }
    }
    // Without a user id the mirror can't be membership-scoped (shared-device
    // safety), so the server's JWT-scoped list is the answer.
    if (currentUserId == null) {
      return serverList;
    }
    try {
      return await listMirroredAssessments(currentUserId);
    } catch (dbError) {
      Logger.error('Local assessments list read failed after sync:', dbError?.message);
      return serverList;
    }
  }
);

const getAllAssessmentsAction = createAsyncThunk(
  'Assessment/GetAllAssessments',
  async (_, { rejectWithValue, getState, dispatch }) => {
    // The Home list ALWAYS renders from the local SQLite mirror — what's on
    // the phone is what's shown, and only the explicit Delete Data flow
    // removes a card. The mirror is served first, in every connectivity
    // state, and the server sync-down runs behind it: awaiting the server
    // here left Home empty for the whole request timeout on a network with
    // signal but no route.
    const currentUserId = getState()?.account?.userData?.user?.id;
    const syncFirst = async () => {
      const result = await dispatch(syncAssessmentsFromServerAction());
      if (syncAssessmentsFromServerAction.fulfilled.match(result)) {
        return result.payload;
      }
      return null;
    };
    if (currentUserId == null) {
      // No id to scope the mirror by, so the JWT-scoped server list is the
      // safer answer; the mirror is only the fallback when it cannot be had.
      const synced = await syncFirst();
      if (synced) {
        return synced;
      }
      try {
        return await listMirroredAssessments(currentUserId);
      } catch (dbError) {
        Logger.error('Local assessments list read failed:', dbError?.message);
        return rejectWithValue('Failed to get all assessments');
      }
    }
    let local;
    try {
      local = await listMirroredAssessments(currentUserId);
      Logger.info(`Assessments list served from local SQLite (${local.length})`);
    } catch (dbError) {
      Logger.error('Local assessments list read failed:', dbError?.message);
      const synced = await syncFirst();
      if (synced) {
        return synced;
      }
      return rejectWithValue('Failed to get all assessments');
    }
    dispatch(syncAssessmentsFromServerAction());
    return local;
  }
);

const getAssessmentByIdAction = createAsyncThunk(
  'Assessment/GetAssessmentById',
  async (assessmentId, { rejectWithValue }) => {
    // Between punch-in and punch-out the assessment is read from SQLite
    // ONLY — no server attempt at all. Outside that window: fetch from API
    // and mirror to SQLite so the next offline load has the freshest
    // snapshot, falling back to the local copy when unreachable.
    if (await isPunchedInLocally(assessmentId)) {
      try {
        const local = await getAssessmentByServerId(assessmentId);
        if (local?.payload?.id) {
          return { assessment: local.payload };
        }
      } catch (dbError) {
        Logger.warn('Punched-in local assessment read failed:', dbError?.message);
      }
      // No usable mirror (shouldn't happen once punched in) — fall through
      // to the normal path rather than dead-ending the screen.
    }
    try {
      Logger.info('Fetching assessment by ID:', assessmentId);
      const response = await Api.AssessmentApi.getAssessmentById(assessmentId);
      const remoteAssessment = response?.data?.assessment;
      let rescheduled = false;
      if (remoteAssessment?.id) {
        try {
          rescheduled = await wipeIfRescheduled(remoteAssessment);
          if (rescheduled) {
            showWarningToast(
              'Assessment rescheduled',
              'Local data has been refreshed for the new schedule.'
            );
          }
        } catch (wipeError) {
          Logger.warn('Reschedule check failed:', wipeError?.message);
        }
        upsertAssessmentFromServer(remoteAssessment).catch((dbError) =>
          Logger.warn('Local mirror of assessment failed:', dbError?.message)
        );
      }
      Logger.info('Assessment retrieved successfully (remote)');
      // rescheduled drives the detail screen back to Home (assessmentSlice →
      // AssessmentStepsList) so the assessor never works off a stale schedule.
      return { ...response.data, rescheduled };
    } catch (error) {
      Logger.warn('Remote fetch failed, attempting local copy:', error?.message);
      try {
        const local = await getAssessmentByServerId(assessmentId);
        // Ignore a bare stub (payload '{}') left by ensureAssessmentRow for
        // an offline capture — only a fully-mirrored copy carries an id.
        if (local?.payload?.id) {
          Logger.info('Assessment served from local SQLite');
          return { assessment: local.payload };
        }
      } catch (dbError) {
        Logger.error('Local lookup also failed:', dbError?.message);
      }
      return rejectWithValue(error.response?.data || 'Failed to get assessment by ID');
    }
  }
);

const getAllAttendanceAction = createAsyncThunk(
  'Assessment/GetAllAttendance',
  async (assessmentId, { rejectWithValue }) => {
    try {
      Logger.info('Fetching all attendance for assessment ID:', assessmentId);
      const response = await Api.AssessmentApi.getAllAttendance(assessmentId);
      Logger.info('All attendance retrieved successfully');
      return response;
    } catch (error) {
      Logger.error('Failed to get all attendance:', error);
      return rejectWithValue(error.response?.data || 'Failed to get all attendance');
    }
  }
);

// Reads the current assessor's latest LOCAL punch from SQLite and returns it
// in the same flat shape as the remote /attendance/my-status response, or null
// if there's no local row. Shared by the offline fallback and the pending
// override below. The row also carries local_status so callers can tell a
// not-yet-synced punch (which the server doesn't know about) from a synced one.
const readLocalAttendanceStatus = async (assessmentId, getState) => {
  // Scope the latest punch to the current assessor so a shared device /
  // multi-member assessment doesn't surface someone else's punch as ours.
  // The id a punch was stored under depends on what was mirrored AT PUNCH TIME:
  // resolveTeamMemberId (the write side) uses me.id, then me.teamMemberId, then
  // falls back to userId for an offline punch on a not-yet-downloaded assessment.
  // This read MUST match that same set of ids — matching only me.id meant an
  // offline punch-in saved under userId was invisible here, so an older
  // punch-out (under me.id, from a previous cycle) surfaced instead and the
  // assessor wrongly read as "already punched out" after an app relaunch.
  const userId = getState()?.account?.userData?.user?.id ?? null;
  let teamMemberId = null;
  try {
    const assessment = await getAssessmentByServerId(assessmentId);
    const members = assessment?.payload?.teamMembers || [];
    const me = members.find((m) => m?.userId === userId || m?.user?.id === userId);
    teamMemberId = me?.id ?? me?.teamMemberId ?? null;
  } catch (lookupError) {
    Logger.warn('Local team member lookup failed:', lookupError?.message);
  }

  const localAssessmentId = idFromServer(assessmentId);
  // Match every id the current assessor's punch could have been stored under
  // (team-member id and userId), then take the single newest row. This keeps a
  // co-assessor's punch from reading as ours while guaranteeing our own latest
  // punch — saved under any id variant — is the one returned.
  const candidateIds = [...new Set([teamMemberId, userId].filter((v) => v != null))];
  let result = { rows: { length: 0 } };
  if (candidateIds.length > 0) {
    const placeholders = candidateIds.map(() => '?').join(', ');
    result = await executeSql(
      `SELECT type, recorded_at, latitude, longitude, local_status, selfie_path FROM attendance
       WHERE assessment_id = ?
         AND team_member_id IN (${placeholders})
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [localAssessmentId, ...candidateIds]
    );
  }
  // No id resolved, or none matched (e.g. the assessment team isn't mirrored and
  // the punch was stored under a different value) — fall back to the most recent
  // punch for this assessment so a valid local punch is never missed. Safe
  // because the attendance table only ever holds THIS device's own punches
  // (server attendance is never mirrored into it).
  if (result.rows.length === 0) {
    result = await executeSql(
      `SELECT type, recorded_at, latitude, longitude, local_status, selfie_path FROM attendance
       WHERE assessment_id = ?
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [localAssessmentId]
    );
  }
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows.item(0);
  return {
    isPunchedIn: row.type === 'punch_in',
    isPending: row.local_status === 'pending',
    lastAttendance: {
      type: row.type,
      recordedAt: row.recorded_at,
      latitude: row.latitude,
      longitude: row.longitude,
      // The locally captured selfie (a durable file:// path). Surfaced so the
      // avatar renders offline, where the server selfieUrl can't be fetched.
      selfiePath: row.selfie_path
    },
    source: 'local'
  };
};

const getAttendanceStatusAction = createAsyncThunk(
  'Assessment/GetAttendanceStatus',
  async (assessmentId, { rejectWithValue, getState }) => {
    // Read the local record FIRST so a transient SQLite error never silently
    // hands the answer to a stale server response (the old in-line pending
    // check did exactly that and flipped the UI back to "Punch-In").
    let local = null;
    try {
      local = await readLocalAttendanceStatus(assessmentId, getState);
    } catch (localError) {
      Logger.warn('Local attendance read failed:', localError?.message);
    }
    // While punched in, the device's own record IS the answer — no server
    // read in the on-site window.
    if (local?.isPunchedIn) {
      return local;
    }
    try {
      const response = await Api.AssessmentApi.getAttendanceStatus(assessmentId);
      // Newest record wins. A punch still waiting in the outbox is by
      // definition newer than anything the server knows; otherwise compare
      // capture timestamps — a local punch the server hasn't reflected yet
      // (sync raced, replay failed) must not be shadowed by the older
      // server state, while a fully-synced device just gets the server's
      // answer because both sides agree.
      if (local?.isPending) {
        return local;
      }
      const localAt = Date.parse(local?.lastAttendance?.recordedAt ?? '');
      const remoteAt = Date.parse(response?.lastAttendance?.recordedAt ?? '');
      if (!Number.isNaN(localAt) && (Number.isNaN(remoteAt) || localAt > remoteAt)) {
        return local;
      }
      // Carry the locally captured selfie path alongside the server response so
      // the avatar always has a durable file:// source — the server selfieUrl
      // can't load offline, and this status may be cached from when we were
      // online. The UI prefers selfiePath (always present) over selfieUrl.
      if (response?.lastAttendance && local?.lastAttendance?.selfiePath) {
        response.lastAttendance.selfiePath = local.lastAttendance.selfiePath;
      }
      return response;
    } catch (error) {
      // Offline / server unreachable: the local record IS the truth. Shape
      // mirrors the remote response (flat) so consumers work identically.
      if (local) {
        return local;
      }
      return rejectWithValue(error.response?.data || 'Failed to get attendance status');
    }
  }
);

const punchInAction = createAsyncThunk(
  'Assessment/PunchIn',
  async (val, { rejectWithValue, getState }) => {
    // Offline-first: writes the attendance row + outbox entry locally first,
    // then hands the row to the drain. Offline or on failure the local writes
    // stand and the drain retries later. The caller's success path runs the
    // same way either case.
    try {
      Logger.info('Punching in for assessment:', val?.assessmentId);
      const result = await recordPunchIn({
        serverAssessmentId: val.assessmentId,
        teamMemberId: val.teamMemberId,
        userId: val.userId ?? getState()?.account?.userData?.user?.id,
        selfieUri: val.selfieUri,
        latitude: val.latitude,
        longitude: val.longitude,
        deviceMetadata: val.deviceMetadata
      });
      Logger.info(`Punch-in recorded (synced=${result.synced})`);
      return result;
    } catch (error) {
      Logger.error('Failed to record punch-in locally:', error);
      return rejectWithValue(error?.message || 'Failed to punch in');
    }
  }
);

const punchOutAction = createAsyncThunk(
  'Assessment/PunchOut',
  async (val, { rejectWithValue, getState }) => {
    // Offline-first: mirrors punchInAction. Persists locally and queues; the
    // outbox drain uploads.
    try {
      Logger.info('Punching out for assessment:', val?.assessmentId);
      const result = await recordPunchOut({
        serverAssessmentId: val.assessmentId,
        teamMemberId: val.teamMemberId,
        userId: val.userId ?? getState()?.account?.userData?.user?.id,
        selfieUri: val.selfieUri,
        latitude: val.latitude,
        longitude: val.longitude,
        deviceMetadata: val.deviceMetadata,
        knownPunchedIn: getState()?.assessment?.attendanceStatus?.isPunchedIn === true
      });
      return result;
    } catch (error) {
      Logger.error('Failed to record punch-out locally:', error);
      return rejectWithValue(error?.message || 'Failed to punch out');
    }
  }
);

const getStepProgressAction = createAsyncThunk(
  'Assessment/GetStepProgress',
  async (assessmentId, { rejectWithValue, getState }) => {
    // Step progress is always computed from local data so the assessment flow
    // works fully offline. When the network is reachable, we first mirror the
    // server's viewer-scoped step statuses (team-global steps another assessor
    // may own — e.g. the lead's opening meeting, which gates the co-assessor's
    // site tour and only ever arrives via the server — plus this assessor's
    // own steps whose synced artifacts no longer exist locally, e.g. after the
    // logout wipe) into local storage; the local computation then folds those
    // in, upgrade-only. The server is a sync target only — never a gate:
    // offline (including while punched in) the fetch rejects fast and the
    // local computation proceeds unchanged.
    // A SLOW online fetch (its request starved behind the large
    // getAssessmentById/getParameters bundles that fire on the same open —
    // routine on the heavier manufacturing assessments) neither rejects nor
    // resolves, so awaiting it blocked the offline-first local computation and
    // left the step list stuck disabled until a manual pull-to-refresh. Bound
    // the sync so the local compute always runs within a short window; a slow
    // sync just lands on the next recompute.
    const tStart = Date.now();
    let syncTimer;
    const syncFetch = Api.AssessmentApi.getStepProgress(assessmentId);
    // Swallow a late rejection if the timeout wins the race below, so the loser
    // never surfaces as an unhandled promise rejection.
    syncFetch.catch(() => undefined);
    try {
      const response = await Promise.race([
        syncFetch,
        new Promise((_, reject) => {
          syncTimer = setTimeout(() => reject(new Error('step-progress sync timed out')), 3000);
        })
      ]);
      clearTimeout(syncTimer);
      const remoteSteps = response?.data?.steps;
      if (Array.isArray(remoteSteps)) {
        const statusByStep = {};
        remoteSteps.forEach((s) => {
          if (s?.step) {
            statusByStep[s.step] = s.status;
          }
        });
        await setSyncedServerSteps(idFromServer(assessmentId), statusByStep);
      }
    } catch (error) {
      clearTimeout(syncTimer);
      if (error?.isOffline) {
        Logger.info('Step status sync skipped: offline');
      } else {
        Logger.warn(
          'Step status sync skipped:',
          error?.response?.status ?? 'no response',
          error?.message
        );
      }
    }
    const tSync = Date.now();

    try {
      const currentUserId = getState()?.account?.userData?.user?.id;
      const result = await computeLocalStepProgress(assessmentId, currentUserId);
      const tCompute = Date.now();
      return { ...result, _timings: { syncMs: tSync - tStart, computeMs: tCompute - tSync } };
    } catch (dbError) {
      Logger.error('Local step progress computation failed:', dbError?.message);
      return rejectWithValue('Failed to get step progress');
    }
  }
);

const getDashboardDataAction = createAsyncThunk(
  'Assessment/GetDashboardData',
  async (_, { rejectWithValue }) => {
    try {
      const response = await Api.AssessmentApi.getDashboardData();
      Logger.info('Dashboard data retrieved successfully');
      return response.data;
    } catch (error) {
      Logger.error('Failed to get dashboard data:', error);
      return rejectWithValue(error.response?.data || 'Failed to get dashboard data');
    }
  }
);

// Dedup concurrent downloads of the SAME assessment: Home auto-downloads on
// focus and the detail screen ensures its own download on open, so both can
// fire for one id at once. Without this they'd run two wholesale
// parameter/question replaces against the single shared SQLite handle. Callers
// share the in-flight promise instead.
const inFlightDownloads = new Map();

const downloadAssessmentForOfflineAction = createAsyncThunk(
  'Assessment/DownloadForOffline',
  async (assessmentId, { rejectWithValue }) => {
    try {
      let promise = inFlightDownloads.get(assessmentId);
      if (!promise) {
        promise = downloadAssessmentForOffline(assessmentId);
        inFlightDownloads.set(assessmentId, promise);
        promise.finally(() => inFlightDownloads.delete(assessmentId));
      }
      const localId = await promise;
      return { localId, assessmentId };
    } catch (error) {
      Logger.error('Failed to download assessment for offline:', error);
      return rejectWithValue(error?.message || 'Failed to download assessment for offline');
    }
  }
);

export {
  downloadAssessmentForOfflineAction,
  getAllAssessmentsAction,
  getAllAttendanceAction,
  getAssessmentByIdAction,
  getAttendanceStatusAction,
  getDashboardDataAction,
  getStepProgressAction,
  punchInAction,
  punchOutAction,
  syncAssessmentsFromServerAction
};
