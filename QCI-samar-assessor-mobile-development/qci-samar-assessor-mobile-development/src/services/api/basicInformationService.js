import { Logger } from '../../utils';
import { logApiError } from '../../utils/apiErrorLog';

const BasicInformationService = (userClient) => {
  const getBasicInformation = async (assessmentId) => {
    try {
      const response = await userClient.get(
        `application-assessments/${assessmentId}/basic-information`
      );
      Logger.info('Assessments retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const getCategory = async () => {
    try {
      const response = await userClient.get(`master-data/manufacturing/vendor-categories?all=true`);
      Logger.info('getCategory retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const getStore = async () => {
    try {
      const response = await userClient.get(`master-data/manufacturing/stores?all=true`);
      Logger.info('getStore retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const addBasicInformation = async (val) => {
    try {
      const response = await userClient.post(
        `application-assessments/${val.assessmentId}/basic-information`,
        val.data
      );
      Logger.info('Assessments retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const getKeyProcesses = async (val) => {
    try {
      const response = await userClient.get(
        `master-data/manufacturing/key-processes?all=true&search=${val}`
      );
      Logger.info('Key processes retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const getKeyResources = async (val) => {
    try {
      const response = await userClient.get(
        `master-data/manufacturing/raw-materials?all=true&search=${val}`
      );
      Logger.info('Key resources retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const getBoughtOutPart = async (val) => {
    try {
      const response = await userClient.get(
        `master-data/manufacturing/bought-out-parts?all=true&search=${val}`
      );
      Logger.info('Bought out parts retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const thirdPartyCertifications = async (val) => {
    try {
      const response = await userClient.get(`master-data/third-party-certs?all=true&search=${val}`);
      Logger.info('Third party certifications retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  const getCountries = async () => {
    try {
      const response = await userClient.get(`master-data/countries?all=true`);
      Logger.info('Countries retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('AssessmentService.getAllAssessments', error);
      throw error;
    }
  };

  // --- Service-sector master data ---
  // Mirrors the manufacturing lookups above but reads from the `service/*`
  // master endpoints. Each list carries a `serviceProviderType` so the
  // Service Basic Information screen can filter options by the selected
  // provider type client-side.
  const getServiceCategory = async () => {
    try {
      const response = await userClient.get(`master-data/service/vendor-categories?all=true`);
      Logger.info('Service getCategory retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('BasicInformationService.getServiceCategory', error);
      throw error;
    }
  };

  const getVendorLabs = async () => {
    try {
      const response = await userClient.get(`master-data/service/vendor-labs?all=true`);
      Logger.info('Service getVendorLabs retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('BasicInformationService.getVendorLabs', error);
      throw error;
    }
  };

  const getServiceKeyProcesses = async (val) => {
    try {
      const response = await userClient.get(
        `master-data/service/key-processes?all=true&search=${val || ''}`
      );
      Logger.info('Service key processes retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('BasicInformationService.getServiceKeyProcesses', error);
      throw error;
    }
  };

  const getServiceKeyResources = async (val) => {
    try {
      const response = await userClient.get(
        `master-data/service/key-resources?all=true&search=${val || ''}`
      );
      Logger.info('Service key resources retrieved successfully');
      return response.data;
    } catch (error) {
      logApiError('BasicInformationService.getServiceKeyResources', error);
      throw error;
    }
  };

  return {
    getBasicInformation,
    addBasicInformation,
    getCategory,
    getStore,
    getKeyProcesses,
    getKeyResources,
    thirdPartyCertifications,
    getBoughtOutPart,
    getCountries,
    getServiceCategory,
    getVendorLabs,
    getServiceKeyProcesses,
    getServiceKeyResources
  };
};
export default BasicInformationService;
