import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../utils/logger';
import {
  changePasswordAction,
  checkLoginStatus,
  forgotPasswordStartAction,
  loginUserAction,
  loginVerifyOTPUserAction,
  logoutUserAction,
  refreshTokenAction,
  registerAction,
  resetPasswordAction,
  verifyOtpAction,
} from '../../action/common/AccountAction';

const initialState = {
  loginLoading: false,
  logoutLoading: false,
  loginError: null,
  loginData: null,
  user: null,
  accessToken: null,
  isUserLoggedIn: false,
  loginVerifyLoading: false,
  loginVerifyError: null,
  loginVerifyData: null,
  registerLoading: false,
  registerError: null,
  registerStatus: null,

  refreshTokenLoading: false,
  refreshTokenError: null,
  refreshToken: null,

  loading: false,
  error: null,
  otpStatus: null,
  passwordResetStatus: null,

  forgotPasswordData: null,
  forgotPasswordLoading: false,
  forgotPasswordError: null,

  resetPasswordData: null,
  resetPasswordLoading: false,
  resetPasswordError: null,

  changePasswordError: null,
  changePasswordLoading: false,
  changePasswordData: null,

  verifyOtpData: null,
  verifyOtpLoading: false,
  verifyOtpError: null,
};

const accountSlice = createSlice({
  name: 'commonAuth',
  initialState,
  reducers: {
    resetForgotPasswordData(state) {
      state.error = null;
      state.resetPasswordData = null;
      state.forgotPasswordData = null;
      state.resetPasswordError = null;
      state.forgotPasswordError = null;
    },
    resetRegisterData(state) {
      state.registerError = null;
      state.registerStatus = null;
    },
    resetLoginState(state) {
      state.loginError = null;
    },
    resetLoginVerifyData(state) {
      state.loginVerifyError = null;
      state.loginVerifyData = null;
    },
    resetChangePasswordData(state) {
      state.changePasswordError = null;
      state.changePasswordData = null;
    },
  },
  extraReducers: builder => {
    // Login
    builder
      .addCase(loginUserAction.pending, state => {
        state.loginLoading = true;
        state.loginError = null;
      })
      .addCase(loginUserAction.fulfilled, (state, action) => {
        state.loginLoading = false;
        state.loginData = action.payload;
        state.user = action.payload?.requiresOtp ? null : action.payload?.user;

        state.isUserLoggedIn = action.payload?.requiresOtp ? false : true;
      })
      .addCase(loginUserAction.rejected, (state, action) => {
        state.loginLoading = false;
        state.loginError = action.payload;
      });

    builder
      .addCase(loginVerifyOTPUserAction.pending, state => {
        state.loginVerifyLoading = true;
        state.loginVerifyError = null;
      })
      .addCase(loginVerifyOTPUserAction.fulfilled, (state, action) => {
        Logger.info('Login verify user success:', action.payload);
        state.loginVerifyData = action.payload;

        state.loginVerifyLoading = false;
        state.user = action.payload?.user;
        state.isUserLoggedIn = true;
      })
      .addCase(loginVerifyOTPUserAction.rejected, (state, action) => {
        Logger.error('Login verify user failed:', action.payload);
        state.loginVerifyLoading = false;
        state.loginVerifyError = action.payload;
      });

    // Register
    builder
      .addCase(registerAction.pending, state => {
        state.registerLoading = true;
        state.registerError = null;
      })
      .addCase(registerAction.fulfilled, (state, action) => {
        state.registerLoading = false;
        state.registerStatus = action.payload;
        state.otpStatus = 'registered';
      })
      .addCase(registerAction.rejected, (state, action) => {
        state.registerLoading = false;
        state.registerError = action.payload;
      });
    // Register otp
    builder
      .addCase(verifyOtpAction.pending, state => {
        state.verifyOtpLoading = true;
        state.verifyOtpError = null;
      })
      .addCase(verifyOtpAction.fulfilled, (state, action) => {
        state.verifyOtpLoading = false;
        state.verifyOtpData = action.payload;
        state.otpStatus = 'registered';
      })
      .addCase(verifyOtpAction.rejected, (state, action) => {
        state.verifyOtpLoading = false;
        state.verifyOtpError = action.payload;
      });

    // Refresh Token
    builder
      .addCase(refreshTokenAction.pending, state => {
        state.refreshTokenLoading = true;
        state.refreshTokenError = null;
      })
      .addCase(refreshTokenAction.fulfilled, (state, action) => {
        state.refreshTokenLoading = false;
        state.refreshToken = action.payload;
        state.accessToken = action.payload?.token;
      })
      .addCase(refreshTokenAction.rejected, (state, action) => {
        state.refreshTokenLoading = false;
        state.refreshTokenError = action.payload;
      });

    builder
      .addCase(checkLoginStatus.pending, state => {
        state.status = 'loading';
      })
      .addCase(checkLoginStatus.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isUserLoggedIn = action.payload?.isLoggedIn || false;
        state.user = action.payload?.user || null;
      })
      .addCase(checkLoginStatus.rejected, (state, action) => {
        state.status = 'failed';
        state.isUserLoggedIn = false;
        state.user = null;
        Logger.error('Check login status failed:', action.error);
        state.error = action.error.message;
      });

    builder
      .addCase(forgotPasswordStartAction.pending, state => {
        state.forgotPasswordLoading = true;
        state.forgotPasswordError = null;
      })
      .addCase(forgotPasswordStartAction.fulfilled, (state, action) => {
        Logger.info('Forgot password success:', action.payload);
        state.forgotPasswordLoading = false;
        state.forgotPasswordData = action.payload;
      })
      .addCase(forgotPasswordStartAction.rejected, (state, action) => {
        Logger.error('Forgot password failed:', action.payload);
        state.forgotPasswordLoading = false;
        state.forgotPasswordError = action.payload;
      });

    // Reset Password
    builder
      .addCase(resetPasswordAction.pending, state => {
        state.resetPasswordLoading = true;
        state.resetPasswordError = null;
      })
      .addCase(resetPasswordAction.fulfilled, (state, action) => {
        Logger.info('Reset password success:', action.payload);
        state.resetPasswordLoading = false;
        state.resetPasswordData = action.payload;
      })
      .addCase(resetPasswordAction.rejected, (state, action) => {
        Logger.error('Reset password failed:', action.payload);
        state.resetPasswordLoading = false;
        state.resetPasswordError = action.payload;
      });
    builder
      .addCase(changePasswordAction.pending, state => {
        state.changePasswordLoading = true;
        state.changePasswordError = null;
        state.changePasswordData = null;
      })
      .addCase(changePasswordAction.fulfilled, (state, action) => {
        state.changePasswordLoading = false;
        state.changePasswordData = action.payload;
      })
      .addCase(changePasswordAction.rejected, (state, action) => {
        state.changePasswordLoading = false;
        state.changePasswordError = action.payload;
      });
    // Logout
    builder.addCase(logoutUserAction.pending, state => {
      Logger.info('Logout pending');
      state.user = null;
      state.logoutLoading = true;
      state.isUserLoggedIn = false;
    });
    builder.addCase(logoutUserAction.fulfilled, state => {
      Logger.info('Logout fulfilled');
      state.user = null;
      state.logoutLoading = false;

      state.accessToken = null;
      state.isUserLoggedIn = false;
      state.loginData = null;
      state.loginVerifyData = null;
    });
    builder.addCase(logoutUserAction.rejected, (state, action) => {
      Logger.error('Logout failed:', action.error?.message);
      state.logoutLoading = false;
      state.user = null;
      state.accessToken = null;
      state.isUserLoggedIn = false;
      state.loginData = null;
      state.loginVerifyData = null;
    });
  },
});

export const { resetForgotPasswordData, resetRegisterData, resetLoginState, resetLoginVerifyData, resetChangePasswordData } = accountSlice.actions;
export default accountSlice.reducer;
