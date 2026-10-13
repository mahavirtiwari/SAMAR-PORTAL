import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const DRDOAdminDashboardService = () => {
  /**
   * Get DRDO Admin dashboard data
   * @returns {Promise<Object>} Dashboard data including summary cards, charts, certificates, and payment summary
   */
  const getDashboard = async () => {
    try {
      const response = await userClient.get('/dashboards/dr');
      Logger.info('Response in DRDOAdminDashboardService.getDashboard:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in DRDOAdminDashboardService.getDashboard:', error.message);
      throw error;
    }
  };

  return {
    getDashboard,
  };
};

export default DRDOAdminDashboardService;
