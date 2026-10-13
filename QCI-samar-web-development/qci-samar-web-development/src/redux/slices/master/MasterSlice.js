import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  activateAssessorDomainAction,
  activateBoughtOutPartAction,
  activateKeyProcessAction,
  activateKeyProcessV1Action,
  activateKeyResourceAction,
  activateManufacturingStoreAction,
  activateOutsourcedComponentAction,
  activateRawMaterialAction,
  activateThirdPartyCertAction,
  activateVendorCategoryAction,
  activateVendorCategoryV1Action,
  activateVendorLabAction,
  createAssessorDomainAction,
  createBoughtOutPartAction,
  createKeyProcessAction,
  createKeyProcessV1Action,
  createKeyResourceAction,
  createManufacturingStoreAction,
  createOutsourcedComponentAction,
  createRawMaterialAction,
  createThirdPartyCertAction,
  createVendorCategoryAction,
  createVendorCategoryV1Action,
  createVendorLabAction,
  deactivateAssessorDomainAction,
  deactivateBoughtOutPartAction,
  deactivateKeyProcessAction,
  deactivateKeyProcessV1Action,
  deactivateKeyResourceAction,
  deactivateManufacturingStoreAction,
  deactivateOutsourcedComponentAction,
  deactivateRawMaterialAction,
  deactivateThirdPartyCertAction,
  deactivateVendorCategoryAction,
  deactivateVendorCategoryV1Action,
  deactivateVendorLabAction,
  deleteThirdPartyCertAction,
  getAssessorDomainAction,
  getBoughtOutPartAction,
  getDistrictsAction,
  getKeyProcessAction,
  getKeyProcessV1Action,
  getKeyResourceAction,
  getManufacturingStoreAction,
  getOutsourcedComponentAction,
  getRawMaterialAction,
  getStateAction,
  getThirdPartyCertAction,
  getUserAction,
  getVendorCategoryAction,
  getVendorCategoryV1Action,
  getVendorLabAction,
  listAssessorDomainsAction,
  listBoughtOutPartsAction,
  listCountriesAction,
  listKeyProcessesAction,
  listKeyProcessV1Action,
  listKeyResourcesAction,
  listManufacturingStoresAction,
  listOutsourcedComponentsAction,
  listRawMaterialsAction,
  listThirdPartyCertsAction,
  listVendorCategoriesAction,
  listVendorCategoriesV1Action,
  listVendorLabsAction,
  pinCodeAction,
  updateAssessorDomainAction,
  updateBoughtOutPartAction,
  updateKeyProcessAction,
  updateKeyProcessV1Action,
  updateKeyResourceAction,
  updateManufacturingStoreAction,
  updateOutsourcedComponentAction,
  updateRawMaterialAction,
  updateThirdPartyCertAction,
  updateUserAction,
  updateVendorCategoryAction,
  updateVendorCategoryV1Action,
  updateVendorLabAction,
} from '../../action/master/MasterAction';

const initialState = {
  districts: null,
  districtsLoading: false,
  districtsError: null,

  // Vendor Categories V1
  drdoVendorCategoriesV1: null,
  drdoVendorCategoriesV1Loading: false,
  drdoVendorCategoriesV1Error: null,
  vendorCategoryV1: null,
  createVendorCategoryV1Loading: false,
  createVendorCategoryV1Error: null,
  createVendorCategoryV1: null,
  updateVendorCategoryV1Loading: false,
  updateVendorCategoryV1Error: null,
  updateVendorCategoryV1: null,
  getVendorCategoryV1Loading: false,
  getVendorCategoryV1Error: null,
  getVendorCategoryV1: null,
  activateVendorCategoryV1Loading: false,
  activateVendorCategoryV1Error: null,
  activateVendorCategoryV1: null,
  deactivateVendorCategoryV1Loading: false,
  deactivateVendorCategoryV1Error: null,
  deactivateVendorCategoryV1: null,

  organizations: null,
  organizationsLoading: false,
  organizationsError: null,
  updateLoading: false,
  updateError: null,

  assessorDomains: null,
  assessorDomainsLoading: false,
  assessorDomainsError: null,
  assessorDomain: null,

  createAssessorDomainLoading: false,
  createAssessorDomainError: null,
  createAssessorDomain: null,
  updateAssessorDomainLoading: false,
  updateAssessorDomainError: null,
  updateAssessorDomain: null,
  getAssessorDomainLoading: false,
  getAssessorDomainError: null,
  getAssessorDomain: null,
  deleteAssessorDomainLoading: false,
  deleteAssessorDomainError: null,
  deleteAssessorDomain: null,
  activateAssessorDomainLoading: false,
  activateAssessorDomainError: null,
  activateAssessorDomain: null,
  deactivateAssessorDomainLoading: false,
  deactivateAssessorDomainError: null,
  deactivateAssessorDomain: null,

  boughtOutParts: null,
  boughtOutPartsLoading: false,
  boughtOutPartsError: null,
  boughtOutPart: null,

  drdoVendorCategories: null,
  drdoVendorCategoriesLoading: false,
  drdoVendorCategoriesError: null,
  vendorCategory: null,
  activateVendorCategoryLoading: false,
  activateVendorCategoryError: null,
  activateVendorCategory: null,
  deactivateVendorCategoryLoading: false,
  deactivateVendorCategoryError: null,
  deactivateVendorCategory: null,

  countries: null,
  countriesLoading: false,
  countriesError: null,

  getKeyProcesses: null,
  keyProcessesLoading: false,
  keyProcessesError: null,
  keyProcess: null,
  activateKeyProcessLoading: false,
  activateKeyProcessError: null,
  activateKeyProcess: null,
  deactivateKeyProcessLoading: false,
  deactivateKeyProcessError: null,
  deactivateKeyProcess: null,

  manufacturingStores: null,
  manufacturingStoresLoading: false,
  manufacturingStoresError: null,
  manufacturingStore: null,

  createManufacturingStore: null,
  createManufacturingStoresLoading: false,
  createManufacturingStoresError: null,

  updateManufacturingStore: null,
  updateManufacturingStoresLoading: false,
  updateManufacturingStoresError: null,
  activateManufacturingStoreLoading: false,
  activateManufacturingStoreError: null,
  activateManufacturingStore: null,
  deactivateManufacturingStoreLoading: false,
  deactivateManufacturingStoreError: null,
  deactivateManufacturingStore: null,

  // Per-field pincode lookup state, keyed so concurrent lookups (e.g., registered office
  // vs unit) don't overwrite each other. Keys are owned by consumers
  // (e.g., 'registeredOffice', 'unit', 'enterpriseRegisteredOffice', 'editUnit', 'addAssessor', ...).
  pinCodeLookups: {},
  pinCodeLoadingByKey: {},
  pinCodeErrorByKey: {},
  // The pincode each key's latest lookup was fetched for — lets consumers tell
  // a settled result apart from a stale one and detect a genuine "not found".
  pinCodeQueriedByKey: {},
  // Deprecated shims — mirror the 'default' key for any caller not yet migrated.
  pinCode: '',
  pinCodeLoading: false,
  pinCodeError: null,

  getState: '',
  getStateLoading: false,
  getStateError: null,

  user: null,
  userLoading: false,
  userError: null,
  updateUserLoading: false,
  updateUserError: null,
  updateUser: null,

  createdrdoVendorCategoriesLoading: false,
  createdrdoVendorCategoriesError: null,
  createvendorCategory: null,
  updatedrdoVendorCategoriesLoading: false,
  updatedrdoVendorCategoriesError: null,
  updatevendorCategory: null,

  createkeyProcessesLoading: false,
  createkeyProcessesError: null,
  createkeyProcess: null,
  updatekeyProcessesLoading: false,
  updatekeyProcessesError: null,
  updatekeyProcess: null,

  createBoughtOutPartLoading: false,
  createBoughtOutPartError: null,
  createBoughtOutPart: null,
  updateBoughtOutPartLoading: false,
  updateBoughtOutPartError: null,
  updateBoughtOutPart: null,
  getBoughtOutPartLoading: false,
  getBoughtOutPartError: null,
  getBoughtOutPart: null,
  activateBoughtOutPartLoading: false,
  activateBoughtOutPartError: null,
  deactivateBoughtOutPartLoading: false,
  deactivateBoughtOutPartError: null,

  // Raw Materials
  rawMaterials: null,
  rawMaterialsLoading: false,
  rawMaterialsError: null,
  rawMaterial: null,
  createRawMaterialLoading: false,
  createRawMaterialError: null,
  createRawMaterial: null,
  updateRawMaterialLoading: false,
  updateRawMaterialError: null,
  updateRawMaterial: null,
  getRawMaterialLoading: false,
  getRawMaterialError: null,
  getRawMaterial: null,
  activateRawMaterialLoading: false,
  activateRawMaterialError: null,
  activateRawMaterial: null,
  deactivateRawMaterialLoading: false,
  deactivateRawMaterialError: null,
  deactivateRawMaterial: null,

  thirdPartyCerts: null,
  thirdPartyCertsLoading: false,
  thirdPartyCertsError: null,
  createThirdPartyCertLoading: false,
  createThirdPartyCertError: null,
  createThirdPartyCert: null,
  updateThirdPartyCertLoading: false,
  updateThirdPartyCertError: null,
  updateThirdPartyCert: null,
  getThirdPartyCertLoading: false,
  getThirdPartyCertError: null,
  getThirdPartyCert: null,
  activateThirdPartyCertLoading: false,
  activateThirdPartyCertError: null,
  activateThirdPartyCert: null,
  deactivateThirdPartyCertLoading: false,
  deactivateThirdPartyCertError: null,
  deactivateThirdPartyCert: null,

  outsourcedComponents: null,
  outsourcedComponentsLoading: false,
  outsourcedComponentsError: null,
  outsourcedComponent: null,
  createOutsourcedComponentLoading: false,
  createOutsourcedComponentError: null,
  createOutsourcedComponent: null,
  updateOutsourcedComponentLoading: false,
  updateOutsourcedComponentError: null,
  updateOutsourcedComponent: null,
  getOutsourcedComponentLoading: false,
  getOutsourcedComponentError: null,
  getOutsourcedComponent: null,
  activateOutsourcedComponentLoading: false,
  activateOutsourcedComponentError: null,
  activateOutsourcedComponent: null,
  deactivateOutsourcedComponentLoading: false,
  deactivateOutsourcedComponentError: null,
  deactivateOutsourcedComponent: null,

  keyResources: null,
  keyResourcesLoading: false,
  keyResourcesError: null,
  keyResource: null,
  createKeyResourceLoading: false,
  createKeyResourceError: null,
  createKeyResource: null,
  updateKeyResourceLoading: false,
  updateKeyResourceError: null,
  updateKeyResource: null,
  getKeyResourceLoading: false,
  getKeyResourceError: null,
  getKeyResource: null,
  activateKeyResourceLoading: false,
  activateKeyResourceError: null,
  activateKeyResource: null,
  deactivateKeyResourceLoading: false,
  deactivateKeyResourceError: null,
  deactivateKeyResource: null,
  vendorLabs: null,
  vendorLabsLoading: false,
  vendorLabsError: null,
  vendorLab: null,
  createVendorLabLoading: false,
  createVendorLabError: null,
  createVendorLab: null,
  updateVendorLabLoading: false,
  updateVendorLabError: null,
  updateVendorLab: null,
  getVendorLabLoading: false,
  getVendorLabError: null,
  getVendorLab: null,
  activateVendorLabLoading: false,
  activateVendorLabError: null,
  activateVendorLab: null,
  deactivateVendorLabLoading: false,
  deactivateVendorLabError: null,
  deactivateVendorLab: null,

  // Key Resources V1
  keyProcessV1: null,
  keyProcessV1Loading: false,
  keyProcessV1Error: null,
  createKeyProcessV1Loading: false,
  createKeyProcessV1Error: null,
  createKeyProcessV1: null,
  updateKeyProcessV1Loading: false,
  updateKeyProcessV1Error: null,
  updateKeyProcessV1: null,
  getKeyProcessV1Loading: false,
  getKeyProcessV1Error: null,
  getKeyProcessV1: null,
  activateKeyProcessV1Loading: false,
  activateKeyProcessV1Error: null,
  activateKeyProcessV1: null,
  deactivateKeyProcessV1Loading: false,
  deactivateKeyProcessV1Error: null,
  deactivateKeyProcessV1: null,

  deactivateBoughtOutPart: null,
  activateBoughtOutPart: null,
};

