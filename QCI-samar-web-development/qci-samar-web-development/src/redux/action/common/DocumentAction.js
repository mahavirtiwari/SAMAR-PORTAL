import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.SystemAdminDocument;

// Get all documents
export const getDocumentsAction = createAsyncThunk('documents/getAll', async (params, { rejectWithValue }) => {
  try {
    const response = await service.getDocuments(params);
    Logger.info('Get documents successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get documents failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const uploadDocumentAction = createAsyncThunk('documents/upload', async (formData, { rejectWithValue }) => {
  try {
    Logger.info('Upload document attempt');
    const response = await service.uploadDocument(formData);
    Logger.info('Upload document successful:', response);
    return response;
  } catch (error) {
    Logger.error('Upload document failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Download document
export const downloadDocumentAction = createAsyncThunk('documents/download', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Download document attempt:', { id });
    const response = await service.downloadDocument(id);
    Logger.info('Download document successful');
    return response;
  } catch (error) {
    Logger.error('Download document failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Activate document
export const activateDocumentAction = createAsyncThunk('documents/activate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.activateDocument(id);
    Logger.info('Activate document successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate document failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Deactivate document
export const deactivateDocumentAction = createAsyncThunk('documents/deactivate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.deactivateDocument(id);
    Logger.info('Deactivate document successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate document failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
