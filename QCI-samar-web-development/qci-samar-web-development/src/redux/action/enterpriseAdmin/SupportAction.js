import { createAsyncThunk } from '@reduxjs/toolkit';
import SupportServices from '../../../services/api/enterpriseAdmin/SupportService';
import { Logger } from '../../../utils/logger';

const supportServicesInstance = SupportServices();
// List support tickets (with pagination / filters)
export const listSupportTicketsAction = createAsyncThunk('support/listSupportTickets', async (params, { rejectWithValue }) => {
  try {
    const data = await supportServicesInstance.listSupportTickets(params);
    Logger.info('List support tickets successful:', data);
    return data;
  } catch (error) {
    Logger.error('List support tickets failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Get single support ticket details
export const getSupportTicketAction = createAsyncThunk('support/getSupportTicket', async (id, { rejectWithValue }) => {
  try {
    const data = await supportServicesInstance.getSupportTicket(id);
    Logger.info('Get support ticket successful:', data);
    return data;
  } catch (error) {
    Logger.error('Get support ticket failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Create support ticket (formData expected)
export const createSupportTicketAction = createAsyncThunk('support/createSupportTicket', async (formData, { rejectWithValue }) => {
  try {
    const data = await supportServicesInstance.createSupportTicket(formData);
    Logger.info('Create support ticket successful:', data);
    return data;
  } catch (error) {
    Logger.error('Create support ticket failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

// Update support ticket
export const updateSupportTicketAction = createAsyncThunk('support/updateSupportTicket', async ({ id, payload }, { rejectWithValue }) => {
  try {
    const data = await supportServicesInstance.updateSupportTicket(id, payload);
    Logger.info('Update support ticket successful:', data);
    return data;
  } catch (error) {
    Logger.error('Update support ticket failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
