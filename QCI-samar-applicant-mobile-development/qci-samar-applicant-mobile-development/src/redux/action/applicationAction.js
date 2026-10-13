import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../services/api';
import { Logger } from '../../utils/logger';

const getApplications = createAsyncThunk(
  'Application/GetApplications',
  async (params, { rejectWithValue }) => {
    try {
      const response = await Api.ApplicationApi.getApplications(params);
      Logger.info('Applications retrieved successfully');
      return response?.data || [];
    } catch (error) {
      Logger.error('Get applications failed:', error?.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to get applications');
    }
  },
);

const getStepProgress = createAsyncThunk(
  'Application/GetStepProgress',
  async (assessmentId, { rejectWithValue }) => {
    try {
      const response = await Api.ApplicationApi.getStepProgress(assessmentId);
      Logger.info('Step progress retrieved successfully');
      return response;
    } catch (error) {
      Logger.error('Get step progress failed:', error?.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to get step progress');
    }
  },
);

export { getApplications, getStepProgress };
