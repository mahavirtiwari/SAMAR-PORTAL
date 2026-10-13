import { Logger } from '../../../utils/logger';
import PublicClient from '../clients/publicClient';
import userClient from '../clients/userClient';

const AccountService = () => {
  const getCaptcha = async () => {
    try {
      const response = await PublicClient.get('/auth/captcha');
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.getCaptcha', error.message);
      throw error;
    }
  };

  const getloginUser = async loginData => {
    try {
      const response = await PublicClient.post('/auth/login', loginData);
      Logger.info('Response in AccountService.getloginUser:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.loginUser', error.message);
      throw error;
    }
  };

  const checkActiveSession = async data => {
    try {
      const response = await PublicClient.post('/auth/check-active-session', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.checkActiveSession', error.message);
      throw error;
    }
  };

  const getLoginVerifyUser = async loginVerifyData => {
    try {
      const response = await PublicClient.post('/auth/verify-login-otp', loginVerifyData);
      Logger.info('Response in AccountService.getLoginVerifyUser:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.getLoginVerifyUser', error.message);
      throw error;
    }
  };
  const logoutUser = async () => {
    try {
      const response = await userClient.post('/auth/logout');
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.logoutUser', error.message);
      throw error;
    }
  };

  const refreshToken = async data => {
    try {
      const response = await PublicClient.post('/auth/refresh', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.refreshToken', error.message);
      throw error;
    }
  };

  const getAuthenticatedUser = async () => {
    try {
      const response = await userClient.get('/auth/me');
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.getAuthenticatedUser', error.message);
      throw error;
    }
  };

  const changePassword = async data => {
    try {
      const response = await userClient.post('/auth/change-password', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.changePassword', error.message);
      throw error;
    }
  };

  const forgotPasswordStart = async data => {
    try {
      const response = await PublicClient.post('/auth/forgot-password', data);
      return response;
    } catch (error) {
      Logger.error('Error in AccountService.forgotPasswordStart', error.message);
      throw error;
    }
  };

  const resendPasswordOtp = async data => {
    try {
      const response = await PublicClient.post('/auth/resend-password-otp', data);
      return response;
    } catch (error) {
      Logger.error('Error in AccountService.resendPasswordOtp', error.message);
      throw error;
    }
  };

  const resetPassword = async data => {
    try {
      const response = await PublicClient.post('/auth/reset-password', data);
      return response;
    } catch (error) {
      Logger.error('Error in AccountService.resetPassword', error.message);
      throw error;
    }
  };

  const register = async data => {
    try {
      const response = await PublicClient.post('/auth/register', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.register', error.message);
      throw error;
    }
  };

  const verifyOtp = async data => {
    try {
      const response = await PublicClient.post('/auth/verify-otp', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.verifyOtp', error.message);
      throw error;
    }
  };

  const resendOtp = async data => {
    try {
      const response = await PublicClient.post('/auth/resend-otp', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.resendOtp', error.message);
      throw error;
    }
  };

  const resendLoginOtp = async data => {
    try {
      const response = await PublicClient.post('/auth/resend-login-otp', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.resendLoginOtp', error.message);
      throw error;
    }
  };

  const getTwoFactorStatus = async () => {
    try {
      const response = await userClient.get('/auth/2fa-status');
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.getTwoFactorStatus', error.message);
      throw error;
    }
  };

  const enableTwoFactor = async () => {
    try {
      const response = await userClient.post('/auth/2fa/enable');
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.enableTwoFactor', error.message);
      throw error;
    }
  };

  const disableTwoFactor = async data => {
    try {
      const response = await userClient.post('/auth/2fa/disable', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.disableTwoFactor', error.message);
      throw error;
    }
  };

  return {
    getCaptcha,
    getloginUser,
    checkActiveSession,
    getLoginVerifyUser,
    logoutUser,
    refreshToken,
    getAuthenticatedUser,
    changePassword,
    forgotPasswordStart,
    resendPasswordOtp,
    resetPassword,
    register,
    verifyOtp,
    resendOtp,
    resendLoginOtp,
    getTwoFactorStatus,
    enableTwoFactor,
    disableTwoFactor,
  };
};

export default AccountService;
