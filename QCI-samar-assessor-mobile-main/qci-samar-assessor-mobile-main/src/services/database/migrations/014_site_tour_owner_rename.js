import { executeSql } from '../sqlUtils';

/**
 * v14 — call the site tour picture's owner what it is.
 *
 * `site_tour_pictures.team_member_id` has held the owner's USER id since it was added,
 * never a team member id. The name sent anyone working on offline step progress looking
 * for a team-member mapping that does not exist, and it cost real time during BUG-08929
 * before the fix could be written. The column added by that fix on the sibling
 * site_pictures table is called owner_user_id, so the two tables disagreed about the name
 * for the same thing. [TASK-08037]
 *
 * Adds the correctly named column and copies the values across. The old column is left in
 * place and no longer read: dropping or renaming a column needs a SQLite version newer
 * than the oldest Android this app supports, and rebuilding the table to remove one
 * unused integer is not worth the risk to an assessor's offline data.
 *
 * Re-run-safe: adding an existing column is ignored, and the copy only fills rows that
 * have not been copied yet.
 */
export default {
  version: 14,
  name: 'site_tour_owner_rename',
  up: async () => {
    try {
      await executeSql('ALTER TABLE site_tour_pictures ADD COLUMN owner_user_id INTEGER');
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }

    await executeSql(
      'UPDATE site_tour_pictures SET owner_user_id = team_member_id WHERE owner_user_id IS NULL'
    );
  }
};
