import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.CommitteeMeeting;

export const getCommitteeMeetingsAction = createAsyncThunk('CommitteeMeeting/get', async ({ params } = {}, { rejectWithValue }) => {
  try {
    const response = service.getMeetings ? await service.getMeetings(params) : await service.getAll(params);
    Logger.info('Get committee meetings successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get committee meetings failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const addCommitteeMeetingAction = createAsyncThunk('CommitteeMeeting/add', async ({ payload }, { rejectWithValue }) => {
  try {
    const response = await service.createMeeting(payload);
    Logger.info('Add committee meeting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Add committee meeting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateCommitteeMeetingAction = createAsyncThunk('CommitteeMeeting/update', async ({ meetingId, payload }, { rejectWithValue }) => {
  try {
    const response = await service.updateMeeting(meetingId, payload);
    Logger.info('Update committee meeting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update committee meeting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const cancelCommitteeMeetingAction = createAsyncThunk('CommitteeMeeting/cancel', async ({ meetingId, reason }, { rejectWithValue }) => {
  try {
    const response = await service.cancelMeeting(meetingId, { reason });
    Logger.info('Cancel committee meeting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Cancel committee meeting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getCommitteeMeetingByIdAction = createAsyncThunk('CommitteeMeeting/getById', async ({ meetingId }, { rejectWithValue }) => {
  try {
    const response = await service.getMeeting(meetingId);
    Logger.info('Get committee meeting by ID successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get committee meeting by ID failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const startCommitteeMeetingAction = createAsyncThunk('CommitteeMeeting/start', async ({ meetingId }, { rejectWithValue }) => {
  try {
    const response = await service.startMeeting(meetingId);
    Logger.info('Start committee meeting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Start committee meeting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const completeCommitteeMeetingAction = createAsyncThunk('CommitteeMeeting/complete', async ({ meetingId, payload }, { rejectWithValue }) => {
  try {
    const response = await service.completeMeeting(meetingId, payload);
    Logger.info('Complete committee meeting successful:', response);
    return response;
  } catch (error) {
    Logger.error('Complete committee meeting failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
