import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const SystemSettingsService = () => {
  // Get all settings
  const getAll = async () => {
    try {
      const response = await userClient.get('/system-settings');
      Logger.info('Response in SystemSettingsService.getAll:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in SystemSettingsService.getAll:', error.message);
      throw error;
    }
  };

  // Get single setting by key
  const get = async key => {
    try {
      const response = await userClient.get(`/system-settings/${key}`);
      Logger.info('Response in SystemSettingsService.get:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in SystemSettingsService.get:', error.message);
      throw error;
    }
  };

  // Create new setting
  const create = async data => {
    try {
      const response = await userClient.post('/system-settings', data);
      Logger.info('Response in SystemSettingsService.create:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in SystemSettingsService.create:', error.message);
      throw error;
    }
  };

  // Update setting by key
  const update = async data => {
    try {
      const response = await userClient.put(`/system-settings/${data.key}`, data);
      Logger.info('Response in SystemSettingsService.update:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in SystemSettingsService.update:', error.message);
      throw error;
    }
  };

  return {
    getAll,
    get,
    create,
    update,
  };
};

export default SystemSettingsService;
