import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.ApplicationAssessment;

// ============================================
// Step Progress
// ============================================

export const getStepProgressAction = createAsyncThunk('applicationAssessment/getStepProgress', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getStepProgress(assessmentId);
    Logger.info('Get step progress successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get step progress failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Step 1: Parameter Allocation
// ============================================

export const getParametersAction = createAsyncThunk('applicationAssessment/getParameters', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getParameters(assessmentId);
    Logger.info('Get parameters successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get parameters failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateMeetingCommentsAction = createAsyncThunk('applicationAssessment/updateMeetingComments', async ({ assessmentId, type, data }, { rejectWithValue }) => {
  try {
    const response = await service.updateMeetingComments(assessmentId, type, data);
    Logger.info('Update meeting comments successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update meeting comments failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Step 2: Site Pictures
// ============================================

export const getSitePicturesAction = createAsyncThunk('applicationAssessment/getSitePictures', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getSitePictures(assessmentId);
    Logger.info('Get site pictures successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get site pictures failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Step 3 & 7: Meetings (Opening & Closing)
// ============================================

export const getOpeningMeetingAction = createAsyncThunk('applicationAssessment/getOpeningMeeting', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getOpeningMeeting(assessmentId);
    Logger.info('Get opening meeting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get opening meeting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getClosingMeetingAction = createAsyncThunk('applicationAssessment/getClosingMeeting', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getClosingMeeting(assessmentId);
    Logger.info('Get closing meeting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get closing meeting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Step 4: Site Tour Pictures
// ============================================

export const getSiteTourPicturesAction = createAsyncThunk('applicationAssessment/getSiteTourPictures', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getSiteTourPictures(assessmentId);
    Logger.info('Get site tour pictures successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get site tour pictures failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Step 5: Basic Information
// ============================================

export const getBasicInformationAction = createAsyncThunk('applicationAssessment/getBasicInformation', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getBasicInformation(assessmentId);
    Logger.info('Get basic information successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get basic information failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Step 6: Assessment Responses
// ============================================

export const getResponsesAction = createAsyncThunk('applicationAssessment/getResponses', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getResponses(assessmentId);
    Logger.info('Get responses successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get responses failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getResponseByQuestionAction = createAsyncThunk('applicationAssessment/getResponseByQuestion', async ({ assessmentId, questionId }, { rejectWithValue }) => {
  try {
    const response = await service.getResponseByQuestion(assessmentId, questionId);
    Logger.info('Get response by question successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get response by question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateResponseByQuestionAction = createAsyncThunk('applicationAssessment/updateResponseByQuestion', async ({ assessmentId, questionId, data }, { rejectWithValue }) => {
  try {
    const response = await service.updateResponseByQuestion(assessmentId, questionId, data);
    Logger.info('Update response by question successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update response by question failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
export const getResponseEvidencesAction = createAsyncThunk('applicationAssessment/getResponseEvidences', async ({ assessmentId, questionId }, { rejectWithValue }) => {
  try {
    const response = await service.getResponseEvidences(assessmentId, questionId);
    Logger.info('Get response evidences successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get response evidences failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Attendance
// ============================================

export const getAttendanceAction = createAsyncThunk('applicationAssessment/getAttendance', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getAttendance(assessmentId);
    Logger.info('Get attendance successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get attendance failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Committee Feedback & Review
// ============================================

export const getQuestionFeedbackHistoryAction = createAsyncThunk('applicationAssessment/getQuestionFeedbackHistory', async ({ assessmentId, questionId }, { rejectWithValue }) => {
  try {
    const response = await service.getQuestionFeedbackHistory(assessmentId, questionId);
    Logger.info('Get question feedback history successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get question feedback history failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const submitResponseAction = createAsyncThunk('applicationAssessment/submitResponse', async ({ assessmentId, questionId, data }, { rejectWithValue }) => {
  try {
    const response = await service.submitResponse(assessmentId, questionId, data);
    Logger.info('Submit response successful:', response);
    return response;
  } catch (error) {
    Logger.error('Submit response failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Execution: Parameter Allocation (Lead)
// ============================================

export const getMyAssignmentsAction = createAsyncThunk('applicationAssessment/getMyAssignments', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getMyAssignments(assessmentId);
    return response;
  } catch (error) {
    Logger.error('Get my assignments failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const bulkAssignParametersAction = createAsyncThunk('applicationAssessment/bulkAssignParameters', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    const response = await service.bulkAssignParameters(assessmentId, data);
    return response;
  } catch (error) {
    Logger.error('Bulk assign parameters failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Execution: Attendance (Punch In/Out)
// ============================================

export const getMyPunchStatusAction = createAsyncThunk('applicationAssessment/getMyPunchStatus', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getMyPunchStatus(assessmentId);
    return response;
  } catch (error) {
    Logger.error('Get my punch status failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const punchInAction = createAsyncThunk('applicationAssessment/punchIn', async ({ assessmentId, formData }, { rejectWithValue }) => {
  try {
    const response = await service.punchIn(assessmentId, formData);
    return response;
  } catch (error) {
    Logger.error('Punch in failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const punchOutAction = createAsyncThunk('applicationAssessment/punchOut', async ({ assessmentId, formData }, { rejectWithValue }) => {
  try {
    const response = await service.punchOut(assessmentId, formData);
    return response;
  } catch (error) {
    Logger.error('Punch out failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Execution: Meetings (Opening & Closing) — Lead
// ============================================

export const createMeetingAction = createAsyncThunk('applicationAssessment/createMeeting', async ({ assessmentId, type, formData }, { rejectWithValue }) => {
  try {
    const response = await service.createMeeting(assessmentId, type, formData);
    return response;
  } catch (error) {
    Logger.error('Create meeting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const addMeetingParticipantAction = createAsyncThunk('applicationAssessment/addMeetingParticipant', async ({ assessmentId, type, data }, { rejectWithValue }) => {
  try {
    const response = await service.addMeetingParticipant(assessmentId, type, data);
    return response;
  } catch (error) {
    Logger.error('Add meeting participant failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const removeMeetingParticipantAction = createAsyncThunk('applicationAssessment/removeMeetingParticipant', async ({ assessmentId, type, participantId }, { rejectWithValue }) => {
  try {
    const response = await service.removeMeetingParticipant(assessmentId, type, participantId);
    return response;
  } catch (error) {
    Logger.error('Remove meeting participant failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Execution: Basic Information (Lead)
// ============================================

export const saveBasicInformationAction = createAsyncThunk('applicationAssessment/saveBasicInformation', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    const response = await service.saveBasicInformation(assessmentId, data);
    return response;
  } catch (error) {
    Logger.error('Save basic information failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Execution: Response Evidences (Lead + Co)
// ============================================

export const uploadResponseEvidenceAction = createAsyncThunk('applicationAssessment/uploadResponseEvidence', async ({ assessmentId, questionId, formData }, { rejectWithValue }) => {
  try {
    const response = await service.uploadResponseEvidence(assessmentId, questionId, formData);
    return response;
  } catch (error) {
    Logger.error('Upload response evidence failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const deleteResponseEvidenceAction = createAsyncThunk('applicationAssessment/deleteResponseEvidence', async ({ assessmentId, questionId, evidenceId }, { rejectWithValue }) => {
  try {
    const response = await service.deleteResponseEvidence(assessmentId, questionId, evidenceId);
    return response;
  } catch (error) {
    Logger.error('Delete response evidence failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Execution: Field-work completion (Lead + Co)
// ============================================

export const completeFieldWorkAction = createAsyncThunk('applicationAssessment/completeFieldWork', async ({ assessmentId, data }, { rejectWithValue }) => {
  try {
    const response = await service.completeFieldWork(assessmentId, data);
    return response;
  } catch (error) {
    Logger.error('Submit for Review failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getFieldCompletionStatusAction = createAsyncThunk('applicationAssessment/getFieldCompletionStatus', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getFieldCompletionStatus(assessmentId);
    return response;
  } catch (error) {
    Logger.error('Get field completion status failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// ============================================
// Convenience: Get All Step Data
// ============================================

export const getAllStepDataAction = createAsyncThunk('applicationAssessment/getAllStepData', async (assessmentId, { rejectWithValue }) => {
  try {
    const response = await service.getAllStepData(assessmentId);
    Logger.info('Get all step data successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get all step data failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
