import { Logger } from '../../../utils/logger';
import { deletePhotoFile } from '../../offline/photoStorage';
import { executeSql } from '../sqlUtils';

const isMissingTable = error => /no such table/i.test(error?.message || '');

const rowsFrom = result => {
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
};

/**
 * Upsert one cached picture keyed by (assessment_id, kind, server_picture_id).
 * A re-fetch of the same server picture refreshes its metadata + local_path in
 * place instead of duplicating the row.
 */
export const upsertCachedPicture = async ({
  assessmentId,
  kind,
  serverPictureId,
  title,
  latitude,
  longitude,
  capturedAt,
  localPath,
  downloadUrl,
}) => {
  await executeSql(
    `INSERT INTO site_picture_cache
       (assessment_id, kind, server_picture_id, title, latitude, longitude, captured_at, local_path, download_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(assessment_id, kind, server_picture_id) DO UPDATE SET
       title = excluded.title,
       latitude = excluded.latitude,
       longitude = excluded.longitude,
       captured_at = excluded.captured_at,
       local_path = excluded.local_path,
       download_url = excluded.download_url,
       updated_at = CURRENT_TIMESTAMP`,
    [
      String(assessmentId),
      kind,
      String(serverPictureId),
      title ?? null,
      latitude != null ? String(latitude) : null,
      longitude != null ? String(longitude) : null,
      capturedAt ?? null,
      localPath ?? null,
      downloadUrl ?? null,
    ],
  );
};

/**
 * All cached rows for an assessment + kind, oldest first. Returns [] when the
 * table hasn't been created yet (fresh install before migration).
 */
export const listCachedPictures = async (assessmentId, kind) => {
  let result;
  try {
    result = await executeSql(
      `SELECT * FROM site_picture_cache
       WHERE assessment_id = ? AND kind = ?
       ORDER BY id ASC`,
      [String(assessmentId), kind],
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return [];
    }
    throw error;
  }
  return rowsFrom(result);
};

/**
 * Remove one cached picture (row + its local file). Called when a picture is
 * deleted so it can never resurface from cache offline.
 */
export const removeCachedPicture = async (assessmentId, kind, serverPictureId) => {
  let result;
  try {
    result = await executeSql(
      `SELECT local_path FROM site_picture_cache
       WHERE assessment_id = ? AND kind = ? AND server_picture_id = ?`,
      [String(assessmentId), kind, String(serverPictureId)],
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return;
    }
    throw error;
  }

  const paths = rowsFrom(result).map(row => row.local_path);
  await executeSql(
    `DELETE FROM site_picture_cache
     WHERE assessment_id = ? AND kind = ? AND server_picture_id = ?`,
    [String(assessmentId), kind, String(serverPictureId)],
  );
  for (const path of paths) {
    await deletePhotoFile(path);
  }
};

/**
 * Drop cached rows whose server_picture_id isn't in the current server set —
 * handles pictures deleted server-side (or by another device) so a stale local
 * copy doesn't linger. Deletes the orphaned local files too.
 */
export const reconcileCache = async (assessmentId, kind, keepServerIds = []) => {
  let result;
  try {
    result = await executeSql(
      `SELECT server_picture_id, local_path FROM site_picture_cache
       WHERE assessment_id = ? AND kind = ?`,
      [String(assessmentId), kind],
    );
  } catch (error) {
    if (isMissingTable(error)) {
      return;
    }
    throw error;
  }

  const keep = new Set(keepServerIds.filter(id => id != null).map(id => String(id)));
  const stale = rowsFrom(result).filter(row => !keep.has(String(row.server_picture_id)));
  for (const row of stale) {
    await executeSql(
      `DELETE FROM site_picture_cache
       WHERE assessment_id = ? AND kind = ? AND server_picture_id = ?`,
      [String(assessmentId), kind, String(row.server_picture_id)],
    );
    await deletePhotoFile(row.local_path);
  }
  if (stale.length > 0) {
    Logger.info(
      `[picture-cache] reconciled ${kind} assessment=${assessmentId}: removed ${stale.length} stale row(s)`,
    );
  }
};

export default {
  upsertCachedPicture,
  listCachedPictures,
  removeCachedPicture,
  reconcileCache,
};
