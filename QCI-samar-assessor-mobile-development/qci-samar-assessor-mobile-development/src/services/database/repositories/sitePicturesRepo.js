import { executeSql } from '../sqlUtils';

export const insertSitePicture = async ({
  id,
  assessmentId,
  type,
  filePath,
  thumbPath,
  latitude,
  longitude,
  capturedAt
}) => {
  await executeSql(
    `INSERT INTO site_pictures (id, assessment_id, type, file_path, thumb_path, latitude, longitude, captured_at, local_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      assessmentId,
      type,
      filePath,
      thumbPath ?? null,
      latitude ?? null,
      longitude ?? null,
      capturedAt ?? null
    ]
  );
};

export const markSitePictureSynced = async (localId, serverId) => {
  await executeSql(`UPDATE site_pictures SET local_status = 'synced', server_id = ? WHERE id = ?`, [
    serverId ?? null,
    localId
  ]);
};

// Matches a row by either its server id (synced rows) or local id (offline
// captures not yet synced), so a delete works regardless of sync state.
export const findSitePictureByServerOrLocalId = async (id) => {
  const result = await executeSql(
    `SELECT * FROM site_pictures WHERE server_id = ? OR id = ? LIMIT 1`,
    [id, id]
  );
  return result.rows.length ? result.rows.item(0) : null;
};

// Soft-delete hides a synced row from the local list immediately while its
// server-side delete is queued; hard-delete removes the row outright (used for
// unsynced rows and after the queued delete confirms on the server).
export const softDeleteSitePicture = async (localId) => {
  await executeSql(`UPDATE site_pictures SET local_status = 'deleted' WHERE id = ?`, [localId]);
};

export const hardDeleteSitePicture = async (localId) => {
  await executeSql(`DELETE FROM site_pictures WHERE id = ?`, [localId]);
};

export const insertSiteTourPicture = async ({
  id,
  assessmentId,
  ownerUserId,
  title,
  filePath,
  thumbPath,
  latitude,
  longitude,
  capturedAt
}) => {
  await executeSql(
    `INSERT INTO site_tour_pictures (id, assessment_id, owner_user_id, title, file_path, thumb_path, latitude, longitude, captured_at, local_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      assessmentId,
      ownerUserId ?? null,
      title ?? null,
      filePath,
      thumbPath ?? null,
      latitude ?? null,
      longitude ?? null,
      capturedAt ?? null
    ]
  );
};

export const markSiteTourPictureSynced = async (localId, serverId) => {
  await executeSql(
    `UPDATE site_tour_pictures SET local_status = 'synced', server_id = ? WHERE id = ?`,
    [serverId ?? null, localId]
  );
};

export const findSiteTourPictureByServerOrLocalId = async (id) => {
  const result = await executeSql(
    `SELECT * FROM site_tour_pictures WHERE server_id = ? OR id = ? LIMIT 1`,
    [id, id]
  );
  return result.rows.length ? result.rows.item(0) : null;
};

export const softDeleteSiteTourPicture = async (localId) => {
  await executeSql(`UPDATE site_tour_pictures SET local_status = 'deleted' WHERE id = ?`, [
    localId
  ]);
};

export const hardDeleteSiteTourPicture = async (localId) => {
  await executeSql(`DELETE FROM site_tour_pictures WHERE id = ?`, [localId]);
};

const collect = (result) => {
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
};

// ownerUserId scopes the read to one assessor's own pictures — the offline
// mirror of the server's /mine endpoint. The table holds the whole team's
// pictures once seeded for offline viewing ([BUG-08929]), so an unscoped read
// would show a co-assessor the lead's pictures too. owner_user_id IS NULL is
// treated as "mine": a row this device captured before ownership was stamped.
// Omit ownerUserId (the pool view) to return every picture unscoped.
export const listSitePictures = async (assessmentLocalId, ownerUserId) => {
  const scoped = ownerUserId != null;
  const result = await executeSql(
    `SELECT * FROM site_pictures
     WHERE assessment_id = ? AND local_status != 'deleted'
     ${scoped ? 'AND (owner_user_id = ? OR owner_user_id IS NULL)' : ''}
     ORDER BY captured_at DESC`,
    scoped ? [assessmentLocalId, ownerUserId] : [assessmentLocalId]
  );
  return collect(result);
};

