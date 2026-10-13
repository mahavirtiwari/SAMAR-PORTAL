import { executeSql } from '../sqlUtils';

/**
 * v6 — mobile-role-done marker.
 *
 * Flags an assessment whose on-site mobile role is finished AND fully synced,
 * and whose local data the user has explicitly cleared from this device via
 * "Delete Data". Such an assessment is excluded from auto-download so the
 * cleanup is terminal (it isn't silently re-pulled while the assessment is
 * still in_progress awaiting the separate, web-only QC submission). Defaults 0.
 */
export default {
  version: 6,
  name: 'assessment_mobile_role_done',
  up: async () => {
    try {
      await executeSql('ALTER TABLE assessments ADD COLUMN mobile_role_done INTEGER DEFAULT 0');
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }
  }
};
