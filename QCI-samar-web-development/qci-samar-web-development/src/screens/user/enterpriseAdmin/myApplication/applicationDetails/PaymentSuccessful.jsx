import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppButton, AppModal } from '../../../../../components/base';
import { toastError } from '../../../../../components/base/toast';
import { Layout } from '../../../../../components/layout';
import ScheduleAssessmentModal from '../../../../../components/modals/ScheduleAssessmentModal';
import { getAssessmentTypeLabel } from '../../../../../constants/assessmentStatus';
import Icons from '../../../../../constants/Icons';
import {
  getApplicationDetailsAction as enterpriseGetApplicationDetailsAction,
  setPreferredAssessmentDateAction as enterpriseSetPreferredAssessmentDateAction,
} from '../../../../../redux/action/enterpriseAdmin/application/ApplicationAction';
import {
  getApplicationDetailsAction as unitGetApplicationDetailsAction,
  setPreferredAssessmentDateAction as unitSetPreferredAssessmentDateAction,
} from '../../../../../redux/action/unitAdmin/application/ApplicationAction';
import { formatDateTime } from '../../../../../utils/formatters';
import { hasRole } from '../../../../../utils/roleUtils';

const PaymentSuccessful = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.Account);
  const isUnitAdmin = hasRole(user, 'unit_admin');
  const setPreferredAssessmentDateAction = isUnitAdmin ? unitSetPreferredAssessmentDateAction : enterpriseSetPreferredAssessmentDateAction;
  const getApplicationDetailsAction = isUnitAdmin ? unitGetApplicationDetailsAction : enterpriseGetApplicationDetailsAction;
  const { applicationDetails } = useSelector(state => (isUnitAdmin ? state.UnitAdminApplication : state.EnterpriseAdminApplication));
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [assessmentDate, setAssessmentDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get payment data from navigation state
  // paymentData can be { payment: {...} } from API or flat object from verify
  const rawPaymentData = location.state?.paymentData || {};
  const paymentData = rawPaymentData?.payment || rawPaymentData;
  const applicationId = location.state?.applicationId;

  // The payment response's nested application does not carry `sector`, so fetch the
  // application to resolve the assessment-type label the same way the detail screens do.
  useEffect(() => {
    if (applicationId) {
      dispatch(getApplicationDetailsAction(applicationId));
    }
  }, [applicationId, dispatch, getApplicationDetailsAction]);

  const assessmentSector = applicationDetails?.sector ?? paymentData?.application?.sector;

  // Format currency
  const formatCurrency = amount => {
    if (!amount) {
      return 'N/A';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handlePickDate = () => {
    setShowAssessmentModal(true);
  };

  const handleCloseAssessmentModal = () => {
    setShowAssessmentModal(false);
  };

  const handleAssessmentDateChange = date => {
    setAssessmentDate(date);
  };

  const handleConfirmAssessmentDate = async () => {
    if (!assessmentDate) {
      toastError('Please select a preferred assessment date.');
      return;
    }

    if (!applicationId) {
      toastError('Application ID not found.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = dayjs(assessmentDate).format('YYYY-MM-DD');
      await dispatch(
        setPreferredAssessmentDateAction({
          applicationId,
          preferredAssessmentDate: formattedDate,
        }),
      ).unwrap();

      setShowAssessmentModal(false);
      setShowSubmitModal(true);
    } catch (error) {
      toastError(error?.message || 'Failed to save preferred assessment date.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
    // Navigate to application details after closing
    if (applicationId) {
      navigate(`/my-application/application-details/${applicationId}`);
    } else {
      navigate('/applications');
    }
  };

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="payment-successful-container">
            <div className="row">
              <div className="col-12 column-center">
                <img src={Icons.successCircle} alt="Payment Successful" className="icon-130" />
                <div className="margin-top-24 text-center">
                  <h1 className="fs-24 fw-600 success-active-color margin-bottom-12">Payment successful</h1>
                  <h4 className="fs-18 fw-600 heading-color margin-bottom-24">Thank you!</h4>
                  <span className="fs-14 fw-500 text-3-color mb-0">An Email of the receipt will be sent on your registered ID.</span>
                  <div className="payment-detaail-container">
                    <ul className="enterpriseInfoUl gap-12 w-100">
                      <li>
                        <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color">Transaction Amount:</p>
                        <p className="fs-12 fw-500 mb-0 text-1-color margin-left-12">{formatCurrency(paymentData?.amount)}</p>
                      </li>
                      <li>
                        <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color">Transaction ID:</p>
                        <p className="fs-12 fw-500 mb-0 text-1-color margin-left-12">{paymentData?.gatewayPaymentId || paymentData?.transactionId || paymentData?.transaction_id || 'N/A'}</p>
                      </li>
                      <li>
                        <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color">Order No.:</p>
                        <p className="fs-12 fw-500 mb-0 text-1-color margin-left-12">#{paymentData?.paymentNumber || paymentData?.orderNumber || paymentData?.id || 'N/A'}</p>
                      </li>
                      <li>
                        <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-2-color">Date & Time of Payment:</p>
                        <p className="fs-12 fw-500 mb-0 text-1-color margin-left-12">
                          {paymentData?.paidAt || paymentData?.paid_at ? formatDateTime(paymentData?.paidAt || paymentData?.paid_at) : formatDateTime(new Date())}
                        </p>
                      </li>
                    </ul>
                  </div>
                  <div className="select-date-container">
                    <div className="rowCenter">
                      <img src={Icons.calendarDark} alt="Info Icon" className="icon-24 margin-right-10" />
                      <span className="fs-16 fw-500 heading-color">Select Preferred Date for Assessment </span>
                    </div>
                    <div className="d-flex gap-3">
                      <AppButton variant="primary" title={'Pick Date'} onClick={handlePickDate} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ScheduleAssessmentModal
        open={showAssessmentModal}
        onClose={handleCloseAssessmentModal}
        applicationRef={paymentData?.application?.applicationNumber || paymentData?.applicationNumber || paymentData?.reference_number || 'N/A'}
        enterpriseName={paymentData?.application?.enterpriseName || 'N/A'}
        assessmentType={getAssessmentTypeLabel(assessmentSector)}
        selectedDate={assessmentDate}
        onDateChange={handleAssessmentDateChange}
        onConfirm={handleConfirmAssessmentDate}
        isLoading={isSubmitting}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={showSubmitModal}
        image={Icons.successCircle}
        header={'Your Preference has been saved'}
        subHeader={'Your preference for the assessment date has been submitted.'}
        singleButton={true}
        buttonClassName={'w-100 primary medium'}
        buttonOnClick={handleCloseSubmitModal}
        singleButtonLabel={'Continue'}
      />
    </Layout>
  );
};

export default PaymentSuccessful;
