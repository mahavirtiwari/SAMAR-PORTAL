import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.SystemAdminDisciplines;

// Get all disciplines
export const getDisciplinesAction = createAsyncThunk('disciplines/getAll', async (params, { rejectWithValue }) => {
  try {
    const response = await service.getDisciplines(params);
    Logger.info('Get disciplines successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get disciplines failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get discipline by ID
export const getDisciplineByIdAction = createAsyncThunk('disciplines/getBy', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getDisciplineById(id);
    Logger.info('Get discipline by ID successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get discipline by ID failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Create discipline
export const createDisciplineAction = createAsyncThunk('disciplines/create', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Create discipline attempt:', { data });
    const response = await service.createDiscipline(data);
    Logger.info('Create discipline successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create discipline failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Update discipline
export const updateDisciplineAction = createAsyncThunk('disciplines/update', async (data, { rejectWithValue }) => {
  try {
    const response = await service.updateDiscipline(data);
    Logger.info('Update discipline successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update discipline failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Delete discipline
export const deleteDisciplineAction = createAsyncThunk('disciplines/delete', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Delete discipline attempt:', { id });
    const response = await service.deleteDiscipline(id);
    Logger.info('Delete discipline successful:', response);
    return response;
  } catch (error) {
    Logger.error('Delete discipline failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Activate discipline
export const activateDisciplineAction = createAsyncThunk('disciplines/activate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.activateDiscipline(id);
    Logger.info('Activate discipline successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate discipline failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Deactivate discipline
export const deactivateDisciplineAction = createAsyncThunk('disciplines/deactivate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.deactivateDiscipline(id);
    Logger.info('Deactivate discipline successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate discipline failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Export disciplines
export const exportDisciplinesAction = createAsyncThunk('disciplines/export', async (params, { rejectWithValue }) => {
  try {
    const response = await service.exportDisciplines(params);
    Logger.info('Export disciplines successful:', response);
    return response;
  } catch (error) {
    Logger.error('Export disciplines failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
