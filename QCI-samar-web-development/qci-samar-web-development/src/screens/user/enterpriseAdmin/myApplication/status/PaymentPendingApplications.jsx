import ApplicationStatus from './ApplicationStatus';

// Enterprise Admin – Payment Pending Applications. Reuses the shared ApplicationStatus
// list, locked to the payment_pending status.
const PaymentPendingApplications = () => {
  return <ApplicationStatus status="payment_pending" heading="Payment Pending Applications" />;
};

export default PaymentPendingApplications;
