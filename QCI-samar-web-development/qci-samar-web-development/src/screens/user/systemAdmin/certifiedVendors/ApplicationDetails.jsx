import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import OverviewManufacturingTab from '../../../../components/applicationTab/OverviewManufacturingTab';
import OverviewServiceTab from '../../../../components/applicationTab/OverviewServiceTab';
import { AppBadge, AppButton, AppModal, FullScreenLoader } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import { ApplicationStoresModal } from '../../../../components/modals';
import ProductDetailModal from '../../../../components/modals/ProductDetailModal';
import Icons from '../../../../constants/Icons';
import { downloadAssessmentReportAction, downloadCertificateAction, getAssessmentByIdAction } from '../../../../redux/action/common/AssessmentAction';
import { downloadFile, downloadPayloadAsPdf } from '../../../../utils/FileUtils';
import { formatDate, formatDisplayValue } from '../../../../utils/formatters';
import { Logger } from '../../../../utils/logger';
import BasicInformation from './BasicInformation';
import SiteTour from './SiteTour';

const AssessmentDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const { assessment, assessmentLoading } = useSelector(state => state.Assessment);

  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  useEffect(() => {
    if (id) {
      dispatch(getAssessmentByIdAction(id));
    }
  }, [dispatch, id]);
  const handleOpenApplicationStoresModal = () => {
    setShowApplicationStoresModal(true);
  };

  const handleCloseApplicationStoresModal = () => {
    setShowApplicationStoresModal(false);
  };
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const applicationDetails = assessmentData?.application;
  const { downloadLoading, downloadReportLoading } = useSelector(state => state.Assessment);
  const [modalOpen, setModalOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('Basic Info');

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
  };
  const handleDownloadDocument = async id => {
    try {
      const result = await dispatch(downloadCertificateAction(id));

      if (result?.type && result.type.endsWith('/fulfilled')) {
        const payload = result.payload ?? result;

        const filename = `certificate_${applicationDetails?.certificateNumber || id || Date.now()}.pdf`;
        downloadPayloadAsPdf(payload, filename);
      } else {
        Logger.error('Download action did not fulfill:', result);
      }
    } catch (error) {
      Logger.error('Export failed:', error);
    }
  };
  const handleAssementReportDocument = async id => {
    try {
      const result = await dispatch(downloadAssessmentReportAction(id));

      if (result?.type && result.type.endsWith('/fulfilled')) {
        const payload = result.payload ?? result;

        const filename = `assessments_${id || Date.now()}.pdf`;
        downloadPayloadAsPdf(payload, filename);
      } else {
        Logger.error('Download action did not fulfill:', result);
      }
    } catch (error) {
      Logger.error('Export failed:', error);
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
                <li className="margin-left-30">Certified</li>
                <div className="dot-separator" />
                <li>Application Details</li>
              </ul>
              <AppBadge variant="purple" label="Certified" className="margin-left-30" />
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
                          <div className="d-flex flex-row justify-content-between">
                            <div>
                              <span className="fs-14 fw-500 text-2-color">{applicationDetails?.applicationNumber}</span>
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
                            <div>
                              <div className="d-flex justify-content-end gap-8">
                                <AppButton
                                  variant="secondary"
                                  size="small"
                                  title={'Certificate'}
                                  leftIcon={Icons.certified}
                                  loading={downloadLoading}
                                  onClick={() => handleDownloadDocument(assessmentData?.certificateNumber)}
                                />
                                <AppButton
                                  variant="secondary"
                                  size="small"
                                  title={'Assessment Report'}
                                  leftIcon={Icons.exportFile}
                                  loading={downloadReportLoading}
                                  onClick={() => handleAssementReportDocument(assessmentData?.id)}
                                />
                              </div>
                              <div className="d-flex align-items-center margin-top-20 gap-8">
                                <div className="date-commencement-container">
                                  <p className="fs-14 fw-500 heading-color mb-0 text-end">{assessmentData?.rating || '-'}</p>
                                  <p className="fs-12 fw-500 text-3-color mb-0 text-end">Rating</p>
                                </div>
                                <div className="date-commencement-container">
                                  <p className="fs-14 fw-500 heading-color mb-0 text-end">{assessmentData?.completedAt ? formatDate(assessmentData.completedAt) : '-'}</p>
                                  <p className="fs-12 fw-500 text-3-color mb-0 text-end">Certification Date</p>
                                </div>
                                <div className="date-commencement-container">
                                  <p className="fs-14 fw-500 heading-color mb-0 text-end">{assessmentData?.certificateExpiryDate ? formatDate(assessmentData.certificateExpiryDate) : '-'}</p>
                                  <p className="fs-12 fw-500 text-3-color mb-0 text-end">Expiry Date</p>
                                </div>
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
                      <span className={activeTab === 'Basic Info' ? 'active cursor-pointer' : 'cursor-pointer'} onClick={() => setActiveTab('Basic Info')}>
                        Basic Information
                      </span>
                      <span className={activeTab === 'Site Tour' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'} onClick={() => setActiveTab('Site Tour')}>
                        Site Tour
                      </span>
                      <span
                        className={activeTab === 'Application Details' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'}
                        onClick={() => setActiveTab('Application Details')}>
                        Application Details
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-bottom-tabs-content">
                  {activeTab === 'Basic Info' && (
                    <div className="tab-content padding-left-10 padding-right-10">
                      <BasicInformation />
                    </div>
                  )}
                  {activeTab === 'Site Tour' && (
                    <div className="overview-tab">
                      <SiteTour />
                    </div>
                  )}
                  {activeTab === 'Application Details' && (
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
      <ProductDetailModal open={modalOpen} onClose={handleCloseModal} product={selectedProduct} />
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

export default AssessmentDetails;