// ownerUserId scopes to one assessor's own pictures — the offline mirror of the
// server's /mine. Same rationale as listSitePictures: the seeded table holds the
// whole team's site-tour pictures, so an unscoped read leaks a co-assessor the
// lead's. owner_user_id IS NULL = "mine" (captured before ownership was stamped).
export const listSiteTourPictures = async (assessmentLocalId, ownerUserId) => {
  const scoped = ownerUserId != null;
  const result = await executeSql(
    `SELECT * FROM site_tour_pictures
     WHERE assessment_id = ? AND local_status != 'deleted'
     ${scoped ? 'AND (owner_user_id = ? OR owner_user_id IS NULL)' : ''}
     ORDER BY captured_at DESC`,
    scoped ? [assessmentLocalId, ownerUserId] : [assessmentLocalId]
  );
  return collect(result);
};

// A row marked 'synced' but with no server_id is a broken orphan: its upload
// completed locally yet the server id was never captured, so the seed's
// server_id match misses it and inserts a second row — a visible duplicate.
// Clearing these right before a reseed is safe: any orphan that truly reached
// the server is in the /mine list and gets re-inserted with a proper server_id,
// and requeueUnconfirmedSiteMedia has already had its chance to recover a
// re-uploadable one (which then has a server_id and is not matched here). Only
// 'synced' rows are touched — pending/failed captures are never removed.
export const deleteSyncedOrphanSitePictures = async (assessmentLocalId) => {
  await executeSql(
    `DELETE FROM site_pictures
     WHERE assessment_id = ? AND local_status = 'synced' AND (server_id IS NULL OR server_id = '')`,
    [assessmentLocalId]
  );
};

export const deleteSyncedOrphanSiteTourPictures = async (assessmentLocalId) => {
  await executeSql(
    `DELETE FROM site_tour_pictures
     WHERE assessment_id = ? AND local_status = 'synced' AND (server_id IS NULL OR server_id = '')`,
    [assessmentLocalId]
  );
};

// Seed a server-synced site picture into the local table during offline
// download, pointing file_path at the image file downloaded to the device — so
// the offline read returns it and the thumbnail renders without a network. Keyed
// on server_id and idempotent: a re-download just refreshes the local file_path.
// ownerUserId is the USER id of the assessor whose picture this is. It is what makes the
// step tick agree with the server, which lets a member submit only on their own pictures:
// this table holds the whole team's pictures once an assessment has been seeded for
// offline viewing. Null means the row was written by this device before that was
// recorded, and the step count reads null as "mine". [BUG-08929]
export const upsertSyncedSitePicture = async ({
  serverId,
  assessmentId,
  type,
  filePath,
  latitude,
  longitude,
  capturedAt,
  ownerUserId
}) => {
  const existing = await executeSql(`SELECT id FROM site_pictures WHERE server_id = ? LIMIT 1`, [
    serverId
  ]);
  if (existing.rows.length > 0) {
    // Re-seeding an existing row also backfills the owner, so a device that downloaded
    // the assessment before this shipped gets it on the next open rather than keeping a
    // null that counts as its own.
    await executeSql(
      `UPDATE site_pictures SET file_path = ?, local_status = 'synced', owner_user_id = ? WHERE server_id = ?`,
      [filePath, ownerUserId ?? null, serverId]
    );
    return;
  }
  await executeSql(
    `INSERT INTO site_pictures (id, assessment_id, server_id, type, file_path, latitude, longitude, captured_at, local_status, owner_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
    [
      `srvpic-${serverId}`,
      assessmentId,
      serverId,
      type ?? null,
      filePath,
      latitude ?? null,
      longitude ?? null,
      capturedAt ?? null,
      ownerUserId ?? null
    ]
  );
};

export const upsertSyncedSiteTourPicture = async ({
  serverId,
  assessmentId,
  ownerUserId,
  title,
  filePath,
  latitude,
  longitude,
  capturedAt
}) => {
  const existing = await executeSql(
    `SELECT id FROM site_tour_pictures WHERE server_id = ? LIMIT 1`,
    [serverId]
  );
  if (existing.rows.length > 0) {
    // Backfills the owner too, so a device that seeded this assessment before the owner
    // was recorded is corrected on its next open rather than keeping a null that the
    // step count would read as its own. Matches upsertSyncedSitePicture. [BUG-08929]
    await executeSql(
      `UPDATE site_tour_pictures SET file_path = ?, local_status = 'synced', owner_user_id = ? WHERE server_id = ?`,
      [filePath, ownerUserId ?? null, serverId]
    );
    return;
  }
  await executeSql(
    `INSERT INTO site_tour_pictures (id, assessment_id, server_id, owner_user_id, title, file_path, latitude, longitude, captured_at, local_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
    [
      `srvtour-${serverId}`,
      assessmentId,
      serverId,
      ownerUserId ?? null,
      title ?? null,
      filePath,
      latitude ?? null,
      longitude ?? null,
      capturedAt ?? null
    ]
  );
};
