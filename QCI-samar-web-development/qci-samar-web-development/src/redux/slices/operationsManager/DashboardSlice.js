import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import { getOperationsManagerDashboardAction } from '../../action/operationsManager/DashboardAction';

const initialState = {
  // Dashboard data
  dashboard: null,
  dashboardLoading: false,
  dashboardError: null,

  // Extracted data for components
  summaryCards: [],
  enterpriseDistribution: {},
  certifiedVendorsByLevel: {},
  assessmentStatusFlow: [],
  stateWiseVendors: [],
};

const dashboardSlice = createSlice({
  name: 'operationsManagerDashboard',
  initialState,
  reducers: {
    resetDashboardState(state) {
      state.dashboardError = null;
    },
    clearDashboard(state) {
      state.dashboard = null;
      state.summaryCards = [];
      state.enterpriseDistribution = {};
      state.certifiedVendorsByLevel = {};
      state.assessmentStatusFlow = [];
      state.stateWiseVendors = [];
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getOperationsManagerDashboardAction.pending, state => {
        state.dashboardLoading = true;
        state.dashboardError = null;
      })
      .addCase(getOperationsManagerDashboardAction.fulfilled, (state, action) => {
        state.dashboardLoading = false;
        state.dashboard = action.payload;

        // Extract nested data for easier component access
        state.summaryCards = action.payload?.summaryCards ?? [];
        state.enterpriseDistribution = action.payload?.enterpriseDistribution ?? {};
        state.certifiedVendorsByLevel = action.payload?.certifiedVendorsByLevel ?? {};
        state.assessmentStatusFlow = action.payload?.assessmentStatusFlow ?? [];
        state.stateWiseVendors = action.payload?.stateWiseVendors ?? [];
        Logger.info('Operations Manager dashboard loaded successfully in slice');
      })
      .addCase(getOperationsManagerDashboardAction.rejected, (state, action) => {
        state.dashboardLoading = false;
        state.dashboardError = action.payload;
        Logger.error('Get operations manager dashboard failed in slice:', action.payload);
      });
  },
});

export const { resetDashboardState, clearDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
