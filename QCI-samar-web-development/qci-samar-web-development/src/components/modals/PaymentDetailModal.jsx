import { formatCurrency, formatDate } from '../../utils/formatters';
import { getBadgeVariantByLabel } from '../../utils/getStatusColors';
import { AppBadge } from '../base';
import AppCommonModal from './AppCommonModal';

const PaymentDetailModal = ({ open, handleClose, paymentData }) => {
  if (!paymentData) {
    return null;
  }

  // Handle array of payments (for backwards compatibility)
  let payment = paymentData;
  if (Array.isArray(paymentData)) {
    payment = paymentData.find(p => p.status === 'success') || paymentData[0] || {};
  }

  const application = payment.application || {};
  const breakdown = payment.breakdown || {};

  // Get total amount from payment
  const totalPayable = payment.amount || 0;
  const date = payment.createdAt || null;

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

  // Modal title
  const modalTitle = <>Payment Details</>;

  // Modal content
  const modalContent = (
    <>
      {/* Order Header */}
      <div className="margin-bottom-24">
        <div className="rowCenter">
          <span className="fs-16 fw-500 text-3-color" style={{ marginRight: '12px' }}>
            ORDER <span className="fs-16 fw-600 info-primary-color">#{orderNo}</span>
          </span>

          <AppBadge variant={getBadgeVariantByLabel(paymentStatus)} label={paymentStatus} />
        </div>
        {date && <span className="fs-12 fw-500 text-2-color">Date: {formatDate(date)}</span>}
      </div>
      <div className="row">
        <div className="col-12">
          <div className="rowBetween margin-bottom-10">
            <span className="fs-12 fw-500 text-2-color">Base Certification Fee</span>
            <span className="fs-12 fw-500 text-1-color">{formatCurrency(baseCertificationFee)}</span>
          </div>
          {foodAccommodation !== undefined && (
            <div className="rowBetween margin-bottom-10">
              <span className="fs-12 fw-500 text-2-color">Logistics Fee</span>
              <span className="fs-12 fw-500 text-1-color">{formatCurrency(foodAccommodation)}</span>
            </div>
          )}
        </div>
      </div>
      {/* Payment Breakdown */}
      <div className="sub-Total-Container padding-top-10 margin-bottom-10">
        <div className="row">
          <div className="col-12">
            <div className="rowBetween margin-bottom-10">
              <span className="fs-12 fw-500 heading-color">Subtotal</span>
              <span className="fs-12 fw-600 heading-color">{formatCurrency(amountPayable)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-12">
          <div className="rowBetween margin-bottom-10">
            <span className="fs-12 fw-500 text-2-color">GST ({(gstRate * 100).toFixed(0)}%)</span>
            <span className="fs-12 fw-500 text-1-color">{formatCurrency(gstAmount)}</span>
          </div>
          {tdsDeductible && (
            <div className="rowBetween margin-bottom-10">
              <span className="fs-12 fw-500 text-2-color">TDS ({(tdsRate * 100).toFixed(0)}%)</span>
              <span className="fs-12 fw-500 text-1-color">-{formatCurrency(tdsAmount)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="total-payable-Container padding-top-10 margin-bottom-32">
        <div className="row">
          <div className="col-12">
            <div className="rowBetween margin-bottom-10">
              <span className="fs-14 fw-600 heading-color">Total Payable</span>
              <span className="fs-14 fw-600 heading-color">{formatCurrency(totalPayable)}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Tax Information */}
      <div>
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
    </>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '600px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default PaymentDetailModal;
