import { Link } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import OverviewManufacturingTab from '../../../../../components/applicationTab/OverviewManufacturingTab';
import OverviewServiceTab from '../../../../../components/applicationTab/OverviewServiceTab';
import { AppBadge, AppButton, AppStatusSteps, FullScreenLoader, RenewalTag } from '../../../../../components/base';
import { defaultStatusSteps } from '../../../../../components/base/AppStatusSteps';
import { Layout } from '../../../../../components/layout';
import ApplicationStoresModal from '../../../../../components/modals/ApplicationStoresModal';
import AppModal from '../../../../../components/modals/AppModal';
import PaymentDisclaimerModal from '../../../../../components/modals/PaymentDisclaimerModal';
import ScheduleAssessmentModal from '../../../../../components/modals/ScheduleAssessmentModal';
import { getAssessmentTypeLabel, RENEWAL_HIDDEN_ASSESSMENT_STATUSES } from '../../../../../constants/assessmentStatus';
import Icons from '../../../../../constants/Icons';
import { getApplicationDetailsAction, getAssessmentSummaryAction, setPreferredAssessmentDateAction } from '../../../../../redux/action/enterpriseAdmin/application/ApplicationAction';
import { isRenewalApplication } from '../../../../../utils/applicationUtils';
import { downloadFile } from '../../../../../utils/FileUtils';
import { formatDate, formatDisplayValue } from '../../../../../utils/formatters';
import { getBadgeVariantByLabel } from '../../../../../utils/getStatusColors';
import BasicInfoTab from './BasicInfoTab';
import EvidencesTab from './EvidencesTab';
import PaymentTab from './PaymentTab';
import SiteTourTab from './SiteTourTab';

