import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const UserService = () => {
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

  const getUser = async id => {
    try {
      const response = await userClient.get(`/users/${id}`);
      Logger.info('getUser response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getUser:', error.message);
      throw error;
    }
  };

  return {
    updateUser,
    getUser,
  };
};

export default UserService;
