import { Logger } from '../../utils/logger';
import { enqueue } from '../database/repositories/outboxRepo';
import { executeSql } from '../database/sqlUtils';
import { isUploadableFile } from './photoStorage';

const serverFromLocal = (localAssessmentId) => String(localAssessmentId || '').replace(/^srv-/, '');

/**
 * Recover captures that were marked 'synced' locally but never received a server
 * id — the "2xx success:false" silent-sync bug: the image file is still on the
 * device, yet the server never got it, and the row left the outbox. Reset those
 * rows to 'pending' and re-queue them so the next drain re-uploads from the
 * existing file. No re-capture needed. The server dedupes on clientUuid
 * (localId), so a row that had actually synced is a harmless no-op.
 *
 * Runs at the start of each drain; it is a no-op when nothing matches. A row
 * re-queued here becomes 'pending', so it is not selected again on the next
 * pass — no loop.
 */
export const requeueUnconfirmedSiteMedia = async () => {
  let requeued = 0;

  const rescan = async (table, opType, buildPayload) => {
    let result;
    try {
      result = await executeSql(
        `SELECT * FROM ${table}
         WHERE local_status = 'synced'
           AND (server_id IS NULL OR server_id = '')
           AND file_path IS NOT NULL`
      );
    } catch {
      // Table may not exist yet on a fresh install — nothing to recover.
      return;
    }
    for (let i = 0; i < result.rows.length; i += 1) {
      const row = result.rows.item(i);
      // The file is gone (e.g. an old premature wipe) — re-queuing it would only
      // fail the drain as "image file missing". Leave it out of the queue so it
      // doesn't churn; the photo is unrecoverable and must be re-captured.
      if (!(await isUploadableFile(row.file_path))) {
        Logger.warn(`[sync] not re-queuing ${opType} — file gone, needs re-capture: ${row.id}`);
        continue;
      }
      await executeSql(`UPDATE ${table} SET local_status = 'pending' WHERE id = ?`, [row.id]);
      await enqueue({
        assessmentId: row.assessment_id,
        opType,
        opKey: `${opType}:${row.id}`,
        payload: buildPayload(row)
      });
      requeued += 1;
    }
  };

  await rescan('site_pictures', 'sitePicture', (row) => ({
    localId: row.id,
    serverAssessmentId: serverFromLocal(row.assessment_id),
    type: row.type,
    filePath: row.file_path,
    latitude: row.latitude,
    longitude: row.longitude,
    capturedAt: row.captured_at
  }));

  await rescan('site_tour_pictures', 'siteTourPicture', (row) => ({
    localId: row.id,
    serverAssessmentId: serverFromLocal(row.assessment_id),
    title: row.title,
    filePath: row.file_path,
    latitude: row.latitude,
    longitude: row.longitude,
    capturedAt: row.captured_at
  }));

  if (requeued > 0) {
    Logger.info(`[sync] re-queued ${requeued} device-only capture(s) (synced with no server id)`);
  }
  return requeued;
};
