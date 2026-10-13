import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination'; // added import

const SystemAdminAssessmentParameterService = () => {
  // Bulk import assessment parameters. enterpriseSize and vendorCategoryId are arrays;
  // the server fans the uploaded file out across size × category.
  const bulkImportAssessmentParameters = async ({ file, sector, enterpriseSize, serviceProviderType, vendorCategoryId }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sector', sector);
      (Array.isArray(enterpriseSize) ? enterpriseSize : [enterpriseSize]).forEach(value => formData.append('enterpriseSize[]', value));
      if (sector === 'service' && serviceProviderType) {
        formData.append('serviceProviderType', serviceProviderType);
      }
      (Array.isArray(vendorCategoryId) ? vendorCategoryId : [vendorCategoryId]).forEach(value => formData.append('vendorCategoryId[]', value));

      const response = await userClient.post('/assessment-parameters/bulk-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // server processes the import synchronously; the 30s client default is too short for multi-parameter files
        // Let axios set multipart/form-data + boundary from the FormData; a hardcoded boundary-less header can drop the file part.
        // Never retry: this upload is not idempotent — a replay can double-apply an import whose response was merely lost.
        'axios-retry': { retries: 0 },
      });
      Logger.info('Response in AssessmentParameterService.bulkImportAssessmentParameters:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.bulkImportAssessmentParameters:', error.message);
      throw error;
    }
  };

  // Bulk update assessment parameters. Rows are matched by the Parameter ID (code) column
  // in the uploaded file; no size/category selection is needed.
  const bulkUpdateAssessmentParameters = async ({ file, sector }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sector', sector);
      const response = await userClient.post('/assessment-parameters/bulk-update', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // server processes the update synchronously; the 30s client default is too short for multi-parameter files
        // Let axios set multipart/form-data + boundary from the FormData; a hardcoded boundary-less header can drop the file part.
        // Never retry: this upload is not idempotent — a replay can double-apply an update whose response was merely lost.
        'axios-retry': { retries: 0 },
      });
      Logger.info('Response in AssessmentParameterService.bulkUpdateAssessmentParameters:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.bulkUpdateAssessmentParameters:', error.message);
      throw error;
    }
  };
  // Get all assessment parameters (with pagination/filter support)
  const getAssessmentParameters = async params => {
    try {
      const queryString = buildPaginationParams(params); // use shared util
      const url = `/assessment-parameters${queryString}`;
      const response = await userClient.get(url);
      Logger.info('Response in AssessmentParameterService.getAssessmentParameters:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.getAssessmentParameters:', error.message);
      throw error;
    }
  };

  // Get assessment parameter by ID
  const getAssessmentParameterById = async id => {
    try {
      const response = await userClient.get(`/assessment-parameters/${id}`);
      Logger.info('Response in AssessmentParameterService.getAssessmentParameterById:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.getAssessmentParameterById:', error.message);
      throw error;
    }
  };

  // Create assessment parameter
  const createAssessmentParameter = async data => {
    try {
      const response = await userClient.post('/assessment-parameters', data);
      Logger.info('Response in AssessmentParameterService.createAssessmentParameter:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.createAssessmentParameter:', error.message);
      throw error;
    }
  };

  // Update assessment parameter
  const updateAssessmentParameter = async data => {
    try {
      const response = await userClient.put(`/assessment-parameters/${data.id}`, data);
      Logger.info('Response in AssessmentParameterService.updateAssessmentParameter:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.updateAssessmentParameter:', error.message);
      throw error;
    }
  };

  // Delete assessment parameter
  const deleteAssessmentParameter = async id => {
    try {
      const response = await userClient.delete(`/assessment-parameters/${id}`);
      Logger.info('Response in AssessmentParameterService.deleteAssessmentParameter:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.deleteAssessmentParameter:', error.message);
      throw error;
    }
  };

  // Activate assessment parameter
  const activateAssessmentParameter = async id => {
    try {
      const response = await userClient.post(`/assessment-parameters/${id}/activate`);
      Logger.info('Response in AssessmentParameterService.activateAssessmentParameter:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.activateAssessmentParameter:', error.message);
      throw error;
    }
  };

  // Deactivate assessment parameter
  const deactivateAssessmentParameter = async id => {
    try {
      const response = await userClient.post(`/assessment-parameters/${id}/deactivate`);
      Logger.info('Response in AssessmentParameterService.deactivateAssessmentParameter:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.deactivateAssessmentParameter:', error.message);
      throw error;
    }
  };

  // Create a new assessment question
  const createAssessmentQuestion = async data => {
    try {
      const response = await userClient.post('/assessment-questions', data);
      Logger.info('Response in AssessmentService.createAssessmentQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.createAssessmentQuestion:', error.message);
      throw error;
    }
  };

  // Get assessment question details with options
  const getAssessmentQuestionDetails = async id => {
    try {
      const response = await userClient.get(`/assessment-questions/${id}`);
      Logger.info('Response in AssessmentService.getAssessmentQuestionDetails:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.getAssessmentQuestionDetails:', error.message);
      throw error;
    }
  };

  // Update an assessment question
  const updateAssessmentQuestion = async (id, data) => {
    try {
      const response = await userClient.put(`/assessment-questions/${id}`, data);
      Logger.info('Response in AssessmentService.updateAssessmentQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.updateAssessmentQuestion:', error.message);
      throw error;
    }
  };

  // Soft delete an assessment question
  const deleteAssessmentQuestion = async id => {
    try {
      const response = await userClient.delete(`/assessment-questions/${id}`);
      Logger.info('Response in AssessmentService.deleteAssessmentQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.deleteAssessmentQuestion:', error.message);
      throw error;
    }
  };

  // Get answer options for an assessment question
  const getAssessmentQuestionOptions = async id => {
    try {
      const response = await userClient.get(`/assessment-questions/${id}/options`);
      Logger.info('Response in AssessmentService.getAssessmentQuestionOptions:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.getAssessmentQuestionOptions:', error.message);
      throw error;
    }
  };

  // Add an answer option to an assessment question
  const addAssessmentQuestionOption = async (id, data) => {
    try {
      const response = await userClient.post(`/assessment-questions/${id}/options`, data);
      Logger.info('Response in AssessmentService.addAssessmentQuestionOption:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.addAssessmentQuestionOption:', error.message);
      throw error;
    }
  };

  // Update an answer option
  const updateAssessmentQuestionOption = async (id, optionId, data) => {
    try {
      const response = await userClient.put(`/assessment-questions/${id}/options/${optionId}`, data);
      Logger.info('Response in AssessmentService.updateAssessmentQuestionOption:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.updateAssessmentQuestionOption:', error.message);
      throw error;
    }
  };

  // Delete an answer option
  const deleteAssessmentQuestionOption = async (id, optionId) => {
    try {
      const response = await userClient.delete(`/assessment-questions/${id}/options/${optionId}`);
      Logger.info('Response in AssessmentService.deleteAssessmentQuestionOption:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.deleteAssessmentQuestionOption:', error.message);
      throw error;
    }
  };

  // Activate assessment question
  const activateAssessmentQuestion = async id => {
    try {
      const response = await userClient.post(`/assessment-questions/${id}/activate`);
      Logger.info('Response in AssessmentService.activateAssessmentQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.activateAssessmentQuestion:', error.message);
      throw error;
    }
  };

  // Deactivate assessment question
  const deactivateAssessmentQuestion = async id => {
    try {
      const response = await userClient.post(`/assessment-questions/${id}/deactivate`);
      Logger.info('Response in AssessmentService.deactivateAssessmentQuestion:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.deactivateAssessmentQuestion:', error.message);
      throw error;
    }
  };

  // Activate assessment question option
  const activateAssessmentQuestionOption = async (id, optionId) => {
    try {
      const response = await userClient.post(`/assessment-questions/${id}/options/${optionId}/activate`);
      Logger.info('Response in AssessmentService.activateAssessmentQuestionOption:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.activateAssessmentQuestionOption:', error.message);
      throw error;
    }
  };

  // Deactivate assessment question option
  const deactivateAssessmentQuestionOption = async (id, optionId) => {
    try {
      const response = await userClient.post(`/assessment-questions/${id}/options/${optionId}/deactivate`);
      Logger.info('Response in AssessmentService.deactivateAssessmentQuestionOption:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.deactivateAssessmentQuestionOption:', error.message);
      throw error;
    }
  };

  const getAssessmentParameterQuestions = async params => {
    try {
      const queryString = buildPaginationParams(params);
      const response = await userClient.get(`/assessment-parameters/${params.parameterId}/questions${queryString}`);
      Logger.info('Response in AssessmentService.getAssessmentParameterQuestions:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentService.getAssessmentParameterQuestions:', error.message);
      throw error;
    }
  };

  // Download the bulk-import template (sample CSV)
  const downloadAssessmentParameterImportTemplate = async () => {
    try {
      const response = await userClient.get('/assessment-parameters/template', {
        responseType: 'blob',
      });
      Logger.info('Response in AssessmentParameterService.downloadAssessmentParameterImportTemplate:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.downloadAssessmentParameterImportTemplate:', error.message);
      throw error;
    }
  };

  // Download the bulk-update template (sample CSV with a Parameter ID column)
  const downloadBulkUpdateTemplate = async sector => {
    try {
      const response = await userClient.get(`/assessment-parameters/bulk-update-template${sector ? `?sector=${sector}` : ''}`, {
        responseType: 'blob',
      });
      Logger.info('Response in AssessmentParameterService.downloadBulkUpdateTemplate:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.downloadBulkUpdateTemplate:', error.message);
      throw error;
    }
  };

  // Export assessment parameters
  const exportAssessmentParameters = async params => {
    try {
      const queryString = buildPaginationParams(params);
      const response = await userClient.get(`/assessment-parameters/export${queryString}`, {
        responseType: 'text',
      });
      Logger.info('Response in AssessmentParameterService.exportAssessmentParameters:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AssessmentParameterService.exportAssessmentParameters:', error.message);
      throw error;
    }
  };

  return {
    getAssessmentParameters,
    getAssessmentParameterById,
    createAssessmentParameter,
    updateAssessmentParameter,
    deleteAssessmentParameter,
    activateAssessmentParameter,
    deactivateAssessmentParameter,
    createAssessmentQuestion,
    getAssessmentQuestionDetails,
    updateAssessmentQuestion,
    deleteAssessmentQuestion,
    getAssessmentQuestionOptions,
    addAssessmentQuestionOption,
    updateAssessmentQuestionOption,
    deleteAssessmentQuestionOption,
    activateAssessmentQuestion,
    deactivateAssessmentQuestion,
    activateAssessmentQuestionOption,
    deactivateAssessmentQuestionOption,
    getAssessmentParameterQuestions,
    exportAssessmentParameters,
    bulkImportAssessmentParameters,
    bulkUpdateAssessmentParameters,
    downloadAssessmentParameterImportTemplate,
    downloadBulkUpdateTemplate,
  };
};

export default SystemAdminAssessmentParameterService;
