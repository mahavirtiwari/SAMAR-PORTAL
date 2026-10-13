import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../../utils/logger';
import { createUnitAction, getAllUnitsAction, getUnitDetailsAction, updateUnitAction } from '../../../action/enterpriseAdmin/unit/UnitAction';

const initialState = {
  unitList: [],
  unitListPagination: null,
  unitListLoading: false,
  unitListError: null,
  createUnitLoading: false,
  createUnitError: null,
  createUnit: null,
  getUnitDetailLoading: false,
  getUnitDetailError: null,
  getUnitDetail: null,
  updateUnitLoading: false,
  updateUnitError: null,
  updateUnit: null,
};

const unitSlice = createSlice({
  name: 'unit',
  initialState,
  reducers: {
    resetCreateUnit(state) {
      state.createUnitError = null;
      state.createUnit = null;
    },
    resetUpdateUnit(state) {
      state.updateUnitError = null;
      state.updateUnit = null;
    },
  },
  extraReducers: builder => {
    // Get all unit
    builder
      .addCase(getAllUnitsAction.pending, state => {
        state.unitListLoading = true;
        state.unitListError = null;
      })
      .addCase(getAllUnitsAction.fulfilled, (state, action) => {
        state.unitListLoading = false;
        state.unitList = action.payload?.data ?? [];
        state.unitListPagination = action.payload?.pagination ?? null;
        Logger.info('Units loaded successfully in slice');
      })
      .addCase(getAllUnitsAction.rejected, (state, action) => {
        state.unitListLoading = false;
        state.unitListError = action.payload;
        Logger.error('Get units failed in slice:', action.payload);
      });

    // create Unit Action
    builder
      .addCase(createUnitAction.pending, state => {
        state.createUnitLoading = true;
        state.createUnitError = null;
      })
      .addCase(createUnitAction.fulfilled, (state, action) => {
        state.createUnitLoading = false;
        state.createUnit = action.payload?.data || action.payload || [];
      })
      .addCase(createUnitAction.rejected, (state, action) => {
        state.createUnitLoading = false;
        state.createUnitError = action.payload;
      });
    // get units details
    builder
      .addCase(getUnitDetailsAction.pending, state => {
        state.getUnitDetailLoading = true;
        state.getUnitDetailError = null;
      })
      .addCase(getUnitDetailsAction.fulfilled, (state, action) => {
        state.getUnitDetailLoading = false;
        state.getUnitDetail = action.payload || [];
      })
      .addCase(getUnitDetailsAction.rejected, (state, action) => {
        state.getUnitDetailLoading = false;
        state.getUnitDetailError = action.payload;
      });
    // update Unit
    builder
      .addCase(updateUnitAction.pending, state => {
        state.updateUnitLoading = true;
        state.updateUnitError = null;
      })
      .addCase(updateUnitAction.fulfilled, (state, action) => {
        state.updateUnitLoading = false;
        state.updateUnit = action.payload;
      })
      .addCase(updateUnitAction.rejected, (state, action) => {
        state.updateUnitLoading = false;
        state.updateUnitError = action.payload;
      });
  },
});

export const { resetCreateUnit, resetUpdateUnit } = unitSlice.actions;
export default unitSlice.reducer;
