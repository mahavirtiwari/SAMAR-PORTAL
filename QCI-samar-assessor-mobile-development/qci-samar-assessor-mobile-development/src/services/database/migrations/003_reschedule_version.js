import { executeSql } from '../sqlUtils';

/**
 * v3 — reschedule tracking.
 *
 * Stores the last-seen backend reschedule_version per assessment so the
 * app can detect when ops reschedules an in-flight assessment and wipe
 * the now-invalid local capture before re-hydrating from the server.
 */
export default {
  version: 3,
  name: 'reschedule_version',
  up: async () => {
    // Re-run safety: a kill between this ALTER committing and the user_version
    // bump would re-run it and "duplicate column" would wedge the DB layer.
    // Treat an already-present column as success (idempotent).
    try {
      await executeSql('ALTER TABLE assessments ADD COLUMN reschedule_version INTEGER DEFAULT 0');
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }
  }
};