const masterSlice = createSlice({
  name: 'master',
  initialState,
  reducers: {
    resetPinCode: (state, action) => {
      const key = action?.payload?.key;
      if (key) {
        delete state.pinCodeLookups[key];
        delete state.pinCodeLoadingByKey[key];
        delete state.pinCodeErrorByKey[key];
        delete state.pinCodeQueriedByKey[key];
        if (key === 'default') {
          state.pinCode = '';
          state.pinCodeLoading = false;
          state.pinCodeError = null;
        }
      } else {
        state.pinCodeLookups = {};
        state.pinCodeLoadingByKey = {};
        state.pinCodeErrorByKey = {};
        state.pinCodeQueriedByKey = {};
        state.pinCode = '';
        state.pinCodeLoading = false;
        state.pinCodeError = null;
      }
      state.districts = null;
    },
    resetGetState: state => {
      state.getState = '';
      state.getStateLoading = false;
      state.getStateError = null;
    },
    resetUser: state => {
      state.user = null;
      state.userLoading = false;
      state.userError = null;
    },
    resetVendorCategoryCreateUpdate: state => {
      state.createdrdoVendorCategoriesLoading = false;
      state.createdrdoVendorCategoriesError = null;
      state.createvendorCategory = null;
      state.updatedrdoVendorCategoriesLoading = false;
      state.updatedrdoVendorCategoriesError = null;
      state.updatevendorCategory = null;
      state.activateVendorCategoryLoading = false;
      state.activateVendorCategoryError = null;
      state.activateVendorCategory = null;
      state.deactivateVendorCategoryLoading = false;
      state.deactivateVendorCategoryError = null;
      state.deactivateVendorCategory = null;
    },
    resetRawMaterialCreateUpdate: state => {
      state.createRawMaterialLoading = false;
      state.createRawMaterialError = null;
      state.createRawMaterial = null;
      state.updateRawMaterialLoading = false;
      state.updateRawMaterialError = null;
      state.updateRawMaterial = null;
      state.activateRawMaterialLoading = false;
      state.activateRawMaterialError = null;
      state.activateRawMaterial = null;
      state.deactivateRawMaterialLoading = false;
      state.deactivateRawMaterialError = null;
      state.deactivateRawMaterial = null;
    },
    resetThirdPartyCertCreateUpdate: state => {
      state.createThirdPartyCertLoading = false;
      state.createThirdPartyCertError = null;
      state.createThirdPartyCert = null;
      state.updateThirdPartyCertLoading = false;
      state.updateThirdPartyCertError = null;
      state.updateThirdPartyCert = null;
      state.activateThirdPartyCertLoading = false;
      state.activateThirdPartyCertError = null;
      state.activateThirdPartyCert = null;
      state.deactivateThirdPartyCertLoading = false;
      state.deactivateThirdPartyCertError = null;
      state.deactivateThirdPartyCert = null;
    },
    resetOutsourcedComponentCreateUpdate: state => {
      state.createOutsourcedComponentLoading = false;
      state.createOutsourcedComponentError = null;
      state.createOutsourcedComponent = null;
      state.updateOutsourcedComponentLoading = false;
      state.updateOutsourcedComponentError = null;
      state.updateOutsourcedComponent = null;
      state.activateOutsourcedComponentLoading = false;
      state.activateOutsourcedComponentError = null;
      state.activateOutsourcedComponent = null;
      state.deactivateOutsourcedComponentLoading = false;
      state.deactivateOutsourcedComponentError = null;
      state.deactivateOutsourcedComponent = null;
    },
    resetKeyResourceCreateUpdate: state => {
      state.createKeyResourceLoading = false;
      state.createKeyResourceError = null;
      state.createKeyResource = null;
      state.updateKeyResourceLoading = false;
      state.updateKeyResourceError = null;
      state.updateKeyResource = null;
      state.activateKeyResourceLoading = false;
      state.activateKeyResourceError = null;
      state.activateKeyResource = null;
      state.deactivateKeyResourceLoading = false;
      state.deactivateKeyResourceError = null;
      state.deactivateKeyResource = null;
    },
    resetKeyProcessV1CreateUpdate: state => {
      state.createKeyProcessV1Loading = false;
      state.createKeyProcessV1Error = null;
      state.createKeyProcessV1 = null;
      state.updateKeyProcessV1Loading = false;
      state.updateKeyProcessV1Error = null;
      state.updateKeyProcessV1 = null;
      state.activateKeyProcessV1Loading = false;
      state.activateKeyProcessV1Error = null;
      state.activateKeyProcessV1 = null;
      state.deactivateKeyProcessV1Loading = false;
      state.deactivateKeyProcessV1Error = null;
      state.deactivateKeyProcessV1 = null;
    },
    resetVendorLabCreateUpdate: state => {
      state.createVendorLabLoading = false;
      state.createVendorLabError = null;
      state.createVendorLab = null;
      state.updateVendorLabLoading = false;
      state.updateVendorLabError = null;
      state.updateVendorLab = null;
      state.activateVendorLabLoading = false;
      state.activateVendorLabError = null;
      state.activateVendorLab = null;
      state.deactivateVendorLabLoading = false;
      state.deactivateVendorLabError = null;
      state.deactivateVendorLab = null;
    },
    resetBoughtOutPartCreateUpdate: state => {
      state.createBoughtOutPartLoading = false;
      state.createBoughtOutPartError = null;
      state.createBoughtOutPart = null;
      state.updateBoughtOutPartLoading = false;
      state.updateBoughtOutPartError = null;
      state.updateBoughtOutPart = null;
      state.activateBoughtOutPartLoading = false;
      state.activateBoughtOutPartError = null;
      state.activateBoughtOutPart = null;
      state.deactivateBoughtOutPartLoading = false;
      state.deactivateBoughtOutPartError = null;
      state.deactivateBoughtOutPart = null;
    },
    resetKeyProcessCreateUpdate: state => {
      state.createkeyProcessesLoading = false;
      state.createkeyProcessesError = null;
      state.createkeyProcess = null;
      state.updatekeyProcessesLoading = false;
      state.updatekeyProcessesError = null;
      state.updatekeyProcess = null;
      state.activateKeyProcessLoading = false;
      state.activateKeyProcessError = null;
      state.activateKeyProcess = null;
      state.deactivateKeyProcessLoading = false;
      state.deactivateKeyProcessError = null;
      state.deactivateKeyProcess = null;
    },
    resetManufacturingStoreCreateUpdate: state => {
      state.createManufacturingStoresLoading = false;
      state.createManufacturingStoresError = null;
      state.createManufacturingStore = null;
      state.updateManufacturingStoresLoading = false;
      state.updateManufacturingStoresError = null;
      state.updateManufacturingStore = null;
      state.activateManufacturingStoreLoading = false;
      state.activateManufacturingStoreError = null;
      state.activateManufacturingStore = null;
      state.deactivateManufacturingStoreLoading = false;
      state.deactivateManufacturingStoreError = null;
      state.deactivateManufacturingStore = null;
    },
    resetAssessorDomainCreateUpdate: state => {
      state.createAssessorDomainLoading = false;
      state.createAssessorDomainError = null;
      state.createAssessorDomain = null;
      state.updateAssessorDomainLoading = false;
      state.updateAssessorDomainError = null;
      state.updateAssessorDomain = null;
      state.activateAssessorDomainLoading = false;
      state.activateAssessorDomainError = null;
      state.activateAssessorDomain = null;
      state.deactivateAssessorDomainLoading = false;
      state.deactivateAssessorDomainError = null;
      state.deactivateAssessorDomain = null;
    },
    resetVendorCategoryCreateV1Update: state => {
      state.createVendorCategoryV1Loading = false;
      state.createVendorCategoryV1Error = null;
      state.createVendorCategoryV1 = null;
      state.updateVendorCategoryV1Loading = false;
      state.updateVendorCategoryV1Error = null;
      state.updateVendorCategoryV1 = null;
      state.activateVendorCategoryV1Loading = false;
      state.activateVendorCategoryV1Error = null;
      state.activateVendorCategoryV1 = null;
      state.deactivateVendorCategoryV1Loading = false;
      state.deactivateVendorCategoryV1Error = null;
      state.deactivateVendorCategoryV1 = null;
    },
  },
  extraReducers: builder => {
    // Key Resources V1
    builder
      .addCase(listKeyProcessV1Action.pending, state => {
        state.keyProcessV1Loading = true;
        state.keyProcessV1Error = null;
      })
      .addCase(listKeyProcessV1Action.fulfilled, (state, action) => {
        state.keyProcessV1Loading = false;
        state.keyProcessV1 = action.payload?.data || action.payload || null;
        Logger.info('Key resources V1 loaded successfully in slice');
      })
      .addCase(listKeyProcessV1Action.rejected, (state, action) => {
        state.keyProcessV1Loading = false;
        state.keyProcessV1Error = action.payload;
        Logger.error('List key resources V1 failed in slice:', action.payload);
      })
      .addCase(getKeyProcessV1Action.pending, state => {
        state.getKeyProcessV1Loading = true;
        state.getKeyProcessV1Error = null;
      })
      .addCase(getKeyProcessV1Action.fulfilled, (state, action) => {
        state.getKeyProcessV1Loading = false;
        state.getKeyProcessV1 = action.payload?.data || action.payload || null;
        Logger.info('Key resource V1 loaded successfully in slice');
      })
      .addCase(getKeyProcessV1Action.rejected, (state, action) => {
        state.getKeyProcessV1Loading = false;
        state.getKeyProcessV1Error = action.payload;
        Logger.error('Get key resource V1 failed in slice:', action.payload);
      })
      .addCase(createKeyProcessV1Action.pending, state => {
        state.createKeyProcessV1Loading = true;
        state.createKeyProcessV1Error = null;
      })
      .addCase(createKeyProcessV1Action.fulfilled, (state, action) => {
        state.createKeyProcessV1Loading = false;
        state.createKeyProcessV1 = action.payload?.data || action.payload || null;
        Logger.info('Key resource V1 created successfully in slice');
      })
      .addCase(createKeyProcessV1Action.rejected, (state, action) => {
        state.createKeyProcessV1Loading = false;
        state.createKeyProcessV1Error = action.payload;
        Logger.error('Create key resource V1 failed in slice:', action.payload);
      })
      .addCase(updateKeyProcessV1Action.pending, state => {
        state.updateKeyProcessV1Loading = true;
        state.updateKeyProcessV1Error = null;
      })
      .addCase(updateKeyProcessV1Action.fulfilled, (state, action) => {
        state.updateKeyProcessV1Loading = false;
        state.updateKeyProcessV1 = action.payload?.data || action.payload || null;
        Logger.info('Key resource V1 updated successfully in slice');
      })
      .addCase(updateKeyProcessV1Action.rejected, (state, action) => {
        state.updateKeyProcessV1Loading = false;
        state.updateKeyProcessV1Error = action.payload;
        Logger.error('Update key resource V1 failed in slice:', action.payload);
      })
      .addCase(activateKeyProcessV1Action.pending, state => {
        state.activateKeyProcessV1Loading = true;
        state.activateKeyProcessV1Error = null;
      })
      .addCase(activateKeyProcessV1Action.fulfilled, (state, action) => {
        state.activateKeyProcessV1Loading = false;
        state.activateKeyProcessV1 = action.payload || null;
        Logger.info('Key process V1 activated successfully in slice');
      })
      .addCase(activateKeyProcessV1Action.rejected, (state, action) => {
        state.activateKeyProcessV1Loading = false;
        state.activateKeyProcessV1Error = action.payload;
        Logger.error('Activate key process V1 failed in slice:', action.payload);
      })
      .addCase(deactivateKeyProcessV1Action.pending, state => {
        state.deactivateKeyProcessV1Loading = true;
        state.deactivateKeyProcessV1Error = null;
      })
      .addCase(deactivateKeyProcessV1Action.fulfilled, (state, action) => {
        state.deactivateKeyProcessV1Loading = false;
        state.deactivateKeyProcessV1 = action.payload || null;
        Logger.info('Key process V1 deactivated successfully in slice');
      })
      .addCase(deactivateKeyProcessV1Action.rejected, (state, action) => {
        state.deactivateKeyProcessV1Loading = false;
        state.deactivateKeyProcessV1Error = action.payload;
        Logger.error('Deactivate key process V1 failed in slice:', action.payload);
      });

    // User update

    // Vendor Categories V1
    builder
      .addCase(listVendorCategoriesV1Action.pending, state => {
        state.drdoVendorCategoriesV1Loading = true;
        state.drdoVendorCategoriesV1Error = null;
      })
      .addCase(listVendorCategoriesV1Action.fulfilled, (state, action) => {
        state.drdoVendorCategoriesV1Loading = false;
        state.drdoVendorCategoriesV1 = action.payload || null;
        Logger.info('Vendor categories V1 loaded successfully in slice');
      })
      .addCase(listVendorCategoriesV1Action.rejected, (state, action) => {
        state.drdoVendorCategoriesV1Loading = false;
        state.drdoVendorCategoriesV1Error = action.payload;
        Logger.error('List Vendor categories V1 failed in slice:', action.payload);
      })
      .addCase(getVendorCategoryV1Action.pending, state => {
        state.getVendorCategoryV1Loading = true;
        state.getVendorCategoryV1Error = null;
      })
      .addCase(getVendorCategoryV1Action.fulfilled, (state, action) => {
        state.getVendorCategoryV1Loading = false;
        state.getVendorCategoryV1 = action.payload?.data || action.payload || null;
        Logger.info('Vendor category V1 loaded successfully in slice');
      })
      .addCase(getVendorCategoryV1Action.rejected, (state, action) => {
        state.getVendorCategoryV1Loading = false;
        state.getVendorCategoryV1Error = action.payload;
        Logger.error('Get Vendor category V1 failed in slice:', action.payload);
      })
      .addCase(createVendorCategoryV1Action.pending, state => {
        state.createVendorCategoryV1Loading = true;
        state.createVendorCategoryV1Error = null;
      })
      .addCase(createVendorCategoryV1Action.fulfilled, (state, action) => {
        state.createVendorCategoryV1Loading = false;
        state.createVendorCategoryV1 = action.payload?.data || action.payload || null;
        Logger.info('Vendor category V1 created successfully in slice');
      })
      .addCase(createVendorCategoryV1Action.rejected, (state, action) => {
        state.createVendorCategoryV1Loading = false;
        state.createVendorCategoryV1Error = action.payload;
        Logger.error('Create Vendor category V1 failed in slice:', action.payload);
      })
      .addCase(updateVendorCategoryV1Action.pending, state => {
        state.updateVendorCategoryV1Loading = true;
        state.updateVendorCategoryV1Error = null;
      })
      .addCase(updateVendorCategoryV1Action.fulfilled, (state, action) => {
        state.updateVendorCategoryV1Loading = false;
        state.updateVendorCategoryV1 = action.payload?.data || action.payload || null;
        Logger.info('Vendor category V1 updated successfully in slice');
      })
      .addCase(updateVendorCategoryV1Action.rejected, (state, action) => {
        state.updateVendorCategoryV1Loading = false;
        state.updateVendorCategoryV1Error = action.payload;
        Logger.error('Update Vendor category V1 failed in slice:', action.payload);
      })
      .addCase(activateVendorCategoryV1Action.pending, state => {
        state.activateVendorCategoryV1Loading = true;
        state.activateVendorCategoryV1Error = null;
      })
      .addCase(activateVendorCategoryV1Action.fulfilled, (state, action) => {
        state.activateVendorCategoryV1Loading = false;
        state.activateVendorCategoryV1 = action.payload || null;
        Logger.info('Vendor category V1 activated successfully in slice');
      })
      .addCase(activateVendorCategoryV1Action.rejected, (state, action) => {
        state.activateVendorCategoryV1Loading = false;
        state.activateVendorCategoryV1Error = action.payload;
        Logger.error('Activate Vendor category V1 failed in slice:', action.payload);
      })
      .addCase(deactivateVendorCategoryV1Action.pending, state => {
        state.deactivateVendorCategoryV1Loading = true;
        state.deactivateVendorCategoryV1Error = null;
      })
      .addCase(deactivateVendorCategoryV1Action.fulfilled, (state, action) => {
        state.deactivateVendorCategoryV1Loading = false;
        state.deactivateVendorCategoryV1 = action.payload || null;
        Logger.info('Vendor category V1 deactivated successfully in slice');
      })
      .addCase(deactivateVendorCategoryV1Action.rejected, (state, action) => {
        state.deactivateVendorCategoryV1Loading = false;
        state.deactivateVendorCategoryV1Error = action.payload;
        Logger.error('Deactivate Vendor category V1 failed in slice:', action.payload);
      });

    builder
      .addCase(updateUserAction.pending, state => {
        state.userLoading = true;
        state.userError = null;
      })
      .addCase(updateUserAction.fulfilled, (state, action) => {
        state.updateUserLoading = false;
        state.updateUser = action.payload || null;
        Logger.info('User updated successfully in slice');
      })
      .addCase(updateUserAction.rejected, (state, action) => {
        state.updateUserLoading = false;
        state.updateUserError = action.payload;
        Logger.error('Update user failed in slice:', action.payload);
      })
      .addCase(getUserAction.pending, state => {
        state.userLoading = true;
        state.userError = null;
      })
      .addCase(getUserAction.fulfilled, (state, action) => {
        state.userLoading = false;
        state.user = action.payload || null;
        Logger.info('User fetched successfully in slice');
      })
      .addCase(getUserAction.rejected, (state, action) => {
        state.userLoading = false;
        state.userError = action.payload;
        Logger.error('Get user failed in slice:', action.payload);
      });

    // Assessor Domains
    builder
      .addCase(listAssessorDomainsAction.pending, state => {
        state.assessorDomainsLoading = true;
        state.assessorDomainsError = null;
      })
      .addCase(listAssessorDomainsAction.fulfilled, (state, action) => {
        state.assessorDomainsLoading = false;
        state.assessorDomains = action.payload || null;
        Logger.info('Assessor domains loaded successfully in slice');
      })
      .addCase(listAssessorDomainsAction.rejected, (state, action) => {
        state.assessorDomainsLoading = false;
        state.assessorDomainsError = action.payload;
        Logger.error('List assessor domains failed in slice:', action.payload);
      })
      .addCase(getAssessorDomainAction.pending, state => {
        state.assessorDomainsLoading = true;
        state.assessorDomainsError = null;
      })
      .addCase(getAssessorDomainAction.fulfilled, (state, action) => {
        state.assessorDomainsLoading = false;
        state.assessorDomain = action.payload || null;
        Logger.info('Assessor domain loaded successfully in slice');
      })
      .addCase(getAssessorDomainAction.rejected, (state, action) => {
        state.assessorDomainsLoading = false;
        state.assessorDomainsError = action.payload;
        Logger.error('Get assessor domain failed in slice:', action.payload);
      })
      .addCase(createAssessorDomainAction.pending, state => {
        state.createAssessorDomainLoading = true;
        state.createAssessorDomainError = null;
      })
      .addCase(createAssessorDomainAction.fulfilled, (state, action) => {
        state.createAssessorDomainLoading = false;
        state.createAssessorDomain = action.payload || null;
        Logger.info('Assessor domain created successfully in slice');
      })
      .addCase(createAssessorDomainAction.rejected, (state, action) => {
        state.createAssessorDomainLoading = false;
        state.createAssessorDomainError = action.payload;
        Logger.error('Create assessor domain failed in slice:', action.payload);
      })
      .addCase(updateAssessorDomainAction.pending, state => {
        state.updateAssessorDomainLoading = true;
        state.updateAssessorDomainError = null;
      })
      .addCase(updateAssessorDomainAction.fulfilled, (state, action) => {
        state.updateAssessorDomainLoading = false;
        state.updateAssessorDomain = action.payload || null;
        Logger.info('Assessor domain updated successfully in slice');
      })
      .addCase(updateAssessorDomainAction.rejected, (state, action) => {
        state.updateAssessorDomainLoading = false;
        state.updateAssessorDomainError = action.payload;
        Logger.error('Update assessor domain failed in slice:', action.payload);
      })
      .addCase(activateAssessorDomainAction.pending, state => {
        state.activateAssessorDomainLoading = true;
        state.activateAssessorDomainError = null;
      })
      .addCase(activateAssessorDomainAction.fulfilled, (state, action) => {
        state.activateAssessorDomainLoading = false;
        state.activateAssessorDomain = action.payload || null;
        Logger.info('Assessor domain activated successfully in slice');
      })
      .addCase(activateAssessorDomainAction.rejected, (state, action) => {
        state.activateAssessorDomainLoading = false;
        state.activateAssessorDomainError = action.payload;
        Logger.error('Activate assessor domain failed in slice:', action.payload);
      })
      .addCase(deactivateAssessorDomainAction.pending, state => {
        state.deactivateAssessorDomainLoading = true;
        state.deactivateAssessorDomainError = null;
      })
      .addCase(deactivateAssessorDomainAction.fulfilled, (state, action) => {
        state.deactivateAssessorDomainLoading = false;
        state.deactivateAssessorDomain = action.payload || null;
        Logger.info('Assessor domain deactivated successfully in slice');
      })
      .addCase(deactivateAssessorDomainAction.rejected, (state, action) => {
        state.deactivateAssessorDomainLoading = false;
        state.deactivateAssessorDomainError = action.payload;
        Logger.error('Deactivate assessor domain failed in slice:', action.payload);
      });

    // Bought-out Parts
    builder
      .addCase(listBoughtOutPartsAction.pending, state => {
        state.boughtOutPartsLoading = true;
        state.boughtOutPartsError = null;
      })
      .addCase(listBoughtOutPartsAction.fulfilled, (state, action) => {
        state.boughtOutPartsLoading = false;
        state.boughtOutParts = action.payload || null;
        Logger.info('Bought-out parts loaded successfully in slice');
      })
      .addCase(listBoughtOutPartsAction.rejected, (state, action) => {
        state.boughtOutPartsLoading = false;
        state.boughtOutPartsError = action.payload;
        Logger.error('List bought-out parts failed in slice:', action.payload);
      })
      .addCase(getBoughtOutPartAction.pending, state => {
        state.boughtOutPartsLoading = true;
        state.boughtOutPartsError = null;
      })
      .addCase(getBoughtOutPartAction.fulfilled, (state, action) => {
        state.getBoughtOutPartLoading = false;
        state.getBoughtOutPart = action.payload || null;
        Logger.info('Bought-out part loaded successfully in slice');
      })
      .addCase(getBoughtOutPartAction.rejected, (state, action) => {
        state.getBoughtOutPartLoading = false;
        state.getBoughtOutPartError = action.payload;
        Logger.error('Get bought-out part failed in slice:', action.payload);
      })
      .addCase(createBoughtOutPartAction.pending, state => {
        state.getBoughtOutPartLoading = true;
        state.getBoughtOutPartError = null;
      })
      .addCase(createBoughtOutPartAction.fulfilled, (state, action) => {
        state.createBoughtOutPartLoading = false;
        state.createBoughtOutPart = action.payload || null;
        Logger.info('Bought-out part created successfully in slice');
      })
      .addCase(createBoughtOutPartAction.rejected, (state, action) => {
        state.createBoughtOutPartLoading = false;
        state.createBoughtOutPartError = action.payload;
        Logger.error('Create bought-out part failed in slice:', action.payload);
      })
      .addCase(updateBoughtOutPartAction.pending, state => {
        state.updateBoughtOutPartLoading = true;
        state.updateBoughtOutPartError = null;
      })
      .addCase(updateBoughtOutPartAction.fulfilled, (state, action) => {
        state.updateBoughtOutPartLoading = false;
        state.updateBoughtOutPart = action.payload || null;
        Logger.info('Bought-out part updated successfully in slice');
      })
      .addCase(updateBoughtOutPartAction.rejected, (state, action) => {
        state.updateBoughtOutPartLoading = false;
        state.updateBoughtOutPartError = action.payload;
        Logger.error('Update bought-out part failed in slice:', action.payload);
      })
      .addCase(activateBoughtOutPartAction.pending, state => {
        state.activateBoughtOutPartLoading = true;
        state.activateBoughtOutPartError = null;
      })
      .addCase(activateBoughtOutPartAction.fulfilled, (state, action) => {
        state.activateBoughtOutPartLoading = false;
        state.activateBoughtOutPart = action.payload || null;
        Logger.info('Bought-out part activated successfully in slice');
      })
      .addCase(activateBoughtOutPartAction.rejected, (state, action) => {
        state.activateBoughtOutPartLoading = false;
        state.activateBoughtOutPart = null;

        state.activateBoughtOutPartError = action.payload;
        Logger.error('Activate bought-out part failed in slice:', action.payload);
      })
      .addCase(deactivateBoughtOutPartAction.pending, state => {
        state.deactivateBoughtOutPartLoading = true;
        state.deactivateBoughtOutPartError = null;
      })
      .addCase(deactivateBoughtOutPartAction.fulfilled, (state, action) => {
        state.deactivateBoughtOutPartLoading = false;
        state.deactivateBoughtOutPart = action.payload || null;
        Logger.info('Bought-out part deactivated successfully in slice');
      })
      .addCase(deactivateBoughtOutPartAction.rejected, (state, action) => {
        state.deactivateBoughtOutPartLoading = false;
        state.deactivateBoughtOutPart = null;
        state.deactivateBoughtOutPartError = action.payload;
        Logger.error('Deactivate bought-out part failed in slice:', action.payload);
      })

      // Raw Materials

      .addCase(listThirdPartyCertsAction.pending, state => {
        state.thirdPartyCertsLoading = true;
        state.thirdPartyCertsError = null;
      })
      .addCase(listThirdPartyCertsAction.fulfilled, (state, action) => {
        state.thirdPartyCertsLoading = false;
        state.thirdPartyCerts = action.payload || null;
        Logger.info('Third party certs loaded successfully in slice');
      })
      .addCase(listThirdPartyCertsAction.rejected, (state, action) => {
        state.thirdPartyCertsLoading = false;
        state.thirdPartyCertsError = action.payload;
        Logger.error('List third party certs failed in slice:', action.payload);
      })
      .addCase(getThirdPartyCertAction.pending, state => {
        state.getThirdPartyCertLoading = true;
        state.getThirdPartyCertError = null;
      })
      .addCase(getThirdPartyCertAction.fulfilled, (state, action) => {
        state.getThirdPartyCertLoading = false;
        state.getThirdPartyCert = action.payload?.data || action.payload || null;
        Logger.info('Third party cert loaded successfully in slice');
      })
      .addCase(getThirdPartyCertAction.rejected, (state, action) => {
        state.getThirdPartyCertLoading = false;
        state.getThirdPartyCertError = action.payload;
        Logger.error('Get third party cert failed in slice:', action.payload);
      })
      .addCase(createThirdPartyCertAction.pending, state => {
        state.createThirdPartyCertLoading = true;
        state.createThirdPartyCertError = null;
      })
      .addCase(createThirdPartyCertAction.fulfilled, (state, action) => {
        state.createThirdPartyCertLoading = false;
        state.createThirdPartyCert = action.payload?.data || action.payload || null;
        Logger.info('Third party cert created successfully in slice');
      })
      .addCase(createThirdPartyCertAction.rejected, (state, action) => {
        state.createThirdPartyCertLoading = false;
        state.createThirdPartyCertError = action.payload;
        Logger.error('Create third party cert failed in slice:', action.payload);
      })
      .addCase(updateThirdPartyCertAction.pending, state => {
        state.updateThirdPartyCertLoading = true;
        state.updateThirdPartyCertError = null;
      })
      .addCase(updateThirdPartyCertAction.fulfilled, (state, action) => {
        state.updateThirdPartyCertLoading = false;
        state.updateThirdPartyCert = action.payload?.data || action.payload || null;
        Logger.info('Third party cert updated successfully in slice');
      })
      .addCase(updateThirdPartyCertAction.rejected, (state, action) => {
        state.updateThirdPartyCertLoading = false;
        state.updateThirdPartyCertError = action.payload;
        Logger.error('Update third party cert failed in slice:', action.payload);
      })
      .addCase(deleteThirdPartyCertAction.pending, state => {
        state.thirdPartyCertsLoading = true;
        state.thirdPartyCertsError = null;
      })
      .addCase(deleteThirdPartyCertAction.fulfilled, state => {
        state.thirdPartyCertsLoading = false;
        Logger.info('Third party cert deleted successfully in slice');
      })
      .addCase(deleteThirdPartyCertAction.rejected, (state, action) => {
        state.thirdPartyCertsLoading = false;
        state.thirdPartyCertsError = action.payload;
        Logger.error('Delete third party cert failed in slice:', action.payload);
      })
      .addCase(activateThirdPartyCertAction.pending, state => {
        state.activateThirdPartyCertLoading = true;
        state.activateThirdPartyCertError = null;
      })
      .addCase(activateThirdPartyCertAction.fulfilled, (state, action) => {
        state.activateThirdPartyCertLoading = false;
        state.activateThirdPartyCert = action.payload || null;
        Logger.info('Third-party cert activated successfully in slice');
      })
      .addCase(activateThirdPartyCertAction.rejected, (state, action) => {
        state.activateThirdPartyCertLoading = false;
        state.activateThirdPartyCertError = action.payload;
        Logger.error('Activate third-party cert failed in slice:', action.payload);
      })
      .addCase(deactivateThirdPartyCertAction.pending, state => {
        state.deactivateThirdPartyCertLoading = true;
        state.deactivateThirdPartyCertError = null;
      })
      .addCase(deactivateThirdPartyCertAction.fulfilled, (state, action) => {
        state.deactivateThirdPartyCertLoading = false;
        state.deactivateThirdPartyCert = action.payload || null;
        Logger.info('Third-party cert deactivated successfully in slice');
      })
      .addCase(deactivateThirdPartyCertAction.rejected, (state, action) => {
        state.deactivateThirdPartyCertLoading = false;
        state.deactivateThirdPartyCertError = action.payload;
        Logger.error('Deactivate third-party cert failed in slice:', action.payload);
      });
    // Raw Materials
    builder
      .addCase(listRawMaterialsAction.pending, state => {
        state.rawMaterialsLoading = true;
        state.rawMaterialsError = null;
      })
      .addCase(listRawMaterialsAction.fulfilled, (state, action) => {
        state.rawMaterialsLoading = false;
        state.rawMaterials = action.payload || null;
        Logger.info('Raw materials loaded successfully in slice');
      })
      .addCase(listRawMaterialsAction.rejected, (state, action) => {
        state.rawMaterialsLoading = false;
        state.rawMaterialsError = action.payload;
        Logger.error('List raw materials failed in slice:', action.payload);
      })
      .addCase(getRawMaterialAction.pending, state => {
        state.getRawMaterialLoading = true;
        state.getRawMaterialError = null;
      })
      .addCase(getRawMaterialAction.fulfilled, (state, action) => {
        state.getRawMaterialLoading = false;
        state.getRawMaterial = action.payload?.data || action.payload || null;
        Logger.info('Raw material loaded successfully in slice');
      })
      .addCase(getRawMaterialAction.rejected, (state, action) => {
        state.getRawMaterialLoading = false;
        state.getRawMaterialError = action.payload;
        Logger.error('Get raw material failed in slice:', action.payload);
      })
      .addCase(createRawMaterialAction.pending, state => {
        state.createRawMaterialLoading = true;
        state.createRawMaterialError = null;
      })
      .addCase(createRawMaterialAction.fulfilled, (state, action) => {
        state.createRawMaterialLoading = false;
        state.createRawMaterial = action.payload?.data || action.payload || null;
        Logger.info('Raw material created successfully in slice');
      })
      .addCase(createRawMaterialAction.rejected, (state, action) => {
        state.createRawMaterialLoading = false;
        state.createRawMaterialError = action.payload;
        Logger.error('Create raw material failed in slice:', action.payload);
      })
      .addCase(updateRawMaterialAction.pending, state => {
        state.updateRawMaterialLoading = true;
        state.updateRawMaterialError = null;
      })
      .addCase(updateRawMaterialAction.fulfilled, (state, action) => {
        state.updateRawMaterialLoading = false;
        state.updateRawMaterial = action.payload?.data || action.payload || null;
        Logger.info('Raw material updated successfully in slice');
      })
      .addCase(updateRawMaterialAction.rejected, (state, action) => {
        state.updateRawMaterialLoading = false;
        state.updateRawMaterialError = action.payload;
        Logger.error('Update raw material failed in slice:', action.payload);
      })
      .addCase(activateRawMaterialAction.pending, state => {
        state.activateRawMaterialLoading = true;
        state.activateRawMaterialError = null;
      })
      .addCase(activateRawMaterialAction.fulfilled, (state, action) => {
        state.activateRawMaterialLoading = false;
        state.activateRawMaterial = action.payload || null;
        Logger.info('Raw material activated successfully in slice');
      })
      .addCase(activateRawMaterialAction.rejected, (state, action) => {
        state.activateRawMaterialLoading = false;
        state.activateRawMaterialError = action.payload;
        Logger.error('Activate raw material failed in slice:', action.payload);
      })
      .addCase(deactivateRawMaterialAction.pending, state => {
        state.deactivateRawMaterialLoading = true;
        state.deactivateRawMaterialError = null;
      })
      .addCase(deactivateRawMaterialAction.fulfilled, (state, action) => {
        state.deactivateRawMaterialLoading = false;
        state.deactivateRawMaterial = action.payload || null;
        Logger.info('Raw material deactivated successfully in slice');
      })
      .addCase(deactivateRawMaterialAction.rejected, (state, action) => {
        state.deactivateRawMaterialLoading = false;
        state.deactivateRawMaterialError = action.payload;
        Logger.error('Deactivate raw material failed in slice:', action.payload);
      });
    // Vendor Categories
    builder
      .addCase(listVendorCategoriesAction.pending, state => {
        state.drdoVendorCategoriesLoading = true;
        state.drdoVendorCategoriesError = null;
      })
      .addCase(listVendorCategoriesAction.fulfilled, (state, action) => {
        state.drdoVendorCategoriesLoading = false;
        state.drdoVendorCategories = action.payload || null;
        Logger.info('Vendor categories loaded successfully in slice');
      })
      .addCase(listVendorCategoriesAction.rejected, (state, action) => {
        state.drdoVendorCategoriesLoading = false;
        state.drdoVendorCategoriesError = action.payload;
        Logger.error('List Vendor categories failed in slice:', action.payload);
      })
      .addCase(getVendorCategoryAction.pending, state => {
        state.drdoVendorCategoriesLoading = true;
        state.drdoVendorCategoriesError = null;
      })
      .addCase(getVendorCategoryAction.fulfilled, (state, action) => {
        state.drdoVendorCategoriesLoading = false;
        state.vendorCategory = action.payload?.data || action.payload || null;
        Logger.info('Vendor category loaded successfully in slice');
      })
      .addCase(getVendorCategoryAction.rejected, (state, action) => {
        state.drdoVendorCategoriesLoading = false;
        state.drdoVendorCategoriesError = action.payload;
        Logger.error('Get Vendor category failed in slice:', action.payload);
      })
      .addCase(createVendorCategoryAction.pending, state => {
        state.createdrdoVendorCategoriesLoading = true;
        state.createdrdoVendorCategoriesError = null;
      })
      .addCase(createVendorCategoryAction.fulfilled, (state, action) => {
        state.createdrdoVendorCategoriesLoading = false;
        state.createvendorCategory = action.payload?.data || action.payload || null;
        Logger.info('Vendor category created successfully in slice');
      })
      .addCase(createVendorCategoryAction.rejected, (state, action) => {
        state.createdrdoVendorCategoriesLoading = false;
        state.createdrdoVendorCategoriesError = action.payload;
        Logger.error('Create Vendor category failed in slice:', action.payload);
      })
      .addCase(updateVendorCategoryAction.pending, state => {
        state.updatedrdoVendorCategoriesLoading = true;
        state.updatedrdoVendorCategoriesError = null;
      })
      .addCase(updateVendorCategoryAction.fulfilled, (state, action) => {
        state.updatedrdoVendorCategoriesLoading = false;
        state.updatevendorCategory = action.payload?.data || action.payload || null;
        Logger.info('Vendor category updated successfully in slice');
      })
      .addCase(updateVendorCategoryAction.rejected, (state, action) => {
        state.updatedrdoVendorCategoriesLoading = false;
        state.updatedrdoVendorCategoriesError = action.payload;
        Logger.error('Update Vendor category failed in slice:', action.payload);
      })
      .addCase(activateVendorCategoryAction.pending, state => {
        state.activateVendorCategoryLoading = true;
        state.activateVendorCategoryError = null;
      })
      .addCase(activateVendorCategoryAction.fulfilled, (state, action) => {
        state.activateVendorCategoryLoading = false;
        state.activateVendorCategory = action.payload || null;
        Logger.info('Vendor category activated successfully in slice');
      })
      .addCase(activateVendorCategoryAction.rejected, (state, action) => {
        state.activateVendorCategoryLoading = false;
        state.activateVendorCategoryError = action.payload;
        Logger.error('Activate Vendor category failed in slice:', action.payload);
      })
      .addCase(deactivateVendorCategoryAction.pending, state => {
        state.deactivateVendorCategoryLoading = true;
        state.deactivateVendorCategoryError = null;
      })
      .addCase(deactivateVendorCategoryAction.fulfilled, (state, action) => {
        state.deactivateVendorCategoryLoading = false;
        state.deactivateVendorCategory = action.payload || null;
        Logger.info('Vendor category deactivated successfully in slice');
      })
      .addCase(deactivateVendorCategoryAction.rejected, (state, action) => {
        state.deactivateVendorCategoryLoading = false;
        state.deactivateVendorCategoryError = action.payload;
        Logger.error('Deactivate Vendor category failed in slice:', action.payload);
      });

    builder
      .addCase(listVendorLabsAction.pending, state => {
        state.vendorLabsLoading = true;
        state.vendorLabsError = null;
      })
      .addCase(listVendorLabsAction.fulfilled, (state, action) => {
        state.vendorLabsLoading = false;
        state.vendorLabs = action.payload || null;
        Logger.info('Vendor labs loaded successfully in slice');
      })
      .addCase(listVendorLabsAction.rejected, (state, action) => {
        state.vendorLabsLoading = false;
        state.vendorLabsError = action.payload;
        Logger.error('List vendor labs failed in slice:', action.payload);
      })
      .addCase(getVendorLabAction.pending, state => {
        state.getVendorLabLoading = true;
        state.getVendorLabError = null;
      })
      .addCase(getVendorLabAction.fulfilled, (state, action) => {
        state.getVendorLabLoading = false;
        state.getVendorLab = action.payload?.data || action.payload || null;
        Logger.info('Vendor lab loaded successfully in slice');
      })
      .addCase(getVendorLabAction.rejected, (state, action) => {
        state.getVendorLabLoading = false;
        state.getVendorLabError = action.payload;
        Logger.error('Get vendor lab failed in slice:', action.payload);
      })
      .addCase(createVendorLabAction.pending, state => {
        state.createVendorLabLoading = true;
        state.createVendorLabError = null;
      })
      .addCase(createVendorLabAction.fulfilled, (state, action) => {
        state.createVendorLabLoading = false;
        state.createVendorLab = action.payload?.data || action.payload || null;
        Logger.info('Vendor lab created successfully in slice');
      })
      .addCase(createVendorLabAction.rejected, (state, action) => {
        state.createVendorLabLoading = false;
        state.createVendorLabError = action.payload;
        Logger.error('Create vendor lab failed in slice:', action.payload);
      })
      .addCase(updateVendorLabAction.pending, state => {
        state.updateVendorLabLoading = true;
        state.updateVendorLabError = null;
      })
      .addCase(updateVendorLabAction.fulfilled, (state, action) => {
        state.updateVendorLabLoading = false;
        state.updateVendorLab = action.payload?.data || action.payload || null;
        Logger.info('Vendor lab updated successfully in slice');
      })
      .addCase(updateVendorLabAction.rejected, (state, action) => {
        state.updateVendorLabLoading = false;
        state.updateVendorLabError = action.payload;
        Logger.error('Update vendor lab failed in slice:', action.payload);
      })
      .addCase(activateVendorLabAction.pending, state => {
        state.activateVendorLabLoading = true;
        state.activateVendorLabError = null;
      })
      .addCase(activateVendorLabAction.fulfilled, (state, action) => {
        state.activateVendorLabLoading = false;
        state.activateVendorLab = action.payload || null;
        Logger.info('Vendor lab activated successfully in slice');
      })
      .addCase(activateVendorLabAction.rejected, (state, action) => {
        state.activateVendorLabLoading = false;
        state.activateVendorLabError = action.payload;
        Logger.error('Activate vendor lab failed in slice:', action.payload);
      })
      .addCase(deactivateVendorLabAction.pending, state => {
        state.deactivateVendorLabLoading = true;
        state.deactivateVendorLabError = null;
      })
      .addCase(deactivateVendorLabAction.fulfilled, (state, action) => {
        state.deactivateVendorLabLoading = false;
        state.deactivateVendorLab = action.payload || null;
        Logger.info('Vendor lab deactivated successfully in slice');
      })
      .addCase(deactivateVendorLabAction.rejected, (state, action) => {
        state.deactivateVendorLabLoading = false;
        state.deactivateVendorLabError = action.payload;
        Logger.error('Deactivate vendor lab failed in slice:', action.payload);
      });

    // Countries
    builder
      .addCase(listCountriesAction.pending, state => {
        state.countriesLoading = true;
        state.countriesError = null;
      })
      .addCase(listCountriesAction.fulfilled, (state, action) => {
        state.countriesLoading = false;
        state.countries = action.payload || null;
        Logger.info('Countries loaded successfully in slice', state.countries);
      })
      .addCase(listCountriesAction.rejected, (state, action) => {
        state.countriesLoading = false;
        state.countriesError = action.payload;
        Logger.error('List countries failed in slice:', action.payload);
      });

    // Key Services
    builder
      .addCase(listKeyProcessesAction.pending, state => {
        state.keyProcessesLoading = true;
        state.keyProcessesError = null;
      })
      .addCase(listKeyProcessesAction.fulfilled, (state, action) => {
        state.keyProcessesLoading = false;
        state.getKeyProcesses = action.payload;
        Logger.info('Key processes loaded successfully in slice');
      })
      .addCase(listKeyProcessesAction.rejected, (state, action) => {
        state.keyProcessesLoading = false;
        state.keyProcessesError = action.payload;
        Logger.error('List key processes failed in slice:', action.payload);
      })
      .addCase(getKeyProcessAction.pending, state => {
        state.keyProcessesLoading = true;
        state.keyProcessesError = null;
      })
      .addCase(getKeyProcessAction.fulfilled, (state, action) => {
        state.keyProcessesLoading = false;
        state.keyProcess = action.payload || null;
        Logger.info('Key process loaded successfully in slice');
      })
      .addCase(getKeyProcessAction.rejected, (state, action) => {
        state.keyProcessesLoading = false;
        state.keyProcessesError = action.payload;
        Logger.error('Get key process failed in slice:', action.payload);
      })
      .addCase(createKeyProcessAction.pending, state => {
        state.createkeyProcessesLoading = true;
        state.createkeyProcessesError = null;
      })
      .addCase(createKeyProcessAction.fulfilled, (state, action) => {
        state.createkeyProcessesLoading = false;
        state.createkeyProcess = action.payload?.data || action.payload || null;
        Logger.info('Key process created successfully in slice');
      })
      .addCase(createKeyProcessAction.rejected, (state, action) => {
        state.createkeyProcessesLoading = false;
        state.createkeyProcessesError = action.payload;
        Logger.error('Create key process failed in slice:', action.payload);
      })
      .addCase(updateKeyProcessAction.pending, state => {
        state.updatekeyProcessesLoading = true;
        state.updatekeyProcessesError = null;
      })
      .addCase(updateKeyProcessAction.fulfilled, (state, action) => {
        state.updatekeyProcessesLoading = false;
        state.updatekeyProcess = action.payload?.data || action.payload || null;
        Logger.info('Key process updated successfully in slice');
      })
      .addCase(updateKeyProcessAction.rejected, (state, action) => {
        state.updatekeyProcessesLoading = false;
        state.updatekeyProcessesError = action.payload;
        Logger.error('Update key process failed in slice:', action.payload);
      })
      .addCase(activateKeyProcessAction.pending, state => {
        state.activateKeyProcessLoading = true;
        state.activateKeyProcessError = null;
      })
      .addCase(activateKeyProcessAction.fulfilled, (state, action) => {
        state.activateKeyProcessLoading = false;
        state.activateKeyProcess = action.payload || null;
        Logger.info('Key process activated successfully in slice');
      })
      .addCase(activateKeyProcessAction.rejected, (state, action) => {
        state.activateKeyProcessLoading = false;
        state.activateKeyProcessError = action.payload;
        Logger.error('Activate key process failed in slice:', action.payload);
      })
      .addCase(deactivateKeyProcessAction.pending, state => {
        state.deactivateKeyProcessLoading = true;
        state.deactivateKeyProcessError = null;
      })
      .addCase(deactivateKeyProcessAction.fulfilled, (state, action) => {
        state.deactivateKeyProcessLoading = false;
        state.deactivateKeyProcess = action.payload || null;
        Logger.info('Key process deactivated successfully in slice');
      })
      .addCase(deactivateKeyProcessAction.rejected, (state, action) => {
        state.deactivateKeyProcessLoading = false;
        state.deactivateKeyProcessError = action.payload;
        Logger.error('Deactivate key process failed in slice:', action.payload);
      });

    builder
      .addCase(listKeyResourcesAction.pending, state => {
        state.keyResourcesLoading = true;
        state.keyResourcesError = null;
      })
      .addCase(listKeyResourcesAction.fulfilled, (state, action) => {
        state.keyResourcesLoading = false;
        state.keyResources = action.payload || null;
        Logger.info('Key resources loaded successfully in slice');
      })
      .addCase(listKeyResourcesAction.rejected, (state, action) => {
        state.keyResourcesLoading = false;
        state.keyResourcesError = action.payload;
        Logger.error('List key resources failed in slice:', action.payload);
      })
      .addCase(getKeyResourceAction.pending, state => {
        state.getKeyResourceLoading = true;
        state.getKeyResourceError = null;
      })
      .addCase(getKeyResourceAction.fulfilled, (state, action) => {
        state.getKeyResourceLoading = false;
        state.getKeyResource = action.payload?.data || action.payload || null;
        Logger.info('Key resource loaded successfully in slice');
      })
      .addCase(getKeyResourceAction.rejected, (state, action) => {
        state.getKeyResourceLoading = false;
        state.getKeyResourceError = action.payload;
        Logger.error('Get key resource failed in slice:', action.payload);
      })
      .addCase(createKeyResourceAction.pending, state => {
        state.createKeyResourceLoading = true;
        state.createKeyResourceError = null;
      })
      .addCase(createKeyResourceAction.fulfilled, (state, action) => {
        state.createKeyResourceLoading = false;
        state.createKeyResource = action.payload?.data || action.payload || null;
        Logger.info('Key resource created successfully in slice');
      })
      .addCase(createKeyResourceAction.rejected, (state, action) => {
        state.createKeyResourceLoading = false;
        state.createKeyResourceError = action.payload;
        Logger.error('Create key resource failed in slice:', action.payload);
      })
      .addCase(updateKeyResourceAction.pending, state => {
        state.updateKeyResourceLoading = true;
        state.updateKeyResourceError = null;
      })
      .addCase(updateKeyResourceAction.fulfilled, (state, action) => {
        state.updateKeyResourceLoading = false;
        state.updateKeyResource = action.payload?.data || action.payload || null;
        Logger.info('Key resource updated successfully in slice');
      })
      .addCase(updateKeyResourceAction.rejected, (state, action) => {
        state.updateKeyResourceLoading = false;
        state.updateKeyResourceError = action.payload;
        Logger.error('Update key resource failed in slice:', action.payload);
      })
      .addCase(activateKeyResourceAction.pending, state => {
        state.activateKeyResourceLoading = true;
        state.activateKeyResourceError = null;
      })
      .addCase(activateKeyResourceAction.fulfilled, (state, action) => {
        state.activateKeyResourceLoading = false;
        state.activateKeyResource = action.payload || null;
        Logger.info('Key resource activated successfully in slice');
      })
      .addCase(activateKeyResourceAction.rejected, (state, action) => {
        state.activateKeyResourceLoading = false;
        state.activateKeyResourceError = action.payload;
        Logger.error('Activate key resource failed in slice:', action.payload);
      })
      .addCase(deactivateKeyResourceAction.pending, state => {
        state.deactivateKeyResourceLoading = true;
        state.deactivateKeyResourceError = null;
      })
      .addCase(deactivateKeyResourceAction.fulfilled, (state, action) => {
        state.deactivateKeyResourceLoading = false;
        state.deactivateKeyResource = action.payload || null;
        Logger.info('Key resource deactivated successfully in slice');
      })
      .addCase(deactivateKeyResourceAction.rejected, (state, action) => {
        state.deactivateKeyResourceLoading = false;
        state.deactivateKeyResourceError = action.payload;
        Logger.error('Deactivate key resource failed in slice:', action.payload);
      });

    // Manufacturing Stores
    builder
      .addCase(listManufacturingStoresAction.pending, state => {
        state.manufacturingStoresLoading = true;
        state.manufacturingStoresError = null;
      })
      .addCase(listManufacturingStoresAction.fulfilled, (state, action) => {
        state.manufacturingStoresLoading = false;
        state.manufacturingStores = action.payload;
        Logger.info('Manufacturing stores loaded successfully in slice');
      })
      .addCase(listManufacturingStoresAction.rejected, (state, action) => {
        state.manufacturingStoresLoading = false;
        state.manufacturingStoresError = action.payload;
        Logger.error('List manufacturing stores failed in slice:', action.payload);
      })
      .addCase(getManufacturingStoreAction.pending, state => {
        state.manufacturingStoresLoading = true;
        state.manufacturingStoresError = null;
      })
      .addCase(getManufacturingStoreAction.fulfilled, (state, action) => {
        state.manufacturingStoresLoading = false;
        state.manufacturingStore = action.payload?.data || action.payload || null;
        Logger.info('Manufacturing store loaded successfully in slice');
      })
      .addCase(getManufacturingStoreAction.rejected, (state, action) => {
        state.manufacturingStoresLoading = false;
        state.manufacturingStoresError = action.payload;
        Logger.error('Get manufacturing store failed in slice:', action.payload);
      })
      .addCase(createManufacturingStoreAction.pending, state => {
        state.createManufacturingStoresLoading = true;
        state.createManufacturingStoresError = null;
      })
      .addCase(createManufacturingStoreAction.fulfilled, (state, action) => {
        state.createManufacturingStoresLoading = false;
        state.createManufacturingStore = action.payload?.data || action.payload || null;
        Logger.info('Manufacturing store created successfully in slice');
      })
      .addCase(createManufacturingStoreAction.rejected, (state, action) => {
        state.createManufacturingStoresLoading = false;
        state.createManufacturingStoresError = action.payload;
        Logger.error('Create manufacturing store failed in slice:', action.payload);
      })
      .addCase(updateManufacturingStoreAction.pending, state => {
        state.updateManufacturingStoresLoading = true;
        state.updateManufacturingStoresError = null;
      })
      .addCase(updateManufacturingStoreAction.fulfilled, (state, action) => {
        state.updateManufacturingStoresLoading = false;
        state.updateManufacturingStore = action.payload?.data || action.payload || null;
        Logger.info('Manufacturing store updated successfully in slice');
      })
      .addCase(updateManufacturingStoreAction.rejected, (state, action) => {
        state.updateManufacturingStoresLoading = false;
        state.updateManufacturingStoresError = action.payload;
        Logger.error('Update manufacturing store failed in slice:', action.payload);
      })
      .addCase(activateManufacturingStoreAction.pending, state => {
        state.activateManufacturingStoreLoading = true;
        state.activateManufacturingStoreError = null;
      })
      .addCase(activateManufacturingStoreAction.fulfilled, (state, action) => {
        state.activateManufacturingStoreLoading = false;
        state.activateManufacturingStore = action.payload || null;
        Logger.info('Manufacturing store activated successfully in slice');
      })
      .addCase(activateManufacturingStoreAction.rejected, (state, action) => {
        state.activateManufacturingStoreLoading = false;
        state.activateManufacturingStoreError = action.payload;
        Logger.error('Activate manufacturing store failed in slice:', action.payload);
      })
      .addCase(deactivateManufacturingStoreAction.pending, state => {
        state.deactivateManufacturingStoreLoading = true;
        state.deactivateManufacturingStoreError = null;
      })
      .addCase(deactivateManufacturingStoreAction.fulfilled, (state, action) => {
        state.deactivateManufacturingStoreLoading = false;
        state.deactivateManufacturingStore = action.payload || null;
        Logger.info('Manufacturing store deactivated successfully in slice');
      })
      .addCase(deactivateManufacturingStoreAction.rejected, (state, action) => {
        state.deactivateManufacturingStoreLoading = false;
        state.deactivateManufacturingStoreError = action.payload;
        Logger.error('Deactivate manufacturing store failed in slice:', action.payload);
      });

    builder
      .addCase(listOutsourcedComponentsAction.pending, state => {
        state.outsourcedComponentsLoading = true;
        state.outsourcedComponentsError = null;
      })
      .addCase(listOutsourcedComponentsAction.fulfilled, (state, action) => {
        state.outsourcedComponentsLoading = false;
        state.outsourcedComponents = action.payload?.data || action.payload || null;
        Logger.info('Outsourced components loaded successfully in slice');
      })
      .addCase(listOutsourcedComponentsAction.rejected, (state, action) => {
        state.outsourcedComponentsLoading = false;
        state.outsourcedComponentsError = action.payload;
        Logger.error('List outsourced components failed in slice:', action.payload);
      })
      .addCase(getOutsourcedComponentAction.pending, state => {
        state.getOutsourcedComponentLoading = true;
        state.getOutsourcedComponentError = null;
      })
      .addCase(getOutsourcedComponentAction.fulfilled, (state, action) => {
        state.getOutsourcedComponentLoading = false;
        state.getOutsourcedComponent = action.payload?.data || action.payload || null;
        Logger.info('Outsourced component loaded successfully in slice');
      })
      .addCase(getOutsourcedComponentAction.rejected, (state, action) => {
        state.getOutsourcedComponentLoading = false;
        state.getOutsourcedComponentError = action.payload;
        Logger.error('Get outsourced component failed in slice:', action.payload);
      })
      .addCase(createOutsourcedComponentAction.pending, state => {
        state.createOutsourcedComponentLoading = true;
        state.createOutsourcedComponentError = null;
      })
      .addCase(createOutsourcedComponentAction.fulfilled, (state, action) => {
        state.createOutsourcedComponentLoading = false;
        state.createOutsourcedComponent = action.payload?.data || action.payload || null;
        Logger.info('Outsourced component created successfully in slice');
      })
      .addCase(createOutsourcedComponentAction.rejected, (state, action) => {
        state.createOutsourcedComponentLoading = false;
        state.createOutsourcedComponentError = action.payload;
        Logger.error('Create outsourced component failed in slice:', action.payload);
      })
      .addCase(updateOutsourcedComponentAction.pending, state => {
        state.updateOutsourcedComponentLoading = true;
        state.updateOutsourcedComponentError = null;
      })
      .addCase(updateOutsourcedComponentAction.fulfilled, (state, action) => {
        state.updateOutsourcedComponentLoading = false;
        state.updateOutsourcedComponent = action.payload?.data || action.payload || null;
        Logger.info('Outsourced component updated successfully in slice');
      })
      .addCase(updateOutsourcedComponentAction.rejected, (state, action) => {
        state.updateOutsourcedComponentLoading = false;
        state.updateOutsourcedComponentError = action.payload;
        Logger.error('Update outsourced component failed in slice:', action.payload);
      })
      .addCase(activateOutsourcedComponentAction.pending, state => {
        state.activateOutsourcedComponentLoading = true;
        state.activateOutsourcedComponentError = null;
      })
      .addCase(activateOutsourcedComponentAction.fulfilled, (state, action) => {
        state.activateOutsourcedComponentLoading = false;
        state.activateOutsourcedComponent = action.payload || null;
        Logger.info('Outsourced component activated successfully in slice');
      })
      .addCase(activateOutsourcedComponentAction.rejected, (state, action) => {
        state.activateOutsourcedComponentLoading = false;
        state.activateOutsourcedComponentError = action.payload;
        Logger.error('Activate outsourced component failed in slice:', action.payload);
      })
      .addCase(deactivateOutsourcedComponentAction.pending, state => {
        state.deactivateOutsourcedComponentLoading = true;
        state.deactivateOutsourcedComponentError = null;
      })
      .addCase(deactivateOutsourcedComponentAction.fulfilled, (state, action) => {
        state.deactivateOutsourcedComponentLoading = false;
        state.deactivateOutsourcedComponent = action.payload || null;
        Logger.info('Outsourced component deactivated successfully in slice');
      })
      .addCase(deactivateOutsourcedComponentAction.rejected, (state, action) => {
        state.deactivateOutsourcedComponentLoading = false;
        state.deactivateOutsourcedComponentError = action.payload;
        Logger.error('Deactivate outsourced component failed in slice:', action.payload);
      });

    builder
      .addCase(pinCodeAction.pending, (state, action) => {
        const key = action.meta?.arg?.key ?? 'default';
        state.pinCodeLoadingByKey[key] = true;
        state.pinCodeErrorByKey[key] = null;
        if (key === 'default') {
          state.pinCodeLoading = true;
          state.pinCodeError = null;
        }
      })
      .addCase(pinCodeAction.fulfilled, (state, action) => {
        const key = action.payload?.key ?? 'default';
        const data = action.payload?.data ?? '';
        state.pinCodeLoadingByKey[key] = false;
        state.pinCodeLookups[key] = data;
        state.pinCodeQueriedByKey[key] = action.meta?.arg?.pincode ?? '';
        if (key === 'default') {
          state.pinCodeLoading = false;
          state.pinCode = data || '';
        }
      })
      .addCase(pinCodeAction.rejected, (state, action) => {
        const key = action.payload?.key ?? action.meta?.arg?.key ?? 'default';
        const error = action.payload?.error ?? action.payload;
        state.pinCodeLoadingByKey[key] = false;
        state.pinCodeErrorByKey[key] = error;
        if (key === 'default') {
          state.pinCodeLoading = false;
          state.pinCodeError = error;
        }
        Logger.error('Pin code fetch failed in slice:', error);
      });
    builder
      .addCase(getStateAction.pending, state => {
        state.getStateLoading = true;
        state.getStateError = null;
      })
      .addCase(getStateAction.fulfilled, (state, action) => {
        state.getStateLoading = false;
        state.getState = action.payload || '';
      })
      .addCase(getStateAction.rejected, (state, action) => {
        state.getStateLoading = false;
        state.getStateError = action.payload;
        Logger.error('Get state fetch failed in slice:', action.payload);
      });
    builder
      .addCase(getDistrictsAction.pending, state => {
        state.districtsLoading = true;
        state.districtsError = null;
      })
      .addCase(getDistrictsAction.fulfilled, (state, action) => {
        state.districtsLoading = false;
        state.districts = action.payload || null;
        Logger.info('Districts loaded successfully in slice');
      })
      .addCase(getDistrictsAction.rejected, (state, action) => {
        state.districtsLoading = false;
        state.districtsError = action.payload;
        Logger.error('Get districts failed in slice:', action.payload);
      });
  },
});
export const {
  resetPinCode,
  resetGetState,
  resetUser,
  resetVendorCategoryCreateUpdate,
  resetRawMaterialCreateUpdate,
  resetThirdPartyCertCreateUpdate,
  resetOutsourcedComponentCreateUpdate,
  resetKeyResourceCreateUpdate,
  resetKeyProcessV1CreateUpdate,
  resetVendorLabCreateUpdate,
  resetBoughtOutPartCreateUpdate,
  resetKeyProcessCreateUpdate,
  resetManufacturingStoreCreateUpdate,
  resetAssessorDomainCreateUpdate,
  resetVendorCategoryCreateV1Update,
} = masterSlice.actions;
export default masterSlice.reducer;
