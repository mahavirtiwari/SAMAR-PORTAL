import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.SystemAdminAssessmentParameter;

// Get all assessment parameters
export const getAssessmentParametersAction = createAsyncThunk('assessmentParameters/getAll', async (params, { rejectWithValue }) => {
  try {
    const response = await service.getAssessmentParameters(params);
    Logger.info('Get assessment parameters successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessment parameters failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get assessment parameter by ID
export const getAssessmentParameterByIdAction = createAsyncThunk('assessmentParameters/getById', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getAssessmentParameterById(id);
    Logger.info('Get assessment parameter by ID successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessment parameter by ID failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Create assessment parameter
export const createAssessmentParameterAction = createAsyncThunk('assessmentParameters/create', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Create assessment parameter attempt:', { data });
    const response = await service.createAssessmentParameter(data);
    Logger.info('Create assessment parameter successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create assessment parameter failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Update assessment parameter
export const updateAssessmentParameterAction = createAsyncThunk('assessmentParameters/update', async (data, { rejectWithValue }) => {
  try {
    const response = await service.updateAssessmentParameter(data);
    Logger.info('Update assessment parameter successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update assessment parameter failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Delete assessment parameter
export const deleteAssessmentParameterAction = createAsyncThunk('assessmentParameters/delete', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Delete assessment parameter attempt:', { id });
    const response = await service.deleteAssessmentParameter(id);
    Logger.info('Delete assessment parameter successful:', response);
    return response;
  } catch (error) {
    Logger.error('Delete assessment parameter failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Activate assessment parameter
export const activateAssessmentParameterAction = createAsyncThunk('assessmentParameters/activate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.activateAssessmentParameter(id);
    Logger.info('Activate assessment parameter successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate assessment parameter failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Deactivate assessment parameter
export const deactivateAssessmentParameterAction = createAsyncThunk('assessmentParameters/deactivate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.deactivateAssessmentParameter(id);
    Logger.info('Deactivate assessment parameter successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate assessment parameter failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Assessment Question Actions

// Create a new assessment question
export const createAssessmentQuestionAction = createAsyncThunk('assessmentQuestions/create', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Create assessment question attempt:', { data });
    const response = await service.createAssessmentQuestion(data);
    Logger.info('Create assessment question successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create assessment question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get assessment question details with options
export const getAssessmentQuestionDetailsAction = createAsyncThunk('assessmentQuestions/getDetails', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getAssessmentQuestionDetails(id);
    Logger.info('Get assessment question details successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessment question details failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Update an assessment question
export const updateAssessmentQuestionAction = createAsyncThunk('assessmentQuestions/update', async ({ id, data }, { rejectWithValue }) => {
  try {
    const response = await service.updateAssessmentQuestion(id, data);
    Logger.info('Update assessment question successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update assessment question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Soft delete an assessment question
export const deleteAssessmentQuestionAction = createAsyncThunk('assessmentQuestions/delete', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Delete assessment question attempt:', { id });
    const response = await service.deleteAssessmentQuestion(id);
    Logger.info('Delete assessment question successful:', response);
    return response;
  } catch (error) {
    Logger.error('Delete assessment question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get answer options for an assessment question
export const getAssessmentQuestionOptionsAction = createAsyncThunk('assessmentQuestions/getOptions', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getAssessmentQuestionOptions(id);
    Logger.info('Get assessment question options successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessment question options failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Add an answer option to an assessment question
export const addAssessmentQuestionOptionAction = createAsyncThunk('assessmentQuestions/addOption', async ({ id, data }, { rejectWithValue }) => {
  try {
    const response = await service.addAssessmentQuestionOption(id, data);
    Logger.info('Add assessment question option successful:', response);
    return response;
  } catch (error) {
    Logger.error('Add assessment question option failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Update an answer option
export const updateAssessmentQuestionOptionAction = createAsyncThunk('assessmentQuestions/updateOption', async ({ id, optionId, data }, { rejectWithValue }) => {
  try {
    const response = await service.updateAssessmentQuestionOption(id, optionId, data);
    Logger.info('Update assessment question option successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update assessment question option failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Delete an answer option
export const deleteAssessmentQuestionOptionAction = createAsyncThunk('assessmentQuestions/deleteOption', async ({ id, optionId }, { rejectWithValue }) => {
  try {
    const response = await service.deleteAssessmentQuestionOption(id, optionId);
    Logger.info('Delete assessment question option successful:', response);
    return response;
  } catch (error) {
    Logger.error('Delete assessment question option failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Activate assessment question
export const activateAssessmentQuestionAction = createAsyncThunk('assessmentQuestions/activate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.activateAssessmentQuestion(id);
    Logger.info('Activate assessment question successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate assessment question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Deactivate assessment question
export const deactivateAssessmentQuestionAction = createAsyncThunk('assessmentQuestions/deactivate', async (id, { rejectWithValue }) => {
  try {
    const response = await service.deactivateAssessmentQuestion(id);
    Logger.info('Deactivate assessment question successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate assessment question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Activate assessment question option
export const activateAssessmentQuestionOptionAction = createAsyncThunk('assessmentQuestions/activateOption', async ({ id, optionId }, { rejectWithValue }) => {
  try {
    const response = await service.activateAssessmentQuestionOption(id, optionId);
    Logger.info('Activate assessment question option successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate assessment question option failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Deactivate assessment question option
export const deactivateAssessmentQuestionOptionAction = createAsyncThunk('assessmentQuestions/deactivateOption', async ({ id, optionId }, { rejectWithValue }) => {
  try {
    const response = await service.deactivateAssessmentQuestionOption(id, optionId);
    Logger.info('Deactivate assessment question option successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate assessment question option failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get questions for a specific assessment parameter
export const getAssessmentParameterQuestionsAction = createAsyncThunk('assessmentParameters/getQuestions', async (parameterId, { rejectWithValue }) => {
  try {
    const response = await service.getAssessmentParameterQuestions(parameterId);
    Logger.info('Get assessment parameter questions successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessment parameter questions failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Export assessment parameters
export const exportAssessmentParametersAction = createAsyncThunk('assessmentParameters/export', async (params, { rejectWithValue }) => {
  try {
    const response = await service.exportAssessmentParameters(params);
    Logger.info('Export assessment parameters successful:', response);
    return response;
  } catch (error) {
    Logger.error('Export assessment parameters failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// A responseless failure (timeout / dropped connection) leaves a non-idempotent bulk operation's
// outcome unknown — surface an honest message instead of the bare "Network Error", and never imply
// it definitely failed. When the server did respond, pass its structured error through unchanged.
const normalizeBulkUploadError = error => {
  if (error?.response?.data) {
    return error.response.data;
  }
  if (error?.code === 'ECONNABORTED') {
    return { message: 'The server took too long to respond. The file may still be processing — refresh and verify the parameters before retrying.' };
  }
  if (!error?.response) {
    return { message: 'The connection to the server dropped before it could respond. The update may or may not have been applied — refresh and verify the parameters before retrying.' };
  }
  return error?.message ?? 'An unknown error occurred';
};

// Bulk import assessment parameters
export const bulkImportAssessmentParametersAction = createAsyncThunk('assessmentParameters/bulkImport', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Bulk import assessment parameters attempt:', { data });
    const response = await service.bulkImportAssessmentParameters(data);
    Logger.info('Bulk import assessment parameters successful:', response);
    return response;
  } catch (error) {
    Logger.error('Bulk import assessment parameters failed:', error);
    return rejectWithValue(normalizeBulkUploadError(error));
  }
});

// Bulk update assessment parameters
export const bulkUpdateAssessmentParametersAction = createAsyncThunk('assessmentParameters/bulkUpdate', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Bulk update assessment parameters attempt:', { data });
    const response = await service.bulkUpdateAssessmentParameters(data);
    Logger.info('Bulk update assessment parameters successful:', response);
    return response;
  } catch (error) {
    Logger.error('Bulk update assessment parameters failed:', error);
    return rejectWithValue(normalizeBulkUploadError(error));
  }
});
