import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

// /start and /complete are long-running, non-idempotent committee-meeting operations:
// certification, send-backs and certificate generation can exceed the global 30s timeout.
// Give them a longer per-request timeout and never auto-retry — a retried POST would
// double-submit against an already-processing meeting.
const LONG_WRITE_REQUEST = {
  timeout: 120000,
  'axios-retry': { retries: 0 },
};

const CommitteeMeetingService = () => {
  /**
   * Get all committee meetings with optional filters
   * @param {Object} params - Query parameters (status, meetingDateFrom, meetingDateTo, perPage, page)
   * @returns {Promise<Object>} paginated meetings list
   */
  const getMeetings = async (params = {}) => {
    try {
      const response = await userClient.get('/committee-meetings', { params });
      Logger.info('Response in CommitteeMeetingService.getMeetings:', response);
      // Whole envelope: the caller needs the sibling `pagination` block, not just `data`.
      return response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.getMeetings:', error.message);
      throw error;
    }
  };

  /**
   * Get a single committee meeting by ID
   * @param {number|string} meetingId
   * @returns {Promise<Object>} meeting details
   */
  const getMeeting = async meetingId => {
    try {
      const response = await userClient.get(`/committee-meetings/${meetingId}`);
      Logger.info('Response in CommitteeMeetingService.getMeeting:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.getMeeting:', error.message);
      throw error;
    }
  };

  /**
   * Create a new committee meeting
   * @param {Object} payload - Meeting data with frontend field names:
   *   - title: string (required)
   *   - members: array of user IDs (required)
   *   - chair: user ID (required)
   *   - convenor: user ID (required)
   *   - assessments: array of assessment IDs (optional)
   *   - meetingType: "Online" | "Offline" (required)
   *   - meetingLink: string (required if meetingType is "Online")
   *   - date: date string (required)
   *   - time: time string HH:mm (required)
   *   - remarks: string (optional)
   * @returns {Promise<Object>} created meeting
   */
  const createMeeting = async payload => {
    try {
      const response = await userClient.post('/committee-meetings', payload);
      Logger.info('Response in CommitteeMeetingService.createMeeting:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.createMeeting:', error.message);
      throw error;
    }
  };

  /**
   * Update a committee meeting
   * @param {number|string} meetingId
   * @param {Object} payload - Meeting data with frontend field names
   * @returns {Promise<Object>} updated meeting
   */
  const updateMeeting = async (meetingId, payload) => {
    try {
      const response = await userClient.put(`/committee-meetings/${meetingId}`, payload);
      Logger.info('Response in CommitteeMeetingService.updateMeeting:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.updateMeeting:', error.message);
      throw error;
    }
  };

  /**
   * Cancel a committee meeting
   * @param {number|string} meetingId
   * @param {Object} payload - { reason: string }
   * @returns {Promise<Object>}
   */
  const cancelMeeting = async (meetingId, payload) => {
    try {
      const response = await userClient.post(`/committee-meetings/${meetingId}/cancel`, payload);
      Logger.info('Response in CommitteeMeetingService.cancelMeeting:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.cancelMeeting:', error.message);
      throw error;
    }
  };

  /**
   * Start a committee meeting
   * @param {number|string} meetingId
   * @returns {Promise<Object>} updated meeting
   */
  const startMeeting = async meetingId => {
    try {
      const response = await userClient.post(`/committee-meetings/${meetingId}/start`, null, LONG_WRITE_REQUEST);
      Logger.info('Response in CommitteeMeetingService.startMeeting:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.startMeeting:', error.message);
      throw error;
    }
  };

  /**
   * Complete a committee meeting
   * @param {number|string} meetingId
   * @param {Object} payload - { minutes, summary }
   * @returns {Promise<Object>} updated meeting
   */
  const completeMeeting = async (meetingId, payload = {}) => {
    try {
      const response = await userClient.post(`/committee-meetings/${meetingId}/complete`, payload, LONG_WRITE_REQUEST);
      Logger.info('Response in CommitteeMeetingService.completeMeeting:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.completeMeeting:', error.message);
      throw error;
    }
  };

  const getMembers = async meetingId => {
    try {
      const response = await userClient.get(`/committee-meetings/${meetingId}/members`);
      Logger.info('Response in CommitteeMeetingService.getMembers:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.getMembers:', error.message);
      throw error;
    }
  };

  /**
   * Add a member to a committee meeting
   * @param {number|string} meetingId
   * @param {Object} payload
   * @returns {Promise<Object>} created member
   */
  const addMember = async (meetingId, payload) => {
    try {
      const response = await userClient.post(`/committee-meetings/${meetingId}/members`, payload);
      Logger.info('Response in CommitteeMeetingService.addMember:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.addMember:', error.message);
      throw error;
    }
  };

  const updateMember = async (meetingId, memberId, payload) => {
    try {
      const response = await userClient.put(`/committee-meetings/${meetingId}/members/${memberId}`, payload);
      Logger.info('Response in CommitteeMeetingService.updateMember:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.updateMember:', error.message);
      throw error;
    }
  };

  const deleteMember = async (meetingId, memberId) => {
    try {
      const response = await userClient.delete(`/committee-meetings/${meetingId}/members/${memberId}`);
      Logger.info('Response in CommitteeMeetingService.deleteMember:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in CommitteeMeetingService.deleteMember:', error.message);
      throw error;
    }
  };

  return {
    getMeetings,
    getMeeting,
    createMeeting,
    updateMeeting,
    cancelMeeting,
    startMeeting,
    completeMeeting,
    getMembers,
    addMember,
    updateMember,
    deleteMember,
  };
};

export default CommitteeMeetingService;
