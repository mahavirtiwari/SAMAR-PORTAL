import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  getApplicationSubmissionSettingByKeyAction,
  getCertificateValiditySettingByKeyAction,
  getDrdoApprovalSettingByKeyAction,
  getMaintenanceModeSettingByKeyAction,
  getRecertificationWindowSettingByKeyAction,
  updateApplicationSubmissionSettingAction,
  updateCertificateValiditySettingAction,
  updateDrdoApprovalSettingAction,
  updateMaintenanceModeSettingAction,
  updateRecertificationWindowSettingAction,
} from '../../action/common/SystemSettingAction';

const initialState = {
  // DRDO specific
  drdoSetting: null,
  drdoLoading: false,
  drdoError: null,
  drdoUpdateLoading: false,
  drdoUpdateError: null,
  drdoUpdatedSetting: null,

  // Certificate validity
  certificateValiditySetting: null,
  certificateValidityLoading: false,
  certificateValidityError: null,
  certificateValidityUpdateLoading: false,
  certificateValidityUpdateError: null,
  certificateValidityUpdatedSetting: null,

  // Recertification window
  recertWindowSetting: null,
  recertWindowLoading: false,
  recertWindowError: null,
  recertWindowUpdateLoading: false,
  recertWindowUpdateError: null,
  recertWindowUpdatedSetting: null,

  // Application submission
  applicationSubmissionSetting: null,
  applicationSubmissionLoading: false,
  applicationSubmissionError: null,
  applicationSubmissionUpdateLoading: false,
  applicationSubmissionUpdateError: null,
  applicationSubmissionUpdatedSetting: null,

  // Maintenance mode
  maintenanceSetting: null,
  maintenanceLoading: false,
  maintenanceError: null,
  maintenanceUpdateLoading: false,
  maintenanceUpdateError: null,
  maintenanceUpdatedSetting: null,
};

