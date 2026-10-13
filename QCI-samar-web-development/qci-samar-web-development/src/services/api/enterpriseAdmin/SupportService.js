import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination';

// New support service helpers modeled after MasterService
const SupportServices = () => {
  const listSupportTickets = async params => {
    try {
      const query = buildPaginationParams(params);
      const url = `/support/tickets${query}`;
      const response = await userClient.get(url);
      Logger.info('listSupportTickets response', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in listSupportTickets:', error);
      throw error;
    }
  };

  const getSupportTicket = async id => {
    try {
      const response = await userClient.get(`/support/tickets/${id}`);
      Logger.info('getSupportTicket response', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in getSupportTicket:', error);
      throw error;
    }
  };

  const createSupportTicket = async formData => {
    try {
      // formData is FormData instance (supports file upload)
      const response = await userClient.post('/support/tickets', formData, {
        // Let axios set appropriate headers for FormData
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      Logger.info('createSupportTicket response', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createSupportTicket:', error);
      throw error;
    }
  };

  const updateSupportTicket = async (id, payload) => {
    try {
      const response = await userClient.put(`/support/tickets/${id}`, payload);
      Logger.info('updateSupportTicket response', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateSupportTicket:', error);
      throw error;
    }
  };

  return {
    listSupportTickets,
    getSupportTicket,
    createSupportTicket,
    updateSupportTicket,
  };
};
export default SupportServices;
