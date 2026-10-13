import { executeSql } from '../sqlUtils';

/**
 * v11 — closing-meeting recording links.
 *
 * The lead assessor can attach up to 5 meeting-recording URLs to the closing
 * meeting. Stored as a JSON-encoded string array so the links render and sync
 * offline, mirroring the server's `recording_links` field. Nullable for rows
 * written before this migration (and for opening meetings, which have none).
 * Re-run-safe.
 */
export default {
  version: 11,
  name: 'meeting_recording_links',
  up: async () => {
    try {
      await executeSql('ALTER TABLE meetings ADD COLUMN recording_links TEXT');
    } catch (error) {
      if (!/duplicate column/i.test(error?.message || '')) {
        throw error;
      }
    }
  }
};
