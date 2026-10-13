import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.SystemAdminFeedback;

// Get all feedback questions
export const getFeedbackQuestionsAction = createAsyncThunk('feedbackQuestions/getAll', async (filters, { rejectWithValue }) => {
  try {
    const response = await service.getFeedbackQuestions(filters);
    Logger.info('Get feedback questions successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get feedback questions failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get feedback question by ID
export const getFeedbackQuestionByIdAction = createAsyncThunk('feedbackQuestions/getById', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getFeedbackQuestionById(id);
    Logger.info('Get feedback question by ID successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get feedback question by ID failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Create feedback question
export const createFeedbackQuestionAction = createAsyncThunk('feedbackQuestions/create', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Create feedback question attempt:', { data });
    const response = await service.createFeedbackQuestion(data);
    Logger.info('Create feedback question successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create feedback question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Update feedback question
export const updateFeedbackQuestionAction = createAsyncThunk('feedbackQuestions/update', async (data, { rejectWithValue }) => {
  try {
    const response = await service.updateFeedbackQuestion(data);
    Logger.info('Update feedback question successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update feedback question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Activate feedback question
export const activateFeedbackQuestionAction = createAsyncThunk('feedbackQuestions/activate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.activateFeedbackQuestion(id);
    Logger.info('Activate feedback question successful:', response);
    return { id, response };
  } catch (error) {
    Logger.error('Activate feedback question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Deactivate feedback question
export const deactivateFeedbackQuestionAction = createAsyncThunk('feedbackQuestions/deactivate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.deactivateFeedbackQuestion(id);
    Logger.info('Deactivate feedback question successful:', response);
    return { id, response };
  } catch (error) {
    Logger.error('Deactivate feedback question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
