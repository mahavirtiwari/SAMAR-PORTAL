import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination';

const CertificateService = () => {
  /**
   * Get all certificates with optional filters
   * @param {Object} params - Query parameters for filtering/pagination
   * @returns {Promise<Object>} Paginated certificates data
   */
  const getCertificates = async params => {
    try {
      const queryString = buildPaginationParams(params);
      const url = `/certificates${queryString}`;

      const response = await userClient.get(url);
      Logger.info('Response in CertificateService.getCertificates:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in CertificateService.getCertificates:', error.message);
      throw error;
    }
  };

  /**
   * Get certificate by ID
   * @param {number} id - Certificate ID
   * @returns {Promise<Object>} Certificate details
   */
  const getCertificateById = async id => {
    try {
      const response = await userClient.get(`/certificates/${id}`);
      Logger.info('Response in CertificateService.getCertificateById:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in CertificateService.getCertificateById:', error.message);
      throw error;
    }
  };

  /**
   * Download certificate document
   * @param {number} documentId - Document ID
   * @returns {Promise<Blob>} Document blob for download
   */
  const downloadDocument = async documentId => {
    try {
      const response = await userClient.get(`/certificates/${documentId}/download`, {
        responseType: 'blob',
      });
      Logger.info('Response in CertificateService.downloadDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in CertificateService.downloadDocument:', error.message);
      throw error;
    }
  };

  return {
    getCertificates,
    getCertificateById,
    downloadDocument,
  };
};

export default CertificateService;
