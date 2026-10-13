import { createSlice } from '@reduxjs/toolkit';
import {
  addBasicInformationAction,
  getBasicInformationAction,
  getBoughtOutPart,
  getCategory,
  getCountriesAction,
  getKeyProcessesAction,
  getKeyResourcesAction,
  getServiceCategoryAction,
  getServiceKeyProcessesAction,
  getServiceKeyResourcesAction,
  getStore,
  getVendorLabsAction,
  thirdPartyCertificationsAction
} from '../action/basicInformationAction';

const initialState = {
  // Get Basic Information
  basicInformationLoading: false,
  basicInformationError: null,
  basicInformation: null,

  // Add Basic Information
  addBasicInformationLoading: false,
  addBasicInformationError: null,
  addBasicInformationData: null,

  getCategoryLoading: false,
  getCategoryError: null,
  getCategoryData: [],

  getStoreLoading: false,
  getStoreError: null,
  getStoreData: [],

  getKeyProcessesLoading: false,
  getKeyProcessesError: null,
  getKeyProcessesData: [],

  getKeyResourcesLoading: false,
  getKeyResourcesError: null,
  getKeyResourcesData: [],

  getThirdPartyCertificationsLoading: false,
  getThirdPartyCertificationsError: null,
  getThirdPartyCertificationsData: [],

  getBoughtOutPartLoading: false,
  getBoughtOutPartError: null,
  getBoughtOutPartData: [],

  getRawmaterialData: [],
  getBoughtOutParts: [],
  getProductsData: [],
  getCustomersData: [],

  countriesList: [],
  countriesListLoading: false,
  countriesListError: null,

  // Service-sector master data
  getServiceCategoryLoading: false,
  getServiceCategoryError: null,
  getServiceCategoryData: [],

  getVendorLabsLoading: false,
  getVendorLabsError: null,
  getVendorLabsData: [],

  getServiceKeyProcessesLoading: false,
  getServiceKeyProcessesError: null,
  getServiceKeyProcessesData: [],

  getServiceKeyResourcesLoading: false,
  getServiceKeyResourcesError: null,
  getServiceKeyResourcesData: []
};

