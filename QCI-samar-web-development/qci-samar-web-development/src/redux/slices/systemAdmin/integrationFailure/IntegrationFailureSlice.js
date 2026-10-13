import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../../utils/logger';
import { getIntegrationFailureCategoriesAction, getIntegrationFailuresAction } from '../../../action/systemAdmin/integrationFailure/IntegrationFailureAction';

const initialState = {
  failures: [],
  failuresPagination: null,
  failuresLoading: false,
  failuresError: null,
  categories: [],
};

const integrationFailureSlice = createSlice({
  name: 'systemAdminIntegrationFailure',
  initialState,

  reducers: {},

  extraReducers: builder => {
    builder
      .addCase(getIntegrationFailuresAction.pending, state => {
        state.failuresLoading = true;
        state.failuresError = null;
      })
      .addCase(getIntegrationFailuresAction.fulfilled, (state, action) => {
        state.failuresLoading = false;
        state.failures = action.payload?.data || [];
        state.failuresPagination = action.payload?.pagination || null;
      })
      .addCase(getIntegrationFailuresAction.rejected, (state, action) => {
        state.failuresLoading = false;
        state.failuresError = action.payload;
        Logger.error('Get integration failures failed in slice:', action.payload);
      })
      .addCase(getIntegrationFailureCategoriesAction.fulfilled, (state, action) => {
        state.categories = action.payload?.data || [];
      });
  },
});

export default integrationFailureSlice.reducer;
