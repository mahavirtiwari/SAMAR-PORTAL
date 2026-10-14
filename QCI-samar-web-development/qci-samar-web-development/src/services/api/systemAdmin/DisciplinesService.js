import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { withAllListCache } from '../utils/listCache';
import { buildPaginationParams } from '../utils/pagination';

// Utility to build pagination query string

// all=true lookups are cached for 10 minutes; any write through this client clears them.
const client = withAllListCache(userClient);

const SystemAdminDisciplinesService = () => {
  // Get all disciplines (with pagination/filter support)
  const getDisciplines = async params => {
    try {
      const queryString = buildPaginationParams(params);
      const url = `/disciplines${queryString}`;
      const response = await client.get(url);
      Logger.info('Response in DisciplinesService.getDisciplines:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DisciplinesService.getDisciplines:', error.message);
      throw error;
    }
  };

  // Get discipline by ID
  const getDisciplineById = async id => {
    try {
      const response = await client.get(`/disciplines/${id}`);
      Logger.info('Response in DisciplinesService.getDisciplineById:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DisciplinesService.getDisciplineById:', error.message);
      throw error;
    }
  };

  // Create discipline
  const createDiscipline = async data => {
    try {
      const response = await client.post('/disciplines', data);
      Logger.info('Response in DisciplinesService.createDiscipline:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DisciplinesService.createDiscipline:', error.message);
      throw error;
    }
  };

  // Update discipline
  const updateDiscipline = async data => {
    try {
      const response = await client.put(`/disciplines/${data.id}`, data);
      Logger.info('Response in DisciplinesService.updateDiscipline:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DisciplinesService.updateDiscipline:', error.message);
      throw error;
    }
  };
  const activateDiscipline = async id => {
    try {
      const response = await client.post(`/disciplines/${id}/activate`);
      Logger.info('Response in DisciplinesService.activateDiscipline:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DisciplinesService.activateDiscipline:', error.message);
      throw error;
    }
  };

  // Deactivate discipline
  const deactivateDiscipline = async id => {
    try {
      const response = await client.post(`/disciplines/${id}/deactivate`);
      Logger.info('Response in DisciplinesService.deactivateDiscipline:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DisciplinesService.deactivateDiscipline:', error.message);
      throw error;
    }
  };

  // Export disciplines
  const exportDisciplines = async params => {
    try {
      const queryString = buildPaginationParams(params);
      const url = `/disciplines/export${queryString}`;
      const response = await client.get(url);
      Logger.info('Response in DisciplinesService.exportDisciplines:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in DisciplinesService.exportDisciplines:', error.message);
      throw error;
    }
  };

  return {
    getDisciplines,
    getDisciplineById,
    createDiscipline,
    updateDiscipline,
    activateDiscipline,
    deactivateDiscipline,
    exportDisciplines,
  };
};

export default SystemAdminDisciplinesService;
