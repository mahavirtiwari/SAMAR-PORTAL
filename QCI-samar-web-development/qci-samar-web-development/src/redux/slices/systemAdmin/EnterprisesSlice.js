import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import { activateOrganizationAction, deactivateOrganizationAction, exportOrganizationsAction, getOrganizationByIdAction, getOrganizationsAction } from '../../action/systemAdmin/EnterprisesAction';

const initialState = {
  organizations: [],
  organizationsLoading: false,
  organizationsError: null,

  organization: null,
  organizationLoading: false,
  organizationError: null,

  exportData: null,
  exportLoading: false,
  exportError: null,

  activateLoading: false,
  activateError: null,
  activatedOrganization: null,

  deactivateLoading: false,
  deactivateError: null,
  deactivatedOrganization: null,
};

const enterprisesSlice = createSlice({
  name: 'enterprises',
  initialState,
  reducers: {
    resetEnterprisesState(state) {
      state.organizationsError = null;
      state.organizationError = null;
    },
    resetActivateDeactivateState(state) {
      state.activateLoading = false;
      state.activateError = null;
      state.activatedOrganization = null;
      state.deactivateLoading = false;
      state.deactivateError = null;
      state.deactivatedOrganization = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getOrganizationsAction.pending, state => {
        state.organizationsLoading = true;
        state.organizationsError = null;
      })
      .addCase(getOrganizationsAction.fulfilled, (state, action) => {
        state.organizationsLoading = false;
        state.organizations = action.payload || [];
        Logger.info('Organizations loaded successfully in slice');
      })
      .addCase(getOrganizationsAction.rejected, (state, action) => {
        state.organizationsLoading = false;
        state.organizationsError = action.payload;
        Logger.error('Get organizations failed in slice:', action.payload);
      });

    builder
      .addCase(getOrganizationByIdAction.pending, state => {
        state.organizationLoading = true;
        state.organizationError = null;
      })
      .addCase(getOrganizationByIdAction.fulfilled, (state, action) => {
        state.organizationLoading = false;
        state.organization = action.payload || null;
        Logger.info('Organization loaded successfully in slice');
      })
      .addCase(getOrganizationByIdAction.rejected, (state, action) => {
        state.organizationLoading = false;
        state.organizationError = action.payload;
        Logger.error('Get organization failed in slice:', action.payload);
      });

    builder
      .addCase(exportOrganizationsAction.pending, state => {
        state.exportLoading = true;
        state.exportError = null;
      })
      .addCase(exportOrganizationsAction.fulfilled, (state, action) => {
        state.exportLoading = false;
        state.exportData = action.payload;
        Logger.info('Organizations exported successfully in slice');
      })
      .addCase(exportOrganizationsAction.rejected, (state, action) => {
        state.exportLoading = false;
        state.exportError = action.payload;
        Logger.error('Export organizations failed in slice:', action.payload);
      });

    builder
      .addCase(activateOrganizationAction.pending, state => {
        state.activateLoading = true;
        state.activateError = null;
      })
      .addCase(activateOrganizationAction.fulfilled, (state, action) => {
        state.activateLoading = false;
        state.activatedOrganization = action.payload;
        Logger.info('Organization activated successfully in slice');
      })
      .addCase(activateOrganizationAction.rejected, (state, action) => {
        state.activateLoading = false;
        state.activateError = action.payload;
        Logger.error('Activate organization failed in slice:', action.payload);
      });

    builder
      .addCase(deactivateOrganizationAction.pending, state => {
        state.deactivateLoading = true;
        state.deactivateError = null;
      })
      .addCase(deactivateOrganizationAction.fulfilled, (state, action) => {
        state.deactivateLoading = false;
        state.deactivatedOrganization = action.payload;
        Logger.info('Organization deactivated successfully in slice');
      })
      .addCase(deactivateOrganizationAction.rejected, (state, action) => {
        state.deactivateLoading = false;
        state.deactivateError = action.payload;
        Logger.error('Deactivate organization failed in slice:', action.payload);
      });
  },
});

export const { resetEnterprisesState, resetActivateDeactivateState } = enterprisesSlice.actions;
export default enterprisesSlice.reducer;
