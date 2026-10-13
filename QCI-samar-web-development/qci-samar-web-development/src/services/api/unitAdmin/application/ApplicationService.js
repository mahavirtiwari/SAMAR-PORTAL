import { Logger } from '../../../../utils/logger';
import userClient from '../../clients/userClient';
import { buildPaginationParams } from '../../utils/pagination';

const UnitAdminApplicationServices = () => {
  const getApplication = async applicationData => {
    try {
      const queryString = buildPaginationParams(applicationData);
      const url = `/applications${queryString}`;
      const response = await userClient.get(url);

      Logger.info('Response in ApplicationServices.getApplication:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.getApplication:', error);
      throw error;
    }
  };

  //   CREATe Application
  const createManufacturingApplication = async applicationData => {
    // applicationData should be a FormData object for file uploads and compatibility
    // Ensure 'applicationType' is included in the FormData payload
    Logger.info('applicationData in ApplicationServices.createApplication:', applicationData);
    try {
      const response = await userClient.post(`/applications/manufacturing/draft`, applicationData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      Logger.info('Response in ApplicationServices.createApplication:', response);
      return response;
    } catch (error) {
      Logger.error('Error in ApplicationServices.createApplication:', error.message);
      throw error;
    }
  };

  const submitManufacturingApplication = async applicationId => {
    Logger.info('applicationId in ApplicationServices.submitManufacturingApplication:', applicationId);
    try {
      const response = await userClient.post(`/applications/${applicationId}/submit`);
      Logger.info('Response in ApplicationServices.submitManufacturingApplication:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.submitManufacturingApplication:', error.message);
      throw error;
    }
  };

  const submitServiceApplication = async applicationId => {
    Logger.info('applicationId in ApplicationServices.submitServiceApplication:', applicationId);
    try {
      const response = await userClient.post(`/applications/${applicationId}/submit`);
      Logger.info('Response in ApplicationServices.submitServiceApplication:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.submitServiceApplication:', error.message);
      throw error;
    }
  };

  const createServiceApplicationDraft = async applicationData => {
    Logger.info('applicationData in ApplicationServices.createServiceApplicationDraft:', applicationData);
    try {
      const response = await userClient.post(`/applications/services/draft`, applicationData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      Logger.info('Response in ApplicationServices.createServiceApplicationDraft:', response);
      return response;
    } catch (error) {
      Logger.error('Error in ApplicationServices.createServiceApplicationDraft:', error.message);
      throw error;
    }
  };

  // Live GSTIN ↔ registered-state ↔ PAN consistency check (fires on GST-field blur).
  const validateGstin = async gstNumber => {
    try {
      const response = await userClient.post('/applications/validate-gstin', { gstNumber });
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.validateGstin:', error?.message);
      throw error;
    }
  };

  //   get application details
  const getApplicationDetails = async applicationId => {
    try {
      const response = await userClient.get(`/applications/${applicationId}`);
      Logger.info('Response in ApplicationServices.getApplicationDetails:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.getApplicationDetails:', error.message);
      throw error;
    }
  };

  //   update Application
  const updateApplication = async (applicationId, applicationData) => {
    try {
      const response = await userClient.put(`/applications/${applicationId}`, applicationData);
      Logger.info('Response in ApplicationServices.updateApplication:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.updateApplication:', error.message);
      throw error;
    }
  };

  // delete Application
  const deleteApplication = async applicationId => {
    try {
      const response = await userClient.delete(`/applications/${applicationId}`);
      Logger.info('Response in ApplicationServices.deleteApplication:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.deleteApplication:', error.message);
      throw error;
    }
  };
  // submit application for review
  const submitApplicationForReview = async applicationId => {
    try {
      const response = await userClient.post(`/applications/${applicationId}/submit`);
      Logger.info('Response in ApplicationServices.submitApplicationForReview:', response);
      return response;
    } catch (error) {
      Logger.error('Error in ApplicationServices.submitApplicationForReview:', error.message);
      throw error;
    }
  };

  // set preferred assessment date
  const setPreferredAssessmentDate = async (applicationId, preferredAssessmentDate) => {
    try {
      const response = await userClient.put(`/applications/${applicationId}/preferred-assessment-date`, {
        preferredAssessmentDate,
      });
      Logger.info('Response in ApplicationServices.setPreferredAssessmentDate:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.setPreferredAssessmentDate:', error.message);
      throw error;
    }
  };

  // get assessment summary (site tour, basic info, evidences)
  const getAssessmentSummary = async applicationId => {
    try {
      const response = await userClient.get(`/applications/${applicationId}/assessment-summary`);
      Logger.info('Response in ApplicationServices.getAssessmentSummary:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.getAssessmentSummary:', error.message);
      throw error;
    }
  };

  return {
    getApplication,
    createManufacturingApplication,
    getApplicationDetails,
    updateApplication,
    deleteApplication,
    submitApplicationForReview,
    createServiceApplicationDraft,
    validateGstin,
    submitManufacturingApplication,
    submitServiceApplication,
    setPreferredAssessmentDate,
    getAssessmentSummary,
  };
};

export default UnitAdminApplicationServices;
