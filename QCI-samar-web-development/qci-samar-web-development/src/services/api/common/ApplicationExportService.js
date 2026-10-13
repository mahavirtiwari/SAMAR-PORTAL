import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination';

/**
 * The applications CSV export.
 *
 * The endpoint scopes rows to the caller's own role, so every applications list
 * screen shares this one call rather than each role service carrying a copy.
 */
const ApplicationExportService = () => {
  const exportApplications = async (filters = {}) => {
    try {
      const queryString = buildPaginationParams(filters);
      const url = `/applications/export${queryString}`;

      Logger.info('ApplicationExportService.exportApplications:', url);
      // responseType 'text' is required so the caller can build a Blob from the
      // body; without it the CSV is parsed as JSON and the download is empty.
      const response = await userClient.get(url, { responseType: 'text' });
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationExportService.exportApplications:', error.message);
      throw error;
    }
  };

  return { exportApplications };
};

export default ApplicationExportService;
