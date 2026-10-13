import { Logger } from '../../utils/logger';
import userClient from './clients/userClient';

const ApplicationService = () => {
  const getApplications = async (params = {}) => {
    try {
      // The applicant must never see an assessment once the lead assessor
      // submits on mobile, so exclusion is this client's default rather than a
      // per-call flag a screen can forget. Override with excludeLeadMobileCompleted: 0.
      const response = await userClient.get('applications', {
        params: { excludeLeadMobileCompleted: 1, ...params },
      });
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationService.getApplications: ', error);
      throw error;
    }
  };

  const getStepProgress = async assessmentId => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/step-progress`,
      );
      Logger.info('Step progress retrieved successfully');
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationService.getStepProgress: ', error);
      throw error;
    }
  };

  return {
    getApplications,
    getStepProgress,
  };
};

export default ApplicationService;
