import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import OverviewManufacturingTab from '../../../../../../components/applicationTab/OverviewManufacturingTab';
import OverviewServiceTab from '../../../../../../components/applicationTab/OverviewServiceTab';
import { AppBadge, AppButton, AppModal, FullScreenLoader, RenewalTag } from '../../../../../../components/base';
import AppIconButton from '../../../../../../components/base/AppIconButton';
import { Layout } from '../../../../../../components/layout';
import { ApplicationStoresModal } from '../../../../../../components/modals';
import ProductDetailModal from '../../../../../../components/modals/ProductDetailModal';
import { ASSESSMENT_STATUS } from '../../../../../../constants/assessmentStatus';
import Icons from '../../../../../../constants/Icons';
import { completeFieldWorkAction, getFieldCompletionStatusAction, getStepProgressAction } from '../../../../../../redux/action/common/ApplicationAssessmentAction';
import { coAssessorSubmitAction, getAssessmentByIdAction, submitAssessmentForQcAction } from '../../../../../../redux/action/common/AssessmentAction';
import { resetAssessmentForQcErrors, resetCoAssessorSubmit } from '../../../../../../redux/slices/common/AssessmentSlice';
import { onActivate } from '../../../../../../utils/a11y';
import { areAllStepsComplete, isServiceSector, resolveTeamRole } from '../../../../../../utils/assessmentExecution';
import { getDeviceMetadata } from '../../../../../../utils/deviceInfo';
import { downloadFile } from '../../../../../../utils/FileUtils';
import { formatDate, formatDisplayValue } from '../../../../../../utils/formatters';
import { Logger } from '../../../../../../utils/logger';
import { getFirstServerError } from '../../../../../../utils/serverErrorUtils';
import AttendanceTab from './AttendanceTab';
import AssessmentTab from './assessment/AssessmentTab';
import ScheduleTab from './ScheduleTab';

const AssessmentDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { id } = useParams();

  const { assessment, submitAssessmentForQcResult, submitAssessmentForQcLoading, submitAssessmentForQcError, coAssessorSubmitLoading, coAssessorSubmitError, assessmentLoading } = useSelector(
    state => state.Assessment,
  );
  const { user } = useSelector(state => state.Account);
  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  useEffect(() => {
    if (id) {
      dispatch(getAssessmentByIdAction(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (id) {
      dispatch(getStepProgressAction(id));
      dispatch(getFieldCompletionStatusAction(id));
    }

    // Refetch step progress + field-completion status when the window regains focus so stale data is avoided
    const handleFocus = () => {
      if (id) {
        dispatch(getStepProgressAction(id));
        dispatch(getFieldCompletionStatusAction(id));
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [dispatch, id]);
  const { stepProgress, fieldCompletionStatus, completeFieldWorkLoading } = useSelector(state => state.ApplicationAssessment);
  const isAllStepsCompleted = areAllStepsComplete(stepProgress);
  const _handleOpenApplicationStoresModal = () => {
    setShowApplicationStoresModal(true);
  };
  const handleCloseApplicationStoresModal = () => {
    setShowApplicationStoresModal(false);
  };
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const applicationDetails = assessmentData?.application;

  // QC submission unlocks only once every assessor has done their mobile
  // cutover (server-confirmed) on top of all steps being complete. The lead
  // sees which assessors are still pending so the wait is not a black box.
  const isLeadAssessor = assessmentData?.leadAssessor?.id === user?.id;
  const allTeamMembersMobileComplete = !!assessmentData?.allTeamMembersMobileComplete;
  const allCoAssessorsWebSubmitted = !!assessmentData?.allCoAssessorsWebSubmitted;
  // The lead can send for QC only once every step is done, every assessor has
  // done their mobile cutover, and every co-assessor has web-submitted.
  const canSubmitForQc = isAllStepsCompleted && allTeamMembersMobileComplete && allCoAssessorsWebSubmitted;
  const pendingMobileAssessors = (assessmentData?.teamMembers || []).filter(member => !member.mobileCompletedAt).map(member => member.name);
  // Co-assessors must complete on mobile before the lead can send for QC — surface that
  // specific blocker (a subset of the mobile-completion gate above).
  const pendingCoAssessors = (assessmentData?.teamMembers || []).filter(member => member.role === 'co_assessor' && !member.mobileCompletedAt).map(member => member.name);
  // Co-assessors who are mobile-complete but have not yet web-submitted — the final
  // gate before the lead's Submit for QC unlocks.
  const pendingWebCoAssessors = (assessmentData?.teamMembers || []).filter(member => member.role === 'co_assessor' && !member.webSubmittedAt).map(member => member.name);

  // The current user's own team-member row drives the co-assessor Submit control.
  const currentTeamMember = (assessmentData?.teamMembers || []).find(member => member.userId === user?.id);
  const isCoAssessor = currentTeamMember?.role === 'co_assessor';
  const myWebSubmittedAt = currentTeamMember?.webSubmittedAt;

  // Field-work completion (service sector): a team member finishes their own
  // mobile-equivalent field work before the web submit handoff unlocks. Once the
  // member is mobile-complete the existing submit controls take over.
  const { isTeamMember } = resolveTeamRole(assessmentData, user?.id);
  const myFieldCompletion = fieldCompletionStatus?.me || null;
  const _fieldWorkBlockers = myFieldCompletion?.blockers || [];
  const showCompleteFieldWork = isServiceSector(assessmentData) && isTeamMember && assessmentData?.status === ASSESSMENT_STATUS.IN_PROGRESS && !myFieldCompletion?.mobileCompleted;

  const [modalOpen, setModalOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showCoSubmitModal, setShowCoSubmitModal] = useState(false);
  const [showCompleteFieldWorkModal, setShowCompleteFieldWorkModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'overview');

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
  };

  const handleCloseCoSubmitModal = () => {
    setShowCoSubmitModal(false);
  };

  const handleCloseCompleteFieldWorkModal = () => {
    setShowCompleteFieldWorkModal(false);
  };

  const handleCompleteFieldWork = async () => {
    try {
      await dispatch(completeFieldWorkAction({ assessmentId: id, data: { deviceMetadata: getDeviceMetadata() } })).unwrap();
      setShowCompleteFieldWorkModal(false);
      dispatch(getAssessmentByIdAction(id));
      dispatch(getFieldCompletionStatusAction(id));
      dispatch(getStepProgressAction(id));
    } catch (error) {
      Logger.error('Submit for Review failed:', error);
      setShowCompleteFieldWorkModal(false);
    }
  };

  const handleCoAssessorSubmit = async () => {
    try {
      await dispatch(coAssessorSubmitAction({ assessmentId: id })).unwrap();
      setShowCoSubmitModal(false);
      dispatch(resetCoAssessorSubmit());
      // Refetch so the co-assessor's own webSubmittedAt (and the lead gate) reflect the change.
      dispatch(getAssessmentByIdAction(id));
    } catch (error) {
      Logger.error('Co-assessor submit failed:', error);
      setShowCoSubmitModal(false);
    }
  };

  const handleSubmit = async () => {
    try {
      // Merged lead flow: mark the lead's own field work complete (Submit for Review) first,
      // then submit for QC in the same action so it is a single button. QC is always attempted
      // once review succeeds; if the assessment is not ready the server rejects it and the error
      // surfaces under the button.
      if (showCompleteFieldWork) {
        await dispatch(completeFieldWorkAction({ assessmentId: id, data: { deviceMetadata: getDeviceMetadata() } })).unwrap();
        dispatch(getAssessmentByIdAction(id));
        dispatch(getFieldCompletionStatusAction(id));
        dispatch(getStepProgressAction(id));
      }
      await dispatch(submitAssessmentForQcAction({ assessmentId: id })).unwrap();
      dispatch(resetAssessmentForQcErrors());
    } catch (error) {
      Logger.error('Submit for QC failed:', error);
      // Close the modal so the error message under the submit button is visible
      handleCloseSubmitModal();
    }
  };

  useEffect(() => {
    if (submitAssessmentForQcResult) {
      handleCloseSubmitModal();
      navigate('/in-progress');
    }
  }, [submitAssessmentForQcResult, submitAssessmentForQcLoading, navigate]);

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
                <li className="margin-left-30">In Progress</li>
                <div className="dot-separator" />
                <li>Assessment Details</li>
              </ul>
              <AppBadge variant="lightBlue" label={assessmentData?.status === ASSESSMENT_STATUS.MOBILE_COMPLETE ? 'Completed on Mobile' : 'In Progress'} className="margin-left-30" />
            </div>
          </div>
        </div>
      }>
      {/* Only the first load blanks the page. A background refetch (opening-meeting save, window focus)
          must not unmount the tabs, or the assessor's current step resets to the first one. */}
      {assessmentLoading && !assessmentData ? (
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
                            <div className="flex-shrink-0 ms-4">
                              {showCompleteFieldWork ? (
                                isLeadAssessor ? (
                                  <div className="d-flex flex-column align-items-end">
                                    {/* The lead's field work is completed as part of Submit for QC, so the
                                        separate Submit for Review step is merged into this single button. */}
                                    <AppButton
                                      variant="primary"
                                      size="small"
                                      title={'Submit for QC'}
                                      rightIconStyle={'icon-16'}
                                      onClick={() => setShowSubmitModal(true)}
                                      disabled={!myFieldCompletion?.canComplete}
                                    />
                                    {isAllStepsCompleted && !myFieldCompletion?.canComplete && (
                                      <p className="fs-12 fw-500 text-3-color mb-0 mt-2 text-end">Assessment steps are completed. Please punch out to submit this assessment for quality check.</p>
                                    )}
                                    {submitAssessmentForQcError && <p className="fs-12 fw-500 text-danger mb-0 mt-2 text-end">{getFirstServerError(submitAssessmentForQcError)}</p>}
                                  </div>
                                ) : (
                                  <div className="d-flex flex-column align-items-end">
                                    <AppButton
                                      variant="primary"
                                      size="small"
                                      title={'Submit for Review'}
                                      rightIconStyle={'icon-16'}
                                      onClick={() => setShowCompleteFieldWorkModal(true)}
                                      disabled={!myFieldCompletion?.canComplete}
                                    />
                                  </div>
                                )
                              ) : (
                                <>
                                  {isLeadAssessor && (
                                    <div className="d-flex flex-column align-items-end">
                                      <AppButton
                                        variant="primary"
                                        size="small"
                                        title={'Submit for QC'}
                                        rightIconStyle={'icon-16'}
                                        onClick={() => setShowSubmitModal(true)}
                                        disabled={!canSubmitForQc}
                                      />
                                      {isAllStepsCompleted &&
                                        !allTeamMembersMobileComplete &&
                                        (pendingCoAssessors.length > 0 ? (
                                          <p className="fs-12 fw-500 text-3-color mb-0 mt-2 text-end">
                                            The Co-Assessor must submit before you can submit for QC. Waiting on: {pendingCoAssessors.join(', ')}
                                          </p>
                                        ) : (
                                          pendingMobileAssessors.length > 0 && (
                                            <p className="fs-12 fw-500 text-3-color mb-0 mt-2 text-end">Waiting on mobile completion: {pendingMobileAssessors.join(', ')}</p>
                                          )
                                        ))}
                                      {isAllStepsCompleted && allTeamMembersMobileComplete && !allCoAssessorsWebSubmitted && pendingWebCoAssessors.length > 0 && (
                                        <p className="fs-12 fw-500 text-3-color mb-0 mt-2 text-end">
                                          The Co-Assessor must submit on web before you can submit for QC. Waiting on: {pendingWebCoAssessors.join(', ')}
                                        </p>
                                      )}
                                      {submitAssessmentForQcError && <p className="fs-12 fw-500 text-danger mb-0 mt-2 text-end">{getFirstServerError(submitAssessmentForQcError)}</p>}
                                    </div>
                                  )}
                                  {isCoAssessor && (
                                    <div className="d-flex flex-column align-items-end">
                                      {myWebSubmittedAt ? (
                                        <AppBadge variant="green" label="Submitted" />
                                      ) : (
                                        <AppButton
                                          variant="primary"
                                          size="small"
                                          title={'Submit'}
                                          rightIconStyle={'icon-16'}
                                          onClick={() => setShowCoSubmitModal(true)}
                                          disabled={assessmentData?.status !== ASSESSMENT_STATUS.MOBILE_COMPLETE}
                                        />
                                      )}
                                      {coAssessorSubmitError && <p className="fs-12 fw-500 text-danger mb-0 mt-2 text-end">{getFirstServerError(coAssessorSubmitError)}</p>}
                                    </div>
                                  )}
                                </>
                              )}
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
                  {activeTab === 'assessment' && (
                    <div className="payment-tab">
                      <AssessmentTab assessment={assessmentData} InProgress={true} />
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
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showSubmitModal}
        handleClose={handleCloseSubmitModal}
        header={'Submit for Quality Check'}
        subHeader={'Once the assessment is forwarded for quality check, you will not be able to make changes.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseSubmitModal}
        rightButton="Submit"
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonOnClick={() => {
          handleSubmit();
        }}
        rightButtonLoading={submitAssessmentForQcLoading || completeFieldWorkLoading}
        rightButtonDisabled={submitAssessmentForQcLoading || completeFieldWorkLoading}
      />

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showCoSubmitModal}
        handleClose={handleCloseCoSubmitModal}
        header={'Submit Assessment'}
        subHeader={'Once you submit, you will not be able to make changes to your portion of this assessment.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseCoSubmitModal}
        rightButton="Submit"
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonOnClick={() => {
          handleCoAssessorSubmit();
        }}
        rightButtonLoading={coAssessorSubmitLoading}
        rightButtonDisabled={coAssessorSubmitLoading}
      />

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showCompleteFieldWorkModal}
        handleClose={handleCloseCompleteFieldWorkModal}
        header={'Submit for Review'}
        subHeader={'Confirm that your on-site field work is complete. After this you can submit the assessment.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseCompleteFieldWorkModal}
        rightButton="Confirm"
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonOnClick={() => {
          handleCompleteFieldWork();
        }}
        rightButtonLoading={completeFieldWorkLoading}
        rightButtonDisabled={completeFieldWorkLoading}
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
