import { Logger } from '../../../utils/logger';
import userClient from '../clients/userClient';
import { buildPaginationParams } from '../utils/pagination';

const MasterServices = () => {
  // Utility to build pagination query string

  const listVendorCategoriesV1 = async params => {
    try {
      const queryString = buildPaginationParams(params);
      const url = `/master-data/service/vendor-categories${queryString}`;
      const response = await userClient.get(url);
      Logger.info('listVendorCategoriesV1 response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in listVendorCategoriesV1:', error.message);
      throw error;
    }
  };

  const getVendorCategoryV1 = async id => {
    try {
      const response = await userClient.get(`/master-data/service/vendor-categories/${id}`);
      Logger.info('getVendorCategoryV1 response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getVendorCategoryV1:', error.message);
      throw error;
    }
  };

  const createVendorCategoryV1 = async payload => {
    try {
      const response = await userClient.post('/master-data/service/vendor-categories', payload);
      Logger.info('createVendorCategoryV1 response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createVendorCategoryV1:', error.message);
      throw error;
    }
  };

  const updateVendorCategoryV1 = async payload => {
    try {
      const response = await userClient.put(`/master-data/service/vendor-categories/${payload.id}`, payload);
      Logger.info('updateVendorCategoryV1 response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateVendorCategoryV1:', error.message);
      throw error;
    }
  };

  const activateVendorCategoryV1 = async id => {
    try {
      const response = await userClient.post(`/master-data/service/vendor-categories/${id}/activate`);
      Logger.info('activateVendorCategoryV1 response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateVendorCategoryV1:', error.message);
      throw error;
    }
  };

  const deactivateVendorCategoryV1 = async id => {
    try {
      const response = await userClient.post(`/master-data/service/vendor-categories/${id}/deactivate`);
      Logger.info('deactivateVendorCategoryV1 response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateVendorCategoryV1:', error.message);
      throw error;
    }
  };
  // v1 Vendor Categories

  const listKeyProcessV1 = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/service/key-processes${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listKeyProcessV1 response:', response);
      return response;
    } catch (error) {
      Logger.error('Error in listKeyProcessV1:', error.message);
      throw error;
    }
  };

  const getKeyProcessV1 = async id => {
    try {
      const response = await userClient.get(`/master-data/service/key-processes/${id}`);
      Logger.info('getKeyProcessV1 response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getKeyProcessV1:', error.message);
      throw error;
    }
  };

  const createKeyProcessV1 = async payload => {
    try {
      const response = await userClient.post('/master-data/service/key-processes', payload);
      Logger.info('createKeyProcessV1 response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createKeyProcessV1:', error.message);
      throw error;
    }
  };

  const updateKeyProcessV1 = async payload => {
    try {
      const response = await userClient.put(`/master-data/service/key-processes/${payload.id}`, payload);
      Logger.info('updateKeyProcessV1 response:', response);
      return response;
    } catch (error) {
      Logger.error('Error in updateKeyProcessV1:', error.message);
      throw error;
    }
  };

  const activateKeyProcessV1 = async id => {
    try {
      Logger.info('Activating key process V1 with ID:', id);
      const response = await userClient.post(`/master-data/service/key-processes/${id}/activate`);
      Logger.info('Key process V1 activated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateKeyProcessV1:', error.message);
      throw error;
    }
  };

  const deactivateKeyProcessV1 = async id => {
    try {
      Logger.info('Deactivating key process V1 with ID:', id);
      const response = await userClient.post(`/master-data/service/key-processes/${id}/deactivate`);
      Logger.info('Key process V1 deactivated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateKeyProcessV1:', error.message);
      throw error;
    }
  };

  const listAssessorDomains = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/assessor-domains${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listAssessorDomains response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in listAssessorDomains:', error.message);
      throw error;
    }
  };

  const getAssessorDomain = async id => {
    try {
      const response = await userClient.get(`/master-data/assessor-domains/${id}`);
      Logger.info('getAssessorDomain response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getAssessorDomain:', error.message);
      throw error;
    }
  };

  // Outsourced Components Services
  const listOutsourcedComponents = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/service/outsourced-components${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listOutsourcedComponents response:', response);
      return response;
    } catch (error) {
      Logger.error('Error in listOutsourcedComponents:', error.message);
      throw error;
    }
  };

  const getOutsourcedComponent = async id => {
    try {
      const response = await userClient.get(`/master-data/service/outsourced-components/${id}`);
      Logger.info('getOutsourcedComponent response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getOutsourcedComponent:', error.message);
      throw error;
    }
  };

  const createOutsourcedComponent = async payload => {
    try {
      const response = await userClient.post('/master-data/service/outsourced-components', payload);
      Logger.info('createOutsourcedComponent response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createOutsourcedComponent:', error.message);
      throw error;
    }
  };

  const updateOutsourcedComponent = async payload => {
    try {
      const response = await userClient.put(`/master-data/service/outsourced-components/${payload.id}`, payload);
      Logger.info('updateOutsourcedComponent response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateOutsourcedComponent:', error.message);
      throw error;
    }
  };

  const activateOutsourcedComponent = async id => {
    try {
      Logger.info('Activating outsourced component with ID:', id);
      const response = await userClient.post(`/master-data/service/outsourced-components/${id}/activate`);
      Logger.info('Outsourced component activated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateOutsourcedComponent:', error.message);
      throw error;
    }
  };

  const deactivateOutsourcedComponent = async id => {
    try {
      Logger.info('Deactivating outsourced component with ID:', id);
      const response = await userClient.post(`/master-data/service/outsourced-components/${id}/deactivate`);
      Logger.info('Outsourced component deactivated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateOutsourcedComponent:', error.message);
      throw error;
    }
  };

  const createAssessorDomain = async payload => {
    try {
      const response = await userClient.post('/master-data/assessor-domains', payload);
      Logger.info('createAssessorDomain response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createAssessorDomain:', error.message);
      throw error;
    }
  };

  const updateAssessorDomain = async payload => {
    try {
      const response = await userClient.put(`/master-data/assessor-domains/${payload.id}`, payload);
      Logger.info('updateAssessorDomain response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateAssessorDomain:', error.message);
      throw error;
    }
  };

  const activateAssessorDomain = async id => {
    try {
      Logger.info('Activating assessor domain with ID:', id);
      const response = await userClient.post(`/master-data/assessor-domains/${id}/activate`);
      Logger.info('Assessor domain activated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateAssessorDomain:', error.message);
      throw error;
    }
  };

  const deactivateAssessorDomain = async id => {
    try {
      Logger.info('Deactivating assessor domain with ID:', id);
      const response = await userClient.post(`/master-data/assessor-domains/${id}/deactivate`);
      Logger.info('Assessor domain deactivated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateAssessorDomain:', error.message);
      throw error;
    }
  };

  // Bought-out Parts Services
  const listBoughtOutParts = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/manufacturing/bought-out-parts${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listBoughtOutParts response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in listBoughtOutParts:', error.message);
      throw error;
    }
  };

  const getBoughtOutPart = async id => {
    try {
      const response = await userClient.get(`/master-data/manufacturing/bought-out-parts/${id}`);
      Logger.info('getBoughtOutPart response:', response.data?.data ?? response.data);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getBoughtOutPart:', error.message);
      throw error;
    }
  };

  const createBoughtOutPart = async payload => {
    try {
      const response = await userClient.post('/master-data/manufacturing/bought-out-parts', payload);
      Logger.info('createBoughtOutPart response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createBoughtOutPart:', error.message);
      throw error;
    }
  };

  const updateBoughtOutPart = async payload => {
    try {
      const response = await userClient.put(`/master-data/manufacturing/bought-out-parts/${payload.id}`, payload);
      Logger.info('updateBoughtOutPart response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateBoughtOutPart:', error.message);
      throw error;
    }
  };

  const activateBoughtOutPart = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/bought-out-parts/${id}/activate`);
      Logger.info('activateBoughtOutPart response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateBoughtOutPart:', error.message);
      throw error;
    }
  };

  const deactivateBoughtOutPart = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/bought-out-parts/${id}/deactivate`);
      Logger.info('deactivateBoughtOutPart response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateBoughtOutPart:', error.message);
      throw error;
    }
  };

  // Vendor Categories Services
  const listVendorCategories = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/manufacturing/vendor-categories${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listVendorCategories response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in listVendorCategories:', error.message);
      throw error;
    }
  };

  const getVendorCategory = async id => {
    try {
      const response = await userClient.get(`/master-data/manufacturing/vendor-categories/${id}`);
      Logger.info('getVendorCategory response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getVendorCategory:', error.message);
      throw error;
    }
  };

  const createVendorCategory = async payload => {
    try {
      const response = await userClient.post('/master-data/manufacturing/vendor-categories', payload);
      Logger.info('createVendorCategory response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createVendorCategory:', error.message);
      throw error;
    }
  };

  const updateVendorCategory = async payload => {
    try {
      const response = await userClient.put(`/master-data/manufacturing/vendor-categories/${payload.id}`, payload);
      Logger.info('updateVendorCategory response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateVendorCategory:', error.message);
      throw error;
    }
  };

  const activateVendorCategory = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/vendor-categories/${id}/activate`);
      Logger.info('activateVendorCategory response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateVendorCategory:', error.message);
      throw error;
    }
  };

  const deactivateVendorCategory = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/vendor-categories/${id}/deactivate`);
      Logger.info('deactivateVendorCategory response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateVendorCategory:', error.message);
      throw error;
    }
  };

  // Key Services Services
  const listKeyProcesses = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/manufacturing/key-processes${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listKeyProcesses response:', response);
      return response;
    } catch (error) {
      Logger.error('Error in listKeyProcesses:', error.message);
      throw error;
    }
  };

  const listVendorLabs = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/service/vendor-labs${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listVendorLabs response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in listVendorLabs:', error.message);
      throw error;
    }
  };

  const getVendorLab = async id => {
    try {
      const response = await userClient.get(`/master-data/service/vendor-labs/${id}`);
      Logger.info('getVendorLab response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getVendorLab:', error.message);
      throw error;
    }
  };

  const createVendorLab = async payload => {
    try {
      const response = await userClient.post('/master-data/service/vendor-labs', payload);
      Logger.info('createVendorLab response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createVendorLab:', error.message);
      throw error;
    }
  };

  const updateVendorLab = async payload => {
    try {
      const response = await userClient.put(`/master-data/service/vendor-labs/${payload.id}`, payload);
      Logger.info('updateVendorLab response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateVendorLab:', error.message);
      throw error;
    }
  };

  const activateVendorLab = async id => {
    try {
      Logger.info('Activating vendor lab with ID:', id);
      const response = await userClient.post(`/master-data/service/vendor-labs/${id}/activate`);
      Logger.info('Vendor lab activated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateVendorLab:', error.message);
      throw error;
    }
  };

  const deactivateVendorLab = async id => {
    try {
      Logger.info('Deactivating vendor lab with ID:', id);
      const response = await userClient.post(`/master-data/service/vendor-labs/${id}/deactivate`);
      Logger.info('Vendor lab deactivated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateVendorLab:', error.message);
      throw error;
    }
  };

  const getKeyProcess = async id => {
    try {
      const response = await userClient.get(`/master-data/manufacturing/key-processes/${id}`);
      Logger.info('getKeyProcess response:', response);
      return response?.data?.data;
    } catch (error) {
      // Labs Services

      Logger.error('Error in getKeyProcess:', error.message);
      throw error;
    }
  };

  const createKeyProcess = async payload => {
    try {
      const response = await userClient.post('/master-data/manufacturing/key-processes', payload);
      Logger.info('createKeyProcess response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createKeyProcess:', error.message);
      throw error;
    }
  };

  const updateKeyProcess = async payload => {
    try {
      const response = await userClient.put(`/master-data/manufacturing/key-processes/${payload.id}`, payload);
      Logger.info('updateKeyProcess response:', response);
      return response?.data;
    } catch (error) {
      Logger.error('Error in updateKeyProcess:', error.message);
      throw error;
    }
  };

  const activateKeyProcess = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/key-processes/${id}/activate`);
      Logger.info('activateKeyProcess response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateKeyProcess:', error.message);
      throw error;
    }
  };

  const deactivateKeyProcess = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/key-processes/${id}/deactivate`);
      Logger.info('deactivateKeyProcess response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateKeyProcess:', error.message);
      throw error;
    }
  };

  // Manufacturing Stores Services
  const listManufacturingStores = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/manufacturing/stores${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listManufacturingStores response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in listManufacturingStores:', error.message);
      throw error;
    }
  };

  const getManufacturingStore = async id => {
    try {
      const response = await userClient.get(`/master-data/manufacturing/stores/${id}`);
      Logger.info('getManufacturingStore response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in getManufacturingStore:', error.message);
      throw error;
    }
  };

  const createManufacturingStore = async payload => {
    try {
      const response = await userClient.post('/master-data/manufacturing/stores', payload);
      Logger.info('createManufacturingStore response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createManufacturingStore:', error.message);
      throw error;
    }
  };

  const updateManufacturingStore = async payload => {
    try {
      const response = await userClient.put(`/master-data/manufacturing/stores/${payload.id}`, payload);
      Logger.info('updateManufacturingStore response:88888', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateManufacturingStore:', error.message);
      throw error;
    }
  };

  const activateManufacturingStore = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/stores/${id}/activate`);
      Logger.info('activateManufacturingStore response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateManufacturingStore:', error.message);
      throw error;
    }
  };

  const deactivateManufacturingStore = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/stores/${id}/deactivate`);
      Logger.info('deactivateManufacturingStore response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateManufacturingStore:', error.message);
      throw error;
    }
  };

  // Key Resources Services
  const listKeyResources = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/service/key-resources${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listKeyResources response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in listKeyResources:', error.message);
      throw error;
    }
  };

  const getKeyResource = async id => {
    try {
      const response = await userClient.get(`/master-data/service/key-resources/${id}`);
      Logger.info('getKeyResource response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getKeyResource:', error.message);
      throw error;
    }
  };

  const createKeyResource = async payload => {
    try {
      const response = await userClient.post('/master-data/service/key-resources', payload);
      Logger.info('createKeyResource response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createKeyResource:', error.message);
      throw error;
    }
  };

  const updateKeyResource = async payload => {
    try {
      const response = await userClient.put(`/master-data/service/key-resources/${payload.id}`, payload);
      Logger.info('updateKeyResource response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateKeyResource:', error.message);
      throw error;
    }
  };

  const activateKeyResource = async id => {
    try {
      Logger.info('Activating key resource with ID:', id);
      const response = await userClient.post(`/master-data/service/key-resources/${id}/activate`);
      Logger.info('Key resource activated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateKeyResource:', error.message);
      throw error;
    }
  };

  const deactivateKeyResource = async id => {
    try {
      Logger.info('Deactivating key resource with ID:', id);
      const response = await userClient.post(`/master-data/service/key-resources/${id}/deactivate`);
      Logger.info('Key resource deactivated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateKeyResource:', error.message);
      throw error;
    }
  };

  // Third Party Certs Services
  const listThirdPartyCerts = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/third-party-certs${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listThirdPartyCerts response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in listThirdPartyCerts:', error.message);
      throw error;
    }
  };

  const getThirdPartyCert = async id => {
    try {
      const response = await userClient.get(`/master-data/third-party-certs/${id}`);
      Logger.info('getThirdPartyCert response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in getThirdPartyCert:', error.message);
      throw error;
    }
  };

  const createThirdPartyCert = async payload => {
    try {
      const response = await userClient.post('/master-data/third-party-certs', payload);
      Logger.info('createThirdPartyCert response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createThirdPartyCert:', error.message);
      throw error;
    }
  };

  const updateThirdPartyCert = async payload => {
    try {
      const response = await userClient.put(`/master-data/third-party-certs/${payload.id}`, payload);
      Logger.info('updateThirdPartyCert response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateThirdPartyCert:', error.message);
      throw error;
    }
  };

  const deleteThirdPartyCert = async id => {
    try {
      const response = await userClient.delete(`/master-data/third-party-certs/${id}`);
      Logger.info('deleteThirdPartyCert response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deleteThirdPartyCert:', error.message);
      throw error;
    }
  };

  const activateThirdPartyCert = async id => {
    try {
      Logger.info('Activating third-party cert with ID:', id);
      const response = await userClient.post(`/master-data/third-party-certs/${id}/activate`);
      Logger.info('Third-party cert activated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateThirdPartyCert:', error.message);
      throw error;
    }
  };

  const deactivateThirdPartyCert = async id => {
    try {
      Logger.info('Deactivating third-party cert with ID:', id);
      const response = await userClient.post(`/master-data/third-party-certs/${id}/deactivate`);
      Logger.info('Third-party cert deactivated successfully:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateThirdPartyCert:', error.message);
      throw error;
    }
  };
  // Raw Materials Services
  const listRawMaterials = async params => {
    const queryString = buildPaginationParams(params);
    const url = `/master-data/manufacturing/raw-materials${queryString}`;
    try {
      const response = await userClient.get(url);
      Logger.info('listRawMaterials response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in listRawMaterials:', error.message);
      throw error;
    }
  };

  const getRawMaterial = async id => {
    try {
      const response = await userClient.get(`/master-data/manufacturing/raw-materials/${id}`);
      Logger.info('getRawMaterial response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in getRawMaterial:', error.message);
      throw error;
    }
  };

  const createRawMaterial = async payload => {
    try {
      const response = await userClient.post('/master-data/manufacturing/raw-materials', payload);
      Logger.info('createRawMaterial response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in createRawMaterial:', error.message);
      throw error;
    }
  };

  const updateRawMaterial = async payload => {
    try {
      const response = await userClient.put(`/master-data/manufacturing/raw-materials/${payload.id}`, payload);
      Logger.info('updateRawMaterial response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in updateRawMaterial:', error.message);
      throw error;
    }
  };

  const activateRawMaterial = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/raw-materials/${id}/activate`);
      Logger.info('activateRawMaterial response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in activateRawMaterial:', error.message);
      throw error;
    }
  };

  const deactivateRawMaterial = async id => {
    try {
      const response = await userClient.post(`/master-data/manufacturing/raw-materials/${id}/deactivate`);
      Logger.info('deactivateRawMaterial response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in deactivateRawMaterial:', error.message);
      throw error;
    }
  };

  const pinCode = async data => {
    try {
      const queryParams = [];

      if (data?.pincode) {
        queryParams.push(`pincode=${encodeURIComponent(data.pincode)}`);
      }

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const url = `/master-data/pincodes${queryString}`;
      const response = await userClient.get(url);
      Logger.info('Response in UserManagementServices.getAllUsers:pincode', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in pincode:', error.message);
      throw error;
    }
  };

  const getState = async params => {
    try {
      const queryString = buildPaginationParams(params);

      const url = `/master-data/states${queryString}`;

      const response = await userClient.get(url);
      Logger.info('Response in state:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in state:', error.message);
      throw error;
    }
  };

  const getDistricts = async id => {
    try {
      const url = `/master-data/districts?all=true&stateName=${id}`;
      const response = await userClient.get(url);
      Logger.info('Response in districts:78', response.data);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in districts:', error.message);
      throw error;
    }
  };
  const listCountries = async params => {
    try {
      const queryString = buildPaginationParams(params);

      const response = await userClient.get(`/master-data/countries${queryString}`);
      Logger.info('listCountries response:', response);
      return response.data?.data ?? response.data;
    } catch (error) {
      Logger.error('Error in listCountries:', error.message);
      throw error;
    }
  };

  return {
    // v1 Key Resources
    listKeyProcessV1,
    getKeyProcessV1,
    createKeyProcessV1,
    updateKeyProcessV1,
    activateKeyProcessV1,
    deactivateKeyProcessV1,
    listAssessorDomains,
    getAssessorDomain,
    createAssessorDomain,
    updateAssessorDomain,
    activateAssessorDomain,
    deactivateAssessorDomain,
    listBoughtOutParts,
    getBoughtOutPart,
    createBoughtOutPart,
    updateBoughtOutPart,
    activateBoughtOutPart,
    deactivateBoughtOutPart,
    listVendorCategories,
    getVendorCategory,
    createVendorCategory,
    updateVendorCategory,
    activateVendorCategory,
    deactivateVendorCategory,
    listKeyProcesses,
    getKeyProcess,
    createKeyProcess,
    updateKeyProcess,
    activateKeyProcess,
    deactivateKeyProcess,
    listManufacturingStores,
    getManufacturingStore,
    createManufacturingStore,
    updateManufacturingStore,
    activateManufacturingStore,
    deactivateManufacturingStore,
    listRawMaterials,
    getRawMaterial,
    createRawMaterial,
    updateRawMaterial,
    activateRawMaterial,
    deactivateRawMaterial,
    listThirdPartyCerts,
    getThirdPartyCert,
    createThirdPartyCert,
    updateThirdPartyCert,
    deleteThirdPartyCert,
    activateThirdPartyCert,
    deactivateThirdPartyCert,
    listKeyResources,
    getKeyResource,
    createKeyResource,
    updateKeyResource,
    activateKeyResource,
    deactivateKeyResource,
    pinCode,
    getState,
    getDistricts,
    listCountries,
    getOutsourcedComponent,
    listOutsourcedComponents,
    createOutsourcedComponent,
    updateOutsourcedComponent,
    activateOutsourcedComponent,
    deactivateOutsourcedComponent,
    listVendorLabs,
    getVendorLab,
    createVendorLab,
    updateVendorLab,
    activateVendorLab,
    deactivateVendorLab,
    listVendorCategoriesV1,
    getVendorCategoryV1,
    createVendorCategoryV1,
    updateVendorCategoryV1,
    activateVendorCategoryV1,
    deactivateVendorCategoryV1,
  };
};

export default MasterServices;
