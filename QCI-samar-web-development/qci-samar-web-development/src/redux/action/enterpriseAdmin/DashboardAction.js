import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.EnterpriseAdminDashboard;

/**
 * Get Enterprise Admin dashboard data
 * Fetches summary cards (units, active applications, certifications, drafts),
 * active applications list, payment summary, and alerts
 */
export const getEnterpriseAdminDashboardAction = createAsyncThunk('enterpriseAdminDashboard/get', async (_, { rejectWithValue }) => {
  try {
    const response = await service.getDashboard();
    Logger.info('Get enterprise admin dashboard successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get enterprise admin dashboard failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
