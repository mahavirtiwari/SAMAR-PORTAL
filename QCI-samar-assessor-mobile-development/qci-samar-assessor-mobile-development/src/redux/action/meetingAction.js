import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../services/api';
import { idFromServer } from '../../services/database/ids';
import { getAssessmentByServerId } from '../../services/database/repositories/assessmentsRepo';
import {
  getMeetingByType,
  listMeetingComments,
  listMeetingParticipants
} from '../../services/database/repositories/meetingsRepo';
import { isPunchedInLocally } from '../../services/offline/readGate';
import { recordMeeting } from '../../services/offline/recordMeeting';
import {
  recordCommentUpsert,
  recordParticipantAdd,
  recordParticipantDelete
} from '../../services/offline/recordMeetingEdit';
import { deriveSyncState } from '../../services/offline/syncStateBadge';
import { Logger } from '../../utils/logger';
import { resolveTeamRole } from '../../utils/teamRole';

// The author of any locally-stored meeting comment is the current user — other
// assessors' comments live on their own devices. Build the same { id, name,
// firstName, lastName, role } stamp the online comments carry on
// comment.teamMember.user / .role, so the offline comment renders a name and the
// correct Lead/Co label instead of a blank author defaulting to "Co-Assessor".
// Role is the per-assessment team role; the user object only carries a `roles`
// array of app slugs, never a singular `role`, so derive it via resolveTeamRole.
const currentUserAuthor = (getState) => {
  const state = getState();
  const user = state?.account?.userData?.user;
  if (!user) {
    return null;
  }
  const assessment = state?.assessment?.assessmentData?.assessment;
  const { isLead } = resolveTeamRole(assessment, user.id);
  return {
    id: user.id,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: isLead ? 'lead_assessor' : 'co_assessor'
  };
};

// Combine the server's comment list (all team members) with this device's own
// locally-stored comment, which may be newer/unsynced. Dedupe by author user
// id, preferring the local copy for the current user so an unsynced edit isn't
// hidden behind a stale server copy.
const mergeOwnIntoRemoteComments = (remoteComments, localComments, currentUserId) => {
  const ownLocal = (localComments || []).find((c) => c?.teamMember?.user?.id === currentUserId);
  if (!ownLocal) {
    return remoteComments;
  }
  const remoteHasOwn = remoteComments.some((c) => c?.teamMember?.user?.id === currentUserId);
  if (!remoteHasOwn) {
    return [...remoteComments, ownLocal];
  }
  return remoteComments.map((c) => (c?.teamMember?.user?.id === currentUserId ? ownLocal : c));
};

