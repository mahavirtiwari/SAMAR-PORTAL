import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination';

const SystemAdminEnterprisesService = () => {
  // Get all organizations
  const getOrganizations = async data => {
    try {
      const queryString = buildPaginationParams(data);
      const response = await userClient.get(`/organizations${queryString}`);
      Logger.info('Response in EnterprisesService.getOrganizations:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in EnterprisesService.getOrganizations:', error.message);
      throw error;
    }
  };

  // Get organization by ID
  const getOrganizationById = async id => {
    try {
      const response = await userClient.get(`/organizations/${id}`);
      Logger.info('Response in EnterprisesService.getOrganizationById:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in EnterprisesService.getOrganizationById:', error.message);
      throw error;
    }
  };

  // Export organizations
  const exportOrganizations = async () => {
    try {
      const response = await userClient.get('/organizations/export');
      Logger.info('Response in EnterprisesService.exportOrganizations:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in EnterprisesService.exportOrganizations:', error.message);
      throw error;
    }
  };

  // Activate organization
  const activateOrganization = async id => {
    try {
      const response = await userClient.post(`/organizations/${id}/activate`);
      Logger.info('Response in EnterprisesService.activateOrganization:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in EnterprisesService.activateOrganization:', error.message);
      throw error;
    }
  };

  // Deactivate organization
  const deactivateOrganization = async id => {
    try {
      const response = await userClient.post(`/organizations/${id}/deactivate`);
      Logger.info('Response in EnterprisesService.deactivateOrganization:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in EnterprisesService.deactivateOrganization:', error.message);
      throw error;
    }
  };

  return {
    getOrganizations,
    getOrganizationById,
    exportOrganizations,
    activateOrganization,
    deactivateOrganization,
  };
};

export default SystemAdminEnterprisesService;
