import { Logger } from '../../utils';
import { logApiError } from '../../utils/apiErrorLog';
import { UPLOAD_TIMEOUT } from './clients/userClient';

const AssessmentResponse = (userClient) => {
  const getAssessmentResponses = async (assessmentId) => {
    try {
      const response = await userClient.get(`application-assessments/${assessmentId}/responses`);
      Logger.info('My assessments retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentParameterService.getMyAssessments', error);
      throw error;
    }
  };

  const getAssessmentResponseById = async (val) => {
    try {
      const response = await userClient.get(
        `application-assessments/${val.assessmentId}/responses/${val.questionId}`
      );
      Logger.info('Assessment response retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentParameterService.getAssessmentResponseById', error);
      throw error;
    }
  };

  const AddAssessmentResponse = async (val) => {
    try {
      const response = await userClient.put(
        `application-assessments/${val.assessmentId}/responses/${val.questionId}`,
        val.data
      );
      Logger.info('Assessment response updated successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentResponseService.AddAssessmentResponse', error);
      throw error;
    }
  };

  const getResponseEvidences = async (val) => {
    try {
      const response = await userClient.get(
        `application-assessments/${val.assessmentId}/responses/${val.questionId}/evidences`
      );
      Logger.info('Response evidences retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentParameterService.getResponseEvidences', error);
      throw error;
    }
  };

  const addResponseEvidence = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/responses/${val.questionId}/evidences`,
        val.data,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: UPLOAD_TIMEOUT
        }
      );
      Logger.info('Response evidence added successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentParameterService.addResponseEvidence', error);
      throw error;
    }
  };

  const deleteResponseEvidence = async (val) => {
    try {
      const response = await userClient.delete(
        `application-assessments/${val.assessmentId}/responses/${val.questionId}/evidences/${val.evidenceId}`
      );
      Logger.info('Response evidence deleted successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentParameterService.deleteResponseEvidence', error);
      throw error;
    }
  };
  return {
    getAssessmentResponses,
    getAssessmentResponseById,
    AddAssessmentResponse,
    getResponseEvidences,
    addResponseEvidence,
    deleteResponseEvidence
  };
};
export default AssessmentResponse;
