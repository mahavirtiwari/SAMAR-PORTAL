import { idFromServer } from '../database/ids';
import { dequeueByOpKey, enqueue } from '../database/repositories/outboxRepo';
import {
  findSiteTourPictureByServerOrLocalId,
  hardDeleteSiteTourPicture,
  softDeleteSiteTourPicture
} from '../database/repositories/sitePicturesRepo';
import { flushOutbox } from './flushOutbox';
import { deletePhotoFile } from './photoStorage';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Deletes a site-tour picture offline-first. Mirrors recordSitePictureDelete:
 * unsynced captures are removed outright (with their queued create cancelled),
 * synced rows are soft-deleted + queued for a server delete handed to the drain.
 */
export const recordSiteTourPictureDelete = async ({ serverAssessmentId, pictureId }) => {
  if (!serverAssessmentId) {
    throw new Error('recordSiteTourPictureDelete: missing serverAssessmentId');
  }
  if (!pictureId) {
    throw new Error('recordSiteTourPictureDelete: missing pictureId');
  }

  const localAssessmentId = idFromServer(serverAssessmentId);
  const row = await findSiteTourPictureByServerOrLocalId(pictureId);

  if (row && !(row.local_status === 'synced' && row.server_id)) {
    await dequeueByOpKey(`siteTourPicture:${row.id}`);
    await deletePhotoFile(row.file_path);
    await hardDeleteSiteTourPicture(row.id);
    return { deleted: true, synced: false, queued: false };
  }

  const serverId = row?.server_id ?? pictureId;
  if (row) {
    await softDeleteSiteTourPicture(row.id);
  }

  const opKey = `siteTourPictureDelete:${serverId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'siteTourPictureDelete',
    opKey,
    payload: { serverAssessmentId, pictureId: serverId, localId: row?.id ?? null }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'siteTourPictureDelete');
  return { deleted: true, synced, queued: true };
};
