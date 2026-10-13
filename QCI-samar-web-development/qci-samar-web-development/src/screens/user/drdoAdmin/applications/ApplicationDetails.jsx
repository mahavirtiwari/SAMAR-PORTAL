import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import OverviewManufacturingTab from '../../../../components/applicationTab/OverviewManufacturingTab';
import OverviewServiceTab from '../../../../components/applicationTab/OverviewServiceTab';
import { AppBadge, AppButton, AppStatusSteps, FullScreenLoader } from '../../../../components/base';
import { defaultStatusSteps } from '../../../../components/base/AppStatusSteps';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { ApplicationStoresModal } from '../../../../components/modals';
import AppModal from '../../../../components/modals/AppModal';
import ProductDetailModal from '../../../../components/modals/ProductDetailModal';
import Icons from '../../../../constants/Icons';
import { executeWorkflowTransitionAction, getApplicationDetailsAction } from '../../../../redux/action/drdoAdmin/application/ApplicationAction';
import { downloadFile } from '../../../../utils/FileUtils';
import { formatDate, formatDisplayValue } from '../../../../utils/formatters';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const ApplicationDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const params = useParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveRemarks, setApproveRemarks] = useState('');
  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  const [_apiError, setApiError] = useState('');
  const { applicationDetails, applicationDetailsLoading, executeWorkflowTransitionLoading } = useSelector(state => state.DrdoAdminApplication);

  // Filter steps based on DRDO approval setting captured at application submission time
  // This ensures the stepper shows correctly even if the system setting changes later
  const statusSteps = applicationDetails?.isDrdoApprovalRequired ? defaultStatusSteps : defaultStatusSteps.filter(step => step.key !== 'drdo_approval_pending');

  useEffect(() => {
    if (params.id) {
      dispatch(getApplicationDetailsAction(params.id));
    }
  }, [params.id, dispatch]);

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleOpenApplicationStoresModal = useCallback(() => {
    setShowApplicationStoresModal(true);
  }, []);

  const handleCloseApplicationStoresModal = useCallback(() => {
    setShowApplicationStoresModal(false);
  }, []);

  const handleApprove = async () => {
    try {
      await dispatch(
        executeWorkflowTransitionAction({
          applicationId: params.id,
          transitionData: {
            action: 'drdo_approve',
            remarks: approveRemarks,
          },
        }),
      ).unwrap();
      setShowApproveModal(false);
      setApproveRemarks('');
      navigate(-1);
    } catch (error) {
      Logger.error('Error approving application:', error);
      const errorMessage = error?.message || error?.error || 'Failed to approve application. Please try again.';
      setApiError(errorMessage);
      toastError(errorMessage);
    }
  };

  const handleReject = async () => {
    try {
      await dispatch(
        executeWorkflowTransitionAction({
          applicationId: params.id,
          transitionData: {
            action: 'drdo_reject',
            reason: rejectReason,
          },
        }),
      ).unwrap();
      setShowRejectModal(false);
      setRejectReason('');
      navigate(-1);
    } catch (error) {
      Logger.error('Error rejecting application:', error);
      const errorMessage = error?.message || error?.error || 'Failed to reject application. Please try again.';
      setApiError(errorMessage);
      toastError(errorMessage);
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
              <h1 className="heading-createApp">Application Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Applications</li>
                <div className="dot-separator" />
                <li>Application Details</li>
              </ul>
              <AppBadge variant={getBadgeVariantByLabel(applicationDetails?.status) || 'yellow'} label={applicationDetails?.statusLabel || 'DRDO Approval Pending'} className="margin-left-30" />
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
                            <div>
                              <span className="fs-14 fw-500 text-2-color">{applicationDetails?.applicationNumber}</span>
                              {/* {applicationDetails?.previousApplicationId && (
                                <div className="fs-12 fw-500 text-3-color mt-1">
                                  Renewed from{' '}
                                  <Link component="button" type="button" underline="hover" onClick={() => navigate(`/my-application/application-details/${applicationDetails.previousApplicationId}`)}>
                                    {applicationDetails?.previousApplicationNumber || 'previous application'}
                                  </Link>
                                </div>
                              )} */}
                              <div className="d-flex align-items-start gap-2 mt-1">
                                <p className="fs-22 fw-600 mb-0 text-3-color flex-shrink-0 unit-name-label">Unit Name:</p>
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
                    </div>
                  </div>
                </div>

                <div className="card-bottom-tabs-content">
                  {activeTab === 'overview' && (
                    <div className="overview-tab">
                      {applicationDetails?.sector === 'service' ? <OverviewServiceTab applicationDetails={applicationDetails} /> : <OverviewManufacturingTab applicationDetails={applicationDetails} />}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ProductDetailModal open={modalOpen} onClose={handleCloseModal} product={selectedProduct} data={applicationDetails} />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.rejectIcon}
        show={showRejectModal}
        handleClose={() => setShowRejectModal(false)}
        header={'Reject Application?'}
        subHeader={'The applicant will be notified and the application will be closed.'}
        textAreaLabel={'Reason for Rejection'}
        textAreaPlaceholder={'Please provide a brief reason for the rejection'}
        textAreaValue={rejectReason}
        onTextAreaChange={e => setRejectReason(e.target.value)}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => setShowRejectModal(false)}
        rightButton={'Reject'}
        isRequiredTextArea
        rightButtonClassName={'w-100 danger-primary'}
        rightButtonOnClick={handleReject}
        rightButtonDisabled={executeWorkflowTransitionLoading || !rejectReason.trim()}
      />

      <ApplicationStoresModal
        open={showApplicationStoresModal}
        onClose={handleCloseApplicationStoresModal}
        type={applicationDetails?.sector === 'service' ? 'Services' : 'Stores'}
        stores={applicationDetails?.sector === 'service' ? applicationDetails?.svcDrdoVendorLabs : applicationDetails?.mfgDrdoVendorStores}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.approveIcon}
        show={showApproveModal}
        handleClose={() => setShowApproveModal(false)}
        header={'Approve Application?'}
        subHeader={'The applicant will be notified and the application will move forward.'}
        textAreaLabel={'Approval Remarks'}
        textAreaPlaceholder={'Enter Approval Remarks..'}
        textAreaValue={approveRemarks}
        onTextAreaChange={e => setApproveRemarks(e.target.value)}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => setShowApproveModal(false)}
        rightButton={'Approve'}
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonOnClick={handleApprove}
        rightButtonDisabled={executeWorkflowTransitionLoading}
      />
    </Layout>
  );
};

export default ApplicationDetails;
