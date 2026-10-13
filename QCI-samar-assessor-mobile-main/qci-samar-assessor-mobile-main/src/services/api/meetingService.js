import { Logger } from '../../utils';
import { logApiError } from '../../utils/apiErrorLog';
import { UPLOAD_TIMEOUT } from './clients/userClient';

const MeetingService = (userClient) => {
  const getMeetingDetails = async (val) => {
    try {
      const response = await userClient.get(
        `application-assessments/${val.assessmentId}/meetings/opening`
      );
      Logger.info('Meeting details retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('MeetingService.getMeetingDetails', error);
      throw error;
    }
  };
  const getClosingMeetingDetails = async (val) => {
    try {
      const response = await userClient.get(
        `application-assessments/${val.assessmentId}/meetings/closing`
      );
      Logger.info('Meeting details retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('MeetingService.getMeetingDetails', error);
      throw error;
    }
  };

  const createMeeting = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/meetings/opening`,
        val.formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: UPLOAD_TIMEOUT
        }
      );
      Logger.info('Meeting created successfully');
      return response.data;
    } catch (error) {
      logApiError('MeetingService.createMeeting', error);
      throw error;
    }
  };

  const closingMeeting = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/meetings/closing`,
        val.formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: UPLOAD_TIMEOUT
        }
      );
      Logger.info('Meeting ended successfully');
      return response.data;
    } catch (error) {
      logApiError('MeetingService.closingMeeting', error);
      throw error;
    }
  };

  const addExternalParticipant = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/meetings/${val.type}/participants`,
        val.data
      );
      Logger.info('External participant added successfully');
      return response.data;
    } catch (error) {
      logApiError('MeetingService.addExternalParticipant', error);
      throw error;
    }
  };

  const deleteExternalParticipant = async (val) => {
    try {
      const response = await userClient.delete(
        `application-assessments/${val.assessmentId}/meetings/${val.type}/participants/${val.participantId}`
      );
      Logger.info('External participant deleted successfully');
      return response.data;
    } catch (error) {
      logApiError('MeetingService.deleteExternalParticipant', error);
      throw error;
    }
  };

  // POST is the comment upsert: the backend creates the team member's comment
  // if absent and updates it if present (idempotent, built for offline replay).
  // PUT only edits an existing comment and 404s on a first-time submission.
  const addComment = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/meetings/${val.type}/comments`,
        val.data
      );
      Logger.info('Comment saved successfully');
      return response.data;
    } catch (error) {
      logApiError('MeetingService.addComment', error);
      throw error;
    }
  };

  return {
    getMeetingDetails,
    createMeeting,
    addExternalParticipant,
    deleteExternalParticipant,
    addComment,
    closingMeeting,
    getClosingMeetingDetails
  };
};
export default MeetingService;
