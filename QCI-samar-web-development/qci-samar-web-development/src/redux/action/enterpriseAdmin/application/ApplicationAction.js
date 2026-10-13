import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../../services/api';
import { Logger } from '../../../../utils/logger';

const service = Api.Application;
// Get all users
export const getApplicationAction = createAsyncThunk('applications', async (data, { rejectWithValue }) => {
  try {
    const response = await service.getApplication(data);
    Logger.info('Get Application successful:', response);
    return response;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// create new service application
export const createServiceApplicationAction = createAsyncThunk('createServiceApplication', async (applicationData, { rejectWithValue }) => {
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
export const createManufacturingApplicationAction = createAsyncThunk('createManufacturingApplication', async (applicationData, { rejectWithValue }) => {
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

// Background per-field autosave — same draft endpoints, separate loading flag so
// the wizard's Save button never flickers while a blur-save is in flight.
export const autosaveManufacturingApplicationAction = createAsyncThunk('autosaveManufacturingApplication', async (applicationData, { rejectWithValue }) => {
  try {
    const response = await service.createManufacturingApplication(applicationData);
    return response;
  } catch (error) {
    Logger.error('Autosave manufacturing draft failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const submitManufacturingApplicationAction = createAsyncThunk('submitManufacturingApplication', async (applicationId, { rejectWithValue }) => {
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
export const submitServiceApplicationAction = createAsyncThunk('submitServiceApplication', async (applicationId, { rejectWithValue }) => {
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

// Live GSTIN consistency check (GST-field blur). Returns the response body { success, message, data: { valid, errorCode, message } }.
export const validateGstinAction = createAsyncThunk('validateGstin', async (gstNumber, { rejectWithValue }) => {
  try {
    return await service.validateGstin(gstNumber);
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// get application details
export const getApplicationDetailsAction = createAsyncThunk('getApplicationDetails', async (applicationId, { rejectWithValue }) => {
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

// update contact person
export const updateContactPersonAction = createAsyncThunk('updateContactPerson', async ({ applicationId, applicationData }, { rejectWithValue }) => {
  try {
    Logger.info('Update contact person attempt:', { applicationId, applicationData });
    const response = await service.updateContactPerson(applicationId, applicationData);
    Logger.info('Update contact person successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update contact person failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// delete application
export const deleteApplicationAction = createAsyncThunk('deleteApplication', async (applicationId, { rejectWithValue }) => {
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
export const submitApplicationForReviewAction = createAsyncThunk('submitApplicationForReview', async (applicationId, { rejectWithValue }) => {
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

// renew a certified application (server clones it into a fresh draft)
export const renewApplicationAction = createAsyncThunk('renewApplication', async (applicationId, { rejectWithValue }) => {
  try {
    Logger.info('Renew application attempt:', { applicationId });
    const response = await service.renewApplication(applicationId);
    Logger.info('Renew application successful:', response);
    return response?.data;
  } catch (error) {
    Logger.error('Renew application failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// execute workflow transition (DRDO approve/reject)
export const executeWorkflowTransitionAction = createAsyncThunk('executeWorkflowTransition', async ({ applicationId, transitionData }, { rejectWithValue }) => {
  try {
    Logger.info('Execute workflow transition attempt:', { applicationId, transitionData });

    let response;
    const { action, remarks, reason } = transitionData;

    // Route to the appropriate API endpoint based on action type
    if (action === 'drdo_approve') {
      response = await service.drdoApproveApplication(applicationId, remarks);
    } else if (action === 'drdo_reject') {
      response = await service.drdoRejectApplication(applicationId, reason);
    } else {
      throw new Error(`Unknown workflow action: ${action}`);
    }

    Logger.info('Execute workflow transition successful:', response);
    return response;
  } catch (error) {
    Logger.error('Execute workflow transition failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// get assessment summary (site tour, basic info, evidences)
export const getAssessmentSummaryAction = createAsyncThunk('getAssessmentSummary', async (applicationId, { rejectWithValue }) => {
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
export const setPreferredAssessmentDateAction = createAsyncThunk('setPreferredAssessmentDate', async ({ applicationId, preferredAssessmentDate }, { rejectWithValue }) => {
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
