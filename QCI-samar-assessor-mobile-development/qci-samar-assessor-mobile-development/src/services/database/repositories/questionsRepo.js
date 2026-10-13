import { idFromServer } from '../ids';
import { executeSql } from '../sqlUtils';

/**
 * Mirror the freshly-fetched server question list into the local table.
 * Questions may arrive nested inside parameters or as a flat list — this
 * helper accepts the flat shape; the download service flattens before calling.
 *
 * Upserts in place rather than delete-all + re-insert: surviving questions
 * keep their ids, so captured responses (responses.question_id → questions
 * ON DELETE CASCADE) are NOT wiped when an assessment is re-downloaded.
 */
export const replaceQuestionsForAssessment = async (
  assessmentLocalId,
  serverAssessmentId,
  serverQuestions = []
) => {
  const keepIds = [];
  for (const q of serverQuestions) {
    if (!q?.id) {
      continue;
    }
    const id = idFromServer(`${serverAssessmentId}-q-${q.id}`);
    const parameterLocalId = q.parameterId
      ? idFromServer(`${serverAssessmentId}-p-${q.parameterId}`)
      : null;
    await executeSql(
      `INSERT INTO questions (id, server_id, assessment_id, parameter_id, payload_json, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         server_id = excluded.server_id,
         parameter_id = excluded.parameter_id,
         payload_json = excluded.payload_json,
         updated_at = CURRENT_TIMESTAMP`,
      [id, q.id, assessmentLocalId, parameterLocalId, JSON.stringify(q)]
    );
    keepIds.push(id);
  }

  // Prune questions that dropped out of the server set (their now-orphaned
  // responses cascade away with them). Skip pruning when the list is empty —
  // that usually means the fetch failed upstream, and wiping would destroy
  // captured responses for no reason.
  if (keepIds.length > 0) {
    const placeholders = keepIds.map(() => '?').join(',');
    await executeSql(
      `DELETE FROM questions WHERE assessment_id = ? AND id NOT IN (${placeholders})`,
      [assessmentLocalId, ...keepIds]
    );
  }
};

/**
 * Guarantees a parent `questions` row exists for an (assessment, question)
 * pair so an offline response can satisfy its question_id foreign key.
 *
 * The answer screen is driven by the live server response, so the local
 * questions table can be empty when a response is captured (questions are
 * only mirrored by an explicit download). This materialises a minimal stub
 * keyed by the SAME deterministic id replaceQuestionsForAssessment uses, so
 * a later download replaces the same row in place rather than orphaning it.
 *
 * The parent assessments row must already exist — call ensureAssessmentRow
 * first (questions.assessment_id FKs to assessments(id)).
 */
export const ensureQuestionRow = async (serverAssessmentId, questionServerId) => {
  if (!serverAssessmentId || !questionServerId) {
    throw new Error('ensureQuestionRow: missing assessment or question id');
  }
  const id = idFromServer(`${serverAssessmentId}-q-${questionServerId}`);
  const assessmentLocalId = idFromServer(serverAssessmentId);
  await executeSql(
    `INSERT OR IGNORE INTO questions (id, server_id, assessment_id, payload_json, updated_at)
     VALUES (?, ?, ?, '{}', CURRENT_TIMESTAMP)`,
    [id, questionServerId, assessmentLocalId]
  );
  return id;
};

export const listQuestionsForAssessment = async (assessmentLocalId) => {
  const result = await executeSql(
    'SELECT * FROM questions WHERE assessment_id = ? ORDER BY id ASC',
    [assessmentLocalId]
  );
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    rows.push({ ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null });
  }
  return rows;
};
