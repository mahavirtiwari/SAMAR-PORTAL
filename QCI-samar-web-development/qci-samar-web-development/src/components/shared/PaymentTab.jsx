import { formatCurrency } from '../../utils/formatters';
import { getBadgeVariantByLabel } from '../../utils/getStatusColors';
import { AppBadge } from '../base';

/**
 * Unified PaymentTab component for displaying payment details
 * Used across all admin panels (Enterprise, System, Operations, DRDO, Unit)
 *
 * @param {Object} props
 * @param {Object} props.paymentData - Payment object from API
 * @param {Object} props.applicationData - Application object (optional fallback for tax info)
 * @param {boolean} props.loading - Loading state
 */
const PaymentTab = ({ paymentData, applicationData, loading = false }) => {
  // Extract payment information
  const payment = paymentData || {};
  const application = applicationData || {};
  const breakdown = payment.breakdown || {};

  // Get total amount from payment
  const totalPayable = payment.amount || 0;

  // Get breakdown from API (already in camelCase from backend)
  const baseCertificationFee = breakdown.baseCertificationFee || 0;
  const foodAccommodation = breakdown.foodAccommodation || 0;
  const amountPayable = breakdown.amountPayable || baseCertificationFee + foodAccommodation;
  const gstAmount = breakdown.gstAmount || 0;
  const tdsAmount = breakdown.tdsAmount || 0;
  // Use nullish coalescing so a legitimate 0% GST is not replaced by 18.
  const gstRate = (breakdown.gstPercentage ?? 18) / 100;
  const tdsRate = (breakdown.tdsPercentage ?? 0) / 100;
  const tdsDeductible = breakdown.tdsDeductible || false;

  // Get order number and status
  const orderNo = payment.paymentNumber || payment.paymentId || application.applicationNumber || 'N/A';
  const paymentStatus = payment.status || 'pending';
  const gstin = payment.gstin || application.gstNumber || '-';
  const tan = payment.tan || application.organization?.tan || '-';

  // Loading state
  if (loading) {
    return (
      <div className="details-card">
        <h5 className="fs-16 fw-600 heading-color mb-4 dark-text">Payment Details</h5>
        <div className="text-center py-4">
          <span className="text-3-color">Loading payment details...</span>
        </div>
      </div>
    );
  }

  // Empty state - no payment data
  if (!paymentData || !payment.id) {
    return (
      <div className="details-card">
        <h5 className="fs-16 fw-600 heading-color mb-4 dark-text">Payment Details</h5>
        <div className="text-center py-4">
          <span className="text-3-color">No payment records found for this application.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="details-card">
      <h5 className="fs-16 fw-600 heading-color mb-4 dark-text">Payment Details</h5>
      <div className="margin-bottom-14">
        <div className="rowCenter">
          <span className="fs-16 fw-500 text-3-color" style={{ marginRight: '12px' }}>
            ORDER <span className="fs-16 fw-600 info-primary-color">#{orderNo}</span>
          </span>
          <AppBadge variant={getBadgeVariantByLabel(paymentStatus)} label={paymentStatus} />
        </div>
      </div>
      <div className="row">
        <div className="col-12 col-md-6">
          <div className="rowBetween margin-bottom-10">
            <span className="fs-14 fw-500 text-2-color">Base Certification Fee</span>
            <span className="fs-14 fw-500 text-1-color">{formatCurrency(baseCertificationFee)}</span>
          </div>
          {foodAccommodation > 0 && (
            <div className="rowBetween margin-bottom-10">
              <span className="fs-14 fw-500 text-2-color">Logistics Fee</span>
              <span className="fs-14 fw-500 text-1-color">{formatCurrency(foodAccommodation)}</span>
            </div>
          )}
          <div className="rowBetween margin-bottom-10">
            <span className="fs-16 fw-500 text-1-color">Total</span>
            <span className="fs-16 fw-600 text-1-color">{formatCurrency(amountPayable)}</span>
          </div>
          <div className="rowBetween margin-bottom-10">
            <span className="fs-14 fw-500 text-2-color">GST ({(gstRate * 100).toFixed(0)}%)</span>
            <span className="fs-14 fw-500 text-1-color">{formatCurrency(gstAmount)}</span>
          </div>
          {tdsDeductible && tdsAmount > 0 && (
            <div className="rowBetween margin-bottom-10">
              <span className="fs-14 fw-500 text-2-color">TDS ({(tdsRate * 100).toFixed(0)}%)</span>
              <span className="fs-14 fw-500 text-1-color">-{formatCurrency(tdsAmount)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="total-payable-Container padding-top-10 padding-bottom-10">
        <div className="row">
          <div className="col-12 col-md-6">
            <div className="rowBetween margin-bottom-0">
              <span className="fs-18 fw-600 heading-color">Total Payable</span>
              <div className="d-flex align-items-center gap-10">
                <span className="fs-20 fw-600 primary-color">{formatCurrency(totalPayable)}</span>
                {/* <AppBadge variant={getBadgeVariantByLabel(paymentStatus)} label={paymentStatus} /> */}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="margin-top-24">
        <h4 className="fs-16 fw-600 heading-color margin-bottom-16">Tax Information</h4>
        <div className="rowCenter" style={{ gap: '70px' }}>
          <div className="rowCenter">
            <span className="fs-12 fw-400 text-2-color margin-right-10">GSTIN Applicable:</span>
            <span className="fs-12 fw-600 heading-color">{gstin}</span>
          </div>

          <div className="rowCenter">
            <span className="fs-12 fw-400 text-2-color margin-right-10">TDS Deduction:</span>
            <span className="fs-12 fw-600 heading-color">{tan}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentTab;
