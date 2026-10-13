import { createSlice } from '@reduxjs/toolkit';
import { Logger } from '../../../../utils/logger';
import { getApplicationPaymentsAction, getPaymentDetailsAction, getPaymentHistoryAction, initiatePaymentAction } from '../../../action/unitAdmin/payment/PaymentAction';

const initialState = {
  // Initiate payment
  initiatePayment: null,
  initiatePaymentLoading: false,
  initiatePaymentError: null,

  // Verify payment

  // Payment details
  paymentDetails: null,
  paymentDetailsLoading: false,
  paymentDetailsError: null,

  // Payment history
  paymentHistory: [],
  paymentHistoryLoading: false,
  paymentHistoryError: null,

  // Application payments
  applicationPayments: null,
  applicationPaymentsLoading: false,
  applicationPaymentsError: null,
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
      state.applicationPayments = null;
    },
    clearPaymentErrors: state => {
      state.initiatePaymentError = null;
      state.paymentDetailsError = null;
      state.paymentHistoryError = null;
      state.applicationPaymentsError = null;
      state.applicationPayments = [];
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

    // Verify payment

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
        Logger.info('Payment history loaded successfully in slice');
      })
      .addCase(getPaymentHistoryAction.rejected, (state, action) => {
        state.paymentHistoryLoading = false;
        state.paymentHistoryError = action.payload;
        Logger.error('Get payment history failed in slice:', action.payload);
      });

    // Get application payments
    // Backend returns: { success: true, data: { payments: [...], pagination: {...} } }
    // We extract the payments array for direct use in components
    builder
      .addCase(getApplicationPaymentsAction.pending, state => {
        state.applicationPaymentsLoading = true;
        state.applicationPaymentsError = null;
      })
      .addCase(getApplicationPaymentsAction.fulfilled, (state, action) => {
        state.applicationPaymentsLoading = false;
        // Extract payments array from response: data.payments or fallback to data if it's already an array
        const responseData = action.payload?.data;
        state.applicationPayments = responseData?.payment || (Array.isArray(responseData) ? responseData : []);
        Logger.info('Application payments loaded successfully in slice:', state.applicationPayments);
      })
      .addCase(getApplicationPaymentsAction.rejected, (state, action) => {
        state.applicationPaymentsLoading = false;
        state.applicationPaymentsError = action.payload;
        Logger.error('Get application payments failed in slice:', action.payload);
      });
  },
});

export const { resetInitiatePayment, resetPaymentDetails, clearPaymentErrors } = paymentSlice.actions;
export default paymentSlice.reducer;
