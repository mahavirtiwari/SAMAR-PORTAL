import { executeSql } from '../sqlUtils';

/**
 * v2 — offline read-cache for already-uploaded site + site-tour pictures.
 *
 * The capture screens fetch previously-uploaded pictures over an authenticated
 * GET and render them from each picture's protected downloadUrl. That GET fails
 * offline, so nothing renders. This table mirrors the server's picture list and
 * points at a locally-downloaded copy of each file (local_path), letting the
 * screens rehydrate from disk when the network read is unavailable.
 *
 * kind separates the two flows ('site' | 'tour'); the unique key
 * (assessment_id, kind, server_picture_id) lets a re-fetch upsert in place and
 * reconcile away rows the server no longer returns.
 */
export default {
  version: 2,
  name: 'site_picture_cache',
  up: async () => {
    await executeSql(`
      CREATE TABLE IF NOT EXISTS site_picture_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        server_picture_id TEXT NOT NULL,
        title TEXT,
        latitude TEXT,
        longitude TEXT,
        captured_at TEXT,
        local_path TEXT,
        download_url TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(assessment_id, kind, server_picture_id)
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_site_picture_cache_lookup ON site_picture_cache(assessment_id, kind)',
    );
  },
};
