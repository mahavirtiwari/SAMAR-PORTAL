import { CircularProgress } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../../../../../components/layout';
import Icons from '../../../../../constants/Icons';
import { getPaymentDetailsAction as enterpriseGetPaymentDetailsAction } from '../../../../../redux/action/enterpriseAdmin/payment/PaymentAction';
import { getPaymentDetailsAction as unitGetPaymentDetailsAction } from '../../../../../redux/action/unitAdmin/payment/PaymentAction';
import { resetPaymentDetails as resetEnterprisePaymentDetails } from '../../../../../redux/slices/enterpriseAdmin/payment/PaymentSlice';
import { resetPaymentDetails as resetUnitPaymentDetails } from '../../../../../redux/slices/unitAdmin/payment/PaymentSlice';
import { Logger } from '../../../../../utils/logger';
import { hasRole } from '../../../../../utils/roleUtils';

/**
 * PaymentCallback Component
 *
 * Handles the return from ICICI EazyPay payment gateway.
 *
 * Flow:
 * 1. Backend receives ICICI callback, verifies signature, updates payment in DB
 * 2. Backend redirects to this page with status and paymentId in URL
 * 3. This component fetches payment details from backend to display actual data
 *
 * Query parameters from backend redirect (camelCase):
 * - status: 'success' | 'failed' | 'pending' (from backend's verification)
 * - paymentId: Payment ID in our system
 * - transactionId: ICICI transaction reference (optional)
 * - message: Status message (optional)
 * - applicationId: Application ID (optional)
 */
