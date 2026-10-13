import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

// Multipart config for image/file uploads. Callers build FormData with
// snake_case keys (selfie, client_uuid, recorded_at, latitude, longitude,
// device_metadata[*]) to match the backend's multipart field names.
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/**
 * Application Assessment Service
 * Handles all application-assessment step data (assessor execution + review).
 *
 * Endpoints: /api/v1/application-assessments/{assessmentId}/*
 */
const ApplicationAssessmentService = () => {
  // ============================================
  // Step Progress
  // ============================================

  /**
   * Get step progress for an assessment
   */
  const getStepProgress = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/step-progress`);
      Logger.info('Response in ApplicationAssessmentService.getStepProgress:', response.data?.data ?? response.data);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getStepProgress:', error.message);
      throw error;
    }
  };

  /**
   * Get detailed step progress
   */

  // ============================================
  // Step 1: Parameter Allocation
  // ============================================

  /**
   * Get all parameters for an assessment
   */
  const getParameters = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/parameters`);
      Logger.info('Response in ApplicationAssessmentService.getParameters:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getParameters:', error.message);
      throw error;
    }
  };

  /**
   * Submit (upsert) the current assessor's meeting comment. Uses POST, which the
   * backend treats as create-or-update; PUT is update-only and 404s on a first
   * comment ("You have not added a comment yet").
   */
  const updateMeetingComments = async (assessmentId, type, data) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/meetings/${type}/comments`, data);
      Logger.info('Response in ApplicationAssessmentService.updateMeetingComments:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.updateMeetingComments:', error.message);
      throw error;
    }
  };

  // ============================================
  // Step 2: Site Pictures
  // ============================================

  /**
   * Get all site pictures for an assessment
   */
  const getSitePictures = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/site-pictures`);
      Logger.info('Response in ApplicationAssessmentService.getSitePictures:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getSitePictures:', error.message);
      throw error;
    }
  };

  // ============================================
  // Step 3 & 7: Meetings (Opening & Closing)
  // ============================================

  /**
   * Get meeting details (opening or closing)
   * @param {number} assessmentId
   * @param {string} type - 'opening' or 'closing'
   */
  const getMeeting = async (assessmentId, type) => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/meetings/${type}`);
      Logger.info(`Response in ApplicationAssessmentService.getMeeting (${type}):`, response);
      return response.data;
    } catch (error) {
      Logger.error(`Error in ApplicationAssessmentService.getMeeting (${type}):`, error.message);
      throw error;
    }
  };

  /**
   * Get opening meeting
   */
  const getOpeningMeeting = async assessmentId => {
    return getMeeting(assessmentId, 'opening');
  };

  /**
   * Get closing meeting
   */
  const getClosingMeeting = async assessmentId => {
    return getMeeting(assessmentId, 'closing');
  };

  // ============================================
  // Step 4: Site Tour Pictures
  // ============================================

  /**
   * Get all site tour pictures for an assessment
   */
  const getSiteTourPictures = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/site-tour-pictures`);
      Logger.info('Response in ApplicationAssessmentService.getSiteTourPictures:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getSiteTourPictures:', error.message);
      throw error;
    }
  };

  // ============================================
  // Step 5: Basic Information
  // ============================================

  /**
   * Get basic information for an assessment
   * Includes: products, customers, materials, vendor category, etc.
   */
  const getBasicInformation = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/basic-information`);
      Logger.info('Response in ApplicationAssessmentService.getBasicInformation:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getBasicInformation:', error.message);
      throw error;
    }
  };

  // ============================================
  // Step 6: Assessment Responses (Question Answers)
  // ============================================

  /**
   * Get all responses for an assessment
   */
  const getResponses = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/responses`);
      Logger.info('Response in ApplicationAssessmentService.getResponses:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getResponses:', error.message);
      throw error;
    }
  };

  /**
   * Get a specific response by question ID
   */
  const getResponseByQuestion = async (assessmentId, questionId) => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/responses/${questionId}`);
      Logger.info('Response in ApplicationAssessmentService.getResponseByQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getResponseByQuestion:', error.message);
      throw error;
    }
  };

  const updateResponseByQuestion = async (assessmentId, questionId, data) => {
    try {
      const response = await userClient.put(`/application-assessments/${assessmentId}/responses/${questionId}`, data);
      Logger.info('Response in ApplicationAssessmentService.updateResponseByQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.updateResponseByQuestion:', error.message);
      throw error;
    }
  };
  /**
   * Get evidences for a response
   */
  const getResponseEvidences = async (assessmentId, questionId) => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/responses/${questionId}/evidences`);
      Logger.info('Response in ApplicationAssessmentService.getResponseEvidences:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getResponseEvidences:', error.message);
      throw error;
    }
  };

  // ============================================
  // Attendance (Punch In/Out)
  // ============================================

  /**
   * Get all attendance records for an assessment
   */
  const getAttendance = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/attendance`);
      Logger.info('Response in ApplicationAssessmentService.getAttendance:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getAttendance:', error.message);
      throw error;
    }
  };

  // ============================================
  // Committee Feedback & Review
  // ============================================

  /**
   * Get feedback history for a question
   * @param {number} assessmentId
   * @param {number} questionId
   */
  const getQuestionFeedbackHistory = async (assessmentId, questionId) => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/questions/${questionId}/feedback-history`);
      Logger.info('Response in ApplicationAssessmentService.getQuestionFeedbackHistory:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getQuestionFeedbackHistory:', error.message);
      throw error;
    }
  };

  /**
   * Submit or update a response for a question
   * POST /application-assessments/{assessmentId}/questions/{questionId}/response
   * @param {number} assessmentId
   * @param {number} questionId
   * @param {object} data - payload for response (e.g., { selectedOption, assessorRemarks, evidences, score })
   */
  const submitResponse = async (assessmentId, questionId, data = {}) => {
    try {
      const response = await userClient.put(`/application-assessments/${assessmentId}/questions/${questionId}/response`, data);
      Logger.info('Response in ApplicationAssessmentService.submitResponse:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.submitResponse:', error.message);
      throw error;
    }
  };

  // ============================================
  // Execution: Parameter Allocation (Lead)
  // ============================================

  /** Parameters assigned to the current assessor. */
  const getMyAssignments = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/parameters/my-assignments`);
      Logger.info('Response in ApplicationAssessmentService.getMyAssignments:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getMyAssignments:', error.message);
      throw error;
    }
  };

  /**
   * Lead bulk-assigns parameters to team members and locks allocation.
   * @param {object} data - { assignments: [{ parameterId, teamMemberId }], skipOptionalUnassigned }
   */
  const bulkAssignParameters = async (assessmentId, data) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/parameters/bulk-assign`, data);
      Logger.info('Response in ApplicationAssessmentService.bulkAssignParameters:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.bulkAssignParameters:', error.message);
      throw error;
    }
  };

  // ============================================
  // Execution: Attendance (Punch In/Out)
  // ============================================

  /** Current user's punch state + history. */
  const getMyPunchStatus = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/attendance/my-status`);
      Logger.info('Response in ApplicationAssessmentService.getMyPunchStatus:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getMyPunchStatus:', error.message);
      throw error;
    }
  };

  /** Punch in — multipart selfie + best-effort geo. */
  const punchIn = async (assessmentId, formData) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/attendance/punch-in`, formData, MULTIPART);
      Logger.info('Response in ApplicationAssessmentService.punchIn:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.punchIn:', error.message);
      throw error;
    }
  };

  /** Punch out — multipart selfie + best-effort geo. Requires a prior punch-in. */
  const punchOut = async (assessmentId, formData) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/attendance/punch-out`, formData, MULTIPART);
      Logger.info('Response in ApplicationAssessmentService.punchOut:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.punchOut:', error.message);
      throw error;
    }
  };

  // ============================================
  // Execution: Meetings (Opening & Closing) — Lead
  // ============================================

  /**
   * Create/update a meeting (photo + best-effort geo).
   * @param {string} type - 'opening' | 'closing'
   * @param {FormData} formData - image, latitude, longitude, conducted_at
   */
  const createMeeting = async (assessmentId, type, formData) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/meetings/${type}`, formData, MULTIPART);
      Logger.info(`Response in ApplicationAssessmentService.createMeeting (${type}):`, response);
      return response.data;
    } catch (error) {
      Logger.error(`Error in ApplicationAssessmentService.createMeeting (${type}):`, error.message);
      throw error;
    }
  };

  /** Add an external participant to a meeting. */
  const addMeetingParticipant = async (assessmentId, type, data) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/meetings/${type}/participants`, data);
      Logger.info(`Response in ApplicationAssessmentService.addMeetingParticipant (${type}):`, response);
      return response.data;
    } catch (error) {
      Logger.error(`Error in ApplicationAssessmentService.addMeetingParticipant (${type}):`, error.message);
      throw error;
    }
  };

  /** Remove an external participant from a meeting. */
  const removeMeetingParticipant = async (assessmentId, type, participantId) => {
    try {
      const response = await userClient.delete(`/application-assessments/${assessmentId}/meetings/${type}/participants/${participantId}`);
      Logger.info(`Response in ApplicationAssessmentService.removeMeetingParticipant (${type}):`, response);
      return response.data;
    } catch (error) {
      Logger.error(`Error in ApplicationAssessmentService.removeMeetingParticipant (${type}):`, error.message);
      throw error;
    }
  };

  // ============================================
  // Execution: Basic Information (Lead)
  // ============================================

  /** Save basic information (service or manufacturing form). Body: { data: <form> }. */
  const saveBasicInformation = async (assessmentId, data) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/basic-information`, data);
      Logger.info('Response in ApplicationAssessmentService.saveBasicInformation:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.saveBasicInformation:', error.message);
      throw error;
    }
  };

  // ============================================
  // Execution: Response Evidences (Lead + Co)
  // ============================================

  /** Attach evidence to a response (service: sourced from the applicant site-tour pool). */
  const uploadResponseEvidence = async (assessmentId, questionId, formData) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/responses/${questionId}/evidences`, formData, MULTIPART);
      Logger.info('Response in ApplicationAssessmentService.uploadResponseEvidence:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.uploadResponseEvidence:', error.message);
      throw error;
    }
  };

  /** Remove an evidence from a response. */
  const deleteResponseEvidence = async (assessmentId, questionId, evidenceId) => {
    try {
      const response = await userClient.delete(`/application-assessments/${assessmentId}/responses/${questionId}/evidences/${evidenceId}`);
      Logger.info('Response in ApplicationAssessmentService.deleteResponseEvidence:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.deleteResponseEvidence:', error.message);
      throw error;
    }
  };

  // ============================================
  // Execution: Field-work completion (Lead + Co)
  // ============================================

  /** Mark the current assessor's field work complete (the "mobile-complete" cutover). */
  const completeFieldWork = async (assessmentId, data = {}) => {
    try {
      const response = await userClient.post(`/application-assessments/${assessmentId}/mobile-complete`, data);
      Logger.info('Response in ApplicationAssessmentService.completeFieldWork:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.completeFieldWork:', error.message);
      throw error;
    }
  };

  /** Per-member field-completion state (can_complete, blockers). */
  const getFieldCompletionStatus = async assessmentId => {
    try {
      const response = await userClient.get(`/application-assessments/${assessmentId}/mobile-completion-status`);
      Logger.info('Response in ApplicationAssessmentService.getFieldCompletionStatus:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getFieldCompletionStatus:', error.message);
      throw error;
    }
  };

  // ============================================
  // Convenience: Get All Step Data
  // ============================================

  /**
   * Get all assessment step data in one call
   * Useful for loading complete assessment view
   */
  const getAllStepData = async assessmentId => {
    try {
      const [stepProgress, parameters, sitePictures, openingMeeting, siteTourPictures, basicInformation, responses, closingMeeting, attendance] = await Promise.all([
        getStepProgress(assessmentId).catch(() => null),
        getParameters(assessmentId).catch(() => null),
        getSitePictures(assessmentId).catch(() => null),
        getOpeningMeeting(assessmentId).catch(() => null),
        getSiteTourPictures(assessmentId).catch(() => null),
        getBasicInformation(assessmentId).catch(() => null),
        getResponses(assessmentId).catch(() => null),
        getClosingMeeting(assessmentId).catch(() => null),
        getAttendance(assessmentId).catch(() => null),
      ]);

      return {
        stepProgress,
        parameters,
        sitePictures,
        openingMeeting,
        siteTourPictures,
        basicInformation,
        responses,
        closingMeeting,
        attendance,
      };
    } catch (error) {
      Logger.error('Error in ApplicationAssessmentService.getAllStepData:', error.message);
      throw error;
    }
  };

  return {
    // Step Progress
    getStepProgress,

    // Step 1: Parameter Allocation
    getParameters,
    updateMeetingComments,

    // Step 2: Site Pictures
    getSitePictures,

    // Step 3 & 7: Meetings
    getMeeting,
    getOpeningMeeting,
    getClosingMeeting,

    // Step 4: Site Tour
    getSiteTourPictures,

    // Step 5: Basic Information
    getBasicInformation,

    // Step 6: Responses
    getResponses,
    getResponseByQuestion,
    getResponseEvidences,
    updateResponseByQuestion,
    // Attendance
    getAttendance,

    // Committee Feedback & Review
    getQuestionFeedbackHistory,
    submitResponse,

    // Execution: Parameter Allocation
    getMyAssignments,
    bulkAssignParameters,

    // Execution: Attendance
    getMyPunchStatus,
    punchIn,
    punchOut,

    // Execution: Meetings
    createMeeting,
    addMeetingParticipant,
    removeMeetingParticipant,

    // Execution: Basic Information
    saveBasicInformation,

    // Execution: Response Evidences
    uploadResponseEvidence,
    deleteResponseEvidence,

    // Execution: Field-work completion
    completeFieldWork,
    getFieldCompletionStatus,

    // Convenience
    getAllStepData,
  };
};

export default ApplicationAssessmentService;
