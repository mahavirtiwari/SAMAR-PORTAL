import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import AppFastImage from '../../components/shared/FastImage';
import { Logger } from '../../utils/logger';
import { executeSql } from '../database/sqlUtils';

// Every table created by the migrations. Wiped wholesale on logout.
const TABLES = [
  'response_evidence',
  'responses',
  'questions',
  'parameters',
  'meeting_comments',
  'meeting_participants',
  'meetings',
  'attendance',
  'site_pictures',
  'site_tour_pictures',
  'basic_information',
  'assessments',
  'outbox',
  'calendar_events',
  'master_data_cache'
];

const ASSESSMENT_PHOTOS_DIR = `${RNFS.DocumentDirectoryPath}/assessments`;

// Marks which user owns the local data currently on this device. Survives a
// wipe so the next login can tell same-user (keep + sync the preserved outbox)
// from a different user (wipe first). See BUG-06152.
export const OWNER_USER_ID_KEY = 'ownerUserId';

// AsyncStorage keys that are device/install identity rather than user data —
// they must survive a wipe so re-login on the same device behaves correctly.
const PRESERVED_KEYS = new Set([
  'deviceInstallId',
  'hasLaunchedBefore',
  'tokenKeyMigrated',
  OWNER_USER_ID_KEY
]);

const wipeDatabase = async () => {
  // foreign_keys is connection-level; turning it off lets us DELETE in any order
  // without tripping the assessments -> parameters -> questions -> responses ->
  // response_evidence (and meetings -> comments/participants) FK chains.
  await executeSql('PRAGMA foreign_keys = OFF');
  try {
    for (const table of TABLES) {
      try {
        await executeSql(`DELETE FROM ${table}`);
      } catch (error) {
        if (!/no such table/i.test(error?.message || '')) {
          throw error;
        }
      }
    }
  } finally {
    await executeSql('PRAGMA foreign_keys = ON');
  }
};

const wipeAsyncStorage = async () => {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((key) => !PRESERVED_KEYS.has(key));
  if (toRemove.length > 0) {
    // async-storage v3's default export is the legacy proxy: it has removeMany,
    // not the v2 multiRemove.
    await AsyncStorage.removeMany(toRemove);
  }
  return toRemove.length;
};

// Best-effort full wipe of every local data store. Each step is isolated so a
// failure in one (e.g. a locked file) still lets the others run — logout must
// never be blocked by a partial cleanup failure.
export const wipeAllLocalData = async () => {
  Logger.info('[wipe] starting full local data wipe');

  try {
    await wipeDatabase();
    Logger.info('[wipe] database cleared');
  } catch (error) {
    Logger.error('[wipe] database clear failed:', error?.message || error);
  }

  try {
    if (await RNFS.exists(ASSESSMENT_PHOTOS_DIR)) {
      await RNFS.unlink(ASSESSMENT_PHOTOS_DIR);
    }
    Logger.info('[wipe] assessment photos cleared');
  } catch (error) {
    Logger.error('[wipe] photo dir clear failed:', error?.message || error);
  }

  try {
    await AppFastImage.clearCache();
    Logger.info('[wipe] image cache cleared');
  } catch (error) {
    Logger.error('[wipe] image cache clear failed:', error?.message || error);
  }

  try {
    const removed = await wipeAsyncStorage();
    Logger.info(`[wipe] async storage cleared: ${removed} key(s) (device identity preserved)`);
  } catch (error) {
    Logger.error('[wipe] async storage clear failed:', error?.message || error);
  }

  Logger.info('[wipe] full local data wipe complete');
};
