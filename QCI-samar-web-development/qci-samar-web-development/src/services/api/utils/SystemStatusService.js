import { Logger } from '../../../utils/logger';
import PublicClient from '../clients/publicClient';

/**
 * Service for checking system status (maintenance mode, etc.)
 * Uses the public client since this endpoint doesn't require authentication
 */
const SystemStatusService = () => {
  /**
   * Check system status including maintenance mode
   * @returns {Promise<{maintenanceMode: boolean, applicationSubmissionOpen: boolean, maintenanceMessage?: string}>}
   */
  const getSystemStatus = async () => {
    try {
      const response = await PublicClient.get('/system/status');
      const data = response?.data?.data || response?.data || {};
      return {
        maintenanceMode: data.maintenanceMode ?? data.maintenance_mode ?? false,
        applicationSubmissionOpen: data.applicationSubmissionOpen ?? data.application_submission_open ?? true,
        maintenanceMessage: data.maintenanceMessage || data.maintenance_message || null,
      };
    } catch (error) {
      Logger.error('Failed to check system status:', error);
      // Return safe defaults on error
      return {
        maintenanceMode: false,
        applicationSubmissionOpen: true,
        maintenanceMessage: null,
      };
    }
  };

  return {
    getSystemStatus,
  };
};

export default SystemStatusService;
