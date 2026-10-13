import { executeSql } from '../sqlUtils';

/**
 * v7 — co-assessor's lead-opening-meeting gate.
 *
 * A co-assessor may only start the Site Tour once they have, while online,
 * confirmed the lead's opening meeting is completed AND synced on the server.
 * This flag records that one-time online verification per assessment so the
 * Site Tour stays unlocked afterwards even if the device later goes offline
 * (offline the co's device has no local opening-meeting row to re-derive it
 * from). Defaults 0; only ever flipped on for co-assessors. Re-run-safe.
 */
export default {
  version: 7,
  name: 'assessment_lead_opening_verified',
  up: async () => {
    try {
      await executeSql(
        'ALTER TABLE assessments ADD COLUMN lead_opening_verified INTEGER DEFAULT 0'
      );
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }
  }
};
