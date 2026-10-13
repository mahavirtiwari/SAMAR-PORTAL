import { Logger } from '../../utils/logger';
import { idFromServer, newId } from '../database/ids';
import { ensureAssessmentRow } from '../database/repositories/assessmentsRepo';
import { enqueue } from '../database/repositories/outboxRepo';
import { ensureQuestionRow } from '../database/repositories/questionsRepo';
import { insertResponseEvidence, upsertResponse } from '../database/repositories/responsesRepo';
import { flushOutbox } from './flushOutbox';
import { copyIntoDurable, persistedBucketOf, persistPhoto } from './photoStorage';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Offline-first parameter response submission. The local row uses a
 * stable id derived from the question — a re-submit of the same
 * question updates the row in place and re-queues the outbox.
 *
 * Evidence photos are queued as separate outbox rows so they can
 * upload independently of the response itself.
 */
export const recordResponse = async ({
  serverAssessmentId,
  questionServerId,
  optionId,
  remarks,
  latitude,
  longitude
}) => {
  if (!serverAssessmentId) {
    throw new Error('recordResponse: missing serverAssessmentId');
  }
  if (!questionServerId) {
    throw new Error('recordResponse: missing questionServerId');
  }

  const localAssessmentId = idFromServer(serverAssessmentId);
  const responseLocalId = idFromServer(`${serverAssessmentId}-r-${questionServerId}`);
  const questionLocalId = idFromServer(`${serverAssessmentId}-q-${questionServerId}`);
  const capturedAt = new Date().toISOString();

  // The response row FKs to BOTH assessments(id) and questions(id). The
  // answer screen is fed by the live server read, so the local questions
  // table may be empty here — make sure both parents exist before insert.
  // Order matters: questions.assessment_id FKs to assessments(id).
  await ensureAssessmentRow(serverAssessmentId);
  await ensureQuestionRow(serverAssessmentId, questionServerId);

  await upsertResponse({
    id: responseLocalId,
    assessmentId: localAssessmentId,
    questionId: questionLocalId,
    optionId,
    remarks,
    latitude,
    longitude,
    capturedAt
  });

  const opKey = `response:${responseLocalId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'response',
    opKey,
    payload: {
      responseLocalId,
      serverAssessmentId,
      questionServerId,
      optionId,
      remarks,
      latitude,
      longitude,
      capturedAt
    }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'response');
  return { localId: responseLocalId, synced };
};

/**
 * Adds an evidence photo to an existing locally-persisted response.
 */
export const recordResponseEvidence = async ({
  serverAssessmentId,
  questionServerId,
  uri,
  latitude,
  longitude,
  capturedAt,
  description,
  sourceSiteTourPictureId
}) => {
  const localAssessmentId = idFromServer(serverAssessmentId);
  const responseLocalId = idFromServer(`${serverAssessmentId}-r-${questionServerId}`);
  const evidenceId = newId();
  // Site-tour picks carry the photo's original capture time; a fresh camera
  // capture has none, so fall back to now().
  const capturedAtIso = capturedAt ?? new Date().toISOString();

  // Evidence is already persisted durably at capture time, so when the uri
  // points at that file just reuse it — re-persisting here re-runs the
  // compressor on an already-compressed image, which is what made Save slow).
  // A persisted file from ANY other bucket (a pick of a still-local site-tour
  // photo) must be COPIED, never shared: the delete paths unlink a row's file
  // outright, so a shared file lets deleting one evidence destroy the tour
  // photo and every other evidence picked from it. Decided by the file's real
  // bucket, not by caller flags. A pick of an already-uploaded tour photo
  // arrives as a freshly downloaded temp file and takes the normal persist path.
  const evidenceName = `evidence_${evidenceId}.jpg`;
  const sourceBucket = persistedBucketOf(uri);
  let filePath;
  if (sourceBucket === 'evidence') {
    filePath = uri;
  } else if (sourceBucket) {
    filePath = await copyIntoDurable({
      uri,
      assessmentId: localAssessmentId,
      bucket: 'evidence',
      name: evidenceName
    });
  } else {
    filePath = await persistPhoto({
      uri,
      assessmentId: localAssessmentId,
      bucket: 'evidence',
      name: evidenceName
    });
  }
  // persistPhoto returns null when the source produced a 0-byte file (e.g. the
  // camera temp file was evicted before this delayed save). Queuing it anyway
  // uploads an empty file the server rejects with 422 (application/x-empty),
  // wedging the outbox. Fail loudly so the capture flow can ask for a retake.
  if (!filePath) {
    Logger.error(
      `[evidence] persist failed (empty/missing source) evidence=${evidenceId} source=${uri}`
    );
    throw new Error('Could not save the evidence photo — the image was empty. Please retake it.');
  }
  Logger.info(`[evidence] persisted evidence=${evidenceId} -> ${filePath}`);

  await insertResponseEvidence({
    id: evidenceId,
    responseId: responseLocalId,
    filePath,
    latitude,
    longitude,
    capturedAt: capturedAtIso,
    description,
    sourceSiteTourPictureId
  });

  const opKey = `responseEvidence:${evidenceId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'responseEvidence',
    opKey,
    payload: {
      evidenceId,
      serverAssessmentId,
      questionServerId,
      filePath,
      latitude,
      longitude,
      capturedAt: capturedAtIso,
      description,
      sourceSiteTourPictureId
    }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'responseEvidence');
  return { localId: evidenceId, synced };
};
