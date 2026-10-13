import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.CommitteeMember;

export const getCommitteeMembersAction = createAsyncThunk('CommitteeMember/getAll', async ({ params } = {}, { rejectWithValue }) => {
  try {
    const response = await service.getMembers(params);
    Logger.info('Get committee members successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get committee members failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const getCommitteeMemberAction = createAsyncThunk('CommitteeMember/getOne', async ({ memberId }, { rejectWithValue }) => {
  try {
    const response = await service.getMember(memberId);
    Logger.info('Get committee member successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get committee member failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const createCommitteeMemberAction = createAsyncThunk('CommitteeMember/create', async ({ payload }, { rejectWithValue }) => {
  try {
    const response = await service.createMember(payload);
    Logger.info('Create committee member successful:', response);
    return response;
  } catch (error) {
    Logger.error('Create committee member failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const updateCommitteeMemberAction = createAsyncThunk('CommitteeMember/update', async ({ memberId, payload }, { rejectWithValue }) => {
  try {
    const response = await service.updateMember(memberId, payload);
    Logger.info('Update committee member successful:', response);
    return response;
  } catch (error) {
    Logger.error('Update committee member failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const deleteCommitteeMemberAction = createAsyncThunk('CommitteeMember/delete', async ({ memberId }, { rejectWithValue }) => {
  try {
    const response = await service.deleteMember(memberId);
    Logger.info('Delete committee member successful:', response);
    return { memberId, ...response };
  } catch (error) {
    Logger.error('Delete committee member failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
