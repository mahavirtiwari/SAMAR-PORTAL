import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import OverviewManufacturingTab from '../../../../../../components/applicationTab/OverviewManufacturingTab';
import OverviewServiceTab from '../../../../../../components/applicationTab/OverviewServiceTab';
import AssessmentScoreSummary from '../../../../../../components/assessment/AssessmentScoreSummary';
import { AppBadge, AppButton, AppModal, FullScreenLoader, RenewalTag } from '../../../../../../components/base';
import { Layout } from '../../../../../../components/layout';
import { ApplicationStoresModal } from '../../../../../../components/modals';
import ProductDetailModal from '../../../../../../components/modals/ProductDetailModal';
import Icons from '../../../../../../constants/Icons';
import { getAssessmentByIdAction, qcDecisionAction } from '../../../../../../redux/action/common/AssessmentAction';
import { clearPendingQc } from '../../../../../../redux/slices/common/AssessmentSlice';
import { downloadFile } from '../../../../../../utils/FileUtils';
import { formatDate, formatDisplayValue } from '../../../../../../utils/formatters';
import { Logger } from '../../../../../../utils/logger';
import { hasAnyRole } from '../../../../../../utils/roleUtils';
import AttendanceTab from './AttendanceTab';
import AssessmentTab from './assessment/AssessmentTab';
import ScheduleTab from './ScheduleTab';

const AssessmentDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const { assessment, qcDecisionLoading, assessmentLoading } = useSelector(state => state.Assessment);
  const { pendingQcActions } = useSelector(state => state.Assessment);
  const { user } = useSelector(state => state.Account);
  const hasPendingSendBack = Array.isArray(pendingQcActions) && pendingQcActions.some(p => String(p.assessmentId) === String(id) && p.type === 'markSendBack');
  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  const [showRequestClarificationModal, setShowRequestClarificationModal] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(getAssessmentByIdAction(id));
    }
  }, [dispatch, id]);
  const handleCloseApplicationStoresModal = () => {
    setShowApplicationStoresModal(false);
  };
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const applicationDetails = assessmentData?.application;
  const [modalOpen, setModalOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Modal handlers

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
    setShowRequestClarificationModal(false);
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
    setShowRequestClarificationModal(false);
  };

  const handleApprove = async () => {
    if (!hasAnyRole(user, ['operations_manager'])) {
      Logger.error('Unauthorized: user does not have operations_manager role');
      return;
    }
    try {
      // Include any pending per-question QC feedback collected earlier
      const payload = { action: 'approve_for_committee' };

      await dispatch(qcDecisionAction({ assessmentId: id, data: payload })).unwrap();
      // Clear pending items for this assessment
      dispatch(clearPendingQc(id));
      handleCloseSubmitModal();
      navigate('/quality-check');
    } catch (error) {
      Logger.error('QC Approve failed:', error);
    }
  };

  const handleSendBack = async () => {
    if (!hasAnyRole(user, ['operations_manager'])) {
      Logger.error('Unauthorized: user does not have operations_manager role');
      return;
    }
    try {
      const qcFeedback = (pendingQcActions || [])
        .filter(p => String(p.assessmentId) === String(id) && p.type === 'markSendBack' && p.comment && String(p.comment).trim() !== '')
        .map(p => ({ questionId: p.questionId ?? null, comment: p.comment ?? null }));

      // If there are no valid comments for send back, abort and do not call the QC decision API
      if (qcFeedback.length === 0) {
        Logger.info('No send-back comments found; aborting send back.');
        return;
      }

      const payload = { action: 'provide_feedback', feedback: qcFeedback };

      await dispatch(qcDecisionAction({ assessmentId: id, data: payload })).unwrap();
      dispatch(clearPendingQc(id));
      handleCloseSubmitModal();
      navigate('/quality-check');
    } catch (error) {
      Logger.error('QC Send Back failed:', error);
    }
  };

  return (
    <Layout
      isSubHeader
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Assessment Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Manage Assessments</li>
                <div className="dot-separator" />
                <li>Quality Check</li>
                <div className="dot-separator" />
                <li>Assessment Details</li>
              </ul>
              <AppBadge variant="purple" label="Quality Check" className="margin-left-30" />
            </div>
          </div>
        </div>
      }>
      {assessmentLoading ? (
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
                          <div className="d-flex justify-content-between">
                            <div className="flex-grow-1 min-w-0">
                              <span className="fs-14 fw-500 text-2-color">{applicationDetails?.applicationNumber}</span>
                              <div className="d-flex align-items-start mt-1">
                                <p className="fs-22 fw-600 mb-0 text-3-color flex-shrink-0 me-2 unit-name-label">Unit Name:</p>
                                <h4 className="fs-24 fw-600 heading-color mb-0 unit-name-value">{applicationDetails?.unitName}</h4>
                              </div>
                              <RenewalTag application={applicationDetails} />
                              <ul className="d-flex align-items-center list-unstyled mb-0">
                                <li className="fs-14 fw-500 text-2-color text-capitalize">
                                  {applicationDetails?.enterpriseClassification === 'startup' ? 'Start-Up' : applicationDetails?.enterpriseClassification}
                                </li>
                                <li className="company-Tags-bullet"></li>
                                <li className="fs-14 fw-500 text-2-color text-capitalize">{applicationDetails?.sector}</li>
                              </ul>
                            </div>
                            <div className="d-flex flex-column align-items-end flex-shrink-0 ms-4">
                              <div className="d-flex gap-8">
                                <AppButton variant="success" size="small" title="Approve" minWidth={110} onClick={() => setShowSubmitModal(true)} disabled={qcDecisionLoading || hasPendingSendBack} />
                                <AppButton
                                  variant="danger-primary"
                                  size="small"
                                  title="Send Back"
                                  minWidth={110}
                                  onClick={() => setShowRequestClarificationModal(true)}
                                  disabled={qcDecisionLoading || !hasPendingSendBack}
                                />
                              </div>
                              <AssessmentScoreSummary assessmentData={assessmentData} className="margin-top-20" />
                            </div>
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
                        <img src={Icons.documentText} alt="documnet" className="icon-24" />
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
                            <p className="fs-12 fw-500 mb-1 text-3-color">Incorporation Number </p>
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
                        <img src={Icons.documentText} alt="documnet" className="icon-24" />
                        <div>
                          <div className="d-flex align-items-center">
                            <p className="fs-12 fw-500 mb-0 text-3-color">DRDO / DRDO Lab Registration Number</p>
                            {applicationDetails?.drdoRegistrationNumber && <img src={Icons.greenTick} className="icon-15 margin-left-4" />}
                          </div>
                          <div className="d-flex align-items-end">
                            <p className="fs-14 fw-500 mb-0 heading-color">{applicationDetails?.drdoRegistrationNumber ? applicationDetails?.drdoRegistrationNumber : '-'}</p>

                            {applicationDetails?.drdoCertificateFileUrl && (
                              <AppButton size="small" variant="link" title={'View'} onClick={() => downloadFile({ downloadUrl: applicationDetails?.drdoCertificateFileUrl })} />
                            )}
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
                  </div>
                  <div className="card-bottom-tabs">
                    <div className="card-tabs-link">
                      <span className={activeTab === 'overview' ? 'active cursor-pointer' : 'cursor-pointer'} onClick={() => setActiveTab('overview')}>
                        Overview
                      </span>
                      <span className={activeTab === 'schedule' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'} onClick={() => setActiveTab('schedule')}>
                        Schedule
                      </span>
                      <span className={activeTab === 'assessment' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'} onClick={() => setActiveTab('assessment')}>
                        Assessment
                      </span>
                      <span className={activeTab === 'checkin/checkout' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'} onClick={() => setActiveTab('checkin/checkout')}>
                        Attendance
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-bottom-tabs-content">
                  {activeTab === 'overview' && (
                    <div className="overview-tab">
                      {applicationDetails?.sector === 'service' ? <OverviewServiceTab applicationDetails={applicationDetails} /> : <OverviewManufacturingTab applicationDetails={applicationDetails} />}
                    </div>
                  )}
                  {activeTab === 'schedule' && (
                    <div className="payment-tab">
                      <ScheduleTab assessment={assessmentData} disabledJoinBtn={true} />
                    </div>
                  )}
                  {activeTab === 'assessment' && (
                    <div className="payment-tab">
                      <AssessmentTab assessment={assessmentData} />
                    </div>
                  )}
                  {activeTab === 'checkin/checkout' && (
                    <div className="payment-tab">
                      <AttendanceTab assessment={assessmentData} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ProductDetailModal open={modalOpen} onClose={handleCloseModal} product={selectedProduct} />

      <ApplicationStoresModal
        open={showApplicationStoresModal}
        onClose={handleCloseApplicationStoresModal}
        type={applicationDetails?.sector === 'service' ? 'Services' : 'Stores'}
        stores={applicationDetails?.sector === 'service' ? applicationDetails?.svcDrdoVendorLabs : applicationDetails?.mfgDrdoVendorStores}
      />

      {/* Approve Modal */}
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showSubmitModal}
        handleClose={handleCloseSubmitModal}
        header="Confirm Quality Check Approval?"
        subHeader="The application will move forward to the next stage."
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={handleCloseSubmitModal}
        rightButton="Approve"
        rightButtonClassName="w-100 btn-primary"
        rightButtonOnClick={handleApprove}
        rightButtonLoading={qcDecisionLoading}
        rightButtonDisabled={qcDecisionLoading}
      />

      {/* Send Back Modal */}
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.redConfirmIcon}
        show={showRequestClarificationModal}
        handleClose={handleCloseSubmitModal}
        header="Send Back for Clarification?"
        subHeader="Please provide a reason for sending this assessment back to the assessor."
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={handleCloseSubmitModal}
        paperSx={{
          width: { xs: '100%', sm: '90%', md: '800px', lg: '500px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
        rightButton="Send Back"
        rightButtonClassName="w-100 danger-primary"
        rightButtonOnClick={handleSendBack}
        rightButtonLoading={qcDecisionLoading}
        rightButtonDisabled={qcDecisionLoading}></AppModal>
    </Layout>
  );
};

export default AssessmentDetails;
