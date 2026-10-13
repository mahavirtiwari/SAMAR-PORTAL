import RNFS from 'react-native-fs';
import Marker, { ImageFormat, Position, TextBackgroundType } from 'react-native-image-marker';
import { Logger } from './logger';

const formatCoord = value =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : '—';

const formatTimestamp = input => {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleString();
  }
  return d.toLocaleString();
};

/**
 * Burns LAT / LONG / timestamp into the source image pixels and returns the
 * path to the stamped copy. Callers compress that result before upload, so the
 * source is left untouched. Returns the original uri on any failure so capture
 * flows are never blocked.
 *
 * Stamping is done with react-native-image-marker (native file-level burn),
 * so it needs no mounted React surface — pass it the capture-time coordinates
 * and timestamp and it always runs. Coordinates are resolved and validated by
 * the capture gate before the camera opens, so they arrive here already valid.
 */
export const applyWatermark = async ({ uri, latitude, longitude, timestamp }) => {
  if (!uri) {
    return uri;
  }

  const stampText = [
    `LAT  ${formatCoord(latitude)}`,
    `LONG ${formatCoord(longitude)}`,
    formatTimestamp(timestamp),
  ].join('\n');

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
            fontName: 'Helvetica',
            fontSize: 40,
            bold: true,
            textAlign: 'left',
            shadowStyle: { dx: 1, dy: 1, radius: 2, color: '#000000FF' },
            textBackgroundStyle: {
              type: TextBackgroundType.stretchX,
              color: '#0000008C',
              paddingX: 28,
              paddingY: 22,
            },
          },
        },
      ],
      quality: 90,
      saveFormat: ImageFormat.jpg,
    });
  } catch (error) {
    Logger.warn('Watermark burn failed, returning original uri:', error);
    return uri;
  }

  if (!markedPath) {
    return uri;
  }
  const stampedUri = markedPath.startsWith('file://') ? markedPath : `file://${markedPath}`;

  // Verify the burn produced a real file; fall back to the untouched source
  // otherwise. image-marker writes to a cache volume that differs from the
  // picker's on some Android builds, so never assume the output exists.
  const stampedBytes = await RNFS.stat(stampedUri.replace(/^file:\/\//, ''))
    .then(s => s.size || 0)
    .catch(() => 0);
  if (!stampedBytes) {
    Logger.warn('Watermark output missing/empty, returning original uri');
    return uri;
  }
  return stampedUri;
};
