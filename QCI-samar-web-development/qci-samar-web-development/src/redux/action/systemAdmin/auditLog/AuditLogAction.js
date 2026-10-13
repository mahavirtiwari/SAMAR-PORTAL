import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../../services/api';
import { Logger } from '../../../../utils/logger';

/**
 * Get the full audit/activity trail with filters (System Admin only) —
 * data changes, authentication, and security events.
 */
export const getAuditLogsAction = createAsyncThunk('systemAdmin/auditLog/getList', async (filters, { rejectWithValue }) => {
  try {
    Logger.info('Get activity logs attempt:', filters);
    const response = await Api.SystemAdminAuditLog.getActivityLogs(filters);
    return response;
  } catch (error) {
    Logger.error('Get activity logs failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
