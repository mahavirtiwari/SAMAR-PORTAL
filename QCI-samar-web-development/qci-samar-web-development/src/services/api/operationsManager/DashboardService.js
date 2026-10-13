import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const OperationsManagerDashboardService = () => {
  /**
   * Get Enterprise Admin dashboard data
   * @returns {Promise<Object>} Dashboard data including summary cards, active applications, and alerts
   */
  const getDashboard = async () => {
    try {
      const response = await userClient.get('/dashboards/om');
      Logger.info('Response in OperationsManagerDashboardService.getDashboard:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in OperationsManagerDashboardService.getDashboard:', error.message);
      throw error;
    }
  };

  return {
    getDashboard,
  };
};

export default OperationsManagerDashboardService;
