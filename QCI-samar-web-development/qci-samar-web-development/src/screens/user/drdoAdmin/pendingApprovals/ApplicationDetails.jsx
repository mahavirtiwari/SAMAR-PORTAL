import { useFormik } from 'formik';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import * as Yup from 'yup';
import OverviewManufacturingTab from '../../../../components/applicationTab/OverviewManufacturingTab';
import OverviewServiceTab from '../../../../components/applicationTab/OverviewServiceTab';
import { AppBadge, AppButton, FullScreenLoader } from '../../../../components/base';
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  const [_apiError, setApiError] = useState('');
  const { applicationDetails, executeWorkflowTransitionLoading, applicationDetailsLoading } = useSelector(state => state.DrdoAdminApplication);

  const rejectFormik = useFormik({
    initialValues: {
      rejectReason: '',
    },
    validationSchema: Yup.object({
      rejectReason: Yup.string().trim().min(10, 'Reason must be at least 10 characters').max(500, 'Reason cannot exceed 500 characters').required('Reason for rejection is required'),
    }),
    onSubmit: async values => {
      try {
        await dispatch(
          executeWorkflowTransitionAction({
            applicationId: params.id,
            transitionData: {
              action: 'drdo_reject',
              reason: values.rejectReason.trim(),
            },
          }),
        ).unwrap();
        setShowRejectModal(false);
        rejectFormik.resetForm();
        navigate(-1);
      } catch (error) {
        Logger.error('Error rejecting application:', error);
        const errorMessage = error?.message || error?.error || 'Failed to reject application. Please try again.';
        setApiError(errorMessage);
        toastError(errorMessage);
      }
    },
  });

  const approveFormik = useFormik({
    initialValues: {
      approveRemarks: '',
    },
    validationSchema: Yup.object({
      approveRemarks: Yup.string()
        .trim()
        .max(500, 'Remarks cannot exceed 500 characters')
        .test('approveRemarks-min-if-present', 'Remarks must be at least 10 characters', value => {
          if (value === undefined || value === null) {
            return true;
          }
          const v = String(value || '').trim();
          if (v === '') {
            return true;
          } // allow empty (optional)
          return v.length >= 10;
        }),
    }),
    onSubmit: async values => {
      try {
        await dispatch(
          executeWorkflowTransitionAction({
            applicationId: params.id,
            transitionData: {
              action: 'drdo_approve',
              remarks: values.approveRemarks && values.approveRemarks.trim() !== '' ? values.approveRemarks.trim() : null,
            },
          }),
        ).unwrap();
        setShowApproveModal(false);
        approveFormik.resetForm();
        setShowSuccessModal(true);
      } catch (error) {
        Logger.error('Error approving application:', error);
        const errorMessage = error?.message || error?.error || 'Failed to approve application. Please try again.';
        setApiError(errorMessage);
        toastError(errorMessage);
      }
    },
  });

  useEffect(() => {
    if (params.id) {
      dispatch(getApplicationDetailsAction(params.id));
    }
  }, [params.id, dispatch]);

  const _handleViewProduct = data => {
    setSelectedProduct(data);
    setModalOpen(true);
  };

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

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigate(-1);
  };

  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        handleSuccessModalClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

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
                <li className="margin-left-30">Pending Approval</li>
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
                            <div className="d-flex flex-column align-items-end">
                              <div className="d-flex gap-8">
                                <AppButton
                                  variant="danger-secondary"
                                  size="small"
                                  title={'Reject'}
                                  customClass={'w-120'}
                                  onClick={() => setShowRejectModal(true)}
                                  disabled={executeWorkflowTransitionLoading}
                                />
                                <AppButton
                                  variant="success"
                                  size="small"
                                  title={'Approve'}
                                  customClass={'w-120'}
                                  onClick={() => setShowApproveModal(true)}
                                  disabled={executeWorkflowTransitionLoading}
                                />
                              </div>
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
        handleClose={() => {
          setShowRejectModal(false);
          rejectFormik.resetForm();
        }}
        header={'Reject Application?'}
        disableBackdropClick
        subHeader={'The applicant will be notified via email with the reason for rejection.'}
        textAreaLabel={'Reason for Rejection'}
        textAreaPlaceholder={'Provide detailed reason for rejection (required)'}
        formik={rejectFormik}
        textAreaName={'rejectReason'}
        isRequiredTextArea
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => {
          setShowRejectModal(false);
          rejectFormik.resetForm();
        }}
        rightButton={'Reject'}
        rightButtonClassName={'w-100 danger-primary'}
        rightButtonOnClick={rejectFormik.handleSubmit}
        rightButtonLoading={executeWorkflowTransitionLoading}
      />
      <ApplicationStoresModal
        open={showApplicationStoresModal}
        onClose={handleCloseApplicationStoresModal}
        stores={applicationDetails?.mfgDrdoVendorStores}
        type={applicationDetails?.sector === 'service' ? 'Services' : 'Stores'}
      />

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.approveIcon}
        show={showApproveModal}
        handleClose={() => {
          setShowApproveModal(false);
          approveFormik.resetForm();
        }}
        disableBackdropClick
        header={'Approve Application?'}
        subHeader={'This will approve the application and notify the applicant to proceed with payment.'}
        textAreaLabel={'Approval Remarks (Optional)'}
        textAreaPlaceholder={'Add any remarks or notes for this approval'}
        formik={approveFormik}
        textAreaName={'approveRemarks'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => {
          setShowApproveModal(false);
          approveFormik.resetForm();
        }}
        rightButton={'Approve'}
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonOnClick={approveFormik.handleSubmit}
        rightButtonLoading={executeWorkflowTransitionLoading}
      />

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={showSuccessModal}
        handleClose={handleSuccessModalClose}
        image={Icons.successCircle}
        header={'Application approved successfully'}
        subHeader={'The application has been approved. The vendor will be notified to proceed with payment.'}
        buttonOnClick={handleSuccessModalClose}
      />
    </Layout>
  );
};

export default ApplicationDetails;
