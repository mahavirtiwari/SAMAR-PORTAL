import { Image as Compressor } from 'react-native-compressor';
import RNFS from 'react-native-fs';
import { Logger } from './logger';
import { applyWatermark } from './watermark';

const ROOT = `${RNFS.DocumentDirectoryPath}/assessments`;

const stripScheme = uri => (uri || '').replace(/^file:\/\//, '');

// Server assessment id used as a path segment — keep it filesystem-safe.
const idForPath = assessmentId => String(assessmentId ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');

const uniqueName = bucket => `${bucket}_${Date.now()}_${Math.floor(Math.random() * 1e6)}.jpg`;

const ensureDir = async path => {
  const exists = await RNFS.exists(path);
  if (!exists) {
    await RNFS.mkdir(path);
  }
};

const safeStat = async path => {
  try {
    const s = await RNFS.stat(path);
    return s.size || 0;
  } catch {
    return 0;
  }
};

/**
 * Image picker options shared by every capture flow. Resizing here is the
 * first pass; final compression (adaptive quality, 1500px, EXIF strip) happens
 * in persistPhoto before the file is staged for upload.
 */
export const getImagePickerOptions = (customOptions = {}) => {
  return {
    mediaType: 'photo',
    includeBase64: false,
    maxWidth: customOptions.maxWidth || 1920,
    maxHeight: customOptions.maxHeight || 1920,
    quality: customOptions.quality || 0.8,
    saveToPhotos: false,
    ...customOptions,
  };
};

const adaptiveQuality = async path => {
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
 * Compresses a captured photo (adaptive quality, max 1500px on the long edge,
 * EXIF stripped, jpg) and stores the result under DocumentDirectoryPath so it
 * survives OS cache eviction between capture and upload — mirroring the
 * assessor app's durable photo storage.
 *
 * Path layout: <Documents>/assessments/<assessmentId>/<bucket>/<name>
 *
 * Returns a `file://`-scheme path safe to stage into FormData, or `null` when
 * it cannot produce a durable file (missing/empty source, or compress + copy
 * both fail). Callers must treat `null` as "ask the user to retake" — staging
 * the original (a soon-evicted camera temp) would queue a doomed upload.
 */
export const persistPhoto = async ({ uri, assessmentId, bucket, name }) => {
  if (!uri) {
    return null;
  }
  const src = stripScheme(uri);

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
    let compressedPath = src;
    try {
      compressedPath = await Compressor.compress(uri, {
        compressionMethod: 'manual',
        maxWidth: 1500,
        maxHeight: 1500,
        quality,
        output: 'jpg',
        // Location/time already travel in the payload fields; EXIF is dead
        // weight on a slow field uplink.
        strip: true,
      });
      compressedPath = stripScheme(compressedPath);
    } catch (compressionError) {
      Logger.warn('persistPhoto: compression failed, using original:', compressionError?.message);
    }

    const target = `${dir}/${name || `${Date.now()}.jpg`}`;
    if (compressedPath !== target) {
      if (await RNFS.exists(target)) {
        await RNFS.unlink(target);
      }
      // moveFile beats copyFile on temp output from the compressor — we don't
      // need the intermediate file once it's at the durable path.
      try {
        await RNFS.moveFile(compressedPath, target);
      } catch {
        await RNFS.copyFile(compressedPath, target);
      }
    }

    const savedBytes = await safeStat(target);
    if (!savedBytes) {
      Logger.error(`persistPhoto: produced an EMPTY (0-byte) file, discarding -> ${target}`);
      try {
        await RNFS.unlink(target);
      } catch {
        // best-effort cleanup
      }
      return null;
    }
    return `file://${target}`;
  } catch (error) {
    Logger.error('persistPhoto failed to produce a durable file:', error?.message || error);
    return null;
  }
};

/**
 * The single capture-preparation path for every photo the app uploads: burns
 * the lat/long/timestamp stamp into the pixels (so the preview and the uploaded
 * file both carry it), then compresses and copies the result to durable storage
 * under the assessment folder — closing the gap between capture and upload where
 * a camera temp would otherwise be evicted and leave a doomed upload.
 *
 * Returns a durable `file://` path ready to stage into FormData, or throws a
 * user-facing "retake" error when the capture produced an empty file so the
 * screen surfaces it instead of staging a doomed upload.
 */
export const prepareCapturedPhoto = async ({
  uri,
  assessmentId,
  bucket = 'captures',
  latitude,
  longitude,
  timestamp,
  label = 'photo',
}) => {
  if (!uri) {
    throw new Error(`Could not read the ${label} — please retake it.`);
  }

  const stampedUri = await applyWatermark({ uri, latitude, longitude, timestamp });

  const durablePath = await persistPhoto({
    uri: stampedUri,
    assessmentId: idForPath(assessmentId),
    bucket,
    name: uniqueName(bucket),
  });

  if (!durablePath) {
    Logger.error(`[${label}] capture persist failed (empty/missing source) source=${uri}`);
    throw new Error(`Could not save the ${label} — the image was empty. Please retake it.`);
  }

  return durablePath;
};
