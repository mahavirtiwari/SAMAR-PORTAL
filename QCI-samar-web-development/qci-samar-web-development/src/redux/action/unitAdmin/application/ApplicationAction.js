import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../../services/api';
import { Logger } from '../../../../utils/logger';

const service = Api.UnitAdminApplication;
// Get all users
export const getApplicationAction = createAsyncThunk('unitAdmin/applications', async (data, { rejectWithValue }) => {
  try {
    const response = await service.getApplication(data);
    Logger.info('Get Application successful:', response);
    return response;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// create new service application
export const createServiceApplicationAction = createAsyncThunk('unitAdmin/createServiceApplication', async (applicationData, { rejectWithValue }) => {
  try {
    Logger.info('Create application attempt:', { applicationData });
    const response = await service.createServiceApplicationDraft(applicationData);
    Logger.info('Create application successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create application failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
// create new manufacturing application
export const createManufacturingApplicationAction = createAsyncThunk('unitAdmin/createManufacturingApplication', async (applicationData, { rejectWithValue }) => {
  try {
    Logger.info('Create application attempt:', { applicationData });
    const response = await service.createManufacturingApplication(applicationData);
    Logger.info('Create application successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create application failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Background per-field autosave — same draft endpoint, separate loading flag so
// the wizard's Save button never flickers while a blur-save is in flight.
export const autosaveManufacturingApplicationAction = createAsyncThunk('unitAdmin/autosaveManufacturingApplication', async (applicationData, { rejectWithValue }) => {
  try {
    const response = await service.createManufacturingApplication(applicationData);
    return response;
  } catch (error) {
    Logger.error('Autosave manufacturing draft failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Background per-field autosave — same draft endpoint, separate loading flag so
// the wizard's Save button never flickers while a blur-save is in flight.
export const autosaveServiceApplicationAction = createAsyncThunk('unitAdmin/autosaveServiceApplication', async (applicationData, { rejectWithValue }) => {
  try {
    const response = await service.createServiceApplicationDraft(applicationData);
    return response;
  } catch (error) {
    Logger.error('Autosave service draft failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const submitManufacturingApplicationAction = createAsyncThunk('unitAdmin/submitManufacturingApplication', async (applicationId, { rejectWithValue }) => {
  try {
    Logger.info('Submit manufacturing application attempt:', { applicationId });
    const response = await service.submitManufacturingApplication(applicationId);
    Logger.info('Submit manufacturing application successful:', response);
    return response;
  } catch (error) {
    Logger.error('Submit manufacturing application failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// submit service application
export const submitServiceApplicationAction = createAsyncThunk('unitAdmin/submitServiceApplication', async (applicationId, { rejectWithValue }) => {
  try {
    Logger.info('Submit service application attempt:', { applicationId });
    const response = await service.submitServiceApplication(applicationId);
    Logger.info('Submit service application successful:', response);
    return response;
  } catch (error) {
    Logger.error('Submit service application failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// get application details
// Live GSTIN consistency check (GST-field blur). Returns the response body { success, message, data: { valid, errorCode, message } }.
export const validateGstinAction = createAsyncThunk('unitAdmin/validateGstin', async (gstNumber, { rejectWithValue }) => {
  try {
    return await service.validateGstin(gstNumber);
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getApplicationDetailsAction = createAsyncThunk('unitAdmin/getApplicationDetails', async (applicationId, { rejectWithValue }) => {
  try {
    Logger.info('Get application details attempt:', { applicationId });
    const response = await service.getApplicationDetails(applicationId);
    Logger.info('Get application details successful:', response);
    return response?.data;
  } catch (error) {
    Logger.error('Get application details failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// update application
export const updateApplicationAction = createAsyncThunk('unitAdmin/updateApplication', async ({ applicationId, applicationData }, { rejectWithValue }) => {
  try {
    Logger.info('Update application attempt:', { applicationId, applicationData });
    const response = await service.updateApplication(applicationId, applicationData);
    Logger.info('Update application successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update application failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// delete application
export const deleteApplicationAction = createAsyncThunk('unitAdmin/deleteApplication', async (applicationId, { rejectWithValue }) => {
  try {
    Logger.info('Delete application attempt:', { applicationId });
    const response = await service.deleteApplication(applicationId);
    Logger.info('Delete application successful:', response);
    return response;
  } catch (error) {
    Logger.error('Delete application failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// submit application for review
export const submitApplicationForReviewAction = createAsyncThunk('unitAdmin/submitApplicationForReview', async (applicationId, { rejectWithValue }) => {
  try {
    Logger.info('Submit application for review attempt:', { applicationId });
    const response = await service.submitApplicationForReview(applicationId);
    Logger.info('Submit application for review successful:', response);
    return response;
  } catch (error) {
    Logger.error('Submit application for review failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// get available workflow transitions

// execute workflow transition
export const executeWorkflowTransitionAction = createAsyncThunk('unitAdmin/executeWorkflowTransition', async ({ applicationId, transitionData }, { rejectWithValue }) => {
  try {
    Logger.info('Execute workflow transition attempt:', { applicationId, transitionData });
    const response = await service.executeWorkflowTransition(applicationId, transitionData);
    Logger.info('Execute workflow transition successful:', response);
    return response;
  } catch (error) {
    Logger.error('Execute workflow transition failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// get assessment summary (site tour, basic info, evidences)
export const getAssessmentSummaryAction = createAsyncThunk('unitAdmin/getAssessmentSummary', async (applicationId, { rejectWithValue }) => {
  try {
    Logger.info('Get assessment summary attempt:', { applicationId });
    const response = await service.getAssessmentSummary(applicationId);
    Logger.info('Get assessment summary successful:', response);
    return response?.data;
  } catch (error) {
    Logger.error('Get assessment summary failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// set preferred assessment date
export const setPreferredAssessmentDateAction = createAsyncThunk('unitAdmin/setPreferredAssessmentDate', async ({ applicationId, preferredAssessmentDate }, { rejectWithValue }) => {
  try {
    Logger.info('Set preferred assessment date attempt:', { applicationId, preferredAssessmentDate });
    const response = await service.setPreferredAssessmentDate(applicationId, preferredAssessmentDate);
    Logger.info('Set preferred assessment date successful:', response);
    return response;
  } catch (error) {
    Logger.error('Set preferred assessment date failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
