import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.Payment;

// One export thunk for every Payment History screen. The endpoint scopes the rows
// to the caller's own role, so the five per-role screens need no variants of this.
export const exportPaymentsAction = createAsyncThunk('payments/export', async (filters = {}, { rejectWithValue }) => {
  try {
    return await service.exportPayments(filters);
  } catch (error) {
    Logger.error('Export payments failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
