import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../../services/api';
import { Logger } from '../../../../utils/logger';

/**
 * Get the read-only integration & system-job failure feed (System Admin only).
 */
export const getIntegrationFailuresAction = createAsyncThunk('systemAdmin/integrationFailure/getList', async (filters, { rejectWithValue }) => {
  try {
    Logger.info('Get integration failures attempt:', filters);
    const response = await Api.SystemAdminIntegrationFailure.getIntegrationFailures(filters);
    return response;
  } catch (error) {
    Logger.error('Get integration failures failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

/**
 * Get the category filter options for the monitor dropdown (System Admin only).
 */
export const getIntegrationFailureCategoriesAction = createAsyncThunk('systemAdmin/integrationFailure/getCategories', async (_, { rejectWithValue }) => {
  try {
    const response = await Api.SystemAdminIntegrationFailure.getCategories();
    return response;
  } catch (error) {
    Logger.error('Get integration failure categories failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
