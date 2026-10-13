import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';

const SystemAdminDocumentService = () => {
  // Get all documents
  const getDocuments = async params => {
    try {
      const response = await userClient.get('/documents', { params });
      Logger.info('Response in DocumentService.getDocuments:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.getDocuments:', error.message);
      throw error;
    }
  };

  // Get document by ID
  const getDocumentById = async id => {
    try {
      const response = await userClient.get(`/documents/${id}`);
      Logger.info('Response in DocumentService.getDocumentById:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.getDocumentById:', error.message);
      throw error;
    }
  };

  // Create document
  const createDocument = async data => {
    try {
      const response = await userClient.post('/documents', data);
      Logger.info('Response in DocumentService.createDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.createDocument:', error.message);
      throw error;
    }
  };

  // Update document
  const updateDocument = async data => {
    try {
      const response = await userClient.put(`/documents/${data.id}`, data);
      Logger.info('Response in DocumentService.updateDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.updateDocument:', error.message);
      throw error;
    }
  };

  // Delete document
  const deleteDocument = async id => {
    try {
      const response = await userClient.delete(`/documents/${id}`);
      Logger.info('Response in DocumentService.deleteDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.deleteDocument:', error.message);
      throw error;
    }
  };

  // Upload document file
  const uploadDocument = async formData => {
    try {
      const response = await userClient.post('/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      Logger.info('Response in DocumentService.uploadDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.uploadDocument:', error.message);
      throw error;
    }
  };

  // Download document
  const downloadDocument = async id => {
    try {
      const response = await userClient.get(`/documents/${id}`, {
        responseType: 'blob',
      });
      Logger.info('Response in DocumentService.downloadDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.downloadDocument:', error.message);
      throw error;
    }
  };
  const activateDocument = async id => {
    try {
      const response = await userClient.post(`/documents/${id}/activate`);
      Logger.info('Response in DocumentService.activateDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.activateDocument:', error.message);
      throw error;
    }
  };

  // Deactivate document
  const deactivateDocument = async id => {
    try {
      const response = await userClient.post(`/documents/${id}/deactivate`);
      Logger.info('Response in DocumentService.deactivateDocument:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DocumentService.deactivateDocument:', error.message);
      throw error;
    }
  };

  return {
    getDocuments,
    getDocumentById,
    createDocument,
    updateDocument,
    deleteDocument,
    uploadDocument,
    downloadDocument,
    deactivateDocument,
    activateDocument,
  };
};

export default SystemAdminDocumentService;
