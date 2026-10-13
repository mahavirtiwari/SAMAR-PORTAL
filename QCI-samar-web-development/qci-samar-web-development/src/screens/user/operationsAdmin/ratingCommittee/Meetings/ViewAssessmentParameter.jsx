import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AssessmentScoreSummary from '../../../../../components/assessment/AssessmentScoreSummary';
import { AppAssessmentViewParameter, AppButton } from '../../../../../components/base';
import { Layout } from '../../../../../components/layout';
import { AddParameterReviewModal, ApplicationStoresModal, AppModal, AppParameterViewQuestionsModal, ViewApplicationDetailsModal } from '../../../../../components/modals';
import Icons from '../../../../../constants/Icons';
import { getResponsesAction } from '../../../../../redux/action/common/ApplicationAssessmentAction';
import { committeeDecisionAction, getAssessmentByIdAction } from '../../../../../redux/action/common/AssessmentAction';
import { downloadFile } from '../../../../../utils/FileUtils';
import { formatDate, formatDisplayValue } from '../../../../../utils/formatters';
import { Logger } from '../../../../../utils/logger';

const ViewAssessmentParameter = () => {
  const [openAppModal, setOpenAppModal] = useState(false);
  const [openParameterQuestionsModal, setOpenParameterQuestionsModal] = useState(false);
  const { assessment } = useSelector(state => state.Assessment);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [_optionsData, setOptionsData] = useState(null);
  const [currentParameterIndex, setCurrentParameterIndex] = useState(0);

  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  // Rating-committee meeting context — committee is actively scoring (or
  // viewing post-scoring), so RC is always applicable on this screen.
  const rcScoreApplicable = true;
  const { assessmentId: assessmentIdFromUrl } = useParams();
  // Prefer the id from the URL so a hard refresh / deep-link still resolves the assessment;
  // fall back to router state for navigations that only pass it that way.
  const assessmentIdFromState1 = assessmentIdFromUrl || location?.state?.assessmentId;

  useEffect(() => {
    if (assessmentIdFromState1) {
      dispatch(getResponsesAction(assessmentIdFromState1));
    }
  }, [dispatch, assessmentIdFromState1]);
  useEffect(() => {
    if (assessmentIdFromState1) {
      dispatch(getAssessmentByIdAction(assessmentIdFromState1));
    }
  }, [dispatch, assessmentIdFromState1]);
  const applicationDetails = assessmentData?.application || {};
  // Handler to open/close AppParameterQuestionsModal
  const handleOpenParameterQuestionsModal = question => {
    // find parameter that contains this question
    const matchesQuestion = (q, target) => {
      if (q == null || target == null) {
        return false;
      }
      if (q.id != null && target.id != null) {
        return String(q.id) === String(target.id);
      }
      return String(q.questionText || '').trim() === String(target.questionText || '').trim();
    };

    const pIndex = displayParameters.findIndex(p => (p.questions || []).some(q => matchesQuestion(q, question)));
    if (pIndex >= 0) {
      const qIndex = (displayParameters[pIndex].questions || []).findIndex(q => matchesQuestion(q, question));
      setCurrentParameterIndex(pIndex);
      setCurrentQuestionIndex(qIndex >= 0 ? qIndex : 0);
    } else {
      setCurrentParameterIndex(0);
      setCurrentQuestionIndex(0);
    }
    setOptionsData(question);
    setOpenParameterQuestionsModal(true);
  };

  const handleCloseParameterQuestionsModal = () => setOpenParameterQuestionsModal(false);
  const _handleOpenApplicationStoresModal = () => {
    setShowApplicationStoresModal(true);
  };

  // Add Parameter Review Modal state and handlers
  const [openAddParameterReviewModal, setOpenAddParameterReviewModal] = useState(false);
  const handleCloseAddParameterReviewModal = () => setOpenAddParameterReviewModal(false);
  const handleAddParametersSelect = selectedIds => {
    try {
      const selectedKeys = Array.isArray(selectedIds) ? selectedIds.map(String) : [];
      setDisplayParameters((allParameters || []).filter(p => selectedKeys.includes(String(p.id)) || selectedKeys.includes(String(p.name)) || selectedKeys.includes(String(p.title))));
    } catch (_e) {
      setDisplayParameters(allParameters);
    }
    setOpenAddParameterReviewModal(false);
  };
  const handleCloseApplicationStoresModal = () => {
    setShowApplicationStoresModal(false);
  };
  const handleOpenAppModal = () => setOpenAppModal(true);

  // Falls back to a literal, so without useMemo this is a new array on every render — and it
  // feeds the displayParameters effect below, which would then re-run and setState forever.
  const selectedParametersState = useMemo(() => location?.state?.selectedParameters || [], [location?.state?.selectedParameters]);
  const assessmentIdFromState = assessmentIdFromUrl || location?.state?.assessmentId;

  const modalInitialSelected =
    Array.isArray(selectedParametersState) && selectedParametersState.length
      ? selectedParametersState.map(sp => (typeof sp === 'object' ? String(sp.id ?? sp.bdata?.id ?? sp.title ?? '') : String(sp)))
      : [];

  // Flags to control display/navigation for AppAssessmentParameter
  const showQuestionNumbers = true;
  const enableNavigation = true;

  // Certify modal state and handlers
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [showCertifiedSuccess, setShowCertifiedSuccess] = useState(false);

  const handleCommitteeDecision = async () => {
    try {
      await dispatch(
        committeeDecisionAction({
          assessmentId: assessmentIdFromState,
          data: { action: 'certify', remarks: '' },
        }),
      ).unwrap();
      handleConfirmCertify();
    } catch (error) {
      Logger.error('QC Approve failed:', error);
    }
  };
  const handleCloseCertifyModal = () => setShowCertifyModal(false);
  const handleConfirmCertify = () => {
    setShowCertifyModal(false);
    setShowCertifiedSuccess(true);
    setTimeout(() => {
      setShowCertifiedSuccess(false);
    }, 3000);
  };
  const handleCloseCertifiedSuccess = () => setShowCertifiedSuccess(false);

  // Questions are provided by API via `responses.parameters` — no local dummy questions

  // Use parameters from Redux responses (no dummy parameterAllocationData)
  const { responses } = useSelector(state => state.ApplicationAssessment || {});
  const allParameters = useMemo(() => responses?.parameters || [], [responses?.parameters]);

  // Only consider parameters that have an assigned assessor (exclude null)
  const availableParameters = useMemo(() => (Array.isArray(allParameters) ? allParameters.filter(p => p.assignedAssessor != null) : []), [allParameters]);

  const [displayParameters, setDisplayParameters] = useState(availableParameters);

  useEffect(() => {
    if (!Array.isArray(allParameters)) {
      return;
    }
    if (Array.isArray(selectedParametersState) && selectedParametersState.length) {
      // selectedParameters may be ids or titles
      const selectedKeys = selectedParametersState.map(sp => (typeof sp === 'object' ? String(sp.id ?? sp.title ?? '') : String(sp)));
      setDisplayParameters(availableParameters.filter(p => selectedKeys.includes(String(p.id)) || selectedKeys.includes(p.name) || selectedKeys.includes(p.title)));
    } else {
      setDisplayParameters(availableParameters);
    }
  }, [selectedParametersState, allParameters, availableParameters]);

  // Enable Certify only when there is at least one question and all questions are approved

  return (
    <Layout
      isSubHeader
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">View Assessment</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Committee Meetings</li>
                <div className="dot-separator" />
                <li>Meeting Details</li>
                <div className="dot-separator" />
                <li>View Assessment</li>
              </ul>
            </div>
          </div>
        </div>
      }>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="details-card-without-tab">
                <div className="details-card-with-tabs">
                  <div className="details-card">
                    <div className="top-details-card">
                      <div className="top-details-card-content">
                        <div className="top-right-details-card">
                          <div className="rowBetween">
                            <div className="flex-grow-1">
                              <h4 className="fs-24 fw-600 heading-color mb-0 mt-1">{applicationDetails?.applicationNumber}</h4>
                              <ul className="d-flex align-items-center list-unstyled mb-0">
                                <li className="fs-14 fw-500 text-2-color text-capitalize">
                                  {applicationDetails?.enterpriseClassification === 'startup' ? 'Start-Up' : applicationDetails?.enterpriseClassification}
                                </li>
                                <li className="company-Tags-bullet"></li>
                                <li className="fs-14 fw-500 text-2-color text-capitalize">{applicationDetails?.sector}</li>
                              </ul>
                              <div className="d-flex align-items-center margin-top-16">
                                <div className="d-flex align-items-center">
                                  <img src={Icons.enterpriseInfoDone} alt="documnet" className="icon-24 margin-right-8" />
                                  <div>
                                    <p className="fs-12 fw-500 mb-0 text-3-color">Unit</p>
                                    <p className="fs-14 fw-500 mb-0 heading-color">{applicationDetails?.unitName}</p>
                                  </div>
                                </div>
                                <div className="vertical-divider" />
                                <div className="d-flex align-items-center">
                                  <img src={Icons.enterpriseInfoDone} alt="documnet" className="icon-24 margin-right-8" />
                                  <div>
                                    <p className="fs-12 fw-500 mb-0 text-3-color">Enterprise</p>
                                    <p className="fs-14 fw-500 mb-0 heading-color">{applicationDetails?.organizationName}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="d-flex flex-column align-items-end">
                              <div className="d-flex gap-8">
                                <AppButton variant="secondary" size="small" title={'View Application Details'} onClick={handleOpenAppModal} />
                              </div>
                              <AssessmentScoreSummary assessmentData={assessmentData} rcScoreApplicable={rcScoreApplicable} className="margin-top-20">
                                {assessmentData?.status === 'certified' && (
                                  <div className="details-level-box">
                                    <p className="fs-14 fw-500 heading-color mb-0">{assessmentData?.rating ?? '-'}</p>
                                    <p className="fs-12 fw-500 text-3-color mb-0">Rating</p>
                                  </div>
                                )}
                              </AssessmentScoreSummary>
                            </div>
                          </div>
                        </div>
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
                </div>

                <div className="parameter-details-card">
                  <div className="review-parameter-container">
                    {displayParameters.map(item => (
                      <AppAssessmentViewParameter
                        key={item.id}
                        title={item.name || item.title}
                        question={item?.questions}
                        questionCount={item.questions?.length || item.questionCount || item.totalQuestions || 0}
                        completedCount={item.answeredQuestions || item.completedCount || 0}
                        totalCount={item.totalCount || item.questionCount || item.questions?.length || 0}
                        assignee={item.assignedAssessor?.name || item.assignee}
                        assigneeRole={item.assignedAssessor?.role || item.assigneeRole}
                        status={item.reviewType === 'committee' ? item.reviewStatus : null}
                        statusIcon={true}
                        mandatory={item.isMandatory}
                        score={item.score}
                        rcScore={item.rcScore}
                        rcScoreApplicable={rcScoreApplicable}
                        questionNumbers={showQuestionNumbers}
                        navigate={enableNavigation}
                        handleViewClick={handleOpenParameterQuestionsModal}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ViewApplicationDetailsModal open={openAppModal} onClose={() => setOpenAppModal(false)} applicationDetails={applicationDetails} />
      <AppParameterViewQuestionsModal
        open={openParameterQuestionsModal}
        onClose={handleCloseParameterQuestionsModal}
        parameterData={displayParameters}
        questions={displayParameters[currentParameterIndex]?.questions || []}
        assessmentId={assessmentIdFromState}
        initialQuestionIndex={currentQuestionIndex}
        Data={true}
      />
      <AddParameterReviewModal
        open={openAddParameterReviewModal}
        onClose={handleCloseAddParameterReviewModal}
        onSelect={handleAddParametersSelect}
        initialSelected={modalInitialSelected}
        assessment={assessment}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showCertifyModal}
        handleClose={handleCloseCertifyModal}
        header={'Certify Assessment?'}
        subHeader={'The assessment status will be locked once certified.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCloseCertifyModal}
        rightButton={'Certify'}
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonOnClick={handleCommitteeDecision}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={showCertifiedSuccess}
        image={Icons.successCircle}
        header={'Assessment certified successfully'}
        subHeader={'The new member has been added and the details have been sent to their email address.'}
        handleClose={handleCloseCertifiedSuccess}
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

export default ViewAssessmentParameter;
