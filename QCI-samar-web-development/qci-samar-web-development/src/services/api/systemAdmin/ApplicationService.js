import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination';

const SystemAdminApplicationServices = () => {
  const getApplication = async (data = {}) => {
    try {
      const queryString = buildPaginationParams(data);
      const url = `/applications${queryString}`;
      const response = await userClient.get(url);
      Logger.info('Response in ApplicationServices.getApplication:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.getApplication:', error.message);
      throw error;
    }
  };

  //   get application details
  const getApplicationDetails = async applicationId => {
    try {
      const response = await userClient.get(`/applications/${applicationId}`);
      Logger.info('Response in ApplicationServices.getApplicationDetails:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.getApplicationDetails:', error.message);
      throw error;
    }
  };

  // execute workflow transition

  return {
    getApplication,
    getApplicationDetails,
  };
};

export default SystemAdminApplicationServices;
