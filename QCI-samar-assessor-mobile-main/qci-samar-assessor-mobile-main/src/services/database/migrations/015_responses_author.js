import { executeSql } from '../sqlUtils';

/**
 * v15 — record which assessor authored a locally stored response.
 *
 * The responses table held only the answer (option + remarks), never who wrote
 * it, because it used to hold nothing but this device's own captures. Once an
 * assessment's responses began being mirrored in for offline viewing, the
 * offline hydrate stamped every remark with the current user, so the lead saw
 * co-assessors' remarks attributed to themselves — and "View All Comments" had
 * to force a server fetch to get the real author, failing offline. These columns
 * let the download persist the server's per-response assessor so the offline
 * hydrate can read it back.
 *
 * All nullable: rows written before this migration, and this device's own
 * unsynced captures, carry no author — the hydrate falls back to the current
 * user for those, matching the pre-migration behaviour.
 *
 * Re-run-safe.
 */
export default {
  version: 15,
  name: 'responses_author',
  up: async () => {
    const columns = [
      'ALTER TABLE responses ADD COLUMN assessor_user_id INTEGER',
      'ALTER TABLE responses ADD COLUMN assessor_name TEXT',
      'ALTER TABLE responses ADD COLUMN assessor_role TEXT'
    ];
    for (const sql of columns) {
      try {
        await executeSql(sql);
      } catch (error) {
        if (!/duplicate column/i.test(error?.message || '')) {
          throw error;
        }
      }
    }
  }
};
