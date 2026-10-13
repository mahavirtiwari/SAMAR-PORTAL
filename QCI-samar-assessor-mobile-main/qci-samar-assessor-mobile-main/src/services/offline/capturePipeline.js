import { Logger } from '../../utils/logger';
import { applyWatermark } from '../../utils/watermark';
import { idFromServer, newId } from '../database/ids';
import { deletePhotoFile, moveIntoDurable, persistPhoto } from './photoStorage';

/**
 * Phase 1 of capture: persist the raw shot to durable storage IMMEDIATELY,
 * before any slow step (location fix, watermarking). This consumes the
 * ephemeral camera temp right away — so the OS can't evict it — and gives the
 * screen a durable `file://` path it can preview and store even while the
 * location fix is still resolving. Offline, a GPS cold start routinely burns
 * the full timeout; if the durable copy waited on it, the preview would stay
 * pinned to the soon-evicted camera temp and reopen blank (BUG-05611).
 *
 * Returns the durable path, or throws a user-facing "retake" error when the
 * source was empty/missing so the screen can ask for a re-capture.
 */
export const persistCapture = async ({ uri, serverAssessmentId, bucket, label = 'photo' }) => {
  if (!uri) {
    throw new Error(`Could not read the ${label} — please retake it.`);
  }
  const durablePath = await persistPhoto({
    uri,
    assessmentId: idFromServer(serverAssessmentId),
    bucket,
    name: `${bucket}_${newId()}.jpg`
  });
  if (!durablePath) {
    Logger.error(`[${label}] capture persist failed (empty/missing source) source=${uri}`);
    throw new Error(`Could not save the ${label} — the image was empty. Please retake it.`);
  }
  return durablePath;
};

/**
 * Phase 2 of capture: burn lat/long/timestamp onto an already-durable file
 * (from persistCapture) and move the stamped result to a fresh durable path,
 * unlinking the un-stamped original. Coordinates are passed in already-resolved,
 * so the watermark does NOT re-fetch them.
 *
 * Best-effort: on any failure the original durable path is returned unchanged —
 * a capture is never lost to a stamping error, at worst it ships un-stamped.
 * The move does not recompress (persistCapture already ran the one compression
 * pass), so total work matches the old single-pass path.
 */
export const stampCapture = async ({
  uri,
  serverAssessmentId,
  bucket,
  latitude,
  longitude,
  timestamp,
  label = 'photo'
}) => {
  if (!uri) {
    return uri;
  }
  const stampedUri = await applyWatermark({
    uri,
    latitude,
    longitude,
    timestamp,
    autoFetchCoords: false
  });
  // Watermark returns the input path unchanged when the burn is a no-op or
  // failed — nothing to move in that case.
  if (!stampedUri || stampedUri === uri) {
    return uri;
  }
  const durablePath = await moveIntoDurable({
    uri: stampedUri,
    assessmentId: idFromServer(serverAssessmentId),
    bucket,
    name: `${bucket}_${newId()}.jpg`
  });
  if (!durablePath) {
    Logger.warn(`[${label}] stamp move failed; keeping the un-stamped durable capture`);
    return uri;
  }
  await deletePhotoFile(uri);
  return durablePath;
};

/**
 * Single-call capture prep: persist first (durable, fast), then stamp. Kept for
 * callers that already hold the coordinates when the shutter fires (punch-in /
 * punch-out, where location is resolved before the camera opens). Screens that
 * capture first and locate afterwards call persistCapture + stampCapture
 * directly, so the durable preview appears before the location fix resolves.
 */
export const prepareCapturedPhoto = async ({
  uri,
  serverAssessmentId,
  bucket,
  latitude,
  longitude,
  timestamp,
  label = 'photo'
}) => {
  const durablePath = await persistCapture({ uri, serverAssessmentId, bucket, label });
  return stampCapture({
    uri: durablePath,
    serverAssessmentId,
    bucket,
    latitude,
    longitude,
    timestamp,
    label
  });
};
