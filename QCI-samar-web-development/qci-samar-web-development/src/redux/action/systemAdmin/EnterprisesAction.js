import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.SystemAdminEnterprises;

// Get all organizations
export const getOrganizationsAction = createAsyncThunk('enterprises/getAll', async (data, { rejectWithValue }) => {
  try {
    const response = await service.getOrganizations(data);
    Logger.info('Get organizations successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get organizations failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get organization by ID
export const getOrganizationByIdAction = createAsyncThunk('enterprises/getById', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getOrganizationById(id);
    Logger.info('Get organization by ID successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get organization by ID failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Export organizations
export const exportOrganizationsAction = createAsyncThunk('enterprises/export', async (_, { rejectWithValue }) => {
  try {
    const response = await service.exportOrganizations();
    Logger.info('Export organizations successful:', response);
    return response;
  } catch (error) {
    Logger.error('Export organizations failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Activate organization
export const activateOrganizationAction = createAsyncThunk('enterprises/activate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.activateOrganization(id);
    Logger.info('Activate organization successful:', response);
    return { id, response };
  } catch (error) {
    Logger.error('Activate organization failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Deactivate organization
export const deactivateOrganizationAction = createAsyncThunk('enterprises/deactivate', async ({ id, reason }, { rejectWithValue }) => {
  try {
    const response = await service.deactivateOrganization(id, reason);
    Logger.info('Deactivate organization successful:', response);
    return { id, response };
  } catch (error) {
    Logger.error('Deactivate organization failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
