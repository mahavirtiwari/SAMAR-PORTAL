import { executeSql } from '../sqlUtils';

/**
 * v8 — locally-cached status of the team-global assessment steps.
 *
 * Step progress is computed from local data so the assessment flow works fully
 * offline; the server is only a sync target when the network is available. The
 * per-member steps (site pictures, site tour, assessment parameters) are always
 * derivable from this device's own captures, but the team-global steps
 * (parameter allocation, opening/closing meeting, basic information) may be
 * completed by another assessor whose artifacts this device never holds. When
 * online we mirror those global statuses into this column (a JSON map of
 * step -> status) so the local step-progress computation can reflect them and
 * they survive the device going offline. Re-run-safe.
 */
export default {
  version: 8,
  name: 'assessment_synced_global_steps',
  up: async () => {
    try {
      await executeSql('ALTER TABLE assessments ADD COLUMN synced_global_steps TEXT');
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }
  }
};
