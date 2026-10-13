import { executeSql } from '../sqlUtils';

/**
 * v12 — stable link from response evidence back to its source site-tour picture.
 *
 * A site-tour pick is uploaded as ordinary response evidence, so after a reload
 * the picker had to re-identify which pictures are already attached. It did that
 * by fuzzy-matching capturedAt/coordinates, which don't reliably survive the
 * server round-trip. We now stamp the picture's title into `description` and its
 * id into `source_site_tour_picture_id` at upload (mirroring the web client) and
 * match on those. Both nullable — camera captures and rows written before this
 * migration have neither. Re-run-safe.
 */
export default {
  version: 12,
  name: 'response_evidence_site_tour_link',
  up: async () => {
    const columns = [
      'ALTER TABLE response_evidence ADD COLUMN description TEXT',
      'ALTER TABLE response_evidence ADD COLUMN source_site_tour_picture_id INTEGER'
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
