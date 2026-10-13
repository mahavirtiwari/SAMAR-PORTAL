import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const CommitteeMemberService = () => {
  /**
   * Get all committee members with optional filters
   * @param {Object} params - Query parameters (search, perPage, page)
   * @returns {Promise<Object>} paginated members list
   */
  const getMembers = async (params = {}) => {
    try {
      const response = await userClient.get('/committee-members', { params });
      Logger.info('Response in CommitteeMemberService.getMembers:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMemberService.getMembers:', error.message);
      throw error;
    }
  };

  /**
   * Get a single committee member by ID
   * @param {number|string} memberId
   * @returns {Promise<Object>} member details
   */
  const getMember = async memberId => {
    try {
      const response = await userClient.get(`/committee-members/${memberId}`);
      Logger.info('Response in CommitteeMemberService.getMember:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMemberService.getMember:', error.message);
      throw error;
    }
  };

  /**
   * Create a new committee member
   * @param {Object} payload - Member data:
   *   - firstName: string (required)
   *   - lastName: string (required)
   *   - email: string (required)
   *   - mobileNumber: string (required, 10 digits)
   *   - designation: string (required)
   *   - organisation: string (required)
   * @returns {Promise<Object>} created member
   */
  const createMember = async payload => {
    try {
      const response = await userClient.post('/committee-members', payload);
      Logger.info('Response in CommitteeMemberService.createMember:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMemberService.createMember:', error.message);
      throw error;
    }
  };

  /**
   * Update a committee member
   * @param {number|string} memberId
   * @param {Object} payload - Member data
   * @returns {Promise<Object>} updated member
   */
  const updateMember = async (memberId, payload) => {
    try {
      const response = await userClient.put(`/committee-members/${memberId}`, payload);
      Logger.info('Response in CommitteeMemberService.updateMember:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMemberService.updateMember:', error.message);
      throw error;
    }
  };

  /**
   * Delete a committee member
   * @param {number|string} memberId
   * @returns {Promise<Object>}
   */
  const deleteMember = async memberId => {
    try {
      const response = await userClient.delete(`/committee-members/${memberId}`);
      Logger.info('Response in CommitteeMemberService.deleteMember:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMemberService.deleteMember:', error.message);
      throw error;
    }
  };

  return {
    getMembers,
    getMember,
    createMember,
    updateMember,
    deleteMember,
  };
};

export default CommitteeMemberService;
