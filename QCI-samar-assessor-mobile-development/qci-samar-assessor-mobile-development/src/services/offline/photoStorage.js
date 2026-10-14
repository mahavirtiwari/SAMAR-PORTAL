import { Image as Compressor } from 'react-native-compressor';
import RNFS from 'react-native-fs';
import { Logger } from '../../utils/logger';

const ROOT = `${RNFS.DocumentDirectoryPath}/assessments`;

const stripScheme = (uri) => (uri || '').replace(/^file:\/\//, '');

// True when a uri already points at a file persistPhoto wrote (under ROOT).
// Lets callers skip a redundant re-compress/re-copy of an already-durable file.
export const isPersistedPhotoPath = (uri) => {
  if (!uri) {
    return false;
  }
  return stripScheme(uri).startsWith(`${ROOT}/`);
};

// The bucket segment (`evidence`, `site_tour`, ...) of a persisted path, or
// null for anything not under ROOT. Lets a caller tell "my own bucket, reuse"
// from "another capture's file, copy" without trusting caller-supplied flags.
export const persistedBucketOf = (uri) => {
  if (!isPersistedPhotoPath(uri)) {
    return null;
  }
  const rest = stripScheme(uri).slice(`${ROOT}/`.length).split('/');
  return rest.length >= 3 ? rest[1] : null;
};

// Re-anchor a stored photo path to the CURRENT app container. iOS changes the
// Documents container UUID on reinstall/update while the SQLite DB survives, so
// an absolute path captured under a previous install points at a dead location
// and its upload fails as "file missing" — the offline-sync-stuck bug. Every
// persisted photo lives under `<Documents>/assessments/…`; keep only that suffix
// and rebuild it against the current DocumentDirectoryPath. Tolerates new
// relative paths, old absolute paths (any UUID), and the file:// scheme.
export const resolvePhotoPath = (stored) => {
  if (!stored) {
    return stored;
  }
  // Only local file paths need re-anchoring. Leave remote/served images alone —
  // a downloadUrl can itself contain "assessments/" (e.g. .../storage/assessments/…)
  // and must never be rewritten to a local path.
  if (/^(https?|content|data):/i.test(stored)) {
    return stored;
  }
  const raw = stripScheme(stored);
  const idx = raw.indexOf('assessments/');
  if (idx === -1) {
    return stored;
  }
  return `file://${RNFS.DocumentDirectoryPath}/${raw.slice(idx)}`;
};

const ensureDir = async (path) => {
  const exists = await RNFS.exists(path);
  if (!exists) {
    await RNFS.mkdir(path);
  }
};

const adaptiveQuality = async (path) => {
  try {
    const stat = await RNFS.stat(path);
    const mb = (stat.size || 0) / (1024 * 1024);
    if (mb > 8) {
      return 0.6;
    }
    if (mb > 3) {
      return 0.7;
    }
    return 0.8;
  } catch {
    return 0.8;
  }
};

/**
 * Compresses a captured photo (adaptive quality, max 1500px on the long
 * edge, EXIF stripped, jpg) and stores the result under DocumentDirectoryPath so it
 * survives app updates and OS cache eviction.
 *
 * Path layout:
 *   <Documents>/assessments/<assessmentLocalId>/<bucket>/<name>
 *
 * Returns a `file://`-scheme path safe to embed in FormData later, or `null`
 * when it cannot produce a durable file (missing/empty source, or compress +
 * copy both fail). Callers must treat `null` as "ask the user to retake" —
 * returning the original uri here would queue a doomed upload (the source is
 * usually a camera temp the OS evicts before sync), which fails with a
 * no-status network error and permanently wedges the outbox.
 */
export const persistPhoto = async ({ uri, assessmentId, bucket, name }) => {
  if (!uri) {
    return null;
  }
  const src = stripScheme(uri);

  // A source that's already gone/empty (OS cache eviction of a camera temp
  // between capture and a delayed save) can never produce a durable file —
  // this is what made response evidence upload a 0-byte file the server
  // rejects as application/x-empty. Bail now so the caller asks for a retake.
  const srcBytes = await safeStat(src);
  if (!srcBytes) {
    Logger.error(`persistPhoto: source missing/empty (${srcBytes} B) -> ${uri}`);
    return null;
  }

  try {
    await ensureDir(ROOT);
    await ensureDir(`${ROOT}/${assessmentId}`);
    const dir = `${ROOT}/${assessmentId}/${bucket}`;
    await ensureDir(dir);

    const quality = await adaptiveQuality(src);
    const compress = async (maxSide, q) =>
      stripScheme(
        await Compressor.compress(uri, {
          compressionMethod: 'manual',
          maxWidth: maxSide,
          maxHeight: maxSide,
          quality: q,
          output: 'jpg',
          // Location/time already travel in the payload fields; EXIF is dead
          // weight on a slow field uplink.
          strip: true
        })
      );
    let compressedPath = src;
    try {
      compressedPath = await compress(1500, quality);
    } catch (compressionError) {
      // The usual cause is the native decoder running out of memory on a
      // large capture. The original is 5-12MB, which would crawl up a field
      // link and press on the server, so retry once smaller before giving up.
      Logger.warn(
        'persistPhoto: compression failed, retrying at 1024px/0.6:',
        compressionError?.message
      );
      try {
        compressedPath = await compress(1024, 0.6);
      } catch (retryError) {
        Logger.warn('persistPhoto: compression retry failed, using original:', retryError?.message);
      }
    }

    const targetName = name || `${Date.now()}.jpg`;
    const target = `${dir}/${targetName}`;
    if (compressedPath !== target) {
      const exists = await RNFS.exists(target);
      if (exists) {
        await RNFS.unlink(target);
      }
      // moveFile beats copyFile on temp output from the compressor — we
      // don't need the intermediate file once it's at the durable path.
      try {
        await RNFS.moveFile(compressedPath, target);
      } catch {
        await RNFS.copyFile(compressedPath, target);
      }
    }
    const savedBytes = await safeStat(target);
    // A zero-byte result means the source was gone/empty by persist time.
    // Returning it would queue an empty upload the server rejects (422,
    // application/x-empty) and which then wedges the outbox as terminal.
    // Discard it and signal failure so the caller can surface a re-capture.
    if (!savedBytes) {
      Logger.error(
        `persistPhoto: produced an EMPTY (0-byte) file, discarding -> ${target} (source: ${uri})`
      );
      try {
        await RNFS.unlink(target);
      } catch {
        // best-effort cleanup
      }
      return null;
    }
    Logger.info(`persistPhoto: saved ${formatBytes(savedBytes)} -> ${target}`);
    return `file://${target}`;
  } catch (error) {
    // We could not produce a durable copy. Returning the original (often a
    // soon-evicted camera temp) would queue a doomed upload, so signal failure
    // and let the caller request a retake.
    Logger.error('persistPhoto failed to produce a durable file:', error?.message || error);
    return null;
  }
};

/**
 * Moves an already-produced image (e.g. a watermarked temp) under durable
 * storage WITHOUT recompressing it — the single compression pass already ran
 * in persistPhoto when the raw capture was first persisted. This is the second
 * half of the capture pipeline: persist the raw shot durably first, then stamp
 * that durable file and move the stamped result home. Returns a `file://` path,
 * or `null` when the source is missing/empty or the move fails.
 */
export const moveIntoDurable = async ({ uri, assessmentId, bucket, name }) => {
  if (!uri) {
    return null;
  }
  const src = stripScheme(uri);
  const srcBytes = await safeStat(src);
  if (!srcBytes) {
    Logger.error(`moveIntoDurable: source missing/empty -> ${uri}`);
    return null;
  }
  try {
    await ensureDir(ROOT);
    await ensureDir(`${ROOT}/${assessmentId}`);
    const dir = `${ROOT}/${assessmentId}/${bucket}`;
    await ensureDir(dir);

    const target = `${dir}/${name || `${Date.now()}.jpg`}`;
    if (src !== target) {
      if (await RNFS.exists(target)) {
        await RNFS.unlink(target);
      }
      try {
        await RNFS.moveFile(src, target);
      } catch {
        await RNFS.copyFile(src, target);
      }
    }
    const savedBytes = await safeStat(target);
    if (!savedBytes) {
      Logger.error(`moveIntoDurable: produced an EMPTY (0-byte) file, discarding -> ${target}`);
      try {
        await RNFS.unlink(target);
      } catch {
        // best-effort cleanup
      }
      return null;
    }
    return `file://${target}`;
  } catch (error) {
    Logger.error('moveIntoDurable failed:', error?.message || error);
    return null;
  }
};

/**
 * Removes every persisted photo for an assessment by unlinking its whole
 * directory (`<Documents>/assessments/<assessmentLocalId>`). Safe to call
 * when the directory does not exist. Used by the reschedule wipe.
 */
/**
 * Copies an already-durable photo to a new durable path WITHOUT recompressing,
 * leaving the source in place. Used when one capture is derived from another
 * (evidence picked from a site-tour photo): every row must own its own file,
 * because the delete paths unlink a row's file outright and a shared file
 * would take every sibling capture down with it. Returns a `file://` path, or
 * `null` when the source is missing/empty or the copy fails.
 */
export const copyIntoDurable = async ({ uri, assessmentId, bucket, name }) => {
  if (!uri) {
    return null;
  }
  const src = stripScheme(resolvePhotoPath(uri));
  const srcBytes = await safeStat(src);
  if (!srcBytes) {
    Logger.error(`copyIntoDurable: source missing/empty -> ${uri}`);
    return null;
  }
  try {
    await ensureDir(ROOT);
    await ensureDir(`${ROOT}/${assessmentId}`);
    const dir = `${ROOT}/${assessmentId}/${bucket}`;
    await ensureDir(dir);

    const target = `${dir}/${name || `${Date.now()}.jpg`}`;
    if (src === target) {
      return `file://${target}`;
    }
    if (await RNFS.exists(target)) {
      await RNFS.unlink(target);
    }
    await RNFS.copyFile(src, target);
    const savedBytes = await safeStat(target);
    if (!savedBytes) {
      Logger.error(`copyIntoDurable: produced an EMPTY (0-byte) file, discarding -> ${target}`);
      try {
        await RNFS.unlink(target);
      } catch {
        // best-effort cleanup
      }
      return null;
    }
    return `file://${target}`;
  } catch (error) {
    Logger.error('copyIntoDurable failed:', error?.message || error);
    return null;
  }
};

/**
 * Removes a single persisted photo by its file path (the `file://...` path
 * stored on a capture row). Safe to call when the file is missing or the path
 * is empty. Used when a capture is deleted offline so we don't leak the image.
 */
export const deletePhotoFile = async (filePath) => {
  if (!filePath) {
    return;
  }
  const path = stripScheme(resolvePhotoPath(filePath));
  try {
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
  } catch (error) {
    Logger.warn('deletePhotoFile failed:', error?.message || error);
  }
};

export const deletePhotosForAssessment = async (assessmentLocalId) => {
  if (!assessmentLocalId) {
    return;
  }
  const dir = `${ROOT}/${assessmentLocalId}`;
  try {
    if (await RNFS.exists(dir)) {
      await RNFS.unlink(dir);
      Logger.info(`deletePhotosForAssessment: removed ${dir}`);
    }
  } catch (error) {
    Logger.warn('deletePhotosForAssessment failed:', error?.message || error);
  }
};

const safeStat = async (path) => {
  try {
    const s = await RNFS.stat(path);
    return s.size || 0;
  } catch {
    return 0;
  }
};

// True when a path points at a real, non-empty file. The drain calls this
// before a photo upload: a missing/empty file would fail the multipart POST
// with a no-status network error that gets retried forever, fencing punch-out
// and wedging the assessment. Better to fail it terminally with a clear reason.
export const isUploadableFile = async (filePath) => {
  if (!filePath) {
    return false;
  }
  return (await safeStat(stripScheme(resolvePhotoPath(filePath)))) > 0;
};

const formatBytes = (bytes) => {
  if (!bytes) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
