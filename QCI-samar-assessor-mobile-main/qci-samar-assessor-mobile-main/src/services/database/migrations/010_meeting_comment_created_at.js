import { executeSql } from '../sqlUtils';

/**
 * v10 — meeting-comment authored-at timestamp.
 *
 * Locally-authored meeting comments carried no capture time, so the closing /
 * opening meeting comment rows rendered a blank date offline (the screen reads
 * `comment.createdAt`). Store the ISO time the comment was written so the date
 * survives with no connectivity, mirroring the online payload's `createdAt`.
 * Nullable for rows written before this migration. Re-run-safe.
 */
export default {
  version: 10,
  name: 'meeting_comment_created_at',
  up: async () => {
    try {
      await executeSql('ALTER TABLE meeting_comments ADD COLUMN created_at TEXT');
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }
  }
};
