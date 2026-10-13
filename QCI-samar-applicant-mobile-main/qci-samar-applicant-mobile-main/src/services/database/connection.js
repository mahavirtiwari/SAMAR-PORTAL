import SQLite from 'react-native-sqlite-storage';
import { Logger } from '../../utils/logger';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

let db = null;

export const getConnection = async () => {
  try {
    if (db) {
      return db;
    }

    db = await SQLite.openDatabase({
      name: 'applicant.db',
      location: 'default',
    });

    // Foreign keys are off per-connection by default in SQLite; turn them on
    // so any ON DELETE CASCADE we add later actually fires.
    await db.executeSql('PRAGMA foreign_keys = ON');

    Logger.info('Database connection established');
    return db;
  } catch (error) {
    Logger.error('Failed to establish database connection:', error.message);
    throw error;
  }
};

export const closeConnection = async () => {
  try {
    if (db) {
      await db.close();
      db = null;
      Logger.info('Database connection closed');
    }
  } catch (error) {
    Logger.error('Failed to close database connection:', error.message);
    throw error;
  }
};

export default { getConnection, closeConnection };
