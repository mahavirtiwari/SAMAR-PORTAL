import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../../services/api';
import { Logger } from '../../../../utils/logger';

const service = Api.Payment;

/**
 * Initiate a payment for an application.
 *
 * Flow:
 *   1. POST /payments/initiate → backend creates a Payment row, calls the
 *      configured gateway adapter, and returns the gateway-specific payload.
 *   2. The thunk stores the raw response in state.initiatePayment (fulfilled).
 *   3. The MakePayment screen has a useEffect on initiatePayment that does
 *      `window.location.href = initiatePayment.gatewayData.paymentUrl` once
 *      the response lands. That is the SINGLE place the redirect happens.
 *
 * Backend response shape (camelCased by ConvertResponseToCamelCase middleware):
 *   {
 *     data: {
 *       paymentId: number,
 *       gatewayData: {
 *         gateway: 'icici_eazypay',
 *         paymentUrl: string,   // <- the encrypted ICICI Plan URL
 *         referenceNo: string,
 *         redirectMethod: 'GET',
 *         ...
 *       }
 *     }
 *   }
 *
 * Do NOT add gateway-URL validation or `window.location.href` here. The field
 * names inside gatewayData are gateway-specific (today ICICI EazyPay, tomorrow
 * possibly Razorpay/Stripe), so any pre-check in this thunk has to know every
 * gateway's shape. Keep the thunk gateway-agnostic — let the screen consume
 * what it needs from the typed response.
 */
export const initiatePaymentAction = createAsyncThunk('systemAdmin/payment/initiate', async (paymentData, { rejectWithValue }) => {
  try {
    Logger.info('Initiate payment attempt');
    const response = await service.initiatePayment(paymentData);
    Logger.info('Initiate payment successful');
    return response;
  } catch (error) {
    Logger.error('Initiate payment failed:', error?.message);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

/**
 * Get payment details by ID
 */
export const getPaymentDetailsAction = createAsyncThunk('systemAdmin/payment/getDetails', async (paymentId, { rejectWithValue }) => {
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
export const getPaymentHistoryAction = createAsyncThunk('systemAdmin/payment/getHistory', async (filters, { rejectWithValue }) => {
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
