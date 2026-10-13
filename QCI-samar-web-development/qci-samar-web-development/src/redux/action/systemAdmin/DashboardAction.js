import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.SystemAdminDashboard;

/**
 * Get System Admin dashboard data
 * Fetches summary cards, enterprise distribution, certified vendors, assessment status flow,
 * user distribution, and state-wise vendors data
 */
export const getSystemAdminDashboardAction = createAsyncThunk('systemAdminDashboard/get', async (_, { rejectWithValue }) => {
  try {
    const response = await service.getDashboard();
    Logger.info('Get system admin dashboard successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get system admin dashboard failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
