import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../../utils/logger';
import { getPaymentDetailsAction, getPaymentHistoryAction, initiatePaymentAction } from '../../../action/enterpriseAdmin/payment/PaymentAction';

const initialState = {
  // Initiate payment
  initiatePayment: null,
  initiatePaymentLoading: false,
  initiatePaymentError: null,

  // Payment details
  paymentDetails: null,
  paymentDetailsLoading: false,
  paymentDetailsError: null,

  // Payment history
  paymentHistory: [],
  paymentHistoryPagination: null,
  // Successful and failed totals for the whole filtered set, not the current page.
  paymentHistorySummary: null,
  paymentHistoryLoading: false,
  paymentHistoryError: null,
};

const paymentSlice = createSlice({
  name: 'payment',
  initialState,

  reducers: {
    resetInitiatePayment: state => {
      state.initiatePayment = null;
      state.initiatePaymentError = null;
      state.initiatePaymentLoading = false;
    },
    resetPaymentDetails: state => {
      state.paymentDetails = null;
      state.paymentDetailsError = null;
      state.paymentDetailsLoading = false;
    },
    clearPaymentErrors: state => {
      state.initiatePaymentError = null;
      state.paymentDetailsError = null;
      state.paymentHistoryError = null;
    },
  },

  extraReducers: builder => {
    // Initiate payment
    builder
      .addCase(initiatePaymentAction.pending, state => {
        state.initiatePaymentLoading = true;
        state.initiatePaymentError = null;
      })
      .addCase(initiatePaymentAction.fulfilled, (state, action) => {
        state.initiatePaymentLoading = false;
        state.initiatePayment = action.payload?.data || action.payload;
        Logger.info('Payment initiated successfully in slice');
      })
      .addCase(initiatePaymentAction.rejected, (state, action) => {
        state.initiatePaymentLoading = false;
        state.initiatePaymentError = action.payload;
        Logger.error('Initiate payment failed in slice:', action.payload);
      });

    // Get payment details
    builder
      .addCase(getPaymentDetailsAction.pending, state => {
        state.paymentDetailsLoading = true;
        state.paymentDetailsError = null;
      })
      .addCase(getPaymentDetailsAction.fulfilled, (state, action) => {
        state.paymentDetailsLoading = false;
        state.paymentDetails = action.payload?.data || action.payload;
        Logger.info('Payment details loaded successfully in slice');
      })
      .addCase(getPaymentDetailsAction.rejected, (state, action) => {
        state.paymentDetailsLoading = false;
        state.paymentDetailsError = action.payload;
        Logger.error('Get payment details failed in slice:', action.payload);
      });

    // Get payment history
    builder
      .addCase(getPaymentHistoryAction.pending, state => {
        state.paymentHistoryLoading = true;
        state.paymentHistoryError = null;
      })
      .addCase(getPaymentHistoryAction.fulfilled, (state, action) => {
        state.paymentHistoryLoading = false;
        state.paymentHistory = action.payload?.data || action.payload || [];
        state.paymentHistoryPagination = action.payload?.pagination || null;
        state.paymentHistorySummary = action.payload?.summary || null;
        Logger.info('Payment history loaded successfully in slice');
      })
      .addCase(getPaymentHistoryAction.rejected, (state, action) => {
        state.paymentHistoryLoading = false;
        state.paymentHistoryError = action.payload;
        Logger.error('Get payment history failed in slice:', action.payload);
      });
  },
});

export const { resetInitiatePayment, resetPaymentDetails, clearPaymentErrors } = paymentSlice.actions;
export default paymentSlice.reducer;
