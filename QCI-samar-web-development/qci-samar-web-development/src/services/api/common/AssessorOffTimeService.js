import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const AssessorOffTimeService = () => {
  // Get the authenticated assessor's own off-time entries
  const getMyOffTimes = async () => {
    try {
      const response = await userClient.get('/off-times');
      Logger.info('Response in AssessorOffTimeService.getMyOffTimes:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in AssessorOffTimeService.getMyOffTimes:', error.message);
      throw error;
    }
  };

  // Create an off-time entry for the authenticated assessor
  const createOffTime = async ({ fromDate, toDate }) => {
    try {
      const response = await userClient.post('/off-times', { fromDate, toDate });
      Logger.info('Response in AssessorOffTimeService.createOffTime:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in AssessorOffTimeService.createOffTime:', error.message);
      throw error;
    }
  };

  // Delete a future off-time entry owned by the authenticated assessor
  const deleteOffTime = async id => {
    try {
      const response = await userClient.delete(`/off-times/${id}`);
      Logger.info('Response in AssessorOffTimeService.deleteOffTime:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessorOffTimeService.deleteOffTime:', error.message);
      throw error;
    }
  };

  // Read-only list of an assessor's off-time entries, for Operations Manager
  // viewing that assessor's profile
  const getAssessorOffTimes = async assessorId => {
    try {
      const response = await userClient.get(`/users/${assessorId}/off-times`);
      Logger.info('Response in AssessorOffTimeService.getAssessorOffTimes:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in AssessorOffTimeService.getAssessorOffTimes:', error.message);
      throw error;
    }
  };

  // Off-time for several assessors in one call, for screens that need a whole
  // list at once. Asking per assessor exhausted the caller's request allowance on
  // a large list, which then refused their unrelated requests too. Returns a map
  // keyed by assessor id, built here from the flat list the API sends. [BUG-08860]
  const getOffTimesForAssessors = async assessorIds => {
    const ids = [...new Set((assessorIds ?? []).filter(id => id !== null && id !== undefined))];

    if (!ids.length) {
      return {};
    }

    try {
      // Axios's default array serialisation emits userIds[]=1&userIds[]=2, which is
      // the bracketed form PHP parses into an array. Do not "simplify" this with
      // paramsSerializer indexes:null: that emits userIds=1&userIds=2, and PHP keeps
      // only the last value, so the screen would silently read one assessor's
      // off-time and show everyone else as available.
      const response = await userClient.get('/users/off-times', {
        params: { userIds: ids },
      });
      Logger.info('Response in AssessorOffTimeService.getOffTimesForAssessors:', response);

      const rows = (response.data?.data ?? response.data)?.offTimes ?? [];

      return rows.reduce((byAssessor, row) => {
        const key = String(row.userId);
        byAssessor[key] = byAssessor[key] ?? [];
        byAssessor[key].push(row);
        return byAssessor;
      }, {});
    } catch (error) {
      Logger.error('Error in AssessorOffTimeService.getOffTimesForAssessors:', error.message);
      throw error;
    }
  };

  return {
    getMyOffTimes,
    createOffTime,
    deleteOffTime,
    getAssessorOffTimes,
    getOffTimesForAssessors,
  };
};

export default AssessorOffTimeService;
