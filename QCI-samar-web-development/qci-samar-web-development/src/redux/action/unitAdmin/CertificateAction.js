import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.UnitAdminCertificate;

/**
 * Get all certificates with optional filters
 */
export const getCertificatesAction = createAsyncThunk('unitAdmin/certificates/getAll', async (params, { rejectWithValue }) => {
  try {
    const response = await service.getCertificates(params);
    Logger.info('Get Certificates successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get Certificates failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

/**
 * Get certificate by ID
 */
export const getCertificateByIdAction = createAsyncThunk('unitAdmin/certificates/getById', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getCertificateById(id);
    Logger.info('Get Certificate by ID successful:', response);
    return response?.data;
  } catch (error) {
    Logger.error('Get Certificate by ID failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

/**
 * Download certificate document
 */
export const downloadCertificateDocumentAction = createAsyncThunk('unitAdmin/certificates/downloadDocument', async (documentId, { rejectWithValue }) => {
  try {
    const response = await service.downloadDocument(documentId);
    Logger.info('Download Certificate Document successful');
    return response;
  } catch (error) {
    Logger.error('Download Certificate Document failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
