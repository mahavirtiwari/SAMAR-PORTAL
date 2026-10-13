import RNFS from 'react-native-fs';
import { Logger } from '../../utils/logger';

// Durable capture root; mirrors imageUtils.persistPhoto, which writes every
// captured photo here before it is staged for upload.
const ROOT = `${RNFS.DocumentDirectoryPath}/assessments`;

const stripScheme = uri => (uri || '').replace(/^file:\/\//, '');

const safeStat = async path => {
  try {
    const s = await RNFS.stat(path);
    return s.size || 0;
  } catch {
    return 0;
  }
};

// True when a uri already points at a durable file persistPhoto wrote (under
// ROOT) — the capture screens persist before Save, so their staged uris are
// already durable and must not be re-copied.
export const isPersistedPhotoPath = uri => {
  if (!uri) {
    return false;
  }
  return stripScheme(uri).startsWith(`${ROOT}/`);
};

// True when a path points at a real, non-empty file. The drain calls this
// before a photo upload: a missing/empty file would fail the multipart POST
// with a no-status network error that gets retried forever, so we fail it
// terminally with a clear reason instead.
export const isUploadableFile = async filePath => {
  if (!filePath) {
    return false;
  }
  return (await safeStat(stripScheme(filePath))) > 0;
};

// Removes a single persisted photo by its file path. Safe when the file is
// missing or the path is empty.
export const deletePhotoFile = async filePath => {
  if (!filePath) {
    return;
  }
  const path = stripScheme(filePath);
  try {
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
  } catch (error) {
    Logger.warn('deletePhotoFile failed:', error?.message || error);
  }
};

export default { isPersistedPhotoPath, isUploadableFile, deletePhotoFile };
