import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.UnitAdmin;
// Get all users
export const getAllUsersAction = createAsyncThunk('users', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Get all users attempt with data:', data);
    const response = await service.getAllUsers(data);
    Logger.info('Get all users successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get all users failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
export const updateUserAction = createAsyncThunk('users/updateUser', async (payload, { rejectWithValue }) => {
  try {
    const service = Api.UnitAdmin;
    const response = await service.updateUser(payload);
    Logger.info('Update user successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update user failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
// create new user
export const createUserAction = createAsyncThunk('createUser', async (userData, { rejectWithValue }) => {
  try {
    Logger.info('Create user attempt:', { userData });
    const response = await service.createUser(userData);
    Logger.info('Create user successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create user failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// get user details
export const getUserDetailsAction = createAsyncThunk('getUserDetails', async (userId, { rejectWithValue }) => {
  try {
    Logger.info('Get user details attempt:', { userId });
    const response = await service.getUserDetails(userId);
    Logger.info('Get user details successful:', response);
    return response.data;
  } catch (error) {
    Logger.error('Get user details failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// get logged-in user details (separate action for Header profile display)
export const getLoggedInUserDetailsAction = createAsyncThunk('getLoggedInUserDetails', async (userId, { rejectWithValue }) => {
  try {
    Logger.info('Get logged-in user details attempt:', { userId });
    const response = await service.getUserDetails(userId);
    Logger.info('Get logged-in user details successful:', response);
    return response.data;
  } catch (error) {
    Logger.error('Get logged-in user details failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// activate user account
export const activateUserAccountAction = createAsyncThunk('activateUserAccount', async (userId, { rejectWithValue }) => {
  try {
    Logger.info('Activate user account attempt:', { userId });
    const response = await service.activateUserAccount(userId);
    Logger.info('Activate user account successful:', response);
    return response;
  } catch (error) {
    Logger.error('Activate user account failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// deactivate user account
export const deactivateUserAccountAction = createAsyncThunk('deactivateUserAccount', async (userId, { rejectWithValue }) => {
  try {
    Logger.info('Deactivate user account attempt:', { userId });
    const response = await service.deactivateUserAccount(userId);
    Logger.info('Deactivate user account successful:', response);
    return response;
  } catch (error) {
    Logger.error('Deactivate user account failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// update user domains (POST)
export const updateUserDomainsAction = createAsyncThunk('updateUserDomains', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Update user domains attempt:', { userId: data.userId, domains: data.domains });
    const response = await service.updateUserDomains(data);
    Logger.info('Update user domains successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update user domains failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// put user domains (PUT)
export const createUserDomainsAction = createAsyncThunk('putUserDomains', async (data, { rejectWithValue }) => {
  try {
    const response = await service.createUserDomains(data);
    Logger.info('Put user domains successful:', response);
    return response;
  } catch (error) {
    Logger.error('Put user domains failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// create user assessor districts
export const createUserAssessorDistrictsAction = createAsyncThunk('createUserAssessorDistricts', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Create user assessor districts attempt:', { userId: data.userId, districts: data.districts });
    const response = await service.createUserAssessorDistricts(data);
    Logger.info('Create user assessor districts successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create user assessor districts failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// update user assessor districts
export const updateUserAssessorDistrictsAction = createAsyncThunk('updateUserAssessorDistricts', async (data, { rejectWithValue }) => {
  try {
    Logger.info('Update user assessor districts attempt:', { userId: data.userId, districts: data.districts });
    const response = await service.updateUserAssessorDistricts(data);
    Logger.info('Update user assessor districts successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update user assessor districts failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
