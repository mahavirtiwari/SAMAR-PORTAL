import { Logger } from '../../../../utils/logger';
import { buildPaginationParams } from '../../utils/pagination';

const unitServices = userClient => {
  // Takes the same filters object as every other list service. It previously took a bare id
  // and interpolated it, so callers passing filters sent organizationId=[object Object] and
  // every filter, page and perPage was silently dropped.
  const getAllUnits = async filters => {
    try {
      const queryString = buildPaginationParams(filters);
      const response = await userClient.get(`/units${queryString}`);
      Logger.info('Response in UserManagementServices.getAllUnits:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.getAllUnits:', error.message);
      throw error;
    }
  };
  // create new unit
  const createUnit = async unitData => {
    try {
      const response = await userClient.post(`/units`, unitData);
      Logger.info('Response in UserManagementServices.createUnit:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.createUnit:', error.message);
      throw error;
    }
  };

  // get unit details
  const getUnitDetails = async unitId => {
    try {
      const response = await userClient.get(`/units/${unitId}`);
      Logger.info('Response in UserManagementServices.getUnitDetails:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.getUnitDetails:', error.message);
      throw error;
    }
  };

  // update unit
  const updateUnit = async (unitId, unitData) => {
    try {
      const response = await userClient.put(`/units/${unitId}`, unitData);
      Logger.info('Response in UserManagementServices.updateUnit:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.updateUnit:', error.message);
      throw error;
    }
  };
  return {
    getAllUnits,
    createUnit,
    getUnitDetails,
    updateUnit,
  };
};
export default unitServices;
