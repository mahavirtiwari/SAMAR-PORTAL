import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.Organizations;

export const getAllOrganizationsAction = createAsyncThunk('organization', async (organizationId, { rejectWithValue }) => {
  try {
    const response = await service.getAllOrganizations(organizationId?.organizationId);
    Logger.info('Get all organizations successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get all organizations failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Update organization
export const updateOrganizationAction = createAsyncThunk('updateorganization', async (organizationData, { rejectWithValue }) => {
  try {
    Logger.info('Update organization attempt:', { organizationData });
    const response = await service.updateOrganization(organizationData);
    Logger.info('Update organization successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update organization failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
