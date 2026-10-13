import { Logger } from '../../utils/logger';
import PublicClient from './clients/publicClient';
import userClient from './clients/userClient';

const AccountService = publicClient => {
  const loginUser = async loginData => {
    try {
      const response = await PublicClient.post('auth/login', loginData);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.loginUser', error.message);
      throw error;
    }
  };

  const checkActiveSession = async data => {
    try {
      const response = await PublicClient.post('auth/check-active-session', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.checkActiveSession', error.message);
      throw error;
    }
  };

  const verifyLoginOtp = async data => {
    try {
      const response = await PublicClient.post('auth/verify-login-otp', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.verifyLoginOtp', error.message);
      throw error;
    }
  };

  const resendLoginOtp = async data => {
    try {
      const response = await PublicClient.post('auth/resend-login-otp', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.resendLoginOtp', error.message);
      throw error;
    }
  };

  const refreshToken = async refreshData => {
    try {
      const response = await publicClient.post('auth/refresh', refreshData);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.refreshToken: ', error);
      throw error;
    }
  };

  const changePassword = async data => {
    try {
      const response = await userClient.post('auth/change-password', data);
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.changePassword: ', error);
      throw error;
    }
  };

  const getuserDetails = async () => {
    try {
      const response = await userClient.get(`auth/me`);
      return response.data.data;
    } catch (error) {
      Logger.error('Error in AccountService.getuserDetails: ', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const response = await userClient.post('auth/logout');
      return response.data;
    } catch (error) {
      Logger.error('Error in AccountService.logout: ', error);
      throw error;
    }
  };

  return {
    loginUser,
    checkActiveSession,
    verifyLoginOtp,
    resendLoginOtp,
    changePassword,
    getuserDetails,
    refreshToken,
    logout,
  };
};

export default AccountService;
