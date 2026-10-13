import { idFromServer } from '../database/ids';
import { dequeueByOpKey, enqueue } from '../database/repositories/outboxRepo';
import {
  findEvidenceByServerOrLocalId,
  hardDeleteEvidence,
  softDeleteEvidence
} from '../database/repositories/responsesRepo';
import { flushOutbox } from './flushOutbox';
import { deletePhotoFile } from './photoStorage';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Deletes a question's response evidence offline-first. Mirrors the picture
 * deletes: unsynced captures are removed outright (queued create cancelled),
 * synced evidence is soft-deleted + queued for a server delete handed to the drain.
 *
 * The server delete is keyed by question + evidence server ids.
 */
export const recordResponseEvidenceDelete = async ({
  serverAssessmentId,
  questionServerId,
  evidenceId
}) => {
  if (!serverAssessmentId) {
    throw new Error('recordResponseEvidenceDelete: missing serverAssessmentId');
  }
  if (!evidenceId) {
    throw new Error('recordResponseEvidenceDelete: missing evidenceId');
  }

  const localAssessmentId = idFromServer(serverAssessmentId);
  const row = await findEvidenceByServerOrLocalId(evidenceId);

  if (row && !(row.local_status === 'synced' && row.server_id)) {
    await dequeueByOpKey(`responseEvidence:${row.id}`);
    await deletePhotoFile(row.file_path);
    await hardDeleteEvidence(row.id);
    return { deleted: true, synced: false, queued: false };
  }

  const serverId = row?.server_id ?? evidenceId;
  if (row) {
    await softDeleteEvidence(row.id);
  }

  const opKey = `responseEvidenceDelete:${serverId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'responseEvidenceDelete',
    opKey,
    payload: {
      serverAssessmentId,
      questionServerId,
      evidenceId: serverId,
      localId: row?.id ?? null
    }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'responseEvidenceDelete');
  return { deleted: true, synced, queued: true };
};