const hydrateMeetingFromLocal = async (assessmentId, type, { userId, author } = {}) => {
  const localAssessmentId = idFromServer(assessmentId);

  // The assessor roster (lead + co-assessors) comes from the mirrored
  // assessment payload and is INDEPENDENT of whether a meeting photo has been
  // captured yet. Build it first and always return it, so the participant list
  // shows offline even before the first capture — exactly as the online
  // endpoint returns the team roster before any meeting exists. (Bailing out
  // when no local meeting row exists was why participants showed as 0 offline.)
  //
  // The slice's reducer reads assessors from `teamMembers` and external
  // participants from `meeting.participants` ([{id,name,designation}]), then
  // merges them into meetingDetails.teamMembers (external → canRemove:true).
  //
  // The mirrored payload stores assessors under snake_case `team_members` as
  // { user_id, name (full name), role, ... } — NOT the camelCase
  // teamMembers[].user.{firstName,lastName} shape the meeting endpoint returns
  // online and the screen renders. Map + split the full name here. (Still accept
  // a camelCase `teamMembers[].user` payload if some other path mirrors that.)
  let teamMembers = [];
  try {
    const assessment = await getAssessmentByServerId(assessmentId);
    const rawMembers = assessment?.payload?.team_members || assessment?.payload?.teamMembers || [];
    teamMembers = rawMembers.map((m) => {
      const hasUserNames = m.user?.firstName || m.user?.lastName;
      const parts = String(m.name || m.full_name || '')
        .trim()
        .split(/\s+/);
      return {
        id: m.user_id ?? m.id,
        participantId: m.user_id ?? m.id,
        user: hasUserNames
          ? m.user
          : { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') },
        role: m.role
      };
    });
  } catch (lookupError) {
    Logger.warn('Local assessment team lookup failed for meeting hydrate:', lookupError?.message);
  }

  const meeting = await getMeetingByType(localAssessmentId, type);
  if (!meeting) {
    // No meeting captured yet — still return the roster so participants render.
    return { teamMembers, meeting: null, source: 'local' };
  }
  const comments = await listMeetingComments(meeting.id);
  const participants = await listMeetingParticipants(meeting.id);

  // Per-photo badge state, same mechanism as site pictures: synced once the
  // mirror row uploaded, else pending/failed from the meeting's outbox row. The
  // online path returns a server meeting with no syncState, which the screens
  // read as 'synced'.
  const syncState = await deriveSyncState({
    isSynced: meeting.local_status === 'synced',
    opKey: `meeting:${type}:${localAssessmentId}`
  });

  return {
    teamMembers,
    meeting: {
      id: meeting.server_id || meeting.id,
      localId: meeting.id,
      type: meeting.type,
      imageUrl: meeting.image_path,
      syncState,
      latitude: meeting.latitude,
      longitude: meeting.longitude,
      conductedAt: meeting.conducted_at,
      // Stored JSON-encoded; expose the same camelCase `recordingLinks` array
      // the online endpoint returns so the screen reads one shape either way.
      recordingLinks: (() => {
        try {
          const parsed = JSON.parse(meeting.recording_links || 'null');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      isSynced: meeting.local_status === 'synced',
      // External participants — the slice turns these into removable members.
      // Omit teamMemberId/isDefault so the slice's external-participant filter
      // (p => !p.teamMemberId && !p.isDefault) keeps them.
      participants: participants.map((p) => ({
        id: p.server_id || p.id,
        name: p.name,
        designation: p.designation
      })),
      // Locally-authored comments belong to the current user; default creator +
      // teamMember.user to the signed-in user so the comment branches that read
      // meeting.creator.id / teamMember.user.id don't throw offline. Stamp the
      // author's name + team role + authored-at so the comment row renders a
      // name, the correct Lead/Co label and a date offline (online these ride on
      // comment.teamMember.user / .role / comment.createdAt).
      creator: { id: author?.id ?? userId ?? null },
      comments: comments.map((c) => ({
        id: c.server_id || c.id,
        comment: c.comment,
        createdAt: c.created_at ?? null,
        teamMember: {
          id: c.team_member_id ?? null,
          userId: author?.id ?? userId ?? null,
          role: author?.role,
          user: {
            id: author?.id ?? userId ?? null,
            firstName: author?.firstName || '',
            lastName: author?.lastName || ''
          }
        }
      }))
    },
    source: 'local'
  };
};

const getMeetingDetailsAction = createAsyncThunk(
  'Meeting/GetMeetingDetails',
  async (val, { rejectWithValue, getState }) => {
    // SQLite-only inside the punch-in window — no server attempt at all.
    if (await isPunchedInLocally(val.assessmentId)) {
      const author = currentUserAuthor(getState);
      return await hydrateMeetingFromLocal(val.assessmentId, 'opening', {
        userId: author?.id,
        author
      });
    }
    try {
      const response = await Api.MeetingApi.getMeetingDetails(val);
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to local opening meeting');
      const author = currentUserAuthor(getState);
      const local = await hydrateMeetingFromLocal(val.assessmentId, 'opening', {
        userId: author?.id,
        author
      });
      if (local) {
        return local;
      }
      return rejectWithValue(error.response?.data || 'Failed to get meeting details');
    }
  }
);

const getClosingMeetingDetailsAction = createAsyncThunk(
  'Meeting/GetClosingMeetingDetails',
  async (val, { rejectWithValue, getState }) => {
    // Inside the punch-in window the meeting itself (photo, participants, the
    // lead's own comment) is captured offline, so it's hydrated from SQLite.
    // BUT comments are cross-device data: the local mirror only holds THIS
    // device's own comment, so co-assessors' comments would be invisible to the
    // lead. Best-effort overlay the server's full comment list (all team
    // members) onto the locally-hydrated meeting, keeping the local photo /
    // participants / unsynced own comment intact. Mirrors ViewAllComments'
    // forceRemote approach for parameter remarks; silently keeps local-only
    // comments when offline.
    if (await isPunchedInLocally(val.assessmentId)) {
      const author = currentUserAuthor(getState);
      const local = await hydrateMeetingFromLocal(val.assessmentId, 'closing', {
        userId: author?.id,
        author
      });
      if (local?.meeting) {
        try {
          const remote = await Api.MeetingApi.getClosingMeetingDetails(val);
          const remoteComments = remote?.data?.meeting?.comments;
          if (Array.isArray(remoteComments)) {
            local.meeting.comments = mergeOwnIntoRemoteComments(
              remoteComments,
              local.meeting.comments,
              author?.id
            );
          }
        } catch {
          Logger.info('Closing comment overlay skipped (offline); using local-only comments');
        }
      }
      return local;
    }
    try {
      const response = await Api.MeetingApi.getClosingMeetingDetails(val);
      return response.data;
    } catch (error) {
      Logger.warn('Remote fetch failed, falling back to local closing meeting');
      const author = currentUserAuthor(getState);
      const local = await hydrateMeetingFromLocal(val.assessmentId, 'closing', {
        userId: author?.id,
        author
      });
      if (local) {
        return local;
      }
      return rejectWithValue(error.response?.data || 'Failed to get meeting details');
    }
  }
);

const createMeetingAction = createAsyncThunk(
  'Meeting/CreateMeeting',
  async (val, { rejectWithValue }) => {
    // Offline-first: persists meeting + comment + participants locally and
    // hands them to the drain.
    try {
      const result = await recordMeeting({
        serverAssessmentId: val.assessmentId,
        type: 'opening',
        teamMemberId: val.teamMemberId,
        imageUri: val.imageUri,
        latitude: val.latitude,
        longitude: val.longitude,
        comment: val.comment,
        participants: val.participants || []
      });
      return result;
    } catch (error) {
      Logger.error('Failed to record opening meeting:', error);
      return rejectWithValue(error?.message || 'Failed to create meeting');
    }
  }
);

const closingMeetingAction = createAsyncThunk(
  'Meeting/ClosingMeeting',
  async (val, { rejectWithValue }) => {
    try {
      const result = await recordMeeting({
        serverAssessmentId: val.assessmentId,
        type: 'closing',
        teamMemberId: val.teamMemberId,
        imageUri: val.imageUri,
        latitude: val.latitude,
        longitude: val.longitude,
        comment: val.comment,
        participants: val.participants || [],
        recordingLinks: val.recordingLinks
      });
      return result;
    } catch (error) {
      Logger.error('Failed to record closing meeting:', error);
      return rejectWithValue(error?.message || 'Failed to create meeting');
    }
  }
);

const addExternalParticipantAction = createAsyncThunk(
  'Meeting/AddExternalParticipant',
  async (val, { rejectWithValue }) => {
    // Offline-first: writes a local participant row + queues the add.
    try {
      const result = await recordParticipantAdd({
        serverAssessmentId: val.assessmentId,
        type: val.type,
        name: val.data?.name ?? val.name,
        designation: val.data?.designation ?? val.designation
      });
      return result;
    } catch (error) {
      Logger.error('Failed to add external participant:', error);
      return rejectWithValue(error?.message || 'Failed to add external participant');
    }
  }
);

const deleteExternalParticipantAction = createAsyncThunk(
  'Meeting/DeleteExternalParticipant',
  async (val, { rejectWithValue }) => {
    // Offline-first: soft-deletes locally + queues the server delete (or cancels
    // the queued add for an unsynced participant).
    try {
      const result = await recordParticipantDelete({
        serverAssessmentId: val.assessmentId,
        type: val.type,
        participantId: val.participantId
      });
      return { ...result, participantId: val.participantId };
    } catch (error) {
      Logger.error('Failed to delete external participant:', error);
      return rejectWithValue(error?.message || 'Failed to delete external participant');
    }
  }
);

const addOpeningCommentAction = createAsyncThunk(
  'Meeting/AddOpeningComment',
  async (val, { rejectWithValue }) => {
    // Offline-first: upserts the local comment + queues it.
    try {
      const result = await recordCommentUpsert({
        serverAssessmentId: val.assessmentId,
        type: 'opening',
        comment: val.data?.comment ?? val.comment
      });
      return result;
    } catch (error) {
      Logger.error('Failed to add comment:', error);
      return rejectWithValue(error?.message || 'Failed to add comment');
    }
  }
);

const addClosingCommentAction = createAsyncThunk(
  'Meeting/AddClosingComment',
  async (val, { rejectWithValue }) => {
    try {
      const result = await recordCommentUpsert({
        serverAssessmentId: val.assessmentId,
        type: 'closing',
        comment: val.data?.comment ?? val.comment
      });
      return result;
    } catch (error) {
      Logger.error('Failed to add comment:', error);
      return rejectWithValue(error?.message || 'Failed to add comment');
    }
  }
);

const updateCommentAction = createAsyncThunk(
  'Meeting/UpdateComment',
  async (val, { rejectWithValue }) => {
    // Offline-first: same upsert path as add (the endpoint is keyed by
    // assessment + type, so one comment per meeting).
    try {
      const result = await recordCommentUpsert({
        serverAssessmentId: val.assessmentId,
        type: val.type,
        comment: val.data?.comment ?? val.comment
      });
      return result;
    } catch (error) {
      Logger.error('Failed to update comment:', error);
      return rejectWithValue(error?.message || 'Failed to update comment');
    }
  }
);

export {
  addClosingCommentAction,
  addExternalParticipantAction,
  addOpeningCommentAction,
  closingMeetingAction,
  createMeetingAction,
  deleteExternalParticipantAction,
  getClosingMeetingDetailsAction,
  getMeetingDetailsAction,
  updateCommentAction
};
