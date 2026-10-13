import { executeSql } from '../sqlUtils';

/**
 * v2 — offline-first core schema.
 *
 * Adds the tables required to conduct a full site assessment with no
 * connectivity. Every captured-on-site row carries a local_status:
 *   'synced'  — server is authoritative for this row
 *   'pending' — captured locally, waiting for sync
 *   'syncing' — being uploaded right now
 *   'failed'  — last sync attempt failed, see outbox.last_error
 *
 * Outbox holds the actual network operation queue. local_status on the
 * domain row mirrors the latest outbox state for that row, denormalized
 * so the UI can render badges without joining outbox on every read.
 *
 * server_id vs local_id:
 *   - id (TEXT PK)        — stable client-generated UUID, never reassigned
 *   - server_id (INTEGER) — backend's numeric id once the row is synced
 *   Screens reference rows by id; outbox payloads carry the id so the
 *   sync engine can patch server_id back onto the row after upload.
 */
export default {
  version: 2,
  name: 'offline_core',
  up: async () => {
    // -- assessments --------------------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        server_id INTEGER UNIQUE,
        status TEXT,
        scheduled_start_date TEXT,
        scheduled_end_date TEXT,
        payload_json TEXT NOT NULL,
        downloaded_at TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_assessments_server_id ON assessments(server_id)'
    );

    // -- parameters ---------------------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS parameters (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        assessment_id TEXT NOT NULL,
        is_mandatory INTEGER DEFAULT 0,
        allocated_to_user_id INTEGER,
        payload_json TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_parameters_assessment ON parameters(assessment_id)'
    );
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_parameters_server_id ON parameters(server_id)'
    );

    // -- questions ----------------------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        assessment_id TEXT NOT NULL,
        parameter_id TEXT,
        payload_json TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        FOREIGN KEY (parameter_id) REFERENCES parameters(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_questions_assessment ON questions(assessment_id)'
    );
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_questions_parameter ON questions(parameter_id)'
    );

    // -- responses ----------------------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        assessment_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        option_id INTEGER,
        remarks TEXT,
        latitude REAL,
        longitude REAL,
        captured_at TEXT,
        local_status TEXT DEFAULT 'pending',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_responses_assessment ON responses(assessment_id)'
    );
    await executeSql('CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id)');
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_responses_local_status ON responses(local_status)'
    );

    // -- response_evidence -------------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS response_evidence (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        response_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        thumb_path TEXT,
        latitude REAL,
        longitude REAL,
        captured_at TEXT,
        local_status TEXT DEFAULT 'pending',
        FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_response_evidence_response ON response_evidence(response_id)'
    );

    // -- attendance ---------------------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        assessment_id TEXT NOT NULL,
        team_member_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        selfie_path TEXT,
        latitude REAL,
        longitude REAL,
        recorded_at TEXT NOT NULL,
        device_metadata_json TEXT,
        local_status TEXT DEFAULT 'pending',
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_attendance_assessment ON attendance(assessment_id)'
    );
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_attendance_local_status ON attendance(local_status)'
    );

    // -- meetings -----------------------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        assessment_id TEXT NOT NULL,
        type TEXT NOT NULL,
        image_path TEXT,
        latitude REAL,
        longitude REAL,
        conducted_at TEXT,
        local_status TEXT DEFAULT 'pending',
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_assessment_type ON meetings(assessment_id, type)'
    );

    // -- meeting_comments --------------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS meeting_comments (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        meeting_id TEXT NOT NULL,
        team_member_id INTEGER,
        comment TEXT,
        local_status TEXT DEFAULT 'pending',
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_meeting_comments_meeting ON meeting_comments(meeting_id)'
    );

    // -- meeting_participants ----------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS meeting_participants (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        meeting_id TEXT NOT NULL,
        name TEXT NOT NULL,
        designation TEXT,
        source TEXT DEFAULT 'local',
        local_status TEXT DEFAULT 'pending',
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id)'
    );

    // -- site_pictures (interior + exterior, dedicated step) ---------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS site_pictures (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        assessment_id TEXT NOT NULL,
        type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        thumb_path TEXT,
        latitude REAL,
        longitude REAL,
        captured_at TEXT,
        local_status TEXT DEFAULT 'pending',
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_site_pictures_assessment ON site_pictures(assessment_id)'
    );

    // -- site_tour_pictures ------------------------------------------
    await executeSql(`
      CREATE TABLE IF NOT EXISTS site_tour_pictures (
        id TEXT PRIMARY KEY,
        server_id INTEGER,
        assessment_id TEXT NOT NULL,
        team_member_id INTEGER,
        title TEXT,
        file_path TEXT NOT NULL,
        thumb_path TEXT,
        latitude REAL,
        longitude REAL,
        captured_at TEXT,
        local_status TEXT DEFAULT 'pending',
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_site_tour_pictures_assessment ON site_tour_pictures(assessment_id)'
    );

    // -- outbox -------------------------------------------------------
    // op_key is a deterministic dedup key (e.g. "response:{questionId}").
    // Re-enqueue on the same key updates the existing row instead of
    // creating a duplicate so the user can edit-then-sync repeatedly.
    await executeSql(`
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id TEXT,
        op_type TEXT NOT NULL,
        op_key TEXT NOT NULL UNIQUE,
        payload_json TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await executeSql('CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status)');
    await executeSql('CREATE INDEX IF NOT EXISTS idx_outbox_assessment ON outbox(assessment_id)');
  }
};