const systemSettingsSlice = createSlice({
  name: 'systemSettings',
  initialState,
  reducers: {},
  extraReducers: builder => {
    // DRDO
    builder
      .addCase(getDrdoApprovalSettingByKeyAction.pending, state => {
        state.drdoLoading = true;
        state.drdoError = null;
      })
      .addCase(getDrdoApprovalSettingByKeyAction.fulfilled, (state, action) => {
        state.drdoLoading = false;
        state.drdoSetting = action.payload || null;
        Logger.info('DRDO setting loaded successfully in slice');
      })
      .addCase(getDrdoApprovalSettingByKeyAction.rejected, (state, action) => {
        state.drdoLoading = false;
        state.drdoError = action.payload;
        Logger.error('Get DRDO setting failed in slice:', action.payload);
      });

    builder
      .addCase(updateDrdoApprovalSettingAction.pending, state => {
        state.drdoUpdateLoading = true;
        state.drdoUpdateError = null;
      })
      .addCase(updateDrdoApprovalSettingAction.fulfilled, (state, action) => {
        state.drdoUpdateLoading = false;
        state.drdoUpdatedSetting = action.payload || null;
        Logger.info('DRDO setting updated successfully in slice');
      })
      .addCase(updateDrdoApprovalSettingAction.rejected, (state, action) => {
        state.drdoUpdateLoading = false;
        state.drdoUpdateError = action.payload;
        Logger.error('Update DRDO setting failed in slice:', action.payload);
      });

    // Certificate validity
    builder
      .addCase(getCertificateValiditySettingByKeyAction.pending, state => {
        state.certificateValidityLoading = true;
        state.certificateValidityError = null;
      })
      .addCase(getCertificateValiditySettingByKeyAction.fulfilled, (state, action) => {
        state.certificateValidityLoading = false;
        state.certificateValiditySetting = action.payload || null;
        Logger.info('Certificate validity setting loaded successfully in slice');
      })
      .addCase(getCertificateValiditySettingByKeyAction.rejected, (state, action) => {
        state.certificateValidityLoading = false;
        state.certificateValidityError = action.payload;
        Logger.error('Get certificate validity setting failed in slice:', action.payload);
      });

    builder
      .addCase(updateCertificateValiditySettingAction.pending, state => {
        state.certificateValidityUpdateLoading = true;
        state.certificateValidityUpdateError = null;
      })
      .addCase(updateCertificateValiditySettingAction.fulfilled, (state, action) => {
        state.certificateValidityUpdateLoading = false;
        state.certificateValidityUpdatedSetting = action.payload || null;
        Logger.info('Certificate validity setting updated successfully in slice');
      })
      .addCase(updateCertificateValiditySettingAction.rejected, (state, action) => {
        state.certificateValidityUpdateLoading = false;
        state.certificateValidityUpdateError = action.payload;
        Logger.error('Update certificate validity setting failed in slice:', action.payload);
      });

    // Recert window
    builder
      .addCase(getRecertificationWindowSettingByKeyAction.pending, state => {
        state.recertWindowLoading = true;
        state.recertWindowError = null;
      })
      .addCase(getRecertificationWindowSettingByKeyAction.fulfilled, (state, action) => {
        state.recertWindowLoading = false;
        state.recertWindowSetting = action.payload || null;
        Logger.info('Recert window setting loaded successfully in slice');
      })
      .addCase(getRecertificationWindowSettingByKeyAction.rejected, (state, action) => {
        state.recertWindowLoading = false;
        state.recertWindowError = action.payload;
        Logger.error('Get recert window setting failed in slice:', action.payload);
      });

    builder
      .addCase(updateRecertificationWindowSettingAction.pending, state => {
        state.recertWindowUpdateLoading = true;
        state.recertWindowUpdateError = null;
      })
      .addCase(updateRecertificationWindowSettingAction.fulfilled, (state, action) => {
        state.recertWindowUpdateLoading = false;
        state.recertWindowUpdatedSetting = action.payload || null;
        Logger.info('Recert window setting updated successfully in slice');
      })
      .addCase(updateRecertificationWindowSettingAction.rejected, (state, action) => {
        state.recertWindowUpdateLoading = false;
        state.recertWindowUpdateError = action.payload;
        Logger.error('Update recert window setting failed in slice:', action.payload);
      });

    // Application submission
    builder
      .addCase(getApplicationSubmissionSettingByKeyAction.pending, state => {
        state.applicationSubmissionLoading = true;
        state.applicationSubmissionError = null;
      })
      .addCase(getApplicationSubmissionSettingByKeyAction.fulfilled, (state, action) => {
        state.applicationSubmissionLoading = false;
        state.applicationSubmissionSetting = action.payload || null;
        Logger.info('Application submission setting loaded successfully in slice');
      })
      .addCase(getApplicationSubmissionSettingByKeyAction.rejected, (state, action) => {
        state.applicationSubmissionLoading = false;
        state.applicationSubmissionError = action.payload;
        Logger.error('Get application submission setting failed in slice:', action.payload);
      });

    builder
      .addCase(updateApplicationSubmissionSettingAction.pending, state => {
        state.applicationSubmissionUpdateLoading = true;
        state.applicationSubmissionUpdateError = null;
      })
      .addCase(updateApplicationSubmissionSettingAction.fulfilled, (state, action) => {
        state.applicationSubmissionUpdateLoading = false;
        state.applicationSubmissionUpdatedSetting = action.payload || null;
        Logger.info('Application submission setting updated successfully in slice');
      })
      .addCase(updateApplicationSubmissionSettingAction.rejected, (state, action) => {
        state.applicationSubmissionUpdateLoading = false;
        state.applicationSubmissionUpdateError = action.payload;
        Logger.error('Update application submission setting failed in slice:', action.payload);
      });

    // Maintenance
    builder
      .addCase(getMaintenanceModeSettingByKeyAction.pending, state => {
        state.maintenanceLoading = true;
        state.maintenanceError = null;
      })
      .addCase(getMaintenanceModeSettingByKeyAction.fulfilled, (state, action) => {
        state.maintenanceLoading = false;
        state.maintenanceSetting = action.payload || null;
        Logger.info('Maintenance setting loaded successfully in slice');
      })
      .addCase(getMaintenanceModeSettingByKeyAction.rejected, (state, action) => {
        state.maintenanceLoading = false;
        state.maintenanceError = action.payload;
        Logger.error('Get maintenance setting failed in slice:', action.payload);
      });

    builder
      .addCase(updateMaintenanceModeSettingAction.pending, state => {
        state.maintenanceUpdateLoading = true;
        state.maintenanceUpdateError = null;
      })
      .addCase(updateMaintenanceModeSettingAction.fulfilled, (state, action) => {
        state.maintenanceUpdateLoading = false;
        state.maintenanceUpdatedSetting = action.payload || null;
        Logger.info('Maintenance setting updated successfully in slice');
      })
      .addCase(updateMaintenanceModeSettingAction.rejected, (state, action) => {
        state.maintenanceUpdateLoading = false;
        state.maintenanceUpdateError = action.payload;
        Logger.error('Update maintenance setting failed in slice:', action.payload);
      });
  },
});
export default systemSettingsSlice.reducer;
