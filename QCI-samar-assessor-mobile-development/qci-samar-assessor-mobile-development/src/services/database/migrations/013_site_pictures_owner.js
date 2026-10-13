import { executeSql } from '../sqlUtils';

/**
 * v13 — record which assessor a locally stored site picture belongs to.
 *
 * The step tick counted every site picture held locally for the assessment, while the
 * server lets a member submit only when they have pictures of their own. The two agreed
 * only by accident, because the local table used to hold nothing but this device's
 * captures. Once an assessment's pictures began being mirrored in for offline viewing,
 * a co-assessor inherited the lead's pictures, saw the step tick, and was then refused
 * at submission. The table had no column to scope the count by, which is what this adds.
 *
 * Nullable on purpose: rows written before this migration have no owner recorded, and
 * the count treats an unknown owner as this device's own so an assessor's existing
 * captures do not vanish from the tick after upgrading.
 *
 * Named owner_user_id because it holds the owner's USER id, which is what the local
 * step-progress check can compare against. Note site_tour_pictures stores the same thing
 * in a column called team_member_id, which is a misnomer: it has held a user id since it
 * was added. Not renamed here to avoid a second migration inside a bug fix. [BUG-08929]
 *
 * Re-run-safe.
 */
export default {
  version: 13,
  name: 'site_pictures_owner',
  up: async () => {
    try {
      await executeSql('ALTER TABLE site_pictures ADD COLUMN owner_user_id INTEGER');
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }
  }
};
