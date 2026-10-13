import { Logger } from './logger';

const formatCoord = value => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : '—');

/**
 * Burn an upload-location + timestamp stamp into an image file (bottom-left,
 * white on translucent black), mirroring the mobile app's capture watermark.
 * Best-effort like mobile: non-images and any failure return the original file.
 *
 * @param {File} file
 * @param {{ latitude?: number|null, longitude?: number|null, timestamp: string }} meta
 * @returns {Promise<File>}
 */
export const applyImageWatermark = async (file, { latitude, longitude, timestamp }) => {
  if (!file || !file.type?.startsWith('image/')) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();

    const lines = [`LAT  ${formatCoord(latitude)}`, `LONG ${formatCoord(longitude)}`, new Date(timestamp).toLocaleString()];

    const fontSize = Math.max(14, Math.round(canvas.width * 0.022));
    const lineHeight = Math.round(fontSize * 1.35);
    const pad = Math.round(fontSize * 0.6);
    ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;

    const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const blockHeight = lineHeight * lines.length + pad * 2;
    const blockTop = canvas.height - blockHeight;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, blockTop, textWidth + pad * 2, blockHeight);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    lines.forEach((line, i) => ctx.fillText(line, pad, blockTop + pad + i * lineHeight));

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      return file;
    }

    const stampedName = `${file.name.replace(/\.(png|jpe?g)$/i, '')}.jpg`;
    return new File([blob], stampedName, { type: 'image/jpeg' });
  } catch (err) {
    Logger.error('applyImageWatermark failed, uploading original image:', err?.message);
    return file;
  }
};
