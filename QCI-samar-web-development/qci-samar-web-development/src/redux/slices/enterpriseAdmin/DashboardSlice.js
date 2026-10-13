import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import { getEnterpriseAdminDashboardAction } from '../../action/enterpriseAdmin/DashboardAction';

const initialState = {
  // Dashboard data
  dashboard: null,
  dashboardLoading: false,
  dashboardError: null,

  // Extracted data for components (for convenience)
  summaryCards: [],
  activeApplications: [],
  paymentSummary: {},
  alerts: [],
  stats: {},
  charts: [],
};

const dashboardSlice = createSlice({
  name: 'enterpriseAdminDashboard',
  initialState,
  reducers: {
    resetDashboardState(state) {
      state.dashboardError = null;
    },
    clearDashboard(state) {
      state.dashboard = null;
      state.summaryCards = [];
      state.activeApplications = [];
      state.paymentSummary = {};
      state.alerts = [];
      state.stats = {};
      state.charts = [];
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getEnterpriseAdminDashboardAction.pending, state => {
        state.dashboardLoading = true;
        state.dashboardError = null;
      })
      .addCase(getEnterpriseAdminDashboardAction.fulfilled, (state, action) => {
        state.dashboardLoading = false;
        state.dashboard = action.payload;

        // Extract nested data for easier component access
        state.summaryCards = action.payload?.summaryCards ?? [];
        state.activeApplications = action.payload?.activeApplications ?? [];
        state.paymentSummary = action.payload?.paymentSummary ?? {};
        state.alerts = action.payload?.alerts ?? [];
        state.stats = action.payload?.stats ?? {};
        state.charts = action.payload?.charts ?? [];

        Logger.info('Enterprise Admin dashboard loaded successfully in slice');
      })
      .addCase(getEnterpriseAdminDashboardAction.rejected, (state, action) => {
        state.dashboardLoading = false;
        state.dashboardError = action.payload;
        Logger.error('Get enterprise admin dashboard failed in slice:', action.payload);
      });
  },
});

export const { resetDashboardState, clearDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
