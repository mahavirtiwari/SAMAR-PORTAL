import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.ApplicationExport;

// One export thunk for every applications list screen. The endpoint scopes the rows
// to the caller's own role, so the per-role screens need no variants of this.
export const exportApplicationsAction = createAsyncThunk('applications/export', async (filters = {}, { rejectWithValue }) => {
  try {
    return await service.exportApplications(filters);
  } catch (error) {
    Logger.error('Export applications failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
