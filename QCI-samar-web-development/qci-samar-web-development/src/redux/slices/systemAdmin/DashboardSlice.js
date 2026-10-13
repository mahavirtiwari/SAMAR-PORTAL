import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import { getSystemAdminDashboardAction } from '../../action/systemAdmin/DashboardAction';

const initialState = {
  // Dashboard data
  dashboard: null,
  dashboardLoading: false,
  dashboardError: null,

  // Extracted data for components (for convenience)
  summaryCards: [],
  enterpriseDistribution: {},
  certifiedVendorsByLevel: {},
  assessmentStatusFlow: [],
  userDistribution: [],
  stateWiseVendors: [],
};

const dashboardSlice = createSlice({
  name: 'systemAdminDashboard',
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
      state.userDistribution = [];
      state.stateWiseVendors = [];
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getSystemAdminDashboardAction.pending, state => {
        state.dashboardLoading = true;
        state.dashboardError = null;
      })
      .addCase(getSystemAdminDashboardAction.fulfilled, (state, action) => {
        state.dashboardLoading = false;
        state.dashboard = action.payload;

        // Extract nested data for easier component access
        state.summaryCards = action.payload?.summaryCards ?? [];
        state.enterpriseDistribution = action.payload?.enterpriseDistribution ?? {};
        state.certifiedVendorsByLevel = action.payload?.certifiedVendorsByLevel ?? {};
        state.assessmentStatusFlow = action.payload?.assessmentStatusFlow ?? [];
        state.userDistribution = action.payload?.userDistribution ?? [];
        state.stateWiseVendors = action.payload?.stateWiseVendors ?? [];

        Logger.info('System Admin dashboard loaded successfully in slice');
      })
      .addCase(getSystemAdminDashboardAction.rejected, (state, action) => {
        state.dashboardLoading = false;
        state.dashboardError = action.payload;
        Logger.error('Get system admin dashboard failed in slice:', action.payload);
      });
  },
});

export const { resetDashboardState, clearDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
