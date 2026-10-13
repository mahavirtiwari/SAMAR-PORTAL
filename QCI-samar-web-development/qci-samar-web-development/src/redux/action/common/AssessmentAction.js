// Update clarification feedback (PATCH)

import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.Assessment;

// Get all assessments with optional filters
export const getAssessmentsAction = createAsyncThunk('assessments/getAll', async (params = {}, { rejectWithValue }) => {
  try {
    const response = await service.getAssessments(params);
    Logger.info('Get assessments successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessments failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Start an assessment (scheduled → in_progress)
export const startAssessmentAction = createAsyncThunk('assessments/start', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.startAssessment(assessmentId);
    Logger.info('Start assessment successful:', response);
    return response;
  } catch (error) {
    Logger.error('Start assessment failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get assessment by ID
export const getAssessmentByIdAction = createAsyncThunk('assessments/getById', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getAssessmentById(id);
    Logger.info('Get assessment by ID successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessment by ID failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get all assessment questions
export const getAssessmentQuestionsAction = createAsyncThunk('assessmentQuestions/getAll', async (_, { rejectWithValue }) => {
  try {
    const response = await service.getAssessmentQuestions();
    Logger.info('Get assessment questions successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessment questions failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get assessment question by ID
export const getAssessmentQuestionByIdAction = createAsyncThunk('assessmentQuestions/getById', async (id, { rejectWithValue }) => {
  try {
    const response = await service.getAssessmentQuestionById(id);
    Logger.info('Get assessment question by ID successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessment question by ID failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Post clarification for a question (Assessor) - multipart/form-data
export const postQuestionClarificationAction = createAsyncThunk('assessments/postClarification', async ({ assessmentId, questionId, formData }, { rejectWithValue }) => {
  try {
    Logger.info('Post question clarification attempt:', { assessmentId, questionId });
    const response = await service.postQuestionClarification(assessmentId, questionId, formData);
    Logger.info('Post question clarification successful:', response);
    return response;
  } catch (error) {
    Logger.error('Post question clarification failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
export const updateQuestionClarificationAction = createAsyncThunk('assessments/updateClarification', async ({ assessmentId, questionId, feedbackId, formData }, { rejectWithValue }) => {
  try {
    Logger.info('Update question clarification attempt:', { assessmentId, questionId, feedbackId });
    const response = await service.updateQuestionClarification(assessmentId, questionId, feedbackId, formData);
    Logger.info('Update question clarification successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update question clarification failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
// Schedule assessment (assign assessors and schedule dates)
export const scheduleAssessmentAction = createAsyncThunk('assessments/schedule', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    Logger.info('Schedule assessment attempt:', { assessmentId, data });
    const response = await service.scheduleAssessment(assessmentId, data);
    Logger.info('Schedule assessment successful:', response);
    return response;
  } catch (error) {
    Logger.error('Schedule assessment failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get assessors list
export const getAssessorsAction = createAsyncThunk('assessments/getAssessors', async (params = {}, { rejectWithValue }) => {
  try {
    const response = await service.getAssessors(params);
    Logger.info('Get assessors successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessors failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const submitAssessmentForQcAction = createAsyncThunk('assessments/submitForQc', async ({ assessmentId }, { rejectWithValue }) => {
  try {
    Logger.info('Submit assessment for QC attempt:', { assessmentId });
    const response = await service.submitAssessmentForQc(assessmentId);
    Logger.info('Submit assessment for QC successful:', response);
    return response;
  } catch (error) {
    Logger.error('Submit assessment for QC failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
// Co-assessor web submit — signs off the co-assessor's portion (gates the lead's Submit for QC)
export const coAssessorSubmitAction = createAsyncThunk('assessments/coAssessorSubmit', async ({ assessmentId }, { rejectWithValue }) => {
  try {
    Logger.info('Co-assessor submit attempt:', { assessmentId });
    const response = await service.coAssessorSubmit(assessmentId);
    Logger.info('Co-assessor submit successful:', response);
    return response;
  } catch (error) {
    Logger.error('Co-assessor submit failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// QC Decision (Operations Manager - approve for committee or provide feedback)
export const qcDecisionAction = createAsyncThunk('assessments/qcDecision', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    Logger.info('QC Decision attempt:', { assessmentId, data });
    const response = await service.qcDecision(assessmentId, data);
    Logger.info('QC Decision successful:', response);
    return response;
  } catch (error) {
    Logger.error('QC Decision failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Committee decision (Operations / Committee - certify or provide feedback)
export const committeeDecisionAction = createAsyncThunk('assessments/committeeDecision', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    Logger.info('Committee decision attempt:', { assessmentId, data });
    const response = await service.committeeDecision(assessmentId, data);
    Logger.info('Committee decision successful:', response);
    return response;
  } catch (error) {
    Logger.error('Committee decision failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Bulk update RC scores (Operations Admin)
export const updateRcScoresAction = createAsyncThunk('assessments/updateRcScores', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    Logger.info('Update RC scores attempt:', { assessmentId, data });
    const response = await service.updateRcScores(assessmentId, data);
    Logger.info('Update RC scores successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update RC scores failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Resubmit assessment for QC after addressing feedback (Assessor)
export const resubmitForQcAction = createAsyncThunk('assessments/resubmitForQc', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    Logger.info('Resubmit for QC attempt:', { assessmentId, data });
    const response = await service.resubmitForQc(assessmentId, data);
    Logger.info('Resubmit for QC successful:', response);
    return response;
  } catch (error) {
    Logger.error('Resubmit for QC failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
export const downloadCertificateAction = createAsyncThunk('certificate/download', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Download Certificate attempt:', { id });
    const response = await service.downloadCertificate(id);
    Logger.info('Download Certificate successful');
    return response;
  } catch (error) {
    Logger.error('Download Certificate failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
export const downloadAssessmentReportAction = createAsyncThunk('assessments/downloadReport', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Download Assessment Report attempt:', { id });
    const response = await service.downloadAssessmentReportCertificate(id);
    Logger.info('Download Assessment Report successful');
    return response;
  } catch (error) {
    Logger.error('Download Assessment Report failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Schedule committee review (Operations Manager/Admin)
export const scheduleCommitteeAction = createAsyncThunk('assessments/scheduleCommittee', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    Logger.info('Schedule committee attempt:', { assessmentId, data });
    const response = await service.scheduleCommittee(assessmentId, data);
    Logger.info('Schedule committee successful:', response);
    return response;
  } catch (error) {
    Logger.error('Schedule committee failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Resubmit assessment to committee after addressing feedback (Assessor)
export const resubmitToCommitteeAction = createAsyncThunk('assessments/resubmitToCommittee', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    Logger.info('Resubmit to committee attempt:', { assessmentId, data });
    const response = await service.resubmitToCommittee(assessmentId, data);
    Logger.info('Resubmit to committee successful:', response);
    return response;
  } catch (error) {
    Logger.error('Resubmit to committee failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Export the assessment list as CSV, honouring the list's current filters
export const exportAssessmentsAction = createAsyncThunk('assessments/export', async (params = {}, { rejectWithValue }) => {
  try {
    return await service.exportAssessments(params);
  } catch (error) {
    Logger.error('Export assessments failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get available workflow transitions for assessment
export const getAvailableTransitionsAction = createAsyncThunk('assessments/getAvailableTransitions', async (assessmentId, { rejectWithValue }) => {
  try {
    Logger.info('Get available transitions attempt:', { assessmentId });
    const response = await service.getAvailableTransitions(assessmentId);
    Logger.info('Get available transitions successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get available transitions failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
