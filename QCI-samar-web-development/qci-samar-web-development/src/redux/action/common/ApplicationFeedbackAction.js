import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.ApplicationFeedback;

// Get applications that are pending feedback
export const getApplicationsForFeedbackAction = createAsyncThunk('applicationFeedback/getApplications', async (params, { rejectWithValue }) => {
  try {
    const response = await service.getApplicationsForFeedback(params);
    Logger.info('Get applications for feedback successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get applications for feedback failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get applications with submitted feedback (admin listing)
export const getSubmittedFeedbackAction = createAsyncThunk('applicationFeedback/getSubmitted', async (params, { rejectWithValue }) => {
  try {
    const response = await service.getSubmittedFeedback(params);
    Logger.info('Get submitted feedback successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get submitted feedback failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get feedback form with questions and existing answers
export const getFeedbackFormAction = createAsyncThunk('applicationFeedback/getForm', async (applicationId, { rejectWithValue }) => {
  try {
    const response = await service.getFeedbackForm(applicationId);
    Logger.info('Get feedback form successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get feedback form failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get all feedbacks for an application
export const getFeedbacksAction = createAsyncThunk('applicationFeedback/getAll', async ({ applicationId, params }, { rejectWithValue }) => {
  try {
    const response = await service.getFeedbacks(applicationId, params);
    Logger.info('Get feedbacks successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get feedbacks failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Export all submitted feedback as CSV (bulk, wide pivot)
export const exportSubmittedFeedbackAction = createAsyncThunk('applicationFeedback/exportSubmitted', async (params, { rejectWithValue }) => {
  try {
    return await service.exportSubmittedFeedback(params);
  } catch (error) {
    Logger.error('Export submitted feedback failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Export a single application's feedback answers as CSV
export const exportApplicationFeedbacksAction = createAsyncThunk('applicationFeedback/exportSingle', async (applicationId, { rejectWithValue }) => {
  try {
    return await service.exportApplicationFeedbacks(applicationId);
  } catch (error) {
    Logger.error('Export application feedback failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Submit a single feedback
export const submitFeedbackAction = createAsyncThunk('applicationFeedback/submit', async ({ applicationId, data }, { rejectWithValue }) => {
  try {
    const response = await service.submitFeedback(applicationId, data);
    Logger.info('Submit feedback successful:', response);
    return response;
  } catch (error) {
    Logger.error('Submit feedback failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Submit multiple feedbacks at once (bulk submit)
export const submitBulkFeedbackAction = createAsyncThunk('applicationFeedback/submitBulk', async (data, { rejectWithValue }) => {
  try {
    const response = await service.submitBulkFeedback(data.id, data.feedbacks, data.remarks);
    Logger.info('Submit bulk feedback successful:', response);
    return response;
  } catch (error) {
    Logger.error('Submit bulk feedback failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
