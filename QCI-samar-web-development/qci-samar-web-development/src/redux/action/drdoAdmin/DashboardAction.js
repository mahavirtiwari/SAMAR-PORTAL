import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.DRDOAdminDashboard;

/**
 * Get DRDO Admin dashboard data
 * Fetches summary cards, charts, recent certificates, payment summary, and quick actions
 */
export const getDRDOAdminDashboardAction = createAsyncThunk('drdoAdminDashboard/get', async (_, { rejectWithValue }) => {
  try {
    const response = await service.getDashboard();
    Logger.info('Get DRDO admin dashboard successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get DRDO admin dashboard failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
