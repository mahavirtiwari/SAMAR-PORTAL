import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import { getAllOrganizationsAction, updateOrganizationAction } from '../../action/organizations/OrganizationAction';

const initialState = {
  // Organizations list
  organizations: [],
  organizationsLoading: false,
  organizationsError: null,

  // Update organization
  updateLoading: false,
  updateError: null,
  updatedOrganization: null,
};

const organizationSlice = createSlice({
  name: 'organizations',
  initialState,
  reducers: {
    resetUpdated(state) {
      state.updatedOrganization = null;
      state.updateError = null;
    },
    resetOrganizations(state) {
      state.organizations = [];
      state.organizationsError = null;
    },
  },
  extraReducers: builder => {
    // Get all organizations
    builder
      .addCase(getAllOrganizationsAction.pending, state => {
        state.organizationsLoading = true;
        state.organizationsError = null;
      })
      .addCase(getAllOrganizationsAction.fulfilled, (state, action) => {
        state.organizationsLoading = false;
        state.organizations = action.payload?.data || action.payload || [];
        Logger.info('Organizations loaded successfully in slice');
      })
      .addCase(getAllOrganizationsAction.rejected, (state, action) => {
        state.organizationsLoading = false;
        state.organizationsError = action.payload;
        Logger.error('Get organizations failed in slice:', action.payload);
      });

    // Update organization
    builder
      .addCase(updateOrganizationAction.pending, state => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateOrganizationAction.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.updatedOrganization = action.payload?.data || action.payload;
      })
      .addCase(updateOrganizationAction.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
        Logger.error('Update organization failed in slice:', action.payload);
      });
  },
});

export const { clearError, clearCurrentOrganization, setCurrentOrganization, resetUpdated, resetOrganizations } = organizationSlice.actions;

export default organizationSlice.reducer;
