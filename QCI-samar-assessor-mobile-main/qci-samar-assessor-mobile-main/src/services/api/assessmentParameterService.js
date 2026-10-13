import { Logger } from '../../utils';
import { logApiError } from '../../utils/apiErrorLog';

const AssessmentParameterService = (userClient) => {
  const getAssessmentParameters = async (assessmentId) => {
    try {
      const response = await userClient.get(`application-assessments/${assessmentId}/parameters`);
      Logger.info('Assessment parameters retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentParameterService.getAssessmentParameters', error);
      throw error;
    }
  };

  const getMyAssessments = async (assessmentId) => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/parameters/my-assignments`
      );
      Logger.info('My assessments retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentParameterService.getMyAssessments', error);
      throw error;
    }
  };

  const bulkAssignParameters = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/parameters/bulk-assign`,
        val.data
      );
      Logger.info('Parameters bulk assigned successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentParameterService.bulkAssignParameters', error);
      throw error;
    }
  };

  return {
    getAssessmentParameters,
    getMyAssessments,
    bulkAssignParameters
  };
};
export default AssessmentParameterService;
