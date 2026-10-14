import RNFS from 'react-native-fs';
import Marker, { ImageFormat, Position, TextBackgroundType } from 'react-native-image-marker';
import { getCurrentCoords } from './location';
import { Logger } from './logger';

const hasCoords = (lat, lng) =>
  typeof lat === 'number' &&
  Number.isFinite(lat) &&
  typeof lng === 'number' &&
  Number.isFinite(lng);

const formatCoord = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : '—';

const formatTimestamp = (input) => {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleString();
  }
  return d.toLocaleString();
};

/**
 * Burns LAT / LONG / timestamp into the source image pixels and returns the
 * path to the stamped copy. Callers persist that result via persistPhoto, so
 * the source is left untouched. Returns the original uri on any failure so
 * capture flows are never blocked.
 *
 * Stamping is done with react-native-image-marker (native file-level burn),
 * so it needs no mounted React surface — pass it the capture-time coordinates
 * and timestamp and it always runs. `autoFetchCoords` defaults to false:
 * every capture screen now gates on acquireCaptureCoords before the camera
 * opens, so coordinates always arrive here already resolved, and a redundant
 * fetch here would just re-trigger the location prompt. Set it true only for
 * a caller that genuinely has no coordinates yet.
 */
export const applyWatermark = async ({
  uri,
  latitude,
  longitude,
  timestamp,
  autoFetchCoords = false
}) => {
  if (!uri) {
    return uri;
  }

  let lat = latitude;
  let lng = longitude;
  if (autoFetchCoords && !hasCoords(lat, lng)) {
    const coords = await getCurrentCoords({ timeout: 4000, maximumAge: 60000 });
    if (coords) {
      lat = coords.latitude;
      lng = coords.longitude;
    }
  }

  const stampText = [
    `LAT  ${formatCoord(lat)}`,
    `LONG ${formatCoord(lng)}`,
    formatTimestamp(timestamp)
  ].join('\n');

  Logger.info('[watermark] burning stamp', {
    uri,
    latitude,
    longitude,
    coordsFinite: hasCoords(lat, lng),
    stampText
  });

  let markedPath;
  try {
    markedPath = await Marker.markText({
      backgroundImage: { src: { uri } },
      watermarkTexts: [
        {
          text: stampText,
          position: { position: Position.bottomLeft },
          style: {
            color: '#FFFFFFFF',
            // No fontName: image-marker falls back to the platform default,
            // which exists on both iOS and Android. A named desktop font like
            // 'Helvetica' does not exist on Android and could break the burn.
            fontSize: 40,
            bold: true,
            textAlign: 'left',
            shadowStyle: { dx: 1, dy: 1, radius: 2, color: '#000000FF' },
            textBackgroundStyle: {
              type: TextBackgroundType.stretchX,
              color: '#0000008C',
              paddingX: 28,
              paddingY: 22
            }
          }
        }
      ],
      // image-marker 2.x takes an integer 0-100. This re-encodes the already
      // compressed photo, so 90 inflated every upload; 75 keeps the stamp legible.
      quality: 75,
      saveFormat: ImageFormat.jpg
    });
  } catch (error) {
    // Loud, with the real reason and the inputs — a silent warn here is exactly
    // why a missing watermark went undiagnosed. Still returns the original uri
    // so capture is never blocked, but the failure is now visible in the log.
    Logger.error('[watermark] burn failed — photo saved WITHOUT lat/long stamp', {
      message: error?.message || String(error),
      uri,
      latitude,
      longitude
    });
    return uri;
  }

  // react-native-image-marker v2 resolves to a result object ({ uri, ... });
  // v1 resolved to the output path itself.
  if (markedPath && typeof markedPath === 'object') {
    markedPath = markedPath.uri;
  }
  if (!markedPath) {
    Logger.error('[watermark] burn returned no path — photo saved WITHOUT lat/long stamp', { uri });
    return uri;
  }
  const stampedUri = markedPath.startsWith('file://') ? markedPath : `file://${markedPath}`;

  // Return the marked output directly. Every capture flow runs this result
  // through persistPhoto, which copies it to durable storage — so there is no
  // need to overwrite the source in place. The old unlink-then-move did a
  // cross-volume rename (image-marker writes to a different cache volume than
  // the picker on some Android builds) that failed with EXDEV, deleting the
  // source and leaving a missing file the upload then choked on. Verify the
  // burn produced a real file; fall back to the untouched source otherwise.
  const stampedBytes = await RNFS.stat(stampedUri.replace(/^file:\/\//, ''))
    .then((s) => s.size || 0)
    .catch(() => 0);
  if (!stampedBytes) {
    Logger.error('[watermark] burn output missing/empty — photo saved WITHOUT lat/long stamp', {
      markedPath,
      stampedUri
    });
    return uri;
  }
  Logger.info('[watermark] burn OK', { stampedUri, stampedBytes });
  return stampedUri;
};
