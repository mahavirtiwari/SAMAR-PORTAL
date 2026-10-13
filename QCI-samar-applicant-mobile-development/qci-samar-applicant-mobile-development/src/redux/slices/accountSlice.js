import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../utils/logger';
import {
  changePasswordAction,
  checkLoginStatus,
  getUserDetails,
  loginUserAction,
  logoutAction,
  refreshToken,
  resendLoginOtpAction,
  verifyLoginOtpAction,
} from '../action/accountAction';

const initialState = {
  isLoggedIn: false,
  token: null,
  loginUser: null,
  loginUserLoading: false,
  loginUserError: null,

  // Login 2FA OTP challenge
  requiresOtp: false,
  sessionToken: null,
  otpVerifyLoading: false,
  otpVerifyError: null,
  otpResendLoading: false,

  changePassword: null,
  changePasswordLoading: false,
  changePasswordError: null,

  userData: null,
  userDataLoading: false,
  userDataError: null,

  refreshToken: null,
  refreshTokenLoading: false,
  refreshTokenError: null,

  // Maintenance mode state
  isUnderMaintenance: false,
  maintenanceMessage: null,
};

const AccountSlice = createSlice({
  name: 'account',
  initialState,
  reducers: {
    resetLoginError(state) {
      state.loginUserError = null;
    },

    resetChangePasswordState(state) {
      state.changePassword = null;
      state.changePasswordError = null;
    },

    resetLoginData(state) {
      state.loginUser = null;
    },

    resetOtpState(state) {
      state.requiresOtp = false;
      state.sessionToken = null;
      state.otpVerifyError = null;
      state.otpVerifyLoading = false;
      state.otpResendLoading = false;
    },

    setMaintenanceMode(state, action) {
      state.isUnderMaintenance = action.payload.isUnderMaintenance;
      state.maintenanceMessage =
        action.payload.message || 'System is currently under maintenance. Please try again later.';
    },

    clearMaintenanceMode(state) {
      state.isUnderMaintenance = false;
      state.maintenanceMessage = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loginUserAction.pending, state => {
        state.loginUserLoading = true;
        state.loginUserError = null;
      })
      .addCase(loginUserAction.fulfilled, (state, action) => {
        state.loginUserLoading = false;
        if (action.payload?.data?.requiresOtp) {
          // Hold login open until the OTP is verified.
          state.requiresOtp = true;
          state.sessionToken = action.payload.data.sessionToken;
          state.otpVerifyError = null;
          return;
        }
        state.loginUser = action.payload;
        state.token = action.payload?.data?.accessToken || null;
        state.isLoggedIn = true;
      })
      .addCase(loginUserAction.rejected, (state, action) => {
        state.loginUserLoading = false;
        state.loginUserError = action.payload;
      });

    builder
      .addCase(verifyLoginOtpAction.pending, state => {
        state.otpVerifyLoading = true;
        state.otpVerifyError = null;
      })
      .addCase(verifyLoginOtpAction.fulfilled, (state, action) => {
        state.otpVerifyLoading = false;
        state.loginUser = action.payload;
        state.token = action.payload?.data?.accessToken || null;
        state.isLoggedIn = true;
        state.requiresOtp = false;
        state.sessionToken = null;
      })
      .addCase(verifyLoginOtpAction.rejected, (state, action) => {
        state.otpVerifyLoading = false;
        state.otpVerifyError = action.payload || action.error.message;
      });

    builder
      .addCase(resendLoginOtpAction.pending, state => {
        state.otpResendLoading = true;
        state.otpVerifyError = null;
      })
      .addCase(resendLoginOtpAction.fulfilled, state => {
        state.otpResendLoading = false;
      })
      .addCase(resendLoginOtpAction.rejected, (state, action) => {
        state.otpResendLoading = false;
        state.otpVerifyError = action.payload || action.error.message;
      });

    builder
      .addCase(refreshToken.pending, state => {
        state.refreshTokenLoading = true;
        state.refreshTokenError = null;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.refreshTokenLoading = false;
        state.refreshToken = action.payload;
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.refreshTokenLoading = false;
        state.refreshTokenError = action.payload || action.error.message;
      });

    builder
      .addCase(changePasswordAction.pending, state => {
        state.changePasswordLoading = true;
        state.changePasswordError = null;
      })
      .addCase(changePasswordAction.fulfilled, (state, action) => {
        state.changePasswordLoading = false;
        state.changePassword = action.payload;
      })
      .addCase(changePasswordAction.rejected, (state, action) => {
        state.changePasswordLoading = false;
        state.changePasswordError = action.payload || action.error.message;
      });

    builder
      .addCase(getUserDetails.pending, state => {
        state.userDataLoading = true;
        state.userDataError = null;
      })
      .addCase(getUserDetails.fulfilled, (state, action) => {
        state.userDataLoading = false;
        state.userData = action.payload;
      })
      .addCase(getUserDetails.rejected, (state, action) => {
        state.userDataLoading = false;
        state.userDataError = action.payload || action.error.message;
      });

    builder
      .addCase(logoutAction.pending, state => {
        state.isLoggedIn = false;
        state.loginUser = null;
        state.token = null;
      })
      .addCase(logoutAction.fulfilled, state => {
        state.isLoggedIn = false;
        state.loginUser = null;
        state.token = null;
        state.userData = null;
        Logger.info('Logout successful');
      })
      .addCase(logoutAction.rejected, (state, action) => {
        Logger.error('Logout failed:', action.error?.message);
        state.isLoggedIn = false;
        state.loginUser = null;
        state.token = null;
        state.userData = null;
      });

    builder
      .addCase(checkLoginStatus.pending, state => {
        state.status = 'loading';
      })
      .addCase(checkLoginStatus.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isLoggedIn = action.payload;
      })
      .addCase(checkLoginStatus.rejected, (state, action) => {
        state.status = 'failed';
        state.isLoggedIn = false;
        Logger.error('Check login status failed:', action.error);
        state.error = action.error.message;
      });
  },
});

export const {
  resetLoginError,
  resetChangePasswordState,
  resetLoginData,
  resetOtpState,
  setMaintenanceMode,
  clearMaintenanceMode,
} = AccountSlice.actions;
export default AccountSlice.reducer;
