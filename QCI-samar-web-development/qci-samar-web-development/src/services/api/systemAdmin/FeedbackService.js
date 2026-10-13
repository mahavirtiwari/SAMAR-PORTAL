import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination';

const SystemAdminFeedbackService = () => {
  // Get all feedback questions
  const getFeedbackQuestions = async (filters = {}) => {
    try {
      const queryString = buildPaginationParams(filters);
      const response = await userClient.get(`/feedback-questions${queryString}`);
      Logger.info('Response in FeedbackService.getFeedbackQuestions:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in FeedbackService.getFeedbackQuestions:', error.message);
      throw error;
    }
  };

  // Get feedback question by ID
  const getFeedbackQuestionById = async id => {
    try {
      const response = await userClient.get(`/feedback-questions/${id}`);
      Logger.info('Response in FeedbackService.getFeedbackQuestionById:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in FeedbackService.getFeedbackQuestionById:', error.message);
      throw error;
    }
  };

  // Create feedback question
  const createFeedbackQuestion = async data => {
    try {
      const response = await userClient.post('/feedback-questions', data);
      Logger.info('Response in FeedbackService.createFeedbackQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in FeedbackService.createFeedbackQuestion:', error.message);
      throw error;
    }
  };

  // Update feedback question
  const updateFeedbackQuestion = async data => {
    try {
      const response = await userClient.put(`/feedback-questions/${data.id}`, data);
      Logger.info('Response in FeedbackService.updateFeedbackQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in FeedbackService.updateFeedbackQuestion:', error.message);
      throw error;
    }
  };

  // Activate feedback question
  const activateFeedbackQuestion = async id => {
    try {
      const response = await userClient.post(`/feedback-questions/${id}/activate`);
      Logger.info('Response in FeedbackService.activateFeedbackQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in FeedbackService.activateFeedbackQuestion:', error.message);
      throw error;
    }
  };

  // Deactivate feedback question
  const deactivateFeedbackQuestion = async id => {
    try {
      const response = await userClient.post(`/feedback-questions/${id}/deactivate`);
      Logger.info('Response in FeedbackService.deactivateFeedbackQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in FeedbackService.deactivateFeedbackQuestion:', error.message);
      throw error;
    }
  };

  return {
    getFeedbackQuestions,
    getFeedbackQuestionById,
    createFeedbackQuestion,
    updateFeedbackQuestion,
    activateFeedbackQuestion,
    deactivateFeedbackQuestion,
  };
};

export default SystemAdminFeedbackService;
