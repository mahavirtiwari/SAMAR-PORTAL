import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const SystemAdminFeeConfigService = () => {
  // Get all fee configurations
  const getFeeConfigurations = async () => {
    try {
      // Use all=true to get complete list without pagination (for lookups and dropdowns)
      const response = await userClient.get('/fee-configurations?all=true');
      Logger.info('Response in FeeConfigService.getFeeConfigurations:', response);
      // With all=true, backend returns: { success: true, data: [...array...] }
      return response.data?.data || response.data || [];
    } catch (error) {
      Logger.error('Error in FeeConfigService.getFeeConfigurations:', error.message);
      throw error;
    }
  };

  // Get fee configuration by ID
  const getFeeConfigurationById = async id => {
    try {
      const response = await userClient.get(`/fee-configurations/${id}`);
      Logger.info('Response in FeeConfigService.getFeeConfigurationById:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in FeeConfigService.getFeeConfigurationById:', error.message);
      throw error;
    }
  };

  // Create fee configuration
  const createFeeConfiguration = async data => {
    try {
      const response = await userClient.post('/fee-configurations', data);
      Logger.info('Response in FeeConfigService.createFeeConfiguration:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in FeeConfigService.createFeeConfiguration:', error.message);
      throw error;
    }
  };

  // Update fee configuration
  const updateFeeConfiguration = async data => {
    try {
      const response = await userClient.put(`/fee-configurations/${data.id}`, data);
      Logger.info('Response in FeeConfigService.updateFeeConfiguration:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in FeeConfigService.updateFeeConfiguration:', error.message);
      throw error;
    }
  };

  // Delete fee configuration
  const deleteFeeConfiguration = async id => {
    try {
      const response = await userClient.delete(`/fee-configurations/${id}`);
      Logger.info('Response in FeeConfigService.deleteFeeConfiguration:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in FeeConfigService.deleteFeeConfiguration:', error.message);
      throw error;
    }
  };

  return {
    getFeeConfigurations,
    getFeeConfigurationById,
    createFeeConfiguration,
    updateFeeConfiguration,
    deleteFeeConfiguration,
  };
};

export default SystemAdminFeeConfigService;
