import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import OverviewManufacturingTab from '../../../../../../components/applicationTab/OverviewManufacturingTab';
import OverviewServiceTab from '../../../../../../components/applicationTab/OverviewServiceTab';
import { AttendanceTab } from '../../../../../../components/assessment/steps';
import { AppBadge, AppButton, AppModal, FullScreenLoader, RenewalTag } from '../../../../../../components/base';
import { Layout } from '../../../../../../components/layout';
import { ApplicationStoresModal } from '../../../../../../components/modals';
import ProductDetailModal from '../../../../../../components/modals/ProductDetailModal';
import { ASSESSMENT_STATUS } from '../../../../../../constants/assessmentStatus';
import Icons from '../../../../../../constants/Icons';
import { getStepProgressAction } from '../../../../../../redux/action/common/ApplicationAssessmentAction';
import { getAssessmentByIdAction, startAssessmentAction } from '../../../../../../redux/action/common/AssessmentAction';
import { isServiceSector, resolveTeamRole } from '../../../../../../utils/assessmentExecution';
import { downloadFile } from '../../../../../../utils/FileUtils';
import { formatDate, formatDisplayValue } from '../../../../../../utils/formatters';
import { Logger } from '../../../../../../utils/logger';
import { getFirstServerError } from '../../../../../../utils/serverErrorUtils';
import AssessmentTab from '../../inProgress/assessmentDetails/assessment/AssessmentTab';
import ScheduleTab from './ScheduleTab';

const AssessmentDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const { assessment, assessmentLoading } = useSelector(state => state.Assessment);
  const { user } = useSelector(state => state.Account);
  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  const [startError, setStartError] = useState(null);
  useEffect(() => {
    if (id) {
      dispatch(getAssessmentByIdAction(id));
      dispatch(getStepProgressAction(id));
    }
  }, [dispatch, id]);
  const _handleOpenApplicationStoresModal = () => {
    setShowApplicationStoresModal(true);
  };
  const handleCloseApplicationStoresModal = () => {
    setShowApplicationStoresModal(false);
  };
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const applicationDetails = assessmentData?.application;

  // Service execution begins on web from the Parameter Allocation tab: the lead
  // allocates parameters, then punches in — the punch-in starts the assessment
  // (scheduled → in_progress) and opens the full step console.
  const { isLead } = resolveTeamRole(assessmentData, user?.id);
  const canStart = isLead && isServiceSector(assessmentData) && assessmentData?.status === ASSESSMENT_STATUS.SCHEDULED;

  const handlePunchInSuccess = async () => {
    if (!canStart) {
      return;
    }
    setStartError(null);
    try {
      await dispatch(startAssessmentAction(id)).unwrap();
      navigate(`/in-progress-assessment-details/${id}`, { state: { activeTab: 'assessment' } });
    } catch (error) {
      Logger.error('Start assessment failed:', error);
      setStartError(getFirstServerError(error) || 'Punch-in recorded, but the assessment could not be started. Complete parameter allocation first.');
    }
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
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
                <li className="margin-left-30">Scheduled</li>
                <div className="dot-separator" />
                <li>Assessment Details</li>
              </ul>
              <AppBadge variant="blue" label="Scheduled" className="margin-left-30" />
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
                        <div className="top-right-details-card d-flex justify-content-between align-items-start">
                          <div>
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
                      <span
                        className={activeTab === 'parameterAllocation' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'}
                        onClick={() => setActiveTab('parameterAllocation')}>
                        Parameter Allocation
                      </span>
                      <span className={activeTab === 'attendance' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'} onClick={() => setActiveTab('attendance')}>
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
                      <ScheduleTab assessment={assessmentData} />
                    </div>
                  )}
                  {activeTab === 'parameterAllocation' && (
                    <div className="payment-tab">
                      {startError && <p className="fs-13 fw-500 text-danger margin-bottom-12">{startError}</p>}
                      <AssessmentTab assessment={assessmentData} onPunchInSuccess={handlePunchInSuccess} />
                    </div>
                  )}
                  {activeTab === 'attendance' && (
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
