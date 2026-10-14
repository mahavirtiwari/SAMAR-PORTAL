import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { AppBadge, FullScreenLoader, RenewalTag } from '../../../../../../components/base';
import AppIconButton from '../../../../../../components/base/AppIconButton';
import { Layout } from '../../../../../../components/layout';
import ProductDetailModal from '../../../../../../components/modals/ProductDetailModal';
import Icons from '../../../../../../constants/Icons';
import { getAssessmentByIdAction } from '../../../../../../redux/action/common/AssessmentAction';
import { onActivate } from '../../../../../../utils/a11y';
import { formatDate } from '../../../../../../utils/formatters';
import AssessmentTab from '../../qualityCheckFeedback/assessmentDetails/assessment/AssessmentTab';
import AttendanceTab from './AttendanceTab';
import ScheduleTab from './ScheduleTab';

const AssessmentDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const { assessment, assessmentLoading } = useSelector(state => state.Assessment);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) {
      dispatch(getAssessmentByIdAction(id));
    }
  }, [dispatch, id]);

  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  return (
    <Layout
      isSubHeader
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <AppIconButton icon={Icons.back} label="Go back" iconClassName="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Assessment Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Manage Assessments</li>
                <div className="dot-separator" />
                <li>Rejected</li>
                <div className="dot-separator" />
                <li>Assessment Details</li>
              </ul>
              <AppBadge variant="red" label="Rejected" className="margin-left-30" />
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
                        <div className="rowBetween w-100">
                          <div className="top-right-details-card">
                            <span className="fs-14 fw-500 text-2-color">{assessmentData?.application?.applicationNumber || '-'}</span>
                            <div className="d-flex align-items-start gap-2 mt-1">
                              <p className="fs-22 fw-600 mb-0 text-3-color flex-shrink-0 unit-name-label">Unit Name:</p>
                              <h4 className="fs-24 fw-600 heading-color mb-0 unit-name-value">{assessmentData?.application?.unitName || '-'}</h4>
                              <RenewalTag application={assessmentData?.application} className="margin-left-10" />
                            </div>
                            <ul className="d-flex align-items-center list-unstyled mb-0">
                              <li className="fs-14 fw-500 text-2-color text-capitalize">
                                {assessmentData?.application?.enterpriseClassification === 'startup' ? 'Start-Up' : assessmentData?.application?.enterpriseClassification || '-'}
                              </li>
                              <li className="company-Tags-bullet"></li>
                              <li className="fs-14 fw-500 text-2-color text-capitalize">{assessmentData?.application?.sector || '-'}</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center margin-top-16">
                      <img src={Icons.enterpriseInfoDone} alt="enterprise" className="icon-24 margin-right-8" />
                      <div className="d-flex align-items-center gap-2">
                        <p className="fs-12 fw-500 mb-0 text-3-color">Enterprise Name:</p>
                        <p className="fs-14 fw-500 mb-0 heading-color">{assessmentData?.application?.organizationName || '-'}</p>
                      </div>
                    </div>
                    {assessmentData?.application?.rejectionReason && (
                      <div className="d-flex align-items-start margin-top-16 p-3" style={{ backgroundColor: 'var(--danger-light)', borderRadius: '8px' }}>
                        <img src={Icons.warningIcon} alt="warning" className="icon-20 margin-right-8" />
                        <div>
                          <p className="fs-12 fw-600 mb-0 text-danger">Rejection Reason</p>
                          <p className="fs-14 fw-500 mb-0 heading-color margin-top-4">{assessmentData.application.rejectionReason}</p>
                        </div>
                      </div>
                    )}
                    <div className="d-flex align-items-center margin-top-16">
                      <img src={Icons.calendarBlue} alt="" className="icon-20 margin-right-8" />
                      <p className="fs-12 fw-500 mb-0 text-3-color">UDYAM Registration Number</p>
                      <p className="fs-14 fw-500 mb-0 heading-color margin-left-12">{assessmentData?.application?.udyamRegistrationNumber || '-'}</p>
                      <p className="margin-left-8 fs-12 fw-600 primary-color cursor-pointer mb-0">View</p>
                    </div>
                    <div className="d-flex align-items-center margin-top-12">
                      <img src={Icons.calendarBlue} alt="" className="icon-20 margin-right-8" />
                      <p className="fs-12 fw-500 mb-0 text-3-color">DRDO / DRDO Lab Registration Number:</p>
                      <p className="fs-14 fw-500 mb-0 heading-color margin-left-12">{assessmentData?.application?.drdoRegistrationNumber || '-'}</p>
                      <p className="margin-left-8 fs-12 fw-600 primary-color cursor-pointer mb-0">View</p>
                    </div>
                    <hr className="divider-small" />
                    <div className="bottom-details-card">
                      <div className="each-details-box">
                        <img src={Icons.shop} alt="shops" className="icon-24 margin-top-6" />
                        <div>
                          <p className="fs-12 fw-500 text-3-color mb-0">Existing DRDO</p>
                          <div className="d-flex align-items-center">
                            <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">{assessmentData?.application?.vendorCategoryName || '-'}</p>
                          </div>
                          <div className="margin-top-2">
                            <AppBadge label={assessmentData?.application?.sector || '-'} variant="grey" />
                          </div>
                        </div>
                      </div>
                      <div className="vertical-divider" />
                      <div className="each-details-box">
                        <img src={Icons.enterpriseInfoDone} alt="calendar" className="icon-24 margin-top-6" />
                        <div>
                          <p className="fs-12 fw-500 text-3-color mb-0">Commencement Date of Unit</p>
                          <div className="d-flex align-items-center">
                            <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">
                              {assessmentData?.application?.unitCommencementDate ? formatDate(assessmentData.application.unitCommencementDate) : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="vertical-divider" />
                      <div className="each-details-box">
                        <img src={Icons.calendarBlue} alt="calendar" className="icon-24 margin-top-6" />
                        <div>
                          <p className="fs-12 fw-500 mb-0 text-3-color">Rejected On</p>
                          <div className="d-flex align-items-center">
                            <p className="fs-14 fw-500 text-danger mb-0 margin-top-2">{assessmentData?.application?.rejectedAt ? formatDate(assessmentData.application.rejectedAt) : '-'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="vertical-divider" />
                      <div className="each-details-box">
                        <img src={Icons.calendarBlue} alt="calendar" className="icon-24 margin-top-6" />
                        <div>
                          <p className="fs-12 fw-500 mb-0 text-3-color">Assessment Date</p>
                          <div className="d-flex align-items-center">
                            <p className="fs-14 fw-500 heading-color mb-0 margin-top-2">
                              {assessmentData?.scheduledStartDate ? formatDate(assessmentData.scheduledStartDate) : '-'} -{' '}
                              {assessmentData?.scheduledEndDate ? formatDate(assessmentData.scheduledEndDate) : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-bottom-tabs">
                    <div className="card-tabs-link">
                      <span className={activeTab === 'overview' ? 'active cursor-pointer' : 'cursor-pointer'} {...onActivate(() => setActiveTab('overview'))} aria-pressed={activeTab === 'overview'}>
                        Overview
                      </span>
                      <span
                        className={activeTab === 'schedule' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'}
                        {...onActivate(() => setActiveTab('schedule'))}
                        aria-pressed={activeTab === 'schedule'}>
                        Schedule
                      </span>
                      <span
                        className={activeTab === 'assessment' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'}
                        {...onActivate(() => setActiveTab('assessment'))}
                        aria-pressed={activeTab === 'assessment'}>
                        Assessment
                      </span>
                      <span
                        className={activeTab === 'checkin/checkout' ? 'active cursor-pointer margin-left-24' : 'cursor-pointer margin-left-24'}
                        {...onActivate(() => setActiveTab('checkin/checkout'))}
                        aria-pressed={activeTab === 'checkin/checkout'}>
                        Attendance
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-bottom-tabs-content">
                  {activeTab === 'overview' && <div className="overview-tab"></div>}
                  {activeTab === 'schedule' && (
                    <div className="payment-tab">
                      <ScheduleTab assessment={assessmentData} />
                    </div>
                  )}
                  {activeTab === 'assessment' && (
                    <div className="payment-tab">
                      <AssessmentTab />
                    </div>
                  )}
                  {activeTab === 'checkin/checkout' && (
                    <div className="payment-tab">
                      <AttendanceTab />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ProductDetailModal open={modalOpen} onClose={handleCloseModal} product={selectedProduct} />
    </Layout>
  );
};

export default AssessmentDetails;
