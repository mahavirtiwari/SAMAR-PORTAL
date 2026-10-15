import { Logger } from '../../../../utils/logger';
import { buildPaginationParams } from '../../utils/pagination';

const unitAdminServices = userClient => {
  // Get all users
  const getAllUsers = async data => {
    try {
      // Build query string directly from data

      const queryString = buildPaginationParams(data);
      const url = `/users${queryString}`;
      const response = await userClient.get(url);
      Logger.info('Response in UserManagementServices.getAllUsers:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.getAllUsers:', error.message);
      throw error;
    }
  };
  const updateUser = async payload => {
    try {
      const response = await userClient.put(`/users/${payload.id}`, payload);
      Logger.info('updateUser response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in updateUser:', error.message);
      throw error;
    }
  };
  // create new user
  const createUser = async userData => {
    try {
      const response = await userClient.post(`/users`, userData);
      Logger.info('Response in UserManagementServices.createUser:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.createUser:', error.message);
      throw error;
    }
  };

  // get user details
  const getUserDetails = async userId => {
    try {
      const response = await userClient.get(`/users/${userId}`);
      Logger.info('Response in UserManagementServices.getUserDetails:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.getUserDetails:', error.message);
      throw error;
    }
  };

  // activate user account
  const activateUserAccount = async userId => {
    try {
      const response = await userClient.post(`/users/${userId}/activate`);
      Logger.info('Response in UserManagementServices.activateUserAccount:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.activateUserAccount:', error.message);
      throw error;
    }
  };

  // deactivate user account
  // The reason is required by the API and kept in the account's status history.
  const deactivateUserAccount = async (userId, reason) => {
    try {
      const response = await userClient.post(`/users/${userId}/deactivate`, { reason });
      Logger.info('Response in UserManagementServices.deactivateUserAccount:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.deactivateUserAccount:', error.message);
      throw error;
    }
  };

  // get user domains
  const getUserDomains = async userId => {
    try {
      const response = await userClient.get(`/users/${userId}/domains`);
      Logger.info('Response in UserManagementServices.getUserDomains:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.getUserDomains:', error.message);
      throw error;
    }
  };

  // update user domains
  const createUserDomains = async data => {
    try {
      const payload = { domainIds: data.domainIds };
      const response = await userClient.post(`/users/${data.userId}/domains`, payload);
      Logger.info('Response in UserManagementServices.updateUserDomains:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.updateUserDomains:', error.message);
      throw error;
    }
  };

  // put user domains
  const updateUserDomains = async data => {
    try {
      const response = await userClient.put(`/users/${data.userId}/domains`, data);
      Logger.info('Response in UserManagementServices.putUserDomains:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.putUserDomains:', error.message);
      throw error;
    }
  };

  // get user assessor districts
  const getUserAssessorDistricts = async userId => {
    try {
      const response = await userClient.get(`/users/${userId}/assessor-districts`);
      Logger.info('Response in UserManagementServices.getUserAssessorDistricts:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.getUserAssessorDistricts:', error.message);
      throw error;
    }
  };

  // create user assessor districts
  const createUserAssessorDistricts = async data => {
    try {
      const response = await userClient.post(`/users/${data.userId}/assessor-districts`, data);
      Logger.info('Response in UserManagementServices.createUserAssessorDistricts:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.createUserAssessorDistricts:', error.message);
      throw error;
    }
  };

  // update user assessor districts
  const updateUserAssessorDistricts = async data => {
    try {
      const response = await userClient.post(`/users/${data.userId}/assessor-districts`, data);
      Logger.info('Response in UserManagementServices.updateUserAssessorDistricts:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in UserManagementServices.updateUserAssessorDistricts:', error.message);
      throw error;
    }
  };

  return {
    getAllUsers,
    createUser,
    getUserDetails,
    activateUserAccount,
    deactivateUserAccount,
    updateUser,
    getUserDomains,
    updateUserDomains,
    createUserDomains,
    getUserAssessorDistricts,
    createUserAssessorDistricts,
    updateUserAssessorDistricts,
  };
};
export default unitAdminServices;
