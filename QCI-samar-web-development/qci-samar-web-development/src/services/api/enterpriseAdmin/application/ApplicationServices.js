import { Logger } from '../../../../utils/logger';
import { buildPaginationParams } from '../../utils/pagination';

const ApplicationServices = userClient => {
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

  //   update contact person
  const updateContactPerson = async (applicationId, applicationData) => {
    try {
      const response = await userClient.put(`/applications/${applicationId}/contact-person`, applicationData);
      Logger.info('Response in ApplicationServices.updateContactPerson:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.updateContactPerson:', error.message);
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
  // get available workflow transitions

  // renew a certified application (clones it into a fresh draft server-side)
  const renewApplication = async applicationId => {
    try {
      const response = await userClient.post(`/applications/${applicationId}/renew`);
      Logger.info('Response in ApplicationServices.renewApplication:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.renewApplication:', error.message);
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

  // DRDO approve application
  const drdoApproveApplication = async (applicationId, remarks) => {
    try {
      const response = await userClient.post(`/applications/${applicationId}/drdo-approve`, {
        remarks,
      });
      Logger.info('Response in ApplicationServices.drdoApproveApplication:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.drdoApproveApplication:', error.message);
      throw error;
    }
  };

  // DRDO reject application
  const drdoRejectApplication = async (applicationId, reason) => {
    try {
      const response = await userClient.post(`/applications/${applicationId}/drdo-reject`, {
        reason,
      });
      Logger.info('Response in ApplicationServices.drdoRejectApplication:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in ApplicationServices.drdoRejectApplication:', error.message);
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
    updateContactPerson,
    deleteApplication,
    submitApplicationForReview,
    createServiceApplicationDraft,
    validateGstin,
    submitManufacturingApplication,
    submitServiceApplication,
    renewApplication,
    setPreferredAssessmentDate,
    drdoApproveApplication,
    drdoRejectApplication,
    getAssessmentSummary,
  };
};

export default ApplicationServices;
