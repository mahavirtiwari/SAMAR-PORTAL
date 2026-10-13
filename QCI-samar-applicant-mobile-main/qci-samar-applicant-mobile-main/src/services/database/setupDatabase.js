import { Logger } from '../../utils/logger';
import { runMigrations } from './migrations/runner';

/**
 * Setup the database for the application.
 *
 * Drives a versioned migration sequence keyed off SQLite's user_version pragma.
 * Adding a table = drop a file under ./migrations/ and register it in
 * ./migrations/index.js — the runner picks it up on next launch.
 */
export const setupDatabase = async () => {
  try {
    Logger.info('Setting up database...');
    await runMigrations();
    Logger.info('Database setup completed successfully');
    return true;
  } catch (error) {
    Logger.error('Database setup failed:', error.message);
    throw error;
  }
};

export default setupDatabase;
