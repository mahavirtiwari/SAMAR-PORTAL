import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.SystemAdminFeeConfig;

// Get all fee configurations
export const getFeeConfigurationsAction = createAsyncThunk('feeConfigurations/getAll', async (_, { rejectWithValue }) => {
  try {
    const response = await service.getFeeConfigurations();
    Logger.info('Get fee configurations successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get fee configurations failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get fee configuration by ID
export const getFeeConfigurationByIdAction = createAsyncThunk('feeConfigurations/getById', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getFeeConfigurationById(id);
    Logger.info('Get fee configuration by ID successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get fee configuration by ID failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Create fee configuration
export const createFeeConfigurationAction = createAsyncThunk('feeConfigurations/create', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Create fee configuration attempt:', { data });
    const response = await service.createFeeConfiguration(data);
    Logger.info('Create fee configuration successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create fee configuration failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Update fee configuration
export const updateFeeConfigurationAction = createAsyncThunk('feeConfigurations/update', async (data, { rejectWithValue }) => {
  try {
    const response = await service.updateFeeConfiguration(data);
    Logger.info('Update fee configuration successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update fee configuration failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Delete fee configuration
export const deleteFeeConfigurationAction = createAsyncThunk('feeConfigurations/delete', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Delete fee configuration attempt:', { id });
    const response = await service.deleteFeeConfiguration(id);
    Logger.info('Delete fee configuration successful:', response);
    return response;
  } catch (error) {
    Logger.error('Delete fee configuration failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
