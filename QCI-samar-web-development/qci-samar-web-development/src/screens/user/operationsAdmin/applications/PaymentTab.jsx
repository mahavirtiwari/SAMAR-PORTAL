import { useSelector } from 'react-redux';
import PaymentTabComponent from '../../../../components/shared/PaymentTab';

/**
 * Operation Admin PaymentTab wrapper
 * Uses applicationDetails.payments which already contains complete payment data with breakdown
 */
const PaymentTab = () => {
  const { applicationDetails, applicationDetailsLoading } = useSelector(state => state.OperationsAdminApplication);

  // Use payments from applicationDetails which includes complete breakdown data
  // This is consistent with how Enterprise Admin Detail Page works
  const payment = applicationDetails?.payments?.find(p => p.status === 'success') || applicationDetails?.payments?.[0] || null;

  return <PaymentTabComponent paymentData={payment} applicationData={applicationDetails} loading={applicationDetailsLoading} />;
};

export default PaymentTab;
