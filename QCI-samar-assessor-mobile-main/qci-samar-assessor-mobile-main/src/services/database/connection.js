import SQLite from 'react-native-sqlite-storage';
import { Logger } from '../../utils/logger';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

let db = null;

/**
 * Get or create database connection
 */
export const getConnection = async () => {
  try {
    if (db) {
      return db;
    }

    db = await SQLite.openDatabase({
      name: 'assessor.db',
      location: 'default'
    });

    // Foreign keys are off per-connection by default in SQLite. Turn them
    // on so the ON DELETE CASCADE clauses in 002_offline_core actually fire.
    await db.executeSql('PRAGMA foreign_keys = ON');

    Logger.info('Database connection established');
    return db;
  } catch (error) {
    Logger.error('Failed to establish database connection:', error.message);
    throw error;
  }
};

/**
 * Close database connection
 */
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
