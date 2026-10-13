import { logApiError } from '../../utils/apiErrorLog';
import { Logger } from '../../utils/logger';
import { UPLOAD_TIMEOUT } from './clients/userClient';

const AssessmentService = (userClient) => {
  const getAllAssessments = async () => {
    try {
      // No hasIncompleteSteps filter: an assessment must stay on the Home list
      // even after every step is done (e.g. after the closing meeting) — it's
      // only removed via the explicit delete flow. The server still scopes to
      // the current assessor; the Home screen renders by status.
      const response = await userClient.get('assessments?excludeMobileCompleted=1');
      Logger.info('Assessments retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };
  const getAssessmentById = async (assessmentId) => {
    try {
      const response = await userClient.get(`assessments/${assessmentId}`);
      Logger.info('Assessments retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const startAssessment = async (assessmentId) => {
    try {
      const response = await userClient.post(`assessments/${assessmentId}/start`);
      Logger.info('Assessment opened successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.openAssessment', error);
      throw error;
    }
  };

  const getAllAttendance = async (assessmentId) => {
    try {
      const response = await userClient.get(`application-assessments/${assessmentId}/attendance`);
      Logger.info('Assessments retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const getAttendanceStatus = async (assessmentId) => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/attendance/my-status`
      );
      Logger.info('Assessments retrieved successfully');
      return response.data?.data ?? response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const punchIn = async (val) => {
    try {
      Logger.info('Preparing to punch in for assessment ID:', val);
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/attendance/punch-in`,
        val.formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: UPLOAD_TIMEOUT
        }
      );
      Logger.info('Punch-in successful');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.punchIn', error);
      throw error;
    }
  };

  const punchOut = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/attendance/punch-out`,
        val.formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: UPLOAD_TIMEOUT
        }
      );
      Logger.info('Assessment opened successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.openAssessment', error);
      throw error;
    }
  };

  const getStepProgress = async (assessmentId) => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/step-progress`
      );
      Logger.info('Step progress retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getStepProgress', error);
      throw error;
    }
  };

  const completeMobile = async (assessmentId, deviceMetadata) => {
    try {
      const response = await userClient.post(
        `application-assessments/${assessmentId}/mobile-complete`,
        { deviceMetadata: deviceMetadata }
      );
      Logger.info('Mobile completion confirmed');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.completeMobile', error);
      throw error;
    }
  };

  const getMobileCompletionStatus = async (assessmentId) => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/mobile-completion-status`
      );
      Logger.info('Mobile completion status retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getMobileCompletionStatus', error);
      throw error;
    }
  };

  const getDashboardData = async () => {
    try {
      const response = await userClient.get(`dashboards/assessor`);
      Logger.info('Dashboard data retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getDashboardData', error);
      throw error;
    }
  };

  // Server-side reset: wipes this assessment's captured execution data on the
  // server so a restart begins from a clean slate. Only clears assessor data
  // (applicant uploads and the parameter allocation are preserved server-side);
  // the backend rejects it once the assessment is submitted for QC.
  const resetAssessmentData = async (assessmentId) => {
    try {
      const response = await userClient.delete(`application-assessments/${assessmentId}/reset`);
      Logger.info('Assessment data reset successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.resetAssessmentData', error);
      throw error;
    }
  };

  return {
    getAllAttendance,
    getAttendanceStatus,
    getAllAssessments,
    getAssessmentById,
    startAssessment,
    punchIn,
    punchOut,
    getStepProgress,
    completeMobile,
    getMobileCompletionStatus,
    getDashboardData,
    resetAssessmentData
  };
};

export default AssessmentService;