const status = {
  drdo_approval_pending: 'DRDO Approval Pending',
  payment_pending: 'Payment Pending',
  payment_completed: 'Payment Completed',
  in_progress: 'In Progress',
  certified: 'Certified',
  rejected: 'Rejected',
};
const ApplicationDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentDate, setAssessmentDate] = useState(null);
  const [showPaymentDisclaimerModal, setShowPaymentDisclaimerModal] = useState(false);
  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  const { applicationDetails, applicationDetailsLoading, assessmentSummary, assessmentSummaryLoading } = useSelector(state => state.EnterpriseAdminApplication);

  // Filter steps based on DRDO approval setting captured at application submission time
  // This ensures the stepper shows correctly even if the system setting changes later
  const statusSteps = applicationDetails?.isDrdoApprovalRequired ? defaultStatusSteps : defaultStatusSteps.filter(step => step.key !== 'drdo_approval_pending');

  // Renewal applications hide the Assessment section while the assessment is in a pre-execution / review status.
  const showAssessmentSection =
    Boolean(applicationDetails?.assessment) && !(isRenewalApplication(applicationDetails) && RENEWAL_HIDDEN_ASSESSMENT_STATUSES.includes(applicationDetails?.assessment?.status));

  const params = useParams();

  useEffect(() => {
    dispatch(getApplicationDetailsAction(params.id));
  }, [params.id, dispatch]);

  useEffect(() => {
    if (showAssessmentSection) {
      dispatch(getAssessmentSummaryAction(params.id));
    }
  }, [showAssessmentSection, params.id, dispatch]);

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
  };

  // Modal handlers
  const handleOpenAssessmentModal = () => {
    // Prefill assessmentDate from API (preferredAssessmentDate) when opening modal
    const pref = applicationDetails?.preferredAssessmentDate;
    setAssessmentDate(pref ? new Date(pref) : null);
    setShowAssessmentModal(true);
  };
  const handleCloseAssessmentModal = () => setShowAssessmentModal(false);
  const handleAssessmentDateChange = date => setAssessmentDate(date);
  const handleConfirmAssessmentDate = () => {
    setShowAssessmentModal(false);
    if (assessmentDate) {
      dispatch(setPreferredAssessmentDateAction({ applicationId: params.id, preferredAssessmentDate: assessmentDate }));
    }
  };

  // Payment disclaimer modal handlers
  const handleMakePaymentClick = () => {
    setShowPaymentDisclaimerModal(true);
  };

  const handleClosePaymentDisclaimerModal = () => {
    setShowPaymentDisclaimerModal(false);
  };
  const handlePaymentDisclaimerAccept = () => {
    setShowPaymentDisclaimerModal(false);
    // Navigate to make payment screen with application data
    // Fee calculation is done dynamically in MakePayment using fee_configurations API
    navigate('/make-payment', {
      state: {
        applicationId: params.id,
        applicationData: {
          id: params.id,
          referenceNumber: applicationDetails?.applicationNumber,
          applicationNumber: applicationDetails?.applicationNumber,
          enterpriseName: applicationDetails?.enterpriseName,
          unitName: applicationDetails?.unitName,
          organizationName: applicationDetails?.organizationName,
          // Sector and enterprise classification for fee lookup
          sector: applicationDetails?.sector,
          enterpriseClassification: applicationDetails?.enterpriseClassification,
          // Address and contact info
          address: applicationDetails?.registeredOfficeAddress,
          contactNumber: applicationDetails?.registeredOfficeMobile,
          // GST information for payment flow
          gstNumber: applicationDetails?.gstNumber,
        },
      },
    });
  };
  // Edit Contact Person modal handlers

  // Application Stores modal handlers
  const handleOpenApplicationStoresModal = () => {
    setShowApplicationStoresModal(true);
  };

  const handleCloseApplicationStoresModal = () => {
    setShowApplicationStoresModal(false);
  };
  // resolve process names using master v1 and fallback getKeyProcesses

  return (
    <Layout
      isSubHeader
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Application Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">My Applications</li>
                <div className="dot-separator" />
                <li>Application Details</li>
              </ul>
              <AppBadge
                variant={getBadgeVariantByLabel(status[applicationDetails?.status])}
                label={applicationDetails?.applicantStatusLabel ?? status[applicationDetails?.status]}
                className="margin-left-30"
              />
              <RenewalTag application={applicationDetails} className="margin-left-10" />
            </div>
          </div>
        </div>
      }>
      {applicationDetailsLoading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '500px' }}>
          <FullScreenLoader loading={true} />
        </div>
      ) : (
        <div className="main-content-inner">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="details-card-with-tabs">
                  <div className="details-card">
                    <div className="top-details-card">
                      <div className="top-details-card-content">
                        <div className="top-right-details-card">
                          <div className="d-flex flex-row justify-content-between">
                            <div className="flex-grow-1 min-w-0">
                              <span className="fs-14 fw-500 text-2-color">{applicationDetails?.applicationNumber}</span>
                              {/* {applicationDetails?.previousApplicationId && (
                                <div className="fs-12 fw-500 text-3-color mt-1">
                                  Renewed from{' '}
                                  <Link component="button" type="button" underline="hover" onClick={() => navigate(`/my-application/application-details/${applicationDetails.previousApplicationId}`)}>
                                    {applicationDetails?.previousApplicationNumber || 'previous application'}
                                  </Link>
                                </div>
                              )} */}
                              <div className="d-flex align-items-start mt-1">
                                <p className="fs-22 fw-600 mb-0 text-3-color flex-shrink-0 me-2 unit-name-label">Unit Name:</p>
                                <h4 className="fs-24 fw-600 heading-color mb-0 unit-name-value">{applicationDetails?.unitName}</h4>
                              </div>
                              <ul className="d-flex align-items-center list-unstyled mb-0">
                                <li className="fs-14 fw-500 text-2-color text-capitalize">
                                  {applicationDetails?.enterpriseClassification === 'startup' ? 'Start-Up' : applicationDetails?.enterpriseClassification}
                                </li>
                                <li className="company-Tags-bullet"></li>
                                <li className="fs-14 fw-500 text-2-color text-capitalize">{applicationDetails?.sector}</li>
                              </ul>
                            </div>
                            {applicationDetails?.status === 'payment_pending' && (
                              <div className="flex-shrink-0 ms-4">
                                <AppButton variant="primary" title={'Make Payment'} rightIconStyle={'icon-16'} onClick={handleMakePaymentClick} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center margin-top-16">
                      <img src={Icons.enterpriseInfoDone} alt="enterprise" className="icon-24 margin-right-8" />
                      <div className="d-flex align-items-center gap-2">
                        <p className="fs-12 fw-500 mb-0 text-3-color">Enterprise Name:</p>
                        <p className="fs-14 fw-500 mb-0 heading-color">{applicationDetails?.organizationName}</p>
                      </div>
                    </div>
                    <div className="bottom-details-card">
                      <div className="each-details-box">
                        <img src={Icons.documentText} alt="document" className="icon-24" />
                        {applicationDetails?.enterpriseClassification === 'startup' && (
                          <div>
                            <p className="fs-12 fw-500 mb-1 text-3-color">DPIIT Registration Number</p>
                            <div className="d-flex align-items-end">
                              <p className="fs-14 fw-500 mb-0 heading-color">{formatDisplayValue(applicationDetails?.dpiitRegistrationNumber)}</p>
                              {applicationDetails?.dpiitCertificateFileUrl && (
                                <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile({ downloadUrl: applicationDetails?.dpiitCertificateFileUrl })} />
                              )}
                            </div>
                          </div>
                        )}
                        {applicationDetails?.enterpriseClassification === 'large' && (
                          <div>
                            <p className="fs-12 fw-500 mb-1 text-3-color">Incorporation Number</p>
                            <div className="d-flex align-items-end">
                              <p className="fs-14 fw-500 mb-0 heading-color">{applicationDetails?.cin}</p>
                              {applicationDetails?.incorporationCertificateFileUrl && (
                                <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile({ downloadUrl: applicationDetails?.incorporationCertificateFileUrl })} />
                              )}
                            </div>
                          </div>
                        )}
                        {/* Show UDYAM registration for micro / small / medium */}
                        {['micro', 'small', 'medium'].includes(applicationDetails?.enterpriseClassification) && (
                          <div>
                            <p className="fs-12 fw-500 mb-1 text-3-color">UDYAM Registration Number</p>
                            <div className="d-flex align-items-end">
                              <p className="fs-14 fw-500 mb-0 heading-color">{formatDisplayValue(applicationDetails?.udyamRegistrationNumber)}</p>
                              {applicationDetails?.udyamCertificateFileUrl && (
                                <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile({ downloadUrl: applicationDetails?.udyamCertificateFileUrl })} />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="vertical-divider" />
                      <div className="each-details-box">
                        <img src={Icons.documentText} alt="document" className="icon-24" />
                        <div>
                          <div className="d-flex align-items-center">
                            <p className="fs-12 fw-500 mb-0 text-3-color">DRDO / DRDO Lab Registration Number</p>
                            {applicationDetails?.drdoRegistrationNumber && <img src={Icons.greenTick} alt="verified" className="icon-15 margin-left-4" />}
                          </div>
                          <div className="d-flex align-items-end">
                            <p className="fs-14 fw-500 mb-0 heading-color">{applicationDetails?.drdoRegistrationNumber ? applicationDetails?.drdoRegistrationNumber : '-'}</p>
                            {applicationDetails?.drdoCertificateFileUrl && (
                              <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile({ downloadUrl: applicationDetails?.drdoCertificateFileUrl })} />
                            )}
                          </div>
                          <div className="d-flex align-items-center margin-top-2">
                            <p className="fs-12 fw-500 text-3-color mb-0">{applicationDetails?.sector === 'service' ? 'Services:' : 'Stores:'}</p>
                            <AppButton size="small" variant="link" title={'View'} onClick={handleOpenApplicationStoresModal} />
                          </div>
                        </div>
                      </div>
                      <div className="vertical-divider" />
                      <div className="each-details-box">
                        <img src={Icons.calendarBlue} alt="calendar" className="icon-24 margin-top-6" />
                        <div>
                          <p className="fs-12 fw-500 text-3-color mb-0">Commencement Date of Unit</p>
                          <div className="d-flex align-items-center">
                            <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">{formatDate(applicationDetails?.unitCommencementDate)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="vertical-divider" />
                      <div className="each-details-box">
                        <img src={Icons.calendarBlue} alt="calendar" className="icon-24 margin-top-6" />
                        <div>
                          <p className="fs-12 fw-500 mb-0 text-3-color">Application Date</p>
                          <div className="d-flex align-items-center">
                            <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">{formatDate(applicationDetails?.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <hr className="divider-small" />
                    <div className="bottom-details-card">
                      <AppStatusSteps
                        steps={statusSteps}
                        stepStatesMap={{
                          submitted: 'success',
                          drdo_approval_pending: applicationDetails?.status === 'drdo_approval_pending' ? 'active' : applicationDetails?.drdoApprovedAt ? 'success' : 'disabled',
                          payment: ['payment_completed', 'in_progress', 'certified'].includes(applicationDetails?.status)
                            ? 'success'
                            : applicationDetails?.status === 'payment_pending'
                              ? 'active'
                              : 'disabled',
                          inProgress: ['in_progress', 'certified'].includes(applicationDetails?.status) ? 'success' : 'disabled',
                          certified: applicationDetails?.status === 'certified' ? 'success' : 'disabled',
                        }}
                        stepDatesMap={{
                          submitted: applicationDetails?.submittedAt ? formatDate(applicationDetails?.submittedAt) : formatDate(applicationDetails?.createdAt),
                          drdo_approval_pending: applicationDetails?.drdoApprovedAt ? formatDate(applicationDetails?.drdoApprovedAt) : null,
                          payment: applicationDetails?.paymentCompletedAt ? formatDate(applicationDetails?.paymentCompletedAt) : null,
                          inProgress: applicationDetails?.allocatedAt ? formatDate(applicationDetails?.allocatedAt) : null,
                          certified: applicationDetails?.certifiedAt ? formatDate(applicationDetails?.certifiedAt) : null,
                        }}
                      />
                    </div>
                  </div>
                  <div className="card-bottom-tabs">
                    <div className="card-tabs-link">
                      <span className={activeTab === 'overview' ? 'active cursor-pointer' : 'cursor-pointer'} onClick={() => setActiveTab('overview')}>
                        Overview
                      </span>
                      {['payment_completed', 'in_progress', 'certified'].includes(applicationDetails?.status) && (
                        <span className={activeTab === 'payment' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'} onClick={() => setActiveTab('payment')}>
                          Payment
                        </span>
                      )}
                      {showAssessmentSection && (
                        <>
                          <span className={activeTab === 'basicInfo' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'} onClick={() => setActiveTab('basicInfo')}>
                            Basic Information
                          </span>
                          <span className={activeTab === 'siteTour' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'} onClick={() => setActiveTab('siteTour')}>
                            Site Tour
                          </span>
                          <span className={activeTab === 'evidences' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'} onClick={() => setActiveTab('evidences')}>
                            Evidences
                          </span>
                        </>
                      )}
                    </div>
                    {applicationDetails?.status === 'payment_completed' && (
                      <div className="assessment-date">
                        <span className="fs-12 fw-500 text-2-color">
                          <Image src={Icons.calendarBlue} className="icon-20 pick-date" /> Preferred Assessment Date:
                          {dayjs(applicationDetails?.preferredAssessmentDate).isValid() || (assessmentDate && dayjs(assessmentDate).isValid()) ? (
                            <span className="heading-color">
                              {dayjs(applicationDetails?.preferredAssessmentDate).isValid() ? formatDate(applicationDetails.preferredAssessmentDate) : formatDate(assessmentDate)}
                            </span>
                          ) : (
                            <Link to={''} className="cusLink" onClick={handleOpenAssessmentModal}>
                              Pick Date
                            </Link>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-bottom-tabs-content">
                  {activeTab === 'overview' && (
                    <div className="overview-tab">
                      {applicationDetails?.sector === 'service' ? (
                        <OverviewServiceTab applicationDetails={applicationDetails} edit={true} />
                      ) : (
                        <OverviewManufacturingTab applicationDetails={applicationDetails} edit={true} />
                      )}
                    </div>
                  )}
                  {activeTab === 'payment' && (
                    <div className="payment-tab">
                      <PaymentTab
                        paymentData={
                          // Find successful payment first, fallback to most recent payment
                          applicationDetails?.payments?.find(p => p.status === 'success') || applicationDetails?.payments?.[0]
                        }
                        applicationData={applicationDetails}
                      />
                    </div>
                  )}
                  {showAssessmentSection && activeTab === 'basicInfo' && (
                    <div className="basic-info-tab">
                      <BasicInfoTab basicInformation={assessmentSummary?.basicInformation} sector={applicationDetails?.sector} loading={assessmentSummaryLoading} />
                    </div>
                  )}
                  {showAssessmentSection && activeTab === 'siteTour' && (
                    <div className="site-tour-tab">
                      <SiteTourTab siteTour={assessmentSummary?.siteTour} loading={assessmentSummaryLoading} />
                    </div>
                  )}
                  {showAssessmentSection && activeTab === 'evidences' && (
                    <div className="evidences-tab">
                      <EvidencesTab evidences={assessmentSummary?.evidences} loading={assessmentSummaryLoading} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showSubmitModal}
        handleClose={handleCloseSubmitModal}
        header={'Submit Application?'}
        subHeader={'Once submitted, you will not be able to make changes.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseSubmitModal}
        rightButton={'Submit'}
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonOnClick={() => {
          handleCloseSubmitModal();
        }}
      />
      <ScheduleAssessmentModal
        open={showAssessmentModal}
        onClose={handleCloseAssessmentModal}
        applicationRef={applicationDetails?.applicationNumber}
        enterpriseName={applicationDetails?.enterpriseName}
        assessmentType={getAssessmentTypeLabel(applicationDetails?.sector)}
        selectedDate={assessmentDate}
        onDateChange={handleAssessmentDateChange}
        onConfirm={handleConfirmAssessmentDate}
      />
      <PaymentDisclaimerModal open={showPaymentDisclaimerModal} handleClose={handleClosePaymentDisclaimerModal} onAccept={handlePaymentDisclaimerAccept} />
      <ApplicationStoresModal
        open={showApplicationStoresModal}
        onClose={handleCloseApplicationStoresModal}
        type={applicationDetails?.sector === 'service' ? 'Services' : 'Stores'}
        stores={applicationDetails?.sector === 'service' ? applicationDetails?.svcDrdoVendorLabs : applicationDetails?.mfgDrdoVendorStores}
      />
    </Layout>
  );
};

export default ApplicationDetails;
