import { idFromServer } from '../database/ids';
import { ensureAssessmentRow } from '../database/repositories/assessmentsRepo';
import { upsertBasicInformation } from '../database/repositories/basicInformationRepo';
import { enqueue } from '../database/repositories/outboxRepo';
import { flushOutbox } from './flushOutbox';
import { findOutboxIdByKey } from './syncHelpers';

/**
 * Offline-first Basic Information save. Persists the form payload locally
 * (so the step renders + reports complete offline), queues the POST, then
 * hands it to the drain, the only uploader.
 */
export const recordBasicInformation = async ({ serverAssessmentId, data }) => {
  if (!serverAssessmentId) {
    throw new Error('recordBasicInformation: missing serverAssessmentId');
  }
  const localAssessmentId = idFromServer(serverAssessmentId);

  await ensureAssessmentRow(serverAssessmentId);
  await upsertBasicInformation({ assessmentLocalId: localAssessmentId, payload: data });

  const opKey = `basicInformation:${localAssessmentId}`;
  await enqueue({
    assessmentId: localAssessmentId,
    opType: 'basicInformation',
    opKey,
    payload: { serverAssessmentId, data }
  });
  const outboxRowId = await findOutboxIdByKey(opKey);

  const synced = await flushOutbox(outboxRowId, 'basicInformation');
  return { synced };
};
