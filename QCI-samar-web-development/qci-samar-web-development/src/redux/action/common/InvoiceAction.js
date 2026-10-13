import { createAsyncThunk } from '@reduxjs/toolkit';
import Api from '../../../services/api';
import { Logger } from '../../../utils/logger';

const service = Api.Payment;

/**
 * Download an ERP document. Returns the raw Blob; the screen hands it to
 * downloadPayloadAsPdf, matching the certificate download flow.
 */
export const downloadInvoicePdfAction = createAsyncThunk('invoice/downloadInvoicePdf', async (invoiceId, { rejectWithValue }) => {
  try {
    return await service.downloadInvoicePdf(invoiceId);
  } catch (error) {
    Logger.error('Download invoice PDF failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});

export const downloadReceiptPdfAction = createAsyncThunk('invoice/downloadReceiptPdf', async (invoiceId, { rejectWithValue }) => {
  try {
    return await service.downloadReceiptPdf(invoiceId);
  } catch (error) {
    Logger.error('Download receipt PDF failed:', error);
    return rejectWithValue(error?.response?.data ?? error?.message ?? 'An unknown error occurred');
  }
});
