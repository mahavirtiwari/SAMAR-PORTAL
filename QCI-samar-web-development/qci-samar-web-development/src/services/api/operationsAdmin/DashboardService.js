import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const OperationsAdminDashboardService = () => {
  /**
   * Get Operations Admin dashboard data
   * @returns {Promise<Object>} Dashboard data including summary cards, charts, and tables
   */
  const getDashboard = async () => {
    try {
      const response = await userClient.get('/dashboards/oa');
      Logger.info('Response in OperationsAdminDashboardService.getDashboard:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in OperationsAdminDashboardService.getDashboard:', error.message);
      throw error;
    }
  };

  return {
    getDashboard,
  };
};

export default OperationsAdminDashboardService;
