import { createAsyncThunk } from '@reduxjs/toolkit';
import UnitAdminSupportServices from '../../../services/api/unitAdmin/SupportService';
import { Logger } from '../../../utils/logger';

const unitAdminSupportServices = UnitAdminSupportServices();
// List support tickets (with pagination / filters)
export const listSupportTicketsAction = createAsyncThunk('unitAdmin/support/listSupportTickets', async (params, { rejectWithValue }) => {
  try {
    const data = await unitAdminSupportServices.listSupportTickets(params);
    Logger.info('List support tickets successful:', data);
    return data;
  } catch (error) {
    Logger.error('List support tickets failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get single support ticket details
export const getSupportTicketAction = createAsyncThunk('unitAdmin/support/getSupportTicket', async (id, { rejectWithValue }) => {
  try {
    const data = await unitAdminSupportServices.getSupportTicket(id);
    Logger.info('Get support ticket successful:', data);
    return data;
  } catch (error) {
    Logger.error('Get support ticket failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Create support ticket (formData expected)
export const createSupportTicketAction = createAsyncThunk('unitAdmin/support/createSupportTicket', async (formData, { rejectWithValue }) => {
  try {
    const data = await unitAdminSupportServices.createSupportTicket(formData);
    Logger.info('Create support ticket successful:', data);
    return data;
  } catch (error) {
    Logger.error('Create support ticket failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Update support ticket
export const updateSupportTicketAction = createAsyncThunk('unitAdmin/support/updateSupportTicket', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const data = await unitAdminSupportServices.updateSupportTicket(id, payload);
    Logger.info('Update support ticket successful:', data);
    return data;
  } catch (error) {
    Logger.error('Update support ticket failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
