import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination';

const ApplicationFeedbackService = () => {
  // Get applications that are pending feedback
  const getApplicationsForFeedback = async (params = {}) => {
    try {
      const queryString = buildPaginationParams(params);
      const url = `/applications/feedback-pending${queryString}`;
      const response = await userClient.get(url);
      Logger.info('Response in ApplicationFeedbackService.getApplicationsForFeedback:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationFeedbackService.getApplicationsForFeedback:', error.message);
      throw error;
    }
  };

  // Get applications with submitted feedback (admin listing)
  const getSubmittedFeedback = async (params = {}) => {
    try {
      const queryString = buildPaginationParams(params);
      const url = `/applications/feedback-submissions${queryString}`;
      const response = await userClient.get(url);
      Logger.info('Response in ApplicationFeedbackService.getSubmittedFeedback:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationFeedbackService.getSubmittedFeedback:', error.message);
      throw error;
    }
  };

  // Get feedback form with questions and existing answers for an application
  const getFeedbackForm = async applicationId => {
    try {
      const response = await userClient.get(`/applications/${applicationId}/feedbacks/form`);
      Logger.info('Response in ApplicationFeedbackService.getFeedbackForm:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationFeedbackService.getFeedbackForm:', error.message);
      throw error;
    }
  };

  // Get all feedbacks for an application with pagination
  const getFeedbacks = async (applicationId, params = {}) => {
    try {
      const response = await userClient.get(`/applications/${applicationId}/feedbacks`, { params });
      Logger.info('Response in ApplicationFeedbackService.getFeedbacks:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationFeedbackService.getFeedbacks:', error.message);
      throw error;
    }
  };

  // Export all submitted feedback as CSV (wide pivot, dynamic per-question columns)
  const exportSubmittedFeedback = async (params = {}) => {
    try {
      const queryString = buildPaginationParams(params);
      const url = `/applications/feedback-submissions/export${queryString}`;
      const response = await userClient.get(url, { responseType: 'text' });
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationFeedbackService.exportSubmittedFeedback:', error.message);
      throw error;
    }
  };

  // Export a single application's feedback answers as CSV
  const exportApplicationFeedbacks = async applicationId => {
    try {
      const response = await userClient.get(`/applications/${applicationId}/feedbacks/export`, { responseType: 'text' });
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationFeedbackService.exportApplicationFeedbacks:', error.message);
      throw error;
    }
  };

  // Submit a single feedback
  const submitFeedback = async (applicationId, data) => {
    try {
      const response = await userClient.post(`/applications/${applicationId}/feedbacks`, data);
      Logger.info('Response in ApplicationFeedbackService.submitFeedback:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationFeedbackService.submitFeedback:', error.message);
      throw error;
    }
  };

  // Submit multiple feedbacks at once (bulk submit)
  const submitBulkFeedback = async (applicationId, feedbacks, remarks = null) => {
    try {
      const payload = { feedbacks };
      if (remarks) {
        payload.remarks = remarks;
      }
      const response = await userClient.post(`/applications/${applicationId}/feedbacks/submit`, payload);
      Logger.info('Response in ApplicationFeedbackService.submitBulkFeedback:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationFeedbackService.submitBulkFeedback:', error.message);
      throw error;
    }
  };

  return {
    getApplicationsForFeedback,
    getSubmittedFeedback,
    getFeedbackForm,
    getFeedbacks,
    exportSubmittedFeedback,
    exportApplicationFeedbacks,
    submitFeedback,
    submitBulkFeedback,
  };
};

export default ApplicationFeedbackService;
