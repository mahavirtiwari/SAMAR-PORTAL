import { Logger } from '../../../utils/logger';
import { buildPaginationParams } from '../utils/pagination';

const PaymentService = userClient => {
  /**
   * Initiate a payment for an application
   * @param {Object} paymentData - Payment initiation data
   * @param {number} paymentData.applicationId - Application ID
   * @param {number} paymentData.amount - Payment amount
   * @param {string} paymentData.description - Payment description
   * @param {string} [paymentData.gateway] - Payment gateway (icici_eazypay)
   * @param {Object} [paymentData.metadata] - Additional metadata (gstin, tan, etc.)
   * @returns {Promise<Object>} Payment initiation response with gateway_url
   */
  const initiatePayment = async paymentData => {
    try {
      Logger.info('PaymentService.initiatePayment:', paymentData);
      const response = await userClient.post('/payments/initiate', paymentData);
      Logger.info('PaymentService.initiatePayment response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in PaymentService.initiatePayment:', error.message);
      throw error;
    }
  };

  /**
   * Quote the fee payable for an application.
   *
   * The server resolves the amount from the fee configuration; the payment screen
   * renders this rather than deriving it, so what the applicant sees and what is
   * charged come from one calculation.
   *
   * @param {number} applicationId - Application ID
   * @param {Object} [options] - TDS election
   * @param {boolean} [options.tdsDeductible] - Whether the applicant elects a TDS deduction
   * @param {number} [options.tdsPercentage] - TDS rate (2 or 10); required when tdsDeductible
   * @returns {Promise<Object>} Fee breakdown
   */
  const getApplicationFee = async (applicationId, { tdsDeductible = false, tdsPercentage } = {}) => {
    try {
      const params = new URLSearchParams();
      if (tdsDeductible) {
        params.set('tdsDeductible', 'true');
        params.set('tdsPercentage', String(tdsPercentage));
      }
      const query = params.toString();
      const url = `/applications/${applicationId}/fee${query ? `?${query}` : ''}`;

      Logger.info('PaymentService.getApplicationFee:', url);
      const response = await userClient.get(url);
      return response.data;
    } catch (error) {
      Logger.error('Error in PaymentService.getApplicationFee:', error.message);
      throw error;
    }
  };

  /**
   * Verify a payment after callback
   * @param {string} paymentId - Payment ID
   * @param {Object} [verificationData] - Optional verification data from gateway callback
   * @returns {Promise<Object>} Payment verification response
   */

  /**
   * Get payment details by ID
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  const getPaymentDetails = async paymentId => {
    try {
      Logger.info('PaymentService.getPaymentDetails:', paymentId);
      const response = await userClient.get(`/payments/${paymentId}`);
      Logger.info('PaymentService.getPaymentDetails response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in PaymentService.getPaymentDetails:', error.message);
      throw error;
    }
  };

  /**
   * Get payment history with optional filters
   * @param {Object} filters - Query filters
   * @param {number} [filters.page] - Page number
   * @param {number} [filters.perPage] - Items per page
   * @param {string} [filters.status] - Payment status filter
   * @param {string} [filters.applicationId] - Filter by application
   * @returns {Promise<Object>} Paginated payment list
   */
  const getPaymentHistory = async filters => {
    try {
      const queryString = buildPaginationParams(filters);
      const url = `/payments${queryString}`;

      Logger.info('PaymentService.getPaymentHistory:', url);
      const response = await userClient.get(url);
      Logger.info('PaymentService.getPaymentHistory response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in PaymentService.getPaymentHistory:', error.message);
      throw error;
    }
  };

  /**
   * Export the payment history as CSV, honouring the list's current filters.
   *
   * responseType 'text' is required so the caller can build a Blob from the body;
   * without it the CSV is parsed as JSON and the download comes out empty.
   *
   * @param {Object} filters - Same filters as getPaymentHistory, without paging
   * @returns {Promise<string>} CSV body
   */
  const exportPayments = async (filters = {}) => {
    try {
      const queryString = buildPaginationParams(filters);
      const url = `/payments/export${queryString}`;

      Logger.info('PaymentService.exportPayments:', url);
      const response = await userClient.get(url, { responseType: 'text' });
      return response.data;
    } catch (error) {
      Logger.error('Error in PaymentService.exportPayments:', error.message);
      throw error;
    }
  };

  /**
   * Get payments for a specific application
   * @param {number} applicationId - Application ID
   * @returns {Promise<Object>} Application payments (array of payments)
   */
  const getApplicationPayments = async applicationId => {
    try {
      Logger.info('PaymentService.getApplicationPayments:', applicationId);
      // Use query parameter to filter payments by application ID
      // Backend expects application_id (snake_case) but middleware converts camelCase
      const response = await userClient.get(`/payments/${applicationId}`);
      Logger.info('PaymentService.getApplicationPayments response:', response);
      return response.data;
    } catch (error) {
      Logger.error('Error in PaymentService.getApplicationPayments:', error.message);
      throw error;
    }
  };

  /**
   * Download the ERP-issued invoice PDF for an invoice.
   * @param {number} invoiceId
   * @returns {Promise<Blob>}
   */
  const downloadInvoicePdf = async invoiceId => {
    try {
      const response = await userClient.get(`/invoices/${invoiceId}/invoice-pdf`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      Logger.error('Error in PaymentService.downloadInvoicePdf:', error.message);
      throw error;
    }
  };

  /**
   * Download the ERP-issued receipt PDF for an invoice.
   * @param {number} invoiceId
   * @returns {Promise<Blob>}
   */
  const downloadReceiptPdf = async invoiceId => {
    try {
      const response = await userClient.get(`/invoices/${invoiceId}/receipt-pdf`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      Logger.error('Error in PaymentService.downloadReceiptPdf:', error.message);
      throw error;
    }
  };

  return {
    initiatePayment,
    getApplicationFee,
    getPaymentDetails,
    getPaymentHistory,
    exportPayments,
    getApplicationPayments,
    downloadInvoicePdf,
    downloadReceiptPdf,
  };
};

export default PaymentService;
