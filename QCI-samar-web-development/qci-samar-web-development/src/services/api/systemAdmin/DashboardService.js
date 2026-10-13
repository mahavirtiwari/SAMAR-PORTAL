import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const SystemAdminDashboardService = () => {
  /**
   * Get System Admin dashboard data
   * @returns {Promise<Object>} Dashboard data including summary cards, charts, and tables
   */
  const getDashboard = async () => {
    try {
      const response = await userClient.get('/dashboards/sa');
      Logger.info('Response in DashboardService.getDashboard:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in DashboardService.getDashboard:', error.message);
      throw error;
    }
  };

  return {
    getDashboard,
  };
};

export default SystemAdminDashboardService;
