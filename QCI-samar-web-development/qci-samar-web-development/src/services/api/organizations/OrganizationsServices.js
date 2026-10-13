import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const OrganizationsServices = () => {
  // Get all organizations
  const getAllOrganizations = async organizationId => {
    try {
      const url = `/organizations/${organizationId}`;
      const response = await userClient.get(url);
      Logger.info('Response in OrganizationsServices.getAllOrganizations:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in OrganizationsServices.getAllOrganizations:', error.message);
      throw error;
    }
  };

  // Update organization
  const updateOrganization = async organizationData => {
    try {
      const response = await userClient.put(`/organization`, organizationData);
      Logger.info('Response in OrganizationsServices.updateOrganization:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in OrganizationsServices.updateOrganization:', error.message);
      throw error;
    }
  };

  return {
    getAllOrganizations,
    updateOrganization,
  };
};

export default OrganizationsServices;