const basicInformationSlice = createSlice({
  name: 'basicInformation',
  initialState,
  reducers: {
    resetData: (state) => {
      state.getRawmaterialData = [];
      state.getBoughtOutParts = [];
      state.getProductsData = [];
      state.getCustomersData = [];
    },
    setKeyResourcesData: (state, action) => {
      state.getRawmaterialData = [...state.getRawmaterialData, ...action.payload];
    },
    setBoughtOutPartsData: (state, action) => {
      state.getBoughtOutParts = [...state.getBoughtOutParts, ...action.payload];
    },
    setProductsData: (state, action) => {
      state.getProductsData = [...state.getProductsData, ...action.payload];
    },
    setCustomersData: (state, action) => {
      state.getCustomersData = [...state.getCustomersData, ...action.payload];
    },
    // Reset individual states
    resetBasicInformationState: (state) => {
      state.basicInformationLoading = false;
      state.basicInformationError = null;
      state.basicInformation = null;
    },
    resetAddBasicInformationState: (state) => {
      state.addBasicInformationLoading = false;
      state.addBasicInformationError = null;
      state.addBasicInformationData = null;
    },
    resetKeyProcessesState: (state) => {
      state.getKeyProcessesLoading = false;
      state.getKeyProcessesError = null;
      state.getKeyProcessesData = [];
    },
    resetKeyResourcesState: (state) => {
      state.getKeyResourcesLoading = false;
      state.getKeyResourcesError = null;
      state.getKeyResourcesData = [];
    },
    resetThirdPartyCertificationsState: (state) => {
      state.getThirdPartyCertificationsLoading = false;
      state.getThirdPartyCertificationsError = null;
      state.getThirdPartyCertificationsData = [];
    },

    resetBoughtOutPartState: (state) => {
      state.getBoughtOutPartLoading = false;
      state.getBoughtOutPartError = null;
      state.getBoughtOutPartData = [];
    },
    resetServiceKeyProcessesState: (state) => {
      state.getServiceKeyProcessesLoading = false;
      state.getServiceKeyProcessesError = null;
      state.getServiceKeyProcessesData = [];
    },
    resetServiceKeyResourcesState: (state) => {
      state.getServiceKeyResourcesLoading = false;
      state.getServiceKeyResourcesError = null;
      state.getServiceKeyResourcesData = [];
    },
    // Reset entire basic information state
    resetBasicInformationSliceState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Get Basic Information
      .addCase(getBasicInformationAction.pending, (state) => {
        state.basicInformationLoading = true;
        state.basicInformationError = null;
      })
      .addCase(getBasicInformationAction.fulfilled, (state, action) => {
        state.basicInformationLoading = false;
        state.basicInformation = action.payload;
        state.basicInformationError = null;
      })
      .addCase(getBasicInformationAction.rejected, (state, action) => {
        state.basicInformationLoading = false;
        state.basicInformationError = action.payload;
        state.basicInformation = null;
      })

      .addCase(getCategory.pending, (state) => {
        state.getCategoryLoading = true;
        state.getCategoryError = null;
      })
      .addCase(getCategory.fulfilled, (state, action) => {
        state.getCategoryLoading = false;
        state.getCategoryData = action.payload;
        state.getCategoryError = null;
      })
      .addCase(getCategory.rejected, (state, action) => {
        state.getCategoryLoading = false;
        state.getCategoryError = action.payload;
        state.getCategoryData = null;
      })

      .addCase(getStore.pending, (state) => {
        state.getStoreLoading = true;
        state.getStoreError = null;
      })
      .addCase(getStore.fulfilled, (state, action) => {
        state.getStoreLoading = false;
        state.getStoreData = action.payload;
      })
      .addCase(getStore.rejected, (state, action) => {
        state.getStoreLoading = false;
        state.getStoreError = action.payload;
      })

      // Add Basic Information
      .addCase(addBasicInformationAction.pending, (state) => {
        state.addBasicInformationLoading = true;
        state.addBasicInformationError = null;
      })
      .addCase(addBasicInformationAction.fulfilled, (state, action) => {
        state.addBasicInformationLoading = false;
        state.addBasicInformationData = action.payload;
        state.addBasicInformationError = null;
      })
      .addCase(addBasicInformationAction.rejected, (state, action) => {
        state.addBasicInformationLoading = false;
        state.addBasicInformationError = action.payload;
        state.addBasicInformationData = null;
      })

      .addCase(getKeyProcessesAction.pending, (state) => {
        state.getKeyProcessesLoading = true;
        state.getKeyProcessesError = null;
      })
      .addCase(getKeyProcessesAction.fulfilled, (state, action) => {
        state.getKeyProcessesLoading = false;
        state.getKeyProcessesData = action.payload;
        state.getKeyProcessesError = null;
      })
      .addCase(getKeyProcessesAction.rejected, (state, action) => {
        state.getKeyProcessesLoading = false;
        state.getKeyProcessesError = action.payload;
        state.getKeyProcessesData = null;
      })

      .addCase(getKeyResourcesAction.pending, (state) => {
        state.getKeyResourcesLoading = true;
        state.getKeyResourcesError = null;
      })
      .addCase(getKeyResourcesAction.fulfilled, (state, action) => {
        state.getKeyResourcesLoading = false;
        state.getKeyResourcesData = action.payload;
        state.getKeyResourcesError = null;
      })
      .addCase(getKeyResourcesAction.rejected, (state, action) => {
        state.getKeyResourcesLoading = false;
        state.getKeyResourcesError = action.payload;
        state.getKeyResourcesData = null;
      })

      .addCase(thirdPartyCertificationsAction.pending, (state) => {
        state.getThirdPartyCertificationsLoading = true;
        state.getThirdPartyCertificationsError = null;
      })
      .addCase(thirdPartyCertificationsAction.fulfilled, (state, action) => {
        state.getThirdPartyCertificationsLoading = false;
        state.getThirdPartyCertificationsData = action.payload;
        state.getThirdPartyCertificationsError = null;
      })
      .addCase(thirdPartyCertificationsAction.rejected, (state, action) => {
        state.getThirdPartyCertificationsLoading = false;
        state.getThirdPartyCertificationsError = action.payload;
        state.getThirdPartyCertificationsData = null;
      })

      .addCase(getBoughtOutPart.pending, (state) => {
        state.getBoughtOutPartLoading = true;
        state.getBoughtOutPartError = null;
      })
      .addCase(getBoughtOutPart.fulfilled, (state, action) => {
        state.getBoughtOutPartLoading = false;
        state.getBoughtOutPartData = action.payload;
        state.getBoughtOutPartError = null;
      })
      .addCase(getBoughtOutPart.rejected, (state, action) => {
        state.getBoughtOutPartLoading = false;
        state.getBoughtOutPartError = action.payload;
        state.getBoughtOutPartData = null;
      })

      .addCase(getCountriesAction.pending, (state) => {
        state.countriesListLoading = true;
        state.countriesListError = null;
      })
      .addCase(getCountriesAction.fulfilled, (state, action) => {
        state.countriesListLoading = false;
        state.countriesList = action.payload;
        state.countriesListError = null;
      })
      .addCase(getCountriesAction.rejected, (state, action) => {
        state.countriesListLoading = false;
        state.countriesListError = action.payload;
        state.countriesList = [];
      })

      // Service-sector master data
      .addCase(getServiceCategoryAction.pending, (state) => {
        state.getServiceCategoryLoading = true;
        state.getServiceCategoryError = null;
      })
      .addCase(getServiceCategoryAction.fulfilled, (state, action) => {
        state.getServiceCategoryLoading = false;
        state.getServiceCategoryData = action.payload;
        state.getServiceCategoryError = null;
      })
      .addCase(getServiceCategoryAction.rejected, (state, action) => {
        state.getServiceCategoryLoading = false;
        state.getServiceCategoryError = action.payload;
        state.getServiceCategoryData = [];
      })

      .addCase(getVendorLabsAction.pending, (state) => {
        state.getVendorLabsLoading = true;
        state.getVendorLabsError = null;
      })
      .addCase(getVendorLabsAction.fulfilled, (state, action) => {
        state.getVendorLabsLoading = false;
        state.getVendorLabsData = action.payload;
        state.getVendorLabsError = null;
      })
      .addCase(getVendorLabsAction.rejected, (state, action) => {
        state.getVendorLabsLoading = false;
        state.getVendorLabsError = action.payload;
        state.getVendorLabsData = [];
      })

      .addCase(getServiceKeyProcessesAction.pending, (state) => {
        state.getServiceKeyProcessesLoading = true;
        state.getServiceKeyProcessesError = null;
      })
      .addCase(getServiceKeyProcessesAction.fulfilled, (state, action) => {
        state.getServiceKeyProcessesLoading = false;
        state.getServiceKeyProcessesData = action.payload;
        state.getServiceKeyProcessesError = null;
      })
      .addCase(getServiceKeyProcessesAction.rejected, (state, action) => {
        state.getServiceKeyProcessesLoading = false;
        state.getServiceKeyProcessesError = action.payload;
        state.getServiceKeyProcessesData = [];
      })

      .addCase(getServiceKeyResourcesAction.pending, (state) => {
        state.getServiceKeyResourcesLoading = true;
        state.getServiceKeyResourcesError = null;
      })
      .addCase(getServiceKeyResourcesAction.fulfilled, (state, action) => {
        state.getServiceKeyResourcesLoading = false;
        state.getServiceKeyResourcesData = action.payload;
        state.getServiceKeyResourcesError = null;
      })
      .addCase(getServiceKeyResourcesAction.rejected, (state, action) => {
        state.getServiceKeyResourcesLoading = false;
        state.getServiceKeyResourcesError = action.payload;
        state.getServiceKeyResourcesData = [];
      });
  }
});

export const {
  resetBasicInformationState,
  resetAddBasicInformationState,
  resetBasicInformationSliceState,
  resetKeyProcessesState,
  resetKeyResourcesState,
  setKeyResourcesData,
  setBoughtOutPartsData,
  setProductsData,
  setCustomersData,
  resetThirdPartyCertificationsState,
  resetData,
  resetBoughtOutPartState,
  resetServiceKeyProcessesState,
  resetServiceKeyResourcesState
} = basicInformationSlice.actions;

export default basicInformationSlice.reducer;
