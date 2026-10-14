import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import OverviewManufacturingTab from '../../../../../components/applicationTab/OverviewManufacturingTab';
import OverviewServiceTab from '../../../../../components/applicationTab/OverviewServiceTab';
import { AppBadge, AppButton, AppModal, FullScreenLoader, RenewalTag } from '../../../../../components/base';
import AppIconButton from '../../../../../components/base/AppIconButton';
import { Layout } from '../../../../../components/layout';
import { ApplicationStoresModal, CustomerDetailModal, KeyRawMaterialModal } from '../../../../../components/modals';
import ProductDetailModal from '../../../../../components/modals/ProductDetailModal';
import Icons from '../../../../../constants/Icons';
import { getAssessmentByIdAction } from '../../../../../redux/action/common/AssessmentAction';
import { downloadFile } from '../../../../../utils/FileUtils';
import { formatDate, formatDisplayValue } from '../../../../../utils/formatters';

const AllocationPendingDetails = () => {
  const { id: assessmentId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Redux state - get assessment data
  const { assessment, assessmentLoading } = useSelector(state => state.Assessment);

  // Local state
  const [modalOpen, setModalOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [keyRawMaterialModalOpen, setKeyRawMaterialModalOpen] = useState(false);
  const [selectedKeyRawMaterial, setSelectedKeyRawMaterial] = useState(null);
  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  // Fetch assessment data on mount
  useEffect(() => {
    if (assessmentId) {
      dispatch(getAssessmentByIdAction(assessmentId));
    }
  }, [assessmentId, dispatch]);

  const _handleOpenApplicationStoresModal = () => {
    setShowApplicationStoresModal(true);
  };
  const handleCloseApplicationStoresModal = () => {
    setShowApplicationStoresModal(false);
  };
  // Get assessment and application details
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const applicationDetails = assessmentData?.application || {};

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleCloseCustomerModal = () => {
    setCustomerModalOpen(false);
    setSelectedCustomer(null);
  };

  const handleCloseKeyRawMaterialModal = () => {
    setKeyRawMaterialModalOpen(false);
    setSelectedKeyRawMaterial(null);
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
  };

  return (
    <Layout
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <AppIconButton
                icon={Icons.back}
                label="Go back"
                onClick={() => {
                  navigate(-1);
                }}
              />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Assessment Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">View Assessments</li>
                <div className="dot-separator" />
                <li>Allocation Pending</li>
                <div className="dot-separator" />
                <li>Assessment Details</li>
              </ul>
              <div className="margin-left-30">
                <AppBadge label="Allocation Pending" variant="yellow" />
              </div>
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
                <div className="details-card">
                  <div className="top-details-card">
                    <div className="top-details-card-content">
                      <div className="top-right-details-card">
                        <span className="fs-14 fw-500 text-2-color">{applicationDetails?.applicationNumber}</span>
                        <div className="d-flex align-items-start gap-2 mt-1">
                          <p className="fs-22 fw-600 mb-0 text-3-color flex-shrink-0 unit-name-label">Unit Name:</p>
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
                      <img src={Icons.documentText} alt="" className="icon-24" />
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
                      <img src={Icons.documentText} alt="" className="icon-24" />
                      <div>
                        <div className="d-flex align-items-center">
                          <p className="fs-12 fw-500 mb-0 text-3-color">DRDO / DRDO Lab Registration Number</p>
                          {applicationDetails?.drdoRegistrationNumber && <img alt="Verified" src={Icons.greenTick} className="icon-15 margin-left-4" />}
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

                <div className="overview-tab">
                  {applicationDetails?.sector === 'service' ? <OverviewServiceTab applicationDetails={applicationDetails} /> : <OverviewManufacturingTab applicationDetails={applicationDetails} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ProductDetailModal open={modalOpen} onClose={handleCloseModal} product={selectedProduct} />
      <CustomerDetailModal open={customerModalOpen} onClose={handleCloseCustomerModal} customer={selectedCustomer} />
      <KeyRawMaterialModal open={keyRawMaterialModalOpen} onClose={handleCloseKeyRawMaterialModal} product={selectedKeyRawMaterial} />
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
      <ApplicationStoresModal
        open={showApplicationStoresModal}
        onClose={handleCloseApplicationStoresModal}
        type={applicationDetails?.sector === 'service' ? 'Services' : 'Stores'}
        stores={applicationDetails?.sector === 'service' ? applicationDetails?.svcDrdoVendorLabs : applicationDetails?.mfgDrdoVendorStores}
      />
    </Layout>
  );
};

export default AllocationPendingDetails;
