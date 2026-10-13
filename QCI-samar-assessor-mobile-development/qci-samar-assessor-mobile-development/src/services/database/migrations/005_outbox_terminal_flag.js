import { executeSql } from '../sqlUtils';

/**
 * v5 — outbox terminal flag.
 *
 * Distinguishes a server REJECTION (409/422 — a plain retry will never fix it;
 * the user must re-capture or discard) from a row that merely exhausted its
 * auto-retry budget (a later retry may still succeed). Both stop the background
 * drain, but the UI needs to tell them apart and so does an explicit "Retry".
 * Defaults to 0 for every existing row.
 */
export default {
  version: 5,
  name: 'outbox_terminal_flag',
  up: async () => {
    // Re-run safety: ALTER ... ADD COLUMN is not idempotent. If the app is killed
    // between this statement committing and the user_version bump, the runner
    // re-runs it on next launch and "duplicate column" would wedge the whole DB
    // layer. Treat an already-present column as success.
    try {
      await executeSql('ALTER TABLE outbox ADD COLUMN terminal INTEGER DEFAULT 0');
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }
  }
};
