import { Logger } from '../../utils/logger';
import Api from '../api';
import { idFromServer, newId } from '../database/ids';
import {
  ensureAssessmentRow,
  getAssessmentByServerId,
  setAssessmentStatus
} from '../database/repositories/assessmentsRepo';
import {
  getMeetingByType,
  insertMeetingComment,
  insertMeetingParticipant,
  markMeetingSynced,
  upsertMeeting
} from '../database/repositories/meetingsRepo';
import { enqueue } from '../database/repositories/outboxRepo';
import { flushOutbox } from './flushOutbox';
import { isPersistedPhotoPath, persistPhoto, resolvePhotoPath } from './photoStorage';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Offline-first opening / closing meeting submission. Persists the
 * group photo + comment + locally-added participants, queues the server
 * submission, then hands it to the drain, the only uploader. type ∈
 * {'opening','closing'}.
 */
export const recordMeeting = async ({
  serverAssessmentId,
  type,
  teamMemberId,
  imageUri,
  latitude,
  longitude,
  comment,
  participants = [],
  recordingLinks
}) => {
  if (!serverAssessmentId) {
    throw new Error('recordMeeting: missing serverAssessmentId');
  }
  if (!['opening', 'closing'].includes(type)) {
    throw new Error(`recordMeeting: unknown type ${type}`);
  }

  const localAssessmentId = idFromServer(serverAssessmentId);
  const meetingLocalId = newId();
  const conductedAt = new Date().toISOString();

  // The meeting row FKs to assessments(id); make sure the parent exists
  // even if the assessment was never downloaded / mirrored yet.
  await ensureAssessmentRow(serverAssessmentId);

  // Saving the opening meeting for the first time is what starts the assessment.
  // Mirror the server's scheduled -> in_progress transition locally so the
  // remaining steps unlock immediately, before this op even syncs.
  if (type === 'opening') {
    const existing = await getAssessmentByServerId(serverAssessmentId);
    const STARTED = ['in_progress', 'mobile_complete', 'completed'];
    if (!existing?.status || !STARTED.includes(existing.status)) {
      await setAssessmentStatus(localAssessmentId, 'in_progress');
    }
  }

  // Already persisted at capture (capturePipeline) → reuse as-is.
  let imagePath = null;
  if (imageUri) {
    imagePath = isPersistedPhotoPath(imageUri)
      ? imageUri
      : await persistPhoto({
          uri: imageUri,
          assessmentId: localAssessmentId,
          bucket: `meeting_${type}`,
          name: `${type}_${meetingLocalId}.jpg`
        });
  }
  // A meeting photo was captured but couldn't be persisted (empty/missing
  // source) — queuing it uploads a doomed file that wedges the outbox. Fail
  // loudly so the meeting flow asks for a retake.
  if (imageUri && !imagePath) {
    Logger.error(
      `[meeting:${type}] image persist failed (empty/missing source) source=${imageUri}`
    );
    throw new Error('Could not save the meeting photo — the image was empty. Please retake it.');
  }

  // upsertMeeting honours the (assessment_id, type) UNIQUE index so a
  // re-submit of the same meeting updates in place.
  const persistedMeetingId = await upsertMeeting({
    id: meetingLocalId,
    assessmentId: localAssessmentId,
    type,
    imagePath,
    latitude,
    longitude,
    conductedAt,
    recordingLinks
  });

  if (comment) {
    await insertMeetingComment({
      meetingId: persistedMeetingId,
      teamMemberId,
      comment
    });
  }
  for (const p of participants) {
    // The server requires both name and designation; persist only what will
    // actually upload so a half-filled participant isn't shown as saved
    // locally and then silently dropped on sync.
    if (!p?.name || !p?.designation) {
      continue;
    }
    await insertMeetingParticipant({
      meetingId: persistedMeetingId,
      name: p.name,
      designation: p.designation || null
    });
  }

  const opKey = `meeting:${type}:${localAssessmentId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: `meeting:${type}`,
    opKey,
    payload: {
      meetingLocalId: persistedMeetingId,
      serverAssessmentId,
      type,
      imagePath,
      latitude,
      longitude,
      conductedAt,
      comment,
      participants,
      recordingLinks
    }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, `meeting:${type}`);
  return { localId: persistedMeetingId, synced };
};

/**
 * The backend splits meeting submission across THREE endpoints:
 *   1. POST /meetings/{type}            image + location + conducted_at
 *   2. POST /meetings/{type}/comments   the assessor's comment (upsert)
 *   3. POST /meetings/{type}/participants  per externally-added participant
 *
 * This helper runs all three sequentially for the sync engine handler, the
 * one place the meeting upload lives.
 */
export const submitMeetingFully = async ({
  serverAssessmentId,
  type,
  imagePath,
  latitude,
  longitude,
  conductedAt,
  comment,
  participants = [],
  recordingLinks,
  persistedMeetingId
}) => {
  // A prior attempt may have completed step 1 and failed on 2 or 3 — the
  // outbox row then retries the WHOLE op. Re-running the create would at
  // best re-upload the photo and at worst trip a server-side conflict and
  // strand the op as terminal. Resume from step 2 only when the local row is
  // both synced AND carries a server id: a re-recorded meeting keeps its old
  // server_id but upsertMeeting flips local_status back to 'pending', and
  // that fresh capture must go through step 1 again.
  let alreadyCreated = false;
  try {
    const localRow = await getMeetingByType(idFromServer(serverAssessmentId), type);
    alreadyCreated = localRow?.server_id != null && localRow?.local_status === 'synced';
  } catch (lookupError) {
    Logger.warn(`[offline] meeting:${type} synced-state lookup failed:`, lookupError?.message);
  }

  if (!alreadyCreated) {
    // Step 1 — meeting itself
    const meetingFormData = new FormData();
    if (imagePath) {
      meetingFormData.append('image', {
        uri: resolvePhotoPath(imagePath),
        type: 'image/jpeg',
        name: `${type}_${Date.now()}.jpg`
      });
    }
    if (latitude != null) {
      meetingFormData.append('latitude', String(latitude));
    }
    if (longitude != null) {
      meetingFormData.append('longitude', String(longitude));
    }
    if (conductedAt) {
      meetingFormData.append('conductedAt', conductedAt);
    }
    // Recording links live on the closing meeting only. Sent camelCase and
    // repeated per link — the API's request middleware rejects snake_case keys
    // and maps recordingLinks[] -> recording_links[]. `undefined` (an image-only
    // save that never carried links) is omitted entirely, so the server keeps
    // its existing links. An explicit array is authoritative: a non-empty set is
    // sent as-is; an EMPTY set (the lead cleared all links) is sent as a single
    // empty sentinel — multipart can't express an empty array, and the backend
    // filters empties to [], so this persists the cleared state instead of
    // silently keeping the old links.
    if (type === 'closing' && Array.isArray(recordingLinks)) {
      const links = recordingLinks
        .map((link) => String(link ?? '').trim())
        .filter((link) => link.length > 0);
      if (links.length > 0) {
        for (const link of links) {
          meetingFormData.append('recordingLinks[]', link);
        }
      } else {
        meetingFormData.append('recordingLinks[]', '');
      }
    }

    const meetingApiCall =
      type === 'opening' ? Api.MeetingApi.createMeeting : Api.MeetingApi.closingMeeting;
    const meetingResponse = await meetingApiCall({
      assessmentId: serverAssessmentId,
      formData: meetingFormData
    });
    const serverMeetingId =
      meetingResponse?.data?.meeting?.id || meetingResponse?.data?.id || meetingResponse?.id;
    if (persistedMeetingId) {
      await markMeetingSynced(persistedMeetingId, serverMeetingId);
    }
  }

  // Step 2 — assessor's comment (any non-empty value). POST upserts the
  // comment (create or update), so it is safe for both first submission and
  // outbox replay — the same addComment path the standalone comment handler uses.
  if (comment && comment.trim().length >= 1) {
    await Api.MeetingApi.addComment({
      assessmentId: serverAssessmentId,
      type,
      data: { comment: comment.trim() }
    });
  }

  // Step 3 — externally-added participants
  for (const p of participants) {
    if (!p?.name || !p?.designation) {
      continue;
    }
    await Api.MeetingApi.addExternalParticipant({
      assessmentId: serverAssessmentId,
      type,
      data: { name: p.name, designation: p.designation }
    });
  }
};
