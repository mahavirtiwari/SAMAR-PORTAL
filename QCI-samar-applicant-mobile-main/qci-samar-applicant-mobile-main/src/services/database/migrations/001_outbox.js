import { executeSql } from '../sqlUtils';

/**
 * v1 — offline outbox.
 *
 * The applicant app's only offline writes are the four site-picture /
 * site-tour capture + delete operations. They queue here first; syncEngine
 * drains them FIFO when connectivity returns. op_key is a deterministic dedup
 * key (e.g. "sitePicture:{localId}") so a re-enqueue of the same logical
 * operation updates the existing row instead of creating a duplicate.
 *
 * `terminal` marks a server rejection a plain retry can never fix (400/409/422
 * or a missing local file), as opposed to a row that merely exhausted its
 * auto-retry budget — the UI and an explicit "Retry" need to tell them apart.
 */
export default {
  version: 1,
  name: 'outbox',
  up: async () => {
    await executeSql(`
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id TEXT,
        op_type TEXT NOT NULL,
        op_key TEXT NOT NULL UNIQUE,
        payload_json TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        terminal INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await executeSql('CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status)');
    await executeSql('CREATE INDEX IF NOT EXISTS idx_outbox_assessment ON outbox(assessment_id)');
  },
};
