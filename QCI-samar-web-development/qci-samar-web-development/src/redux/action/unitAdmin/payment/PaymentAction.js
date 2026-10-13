import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../../services/api';
import { Logger } from '../../../../utils/logger';

const service = Api.Payment;

/**
 * Initiate a payment for an application
 * This calls the backend which returns a gateway_url to redirect the user to ICICI EazyPay
 */
export const initiatePaymentAction = createAsyncThunk('unitAdmin/payment/initiate', async (paymentData, { rejectWithValue }) => {
  try {
    Logger.info('Initiate payment attempt:', paymentData);
    const response = await service.initiatePayment(paymentData);
    Logger.info('Initiate payment successful:', response);
    return response;
  } catch (error) {
    Logger.error('Initiate payment failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

/**
 * Verify a payment after returning from the gateway
 */

/**
 * Get payment details by ID
 */
export const getPaymentDetailsAction = createAsyncThunk('unitAdmin/payment/getDetails', async (paymentId, { rejectWithValue }) => {
  try {
    Logger.info('Get payment details attempt:', paymentId);
    const response = await service.getPaymentDetails(paymentId);
    Logger.info('Get payment details successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get payment details failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

/**
 * Get payment history with filters
 */
export const getPaymentHistoryAction = createAsyncThunk('unitAdmin/payment/getHistory', async (filters, { rejectWithValue }) => {
  try {
    Logger.info('Get payment history attempt:', filters);
    const response = await service.getPaymentHistory(filters);
    Logger.info('Get payment history successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get payment history failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

/**
 * Get payments for a specific application
 */
export const getApplicationPaymentsAction = createAsyncThunk('unitAdmin/payment/getApplicationPayments', async (applicationId, { rejectWithValue }) => {
  try {
    Logger.info('Get application payments attempt:', applicationId);
    const response = await service.getApplicationPayments(applicationId);
    Logger.info('Get application payments successful:', response);
    return response;
  } catch (error) {
    Logger.error('Get application payments failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
