// Labs Actions
import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import MasterServices from '../../../services/api/master/MasterService';
import { Logger } from '../../../utils/logger';

const masterServices = MasterServices();

// Vendor Categories V1 Actions
export const listVendorCategoriesV1Action = createAsyncThunk('master/listVendorCategoriesV1', async (params, { rejectWithValue }) => {
  try {
    const data = await masterServices.listVendorCategoriesV1(params);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const getVendorCategoryV1Action = createAsyncThunk('master/getVendorCategoryV1', async (id, { rejectWithValue }) => {
  try {
    const data = await masterServices.getVendorCategoryV1(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const createVendorCategoryV1Action = createAsyncThunk('master/createVendorCategoryV1', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.createVendorCategoryV1(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateVendorCategoryV1Action = createAsyncThunk('master/updateVendorCategoryV1', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.updateVendorCategoryV1(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateVendorCategoryV1Action = createAsyncThunk('master/activateVendorCategoryV1', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Activating Vendor category V1 with ID:', id);
    const data = await masterServices.activateVendorCategoryV1(id);
    Logger.info('Vendor category V1 activated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to activate Vendor category V1:', error);
    return rejectWithValue(error.message);
  }
});

export const deactivateVendorCategoryV1Action = createAsyncThunk('master/deactivateVendorCategoryV1', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Deactivating Vendor category V1 with ID:', id);
    const data = await masterServices.deactivateVendorCategoryV1(id);
    Logger.info('Vendor category V1 deactivated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to deactivate Vendor category V1:', error);
    return rejectWithValue(error.message);
  }
});

export const listVendorLabsAction = createAsyncThunk('master/listVendorLabs', async (params, { rejectWithValue }) => {
  try {
    const data = await masterServices.listVendorLabs(params);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const getVendorLabAction = createAsyncThunk('master/getVendorLab', async (id, { rejectWithValue }) => {
  try {
    const data = await masterServices.getVendorLab(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const createVendorLabAction = createAsyncThunk('master/createVendorLab', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.createVendorLab(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateVendorLabAction = createAsyncThunk('master/updateVendorLab', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.updateVendorLab(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateVendorLabAction = createAsyncThunk('master/activateVendorLab', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Activating vendor lab with ID:', id);
    const data = await masterServices.activateVendorLab(id);
    Logger.info('Vendor lab activated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to activate vendor lab:', error);
    return rejectWithValue(error.message);
  }
});

export const deactivateVendorLabAction = createAsyncThunk('master/deactivateVendorLab', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Deactivating vendor lab with ID:', id);
    const data = await masterServices.deactivateVendorLab(id);
    Logger.info('Vendor lab deactivated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to deactivate vendor lab:', error);
    return rejectWithValue(error.message);
  }
});

// Key Resources Actions
// Key Resources V1 Actions
export const listKeyProcessV1Action = createAsyncThunk('master/listKeyProcessV1', async (params, { rejectWithValue }) => {
  try {
    const data = await masterServices.listKeyProcessV1(params);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const getKeyProcessV1Action = createAsyncThunk('master/getKeyProcessV1', async (id, { rejectWithValue }) => {
  try {
    const data = await masterServices.getKeyProcessV1(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const createKeyProcessV1Action = createAsyncThunk('master/createKeyProcessV1', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.createKeyProcessV1(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateKeyProcessV1Action = createAsyncThunk('master/updateKeyProcessV1', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.updateKeyProcessV1(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateKeyProcessV1Action = createAsyncThunk('master/activateKeyProcessV1', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Activating key process V1 with ID:', id);
    const data = await masterServices.activateKeyProcessV1(id);
    Logger.info('Key process V1 activated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to activate key process V1:', error);
    return rejectWithValue(error.message);
  }
});

export const deactivateKeyProcessV1Action = createAsyncThunk('master/deactivateKeyProcessV1', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Deactivating key process V1 with ID:', id);
    const data = await masterServices.deactivateKeyProcessV1(id);
    Logger.info('Key process V1 deactivated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to deactivate key process V1:', error);
    return rejectWithValue(error.message);
  }
});

export const listKeyResourcesAction = createAsyncThunk('master/listKeyResources', async (params, { rejectWithValue }) => {
  try {
    const data = await masterServices.listKeyResources(params);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const getKeyResourceAction = createAsyncThunk('master/getKeyResource', async (id, { rejectWithValue }) => {
  try {
    const data = await masterServices.getKeyResource(id);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const createKeyResourceAction = createAsyncThunk('master/createKeyResource', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.createKeyResource(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateKeyResourceAction = createAsyncThunk('master/updateKeyResource', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.updateKeyResource(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateKeyResourceAction = createAsyncThunk('master/activateKeyResource', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Activating key resource with ID:', id);
    const data = await masterServices.activateKeyResource(id);
    Logger.info('Key resource activated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to activate key resource:', error);
    return rejectWithValue(error.message);
  }
});

export const deactivateKeyResourceAction = createAsyncThunk('master/deactivateKeyResource', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Deactivating key resource with ID:', id);
    const data = await masterServices.deactivateKeyResource(id);
    Logger.info('Key resource deactivated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to deactivate key resource:', error);
    return rejectWithValue(error.message);
  }
});

// Outsourced Components Actions
export const listOutsourcedComponentsAction = createAsyncThunk('master/listOutsourcedComponents', async (params, { rejectWithValue }) => {
  try {
    const data = await masterServices.listOutsourcedComponents(params);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const getOutsourcedComponentAction = createAsyncThunk('master/getOutsourcedComponent', async (id, { rejectWithValue }) => {
  try {
    const data = await masterServices.getOutsourcedComponent(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const createOutsourcedComponentAction = createAsyncThunk('master/createOutsourcedComponent', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.createOutsourcedComponent(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateOutsourcedComponentAction = createAsyncThunk('master/updateOutsourcedComponent', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.updateOutsourcedComponent(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateOutsourcedComponentAction = createAsyncThunk('master/activateOutsourcedComponent', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Activating outsourced component with ID:', id);
    const data = await masterServices.activateOutsourcedComponent(id);
    Logger.info('Outsourced component activated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to activate outsourced component:', error);
    return rejectWithValue(error.message);
  }
});

export const deactivateOutsourcedComponentAction = createAsyncThunk('master/deactivateOutsourcedComponent', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Deactivating outsourced component with ID:', id);
    const data = await masterServices.deactivateOutsourcedComponent(id);
    Logger.info('Outsourced component deactivated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to deactivate outsourced component:', error);
    return rejectWithValue(error.message);
  }
});

// Third Party Certs Actions

export const listThirdPartyCertsAction = createAsyncThunk('master/listThirdPartyCerts', async (params, { rejectWithValue }) => {
  try {
    const data = await masterServices.listThirdPartyCerts(params);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const getThirdPartyCertAction = createAsyncThunk('master/getThirdPartyCert', async (id, { rejectWithValue }) => {
  try {
    const data = await masterServices.getThirdPartyCert(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const createThirdPartyCertAction = createAsyncThunk('master/createThirdPartyCert', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.createThirdPartyCert(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateThirdPartyCertAction = createAsyncThunk('master/updateThirdPartyCert', async (payload, { rejectWithValue }) => {
  try {
    const data = await masterServices.updateThirdPartyCert(payload);
    return data;
  } catch (error) {
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const deleteThirdPartyCertAction = createAsyncThunk('master/deleteThirdPartyCert', async (id, { rejectWithValue }) => {
  try {
    const data = await masterServices.deleteThirdPartyCert(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const activateThirdPartyCertAction = createAsyncThunk('master/activateThirdPartyCert', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Activating third-party cert with ID:', id);
    const data = await masterServices.activateThirdPartyCert(id);
    Logger.info('Third-party cert activated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to activate third-party cert:', error);
    return rejectWithValue(error.message);
  }
});

export const deactivateThirdPartyCertAction = createAsyncThunk('master/deactivateThirdPartyCert', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Deactivating third-party cert with ID:', id);
    const data = await masterServices.deactivateThirdPartyCert(id);
    Logger.info('Third-party cert deactivated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to deactivate third-party cert:', error);
    return rejectWithValue(error.message);
  }
});

// Raw Materials
export const listRawMaterialsAction = createAsyncThunk('master/listRawMaterials', async (params, { rejectWithValue }) => {
  try {
    const response = await masterService.listRawMaterials(params);
    Logger.info('List raw materials successful:', response);
    return response;
  } catch (error) {
    Logger.error('List raw materials failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getRawMaterialAction = createAsyncThunk('master/getRawMaterial', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.getRawMaterial(id);
    Logger.info('Get raw material successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get raw material failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const createRawMaterialAction = createAsyncThunk('master/createRawMaterial', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.createRawMaterial(payload);
    Logger.info('Create raw material successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create raw material failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateRawMaterialAction = createAsyncThunk('master/updateRawMaterial', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.updateRawMaterial(payload);
    Logger.info('Update raw material successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update raw material failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateRawMaterialAction = createAsyncThunk('master/activateRawMaterial', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.activateRawMaterial(id);
    Logger.info('Activate raw material successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate raw material failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const deactivateRawMaterialAction = createAsyncThunk('master/deactivateRawMaterial', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.deactivateRawMaterial(id);
    Logger.info('Deactivate raw material successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate raw material failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

const masterService = Api.Master;

// Master Data Actions

export const listAssessorDomainsAction = createAsyncThunk('master/listAssessorDomains', async (data, { rejectWithValue }) => {
  try {
    const response = await masterService.listAssessorDomains(data);
    Logger.info('List assessor domains successful:', response);
    return response;
  } catch (error) {
    Logger.error('List assessor domains failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getAssessorDomainAction = createAsyncThunk('master/getAssessorDomain', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.getAssessorDomain(id);
    Logger.info('Get assessor domain successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get assessor domain failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const createAssessorDomainAction = createAsyncThunk('master/createAssessorDomain', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.createAssessorDomain(payload);
    Logger.info('Create assessor domain successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create assessor domain failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateAssessorDomainAction = createAsyncThunk('master/updateAssessorDomain', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.updateAssessorDomain(payload);
    Logger.info('Update assessor domain successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update assessor domain failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateAssessorDomainAction = createAsyncThunk('master/activateAssessorDomain', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Activating assessor domain with ID:', id);
    const data = await masterService.activateAssessorDomain(id);
    Logger.info('Assessor domain activated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to activate assessor domain:', error);
    return rejectWithValue(error.message);
  }
});

export const deactivateAssessorDomainAction = createAsyncThunk('master/deactivateAssessorDomain', async (id, { rejectWithValue }) => {
  try {
    Logger.info('Deactivating assessor domain with ID:', id);
    const data = await masterService.deactivateAssessorDomain(id);
    Logger.info('Assessor domain deactivated successfully:', data);
    return data;
  } catch (error) {
    Logger.error('Failed to deactivate assessor domain:', error);
    return rejectWithValue(error.message);
  }
});

// Bought-out Parts
export const listBoughtOutPartsAction = createAsyncThunk('master/listBoughtOutParts', async (params, { rejectWithValue }) => {
  try {
    const response = await masterService.listBoughtOutParts(params);
    Logger.info('List bought-out parts successful:', response);
    return response;
  } catch (error) {
    Logger.error('List bought-out parts failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getBoughtOutPartAction = createAsyncThunk('master/getBoughtOutPart', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.getBoughtOutPart(id);
    Logger.info('Get bought-out part successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get bought-out part failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const createBoughtOutPartAction = createAsyncThunk('master/createBoughtOutPart', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.createBoughtOutPart(payload);
    Logger.info('Create bought-out part successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create bought-out part failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateBoughtOutPartAction = createAsyncThunk('master/updateBoughtOutPart', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.updateBoughtOutPart(payload);
    Logger.info('Update bought-out part successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update bought-out part failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateBoughtOutPartAction = createAsyncThunk('master/activateBoughtOutPart', async (id, { rejectWithValue }) => {
  try {
    const response = await masterServices.activateBoughtOutPart(id);
    Logger.info('Activate bought-out part successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate bought-out part failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const deactivateBoughtOutPartAction = createAsyncThunk('master/deactivateBoughtOutPart', async (id, { rejectWithValue }) => {
  try {
    const response = await masterServices.deactivateBoughtOutPart(id);
    Logger.info('Deactivate bought-out part successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate bought-out part failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Vendor Categories
export const listVendorCategoriesAction = createAsyncThunk('master/listVendorCategories', async (data, { rejectWithValue }) => {
  try {
    const response = await masterService.listVendorCategories(data);
    Logger.info('List Vendor categories successful:', response);
    return response;
  } catch (error) {
    Logger.error('List Vendor categories failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getVendorCategoryAction = createAsyncThunk('master/getVendorCategory', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.getVendorCategory(id);
    Logger.info('Get Vendor category successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get Vendor category failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const createVendorCategoryAction = createAsyncThunk('master/createVendorCategory', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.createVendorCategory(payload);
    Logger.info('Create Vendor category successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create Vendor category failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateVendorCategoryAction = createAsyncThunk('master/updateVendorCategory', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.updateVendorCategory(payload);
    Logger.info('Update Vendor category successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update Vendor category failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateVendorCategoryAction = createAsyncThunk('master/activateVendorCategory', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.activateVendorCategory(id);
    Logger.info('Activate Vendor category successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate Vendor category failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const deactivateVendorCategoryAction = createAsyncThunk('master/deactivateVendorCategory', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.deactivateVendorCategory(id);
    Logger.info('Deactivate Vendor category successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate Vendor category failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Key Services
export const listKeyProcessesAction = createAsyncThunk('master/listKeyProcesses', async (params, { rejectWithValue }) => {
  try {
    const response = await masterService.listKeyProcesses(params);
    Logger.info('List key processes successful:', response);
    return response?.data;
  } catch (error) {
    Logger.error('List key processes failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getKeyProcessAction = createAsyncThunk('master/getKeyProcess', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.getKeyProcess(id);
    Logger.info('Get key process successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get key process failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const createKeyProcessAction = createAsyncThunk('master/createKeyProcess', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.createKeyProcess(payload);
    Logger.info('Create key process successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create key process failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateKeyProcessAction = createAsyncThunk('master/updateKeyProcess', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.updateKeyProcess(payload);
    Logger.info('Update key process successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update key process failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateKeyProcessAction = createAsyncThunk('master/activateKeyProcess', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.activateKeyProcess(id);
    Logger.info('Activate key process successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate key process failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const deactivateKeyProcessAction = createAsyncThunk('master/deactivateKeyProcess', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.deactivateKeyProcess(id);
    Logger.info('Deactivate key process successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate key process failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Manufacturing Stores
export const listManufacturingStoresAction = createAsyncThunk('master/listManufacturingStores', async (data, { rejectWithValue }) => {
  try {
    const response = await masterService.listManufacturingStores(data);
    Logger.info('List manufacturing stores successful:', response);
    return response;
  } catch (error) {
    Logger.error('List manufacturing stores failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getManufacturingStoreAction = createAsyncThunk('master/getManufacturingStore', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.getManufacturingStore(id);
    Logger.info('Get manufacturing store successful:', response);
    return response?.data;
  } catch (error) {
    Logger.error('Get manufacturing store failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const createManufacturingStoreAction = createAsyncThunk('master/createManufacturingStore', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.createManufacturingStore(payload);
    Logger.info('Create manufacturing store successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create manufacturing store failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateManufacturingStoreAction = createAsyncThunk('master/updateManufacturingStore', async (payload, { rejectWithValue }) => {
  try {
    const response = await masterService.updateManufacturingStore(payload);
    Logger.info('Update manufacturing store successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update manufacturing store failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const activateManufacturingStoreAction = createAsyncThunk('master/activateManufacturingStore', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.activateManufacturingStore(id);
    Logger.info('Activate manufacturing store successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate manufacturing store failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const deactivateManufacturingStoreAction = createAsyncThunk('master/deactivateManufacturingStore', async (id, { rejectWithValue }) => {
  try {
    const response = await masterService.deactivateManufacturingStore(id);
    Logger.info('Deactivate manufacturing store successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate manufacturing store failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// pinCodeAction accepts an optional per-field `key` so concurrent lookups on the
// same screen (e.g., registered office vs unit) don't overwrite each other.
// Callers that don't pass a key still work via the 'default' bucket + deprecated shim.
export const pinCodeAction = createAsyncThunk('master/pinCode', async (payload, { rejectWithValue }) => {
  const key = payload?.key ?? 'default';
  const { key: _ignored, ...data } = payload ?? {};
  try {
    const response = await masterService.pinCode(data);
    Logger.info('Pin code fetch successful:', response);
    return { key, data: response };
  } catch (error) {
    Logger.error('Pin code fetch failed:', error);
    return rejectWithValue({ key, error: error?.response?.data ?? error?.message ?? 'An unknown error occurred' });
  }
});

export const getStateAction = createAsyncThunk('master/getState', async (data, { rejectWithValue }) => {
  try {
    const response = await masterService.getState(data);
    Logger.info('District fetch successful:', response);
    return response;
  } catch (error) {
    Logger.error('District fetch failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
export const getDistrictsAction = createAsyncThunk('master/getDistricts', async (id, { rejectWithValue }) => {
  try {
    const data = await masterServices.getDistricts(id);
    return data;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});
// Countries
export const listCountriesAction = createAsyncThunk('master/listCountries', async (data, { rejectWithValue }) => {
  try {
    const response = await masterService.listCountries(data);
    Logger.info('List countries successful:', response);
    return response;
  } catch (error) {
    Logger.error('List countries failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

const userService = Api.User;

export const updateUserAction = createAsyncThunk('users/updateUser', async (payload, { rejectWithValue }) => {
  try {
    const response = await userService.updateUser(payload);
    Logger.info('Update user successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update user failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getUserAction = createAsyncThunk('users/getUser', async (id, { rejectWithValue }) => {
  try {
    const response = await userService.getUser(id);
    Logger.info('Get user successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get user failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
