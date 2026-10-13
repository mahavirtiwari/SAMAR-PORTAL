import DeviceInfo from 'react-native-device-info';
import { Logger } from './logger';

export const MIN_FREE_DISK_BYTES = 1024 * 1024 * 1024; // 1 GB

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 MB';
  }
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
};

export const checkFreeDiskSpace = async (minBytes = MIN_FREE_DISK_BYTES) => {
  try {
    const freeBytes = await DeviceInfo.getFreeDiskStorage();
    const sufficient = freeBytes >= minBytes;
    Logger.info(
      `Disk space: ${formatBytes(freeBytes)} free, minimum ${formatBytes(
        minBytes
      )}, sufficient=${sufficient}`
    );
    return { sufficient, freeBytes, minBytes };
  } catch (error) {
    Logger.error('Failed to read free disk storage:', error);
    return { sufficient: false, freeBytes: 0, minBytes };
  }
};
