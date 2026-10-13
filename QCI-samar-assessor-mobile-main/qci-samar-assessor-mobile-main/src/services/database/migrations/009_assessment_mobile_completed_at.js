import { executeSql } from '../sqlUtils';

/**
 * v9 — mobile-completion timestamp mirror.
 *
 * Records when the assessor confirmed the server-side "Complete on Mobile"
 * cutover for this assessment. Mirrored locally so the Delete Data gate and the
 * post-cutover UI survive going offline after the online completion. Nullable
 * until the cutover happens. Re-run-safe.
 */
export default {
  version: 9,
  name: 'assessment_mobile_completed_at',
  up: async () => {
    try {
      await executeSql('ALTER TABLE assessments ADD COLUMN mobile_completed_at TEXT');
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }
  }
};
