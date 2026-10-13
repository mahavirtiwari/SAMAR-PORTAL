import RNFS from 'react-native-fs';
import { checkInternetConnection } from '../../utils/checkInternetConnection';
import { Logger } from '../../utils/logger';
import {
  listCachedPictures,
  reconcileCache,
  upsertCachedPicture,
} from '../database/repositories/sitePictureCacheRepo';

// Durable cache root, separate from the capture root (imageUtils ROOT) so a
// cache cleanup can never touch a not-yet-uploaded capture.
const ROOT = `${RNFS.DocumentDirectoryPath}/applicant_cache`;

const stripScheme = uri => (uri || '').replace(/^file:\/\//, '');

const withFileScheme = path => {
  if (!path) {
    return path;
  }
  return path.startsWith('file://') ? path : `file://${path}`;
};

// Path segments derived from server ids — keep them filesystem-safe.
const idForPath = value => String(value ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');

const ensureDir = async path => {
  if (!(await RNFS.exists(path))) {
    await RNFS.mkdir(path);
  }
};

const fileExists = async path => {
  if (!path) {
    return false;
  }
  try {
    return await RNFS.exists(stripScheme(path));
  } catch {
    return false;
  }
};

/**
 * Write-through: download each server picture's protected file to durable local
 * storage and record it in site_picture_cache, so a later offline visit can
 * render it. Best-effort — a failed download skips just that picture. Skips
 * entirely when offline (there's nothing to fetch). After caching, reconciles
 * the local set against the server's current ids so server-side deletions drop
 * out of the cache too.
 */
export const cacheServerPictures = async ({ assessmentId, kind, pictures, authHeader }) => {
  if (!assessmentId || !kind || !Array.isArray(pictures)) {
    return;
  }
  if (!(await checkInternetConnection())) {
    return;
  }

  let existing = [];
  try {
    existing = await listCachedPictures(assessmentId, kind);
  } catch (error) {
    Logger.warn('[picture-cache] could not read existing cache:', error?.message || error);
  }
  const existingByServerId = new Map(existing.map(row => [String(row.server_picture_id), row]));

  const dir = `${ROOT}/${idForPath(assessmentId)}/${kind}`;
  try {
    await ensureDir(ROOT);
    await ensureDir(`${ROOT}/${idForPath(assessmentId)}`);
    await ensureDir(dir);
  } catch (error) {
    Logger.warn('[picture-cache] could not prepare cache dir:', error?.message || error);
    return;
  }

  for (const picture of pictures) {
    try {
      const serverPictureId = picture?.id;
      if (serverPictureId == null || !picture?.downloadUrl) {
        continue;
      }

      const cached = existingByServerId.get(String(serverPictureId));
      let localPath = cached?.local_path || null;

      // Re-download only when we don't already hold a real local file for this
      // server picture id — a picture's bytes are immutable, so an existing copy
      // is always current.
      const alreadyCached = localPath && (await fileExists(localPath));
      if (!alreadyCached) {
        const target = `${dir}/${idForPath(serverPictureId)}.jpg`;
        const { promise } = RNFS.downloadFile({
          fromUrl: picture.downloadUrl,
          toFile: target,
          headers: authHeader || {},
        });
        const result = await promise;
        if (result?.statusCode && result.statusCode >= 400) {
          Logger.warn(
            `[picture-cache] download failed status=${result.statusCode} id=${serverPictureId}`,
          );
          continue;
        }
        localPath = withFileScheme(target);
      }

      await upsertCachedPicture({
        assessmentId,
        kind,
        serverPictureId,
        title: picture.title,
        latitude: picture.latitude,
        longitude: picture.longitude,
        capturedAt: picture.capturedAt,
        localPath,
        downloadUrl: picture.downloadUrl,
      });
    } catch (error) {
      Logger.warn('[picture-cache] failed to cache picture:', error?.message || error);
    }
  }

  try {
    await reconcileCache(
      assessmentId,
      kind,
      pictures.map(picture => picture?.id),
    );
  } catch (error) {
    Logger.warn('[picture-cache] reconcile failed:', error?.message || error);
  }
};

/**
 * Write-through for a just-uploaded local capture: copy the captured file into
 * the cache root (so the cache owns a copy independent of capture-side cleanup)
 * and record it against its new server picture id. Called on a successful upload
 * — inline or via the drain — so an offline revisit after the upload can still
 * render it, instead of showing an empty slot because the row is already synced
 * (out of the pending overlay) but was never fetched back into the cache.
 */
export const cacheLocalCapture = async ({
  assessmentId,
  kind,
  serverPictureId,
  localUri,
  title,
  latitude,
  longitude,
  capturedAt,
  downloadUrl,
}) => {
  if (!assessmentId || !kind || serverPictureId == null || !localUri) {
    return;
  }
  const src = stripScheme(localUri);
  try {
    if (!(await RNFS.exists(src))) {
      return;
    }
    const dir = `${ROOT}/${idForPath(assessmentId)}/${kind}`;
    await ensureDir(ROOT);
    await ensureDir(`${ROOT}/${idForPath(assessmentId)}`);
    await ensureDir(dir);

    const target = `${dir}/${idForPath(serverPictureId)}.jpg`;
    if (await RNFS.exists(target)) {
      await RNFS.unlink(target);
    }
    await RNFS.copyFile(src, target);

    await upsertCachedPicture({
      assessmentId,
      kind,
      serverPictureId,
      title,
      latitude,
      longitude,
      capturedAt,
      localPath: withFileScheme(target),
      downloadUrl,
    });
  } catch (error) {
    Logger.warn('[picture-cache] could not cache local capture:', error?.message || error);
  }
};

/**
 * Read-through: return the cached pictures shaped exactly like the server GET
 * (id, downloadUrl, title, latitude, longitude, capturedAt) but with
 * downloadUrl swapped for a local file:// uri, so a screen can hydrate its slots
 * identically. Rows whose local file has gone missing are skipped.
 */
export const loadCachedPictures = async ({ assessmentId, kind }) => {
  if (!assessmentId || !kind) {
    return [];
  }

  let rows = [];
  try {
    rows = await listCachedPictures(assessmentId, kind);
  } catch (error) {
    Logger.warn('[picture-cache] could not read cache:', error?.message || error);
    return [];
  }

  const pictures = [];
  for (const row of rows) {
    if (!(await fileExists(row.local_path))) {
      continue;
    }
    pictures.push({
      id: row.server_picture_id,
      downloadUrl: withFileScheme(row.local_path),
      title: row.title,
      latitude: row.latitude,
      longitude: row.longitude,
      capturedAt: row.captured_at,
    });
  }
  return pictures;
};

export default { cacheServerPictures, cacheLocalCapture, loadCachedPictures };
