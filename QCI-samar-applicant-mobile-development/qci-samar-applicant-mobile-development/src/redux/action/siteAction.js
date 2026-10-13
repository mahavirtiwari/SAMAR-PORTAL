import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../services/api';
import { Logger } from '../../utils/logger';

const getSitePictures = createAsyncThunk(
  'Site/GetSitePictures',
  async (assessmentId, { rejectWithValue }) => {
    try {
      const response = await Api.SiteApi.getSitePictures(assessmentId);
      Logger.info('Site pictures retrieved successfully');
      return response;
    } catch (error) {
      Logger.error('Get site pictures failed:', error?.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to get site pictures');
    }
  },
);

const getSiteTourPictures = createAsyncThunk(
  'Site/GetSiteTourPictures',
  async (assessmentId, { rejectWithValue }) => {
    try {
      const response = await Api.SiteApi.getSiteTourPictures(assessmentId);
      Logger.info('Site tour pictures retrieved successfully');
      return response;
    } catch (error) {
      Logger.error('Get site tour pictures failed:', error?.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to get site tour pictures');
    }
  },
);

const addSitePicture = createAsyncThunk(
  'Site/AddSitePicture',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await Api.SiteApi.addSitePicture(payload);
      Logger.info('Site picture uploaded successfully');
      return response;
    } catch (error) {
      Logger.error('Add site picture failed:', error?.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to upload site picture');
    }
  },
);

const deleteSitePicture = createAsyncThunk(
  'Site/DeleteSitePicture',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await Api.SiteApi.deleteSitePicture(payload);
      Logger.info('Site picture deleted successfully');
      return response;
    } catch (error) {
      Logger.error('Delete site picture failed:', error?.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to delete site picture');
    }
  },
);

const addSiteTourPicture = createAsyncThunk(
  'Site/AddSiteTourPicture',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await Api.SiteApi.addSiteTourPicture(payload);
      Logger.info('Site tour picture uploaded successfully');
      return response;
    } catch (error) {
      Logger.error('Add site tour picture failed:', error?.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to upload site tour picture');
    }
  },
);

const deleteSiteTourPicture = createAsyncThunk(
  'Site/DeleteSiteTourPicture',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await Api.SiteApi.deleteSiteTourPicture(payload);
      Logger.info('Site tour picture deleted successfully');
      return response;
    } catch (error) {
      Logger.error('Delete site tour picture failed:', error?.message);
      return rejectWithValue(error.response?.data?.message || 'Failed to delete site tour picture');
    }
  },
);

export {
  addSitePicture,
  addSiteTourPicture,
  deleteSitePicture,
  deleteSiteTourPicture,
  getSitePictures,
  getSiteTourPictures,
};