const PaymentCallback = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { user } = useSelector(state => state.Account);
  const isUnitAdmin = hasRole(user, 'unit_admin');
  const getPaymentDetailsAction = isUnitAdmin ? unitGetPaymentDetailsAction : enterpriseGetPaymentDetailsAction;
  const resetPaymentDetails = isUnitAdmin ? resetUnitPaymentDetails : resetEnterprisePaymentDetails;

  const [processingStatus, setProcessingStatus] = useState('loading'); // loading, success, failed, pending, error
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  // Cleanup ref on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Enterprise and unit admin keep separate payment slices; pick the active one.
  const enterprisePayment = useSelector(state => state.EnterpriseAdminPayment);
  const unitPayment = useSelector(state => state.UnitAdminPayment);
  const { paymentDetails, paymentDetailsLoading, paymentDetailsError } = isUnitAdmin ? unitPayment : enterprisePayment;

  // Extract query parameters from URL
  const status = searchParams.get('status');
  const paymentId = searchParams.get('paymentId');
  const transactionId = searchParams.get('transactionId');
  const message = searchParams.get('message');
  const applicationId = searchParams.get('applicationId');

  // Fetch payment details on mount
  useEffect(() => {
    Logger.info('Payment callback received:', { status, paymentId, transactionId, message, applicationId });

    if (paymentId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      dispatch(getPaymentDetailsAction(paymentId));
    } else if (!paymentId) {
      Logger.error('No payment ID in callback URL');
      setProcessingStatus('error');
    }
  }, [dispatch, paymentId, status, transactionId, message, applicationId]);

  // Handle payment details response
  useEffect(() => {
    if (paymentDetailsLoading || !hasFetchedRef.current) {
      return;
    }

    if (paymentDetails) {
      Logger.info('Payment details loaded:', paymentDetails);

      const paymentStatus = paymentDetails.status || paymentDetails.payment?.status;

      if (paymentStatus === 'completed' || paymentStatus === 'success') {
        setProcessingStatus('success');
      } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
        setProcessingStatus('failed');
      } else if (paymentStatus === 'pending' || paymentStatus === 'initiated' || paymentStatus === 'processing') {
        setProcessingStatus('pending');
      } else {
        // Fallback to URL status if payment status is unclear
        setProcessingStatus(status || 'pending');
      }
    }
  }, [paymentDetails, paymentDetailsLoading, status]);

  // Handle fetch error
  useEffect(() => {
    if (paymentDetailsError) {
      Logger.error('Failed to fetch payment details:', paymentDetailsError);
      // Fallback to URL status on error
      if (status === 'success') {
        setProcessingStatus('success');
      } else if (status === 'failed') {
        setProcessingStatus('failed');
      } else {
        setProcessingStatus('error');
      }
    }
  }, [paymentDetailsError, status]);

  // Auto-redirect on success after delay
  useEffect(() => {
    let redirectTimeout;
    if (processingStatus === 'success') {
      redirectTimeout = setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }
        navigate('/payment-successful', {
          state: {
            paymentData: paymentDetails,
            applicationId: applicationId,
          },
        });
      }, 2000);
    }
    return () => {
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [processingStatus, paymentDetails, applicationId, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(resetPaymentDetails());
    };
  }, [dispatch]);

  const handleRetry = () => {
    if (applicationId) {
      navigate(`/my-application/application-details/${applicationId}`);
    } else {
      navigate('/applications');
    }
  };

  const handleViewApplication = () => {
    if (applicationId) {
      navigate(`/my-application/application-details/${applicationId}`);
    } else {
      navigate('/applications');
    }
  };

  // Get display values from payment details or URL params
  const displayTransactionId = paymentDetails?.gatewayPaymentId || paymentDetails?.payment?.gatewayPaymentId || transactionId;
  const displayAmount = paymentDetails?.amount || paymentDetails?.payment?.amount;
  const displayMessage = paymentDetailsError?.message || message;

  const renderContent = () => {
    switch (processingStatus) {
      case 'loading':
        return (
          <div className="text-center">
            <CircularProgress size={60} />
            <h2 className="fs-20 fw-600 heading-color margin-top-24">Processing Payment...</h2>
            <p className="fs-14 fw-400 text-3-color margin-top-12">Please wait while we fetch your payment details.</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <img src={Icons.successCircle} alt="Payment Successful" className="icon-100" />
            <h2 className="fs-24 fw-600 success-active-color margin-top-24">Payment successful</h2>
            <p className="fs-14 fw-400 text-3-color margin-top-12">Your payment has been processed successfully.</p>
            {displayTransactionId && <p className="fs-12 fw-500 text-2-color margin-top-8">Transaction ID: {displayTransactionId}</p>}
            {displayAmount && <p className="fs-12 fw-500 text-2-color margin-top-4">Amount: ₹{displayAmount}</p>}
            <p className="fs-12 fw-400 text-3-color margin-top-8">Redirecting to confirmation page...</p>
          </div>
        );

      case 'failed':
        return (
          <div className="text-center">
            <img src={Icons.errorCircle || Icons.warningIcon} alt="Payment Failed" className="icon-100" />
            <h2 className="fs-24 fw-600 text-danger margin-top-24">Payment Failed</h2>
            <p className="fs-14 fw-400 text-3-color margin-top-12">{displayMessage || 'Your payment could not be processed. Please try again.'}</p>
            {displayTransactionId && <p className="fs-12 fw-500 text-2-color margin-top-8">Transaction Reference: {displayTransactionId}</p>}
            <div className="margin-top-24 d-flex justify-content-center gap-3">
              <button className="btn btn-outline-primary" onClick={handleRetry}>
                Try Again
              </button>
              <button className="btn btn-primary" onClick={handleViewApplication}>
                View Application
              </button>
            </div>
          </div>
        );

      case 'pending':
        return (
          <div className="text-center">
            <img src={Icons.warningIcon} alt="Payment Pending" className="icon-100" />
            <h2 className="fs-24 fw-600 text-warning margin-top-24">Payment Pending</h2>
            <p className="fs-14 fw-400 text-3-color margin-top-12">Your payment is being processed. This may take a few minutes.</p>
            {displayTransactionId && <p className="fs-12 fw-500 text-2-color margin-top-8">Transaction Reference: {displayTransactionId}</p>}
            <p className="fs-12 fw-400 text-3-color margin-top-12">You will receive a confirmation once the payment is complete.</p>
            <div className="margin-top-24">
              <button className="btn btn-primary" onClick={handleViewApplication}>
                View Application
              </button>
            </div>
          </div>
        );

      case 'error':
      default:
        return (
          <div className="text-center">
            <img src={Icons.errorCircle || Icons.warningIcon} alt="Error" className="icon-100" />
            <h2 className="fs-24 fw-600 text-danger margin-top-24">Something Went Wrong</h2>
            <p className="fs-14 fw-400 text-3-color margin-top-12">{displayMessage || 'We could not fetch your payment status. Please check your application for the latest status.'}</p>
            <div className="margin-top-24 d-flex justify-content-center gap-3">
              <button className="btn btn-outline-primary" onClick={handleRetry}>
                Try Again
              </button>
              <button className="btn btn-primary" onClick={handleViewApplication}>
                View Application
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="payment-callback-container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="row">
              <div className="col-12">{renderContent()}</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PaymentCallback;
