import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.SystemSettingsService;

// --- Convenience getters/updaters for specific keys ---
// DRDO approval
export const getDrdoApprovalSettingByKeyAction = createAsyncThunk('systemSettings/getDrdoApproval', async (data, { rejectWithValue }) => {
  try {
    const response = await service.get(data);
    Logger.info('Get DRDO approval setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get DRDO approval setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateDrdoApprovalSettingAction = createAsyncThunk('systemSettings/updateDrdoApproval', async (data, { rejectWithValue }) => {
  try {
    const response = await service.update(data);
    Logger.info('Update DRDO approval setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update DRDO approval setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Certificate validity
export const getCertificateValiditySettingByKeyAction = createAsyncThunk('systemSettings/getCertificateValidity', async (data, { rejectWithValue }) => {
  try {
    const response = await service.get(data);
    Logger.info('Get certificate validity setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get certificate validity setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateCertificateValiditySettingAction = createAsyncThunk('systemSettings/updateCertificateValidity', async (data, { rejectWithValue }) => {
  try {
    const response = await service.update(data);
    Logger.info('Update certificate validity setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update certificate validity setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Recertification window
export const getRecertificationWindowSettingByKeyAction = createAsyncThunk('systemSettings/getRecertWindow', async (data, { rejectWithValue }) => {
  try {
    const response = await service.get(data);
    Logger.info('Get recertification window setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get recertification window setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateRecertificationWindowSettingAction = createAsyncThunk('systemSettings/updateRecertWindow', async (data, { rejectWithValue }) => {
  try {
    const response = await service.update(data);
    Logger.info('Update recertification window setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update recertification window setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Application submission open
export const getApplicationSubmissionSettingByKeyAction = createAsyncThunk('systemSettings/getApplicationSubmission', async (data, { rejectWithValue }) => {
  try {
    const response = await service.get(data);
    Logger.info('Get application submission setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get application submission setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateApplicationSubmissionSettingAction = createAsyncThunk('systemSettings/updateApplicationSubmission', async (data, { rejectWithValue }) => {
  try {
    const response = await service.update(data);
    Logger.info('Update application submission setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update application submission setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Maintenance mode
export const getMaintenanceModeSettingByKeyAction = createAsyncThunk('systemSettings/getMaintenanceMode', async (data, { rejectWithValue }) => {
  try {
    const response = await service.get(data);
    Logger.info('Get maintenance mode setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get maintenance mode setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateMaintenanceModeSettingAction = createAsyncThunk('systemSettings/updateMaintenanceMode', async (data, { rejectWithValue }) => {
  try {
    const response = await service.update(data);
    Logger.info('Update maintenance mode setting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update maintenance mode setting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
