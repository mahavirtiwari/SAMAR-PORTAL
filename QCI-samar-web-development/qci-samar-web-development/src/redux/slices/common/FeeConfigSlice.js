import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  createFeeConfigurationAction,
  deleteFeeConfigurationAction,
  getFeeConfigurationByIdAction,
  getFeeConfigurationsAction,
  updateFeeConfigurationAction,
} from '../../action/common/FeeConfigAction';

const initialState = {
  feeConfigurations: [],
  feeConfigurationsLoading: true,
  feeConfigurationsError: null,

  feeConfiguration: null,
  feeConfigurationLoading: false,
  feeConfigurationError: null,

  createLoading: false,
  createError: null,
  createdFeeConfiguration: null,

  updateLoading: false,
  updateError: null,
  updatedFeeConfiguration: null,

  deleteLoading: false,
  deleteError: null,
  deletedFeeConfiguration: null,
};

const feeConfigSlice = createSlice({
  name: 'feeConfig',
  initialState,
  reducers: {
    resetFeeConfigCreateUpdateDelete(state) {
      state.createLoading = false;
      state.createError = null;
      state.createdFeeConfiguration = null;
      state.updateLoading = false;
      state.updateError = null;
      state.updatedFeeConfiguration = null;
      state.deleteLoading = false;
      state.deleteError = null;
      state.deletedFeeConfiguration = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getFeeConfigurationsAction.pending, state => {
        state.feeConfigurationsLoading = true;
        state.feeConfigurationsError = null;
      })
      .addCase(getFeeConfigurationsAction.fulfilled, (state, action) => {
        state.feeConfigurationsLoading = false;
        state.feeConfigurations = action.payload || [];
        Logger.info('Fee configurations loaded successfully in slice');
      })
      .addCase(getFeeConfigurationsAction.rejected, (state, action) => {
        state.feeConfigurationsLoading = false;
        state.feeConfigurationsError = action.payload;
        Logger.error('Get fee configurations failed in slice:', action.payload);
      });

    builder
      .addCase(getFeeConfigurationByIdAction.pending, state => {
        state.feeConfigurationLoading = true;
        state.feeConfigurationError = null;
      })
      .addCase(getFeeConfigurationByIdAction.fulfilled, (state, action) => {
        state.feeConfigurationLoading = false;
        state.feeConfiguration = action.payload || null;
        Logger.info('Fee configuration loaded successfully in slice');
      })
      .addCase(getFeeConfigurationByIdAction.rejected, (state, action) => {
        state.feeConfigurationLoading = false;
        state.feeConfigurationError = action.payload;
        Logger.error('Get fee configuration failed in slice:', action.payload);
      });

    builder
      .addCase(createFeeConfigurationAction.pending, state => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createFeeConfigurationAction.fulfilled, (state, action) => {
        state.createLoading = false;
        state.createdFeeConfiguration = action.payload || null;
        Logger.info('Fee configuration created successfully in slice');
      })
      .addCase(createFeeConfigurationAction.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
        Logger.error('Create fee configuration failed in slice:', action.payload);
      });

    builder
      .addCase(updateFeeConfigurationAction.pending, state => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateFeeConfigurationAction.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.updatedFeeConfiguration = action.payload || null;
        Logger.info('Fee configuration updated successfully in slice');
      })
      .addCase(updateFeeConfigurationAction.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
        Logger.error('Update fee configuration failed in slice:', action.payload);
      });

    builder
      .addCase(deleteFeeConfigurationAction.pending, state => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deleteFeeConfigurationAction.fulfilled, (state, action) => {
        state.deleteLoading = false;
        state.deletedFeeConfiguration = action.payload || null;
        Logger.info('Fee configuration deleted successfully in slice');
      })
      .addCase(deleteFeeConfigurationAction.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload;
        Logger.error('Delete fee configuration failed in slice:', action.payload);
      });
  },
});
export const { resetFeeConfigCreateUpdateDelete } = feeConfigSlice.actions;
export default feeConfigSlice.reducer;
