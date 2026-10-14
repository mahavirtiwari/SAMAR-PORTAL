import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AssessmentScoreSummary from '../../../../../components/assessment/AssessmentScoreSummary';
import { AppAssessmentReviewParameter, AppButton } from '../../../../../components/base';
import AppIconButton from '../../../../../components/base/AppIconButton';
import { Layout } from '../../../../../components/layout';
import { AddParameterReviewModal, ApplicationStoresModal, AppModal, AppParameterQuestionsModal, ViewApplicationDetailsModal } from '../../../../../components/modals';
import { ASSESSMENT_STATUS } from '../../../../../constants/assessmentStatus';
import Icons from '../../../../../constants/Icons';
import { getQuestionFeedbackHistoryAction, getResponsesAction } from '../../../../../redux/action/common/ApplicationAssessmentAction';
import { committeeDecisionAction, getAssessmentByIdAction, updateRcScoresAction } from '../../../../../redux/action/common/AssessmentAction';
import { clearPendingQc, clearPendingRcScores } from '../../../../../redux/slices/common/AssessmentSlice';
import { downloadFile } from '../../../../../utils/FileUtils';
import { formatDate, formatDisplayValue } from '../../../../../utils/formatters';
import { Logger } from '../../../../../utils/logger';
import { hasAnyRole } from '../../../../../utils/roleUtils';

// The Rating Committee may send an assessment back to the assessor at most twice.
// On the 3rd review only "Certify" is allowed — the "Send Back" action is removed.
const MAX_COMMITTEE_SEND_BACKS = 2;
// Feedback-history entries created by a committee send-back carry this type.
const COMMITTEE_FEEDBACK_TYPE = 'Committee Feedback';

// Mirror of the backend rating mapping (qci-samar-backend/app/Models/Assessment.php:752-765):
// a 0–5 score maps to Level 1–5. Kept client-side so the Rating box tracks the live RC score
// during review instead of showing the stale persisted assessmentData.rating.
const ratingLevelFromScore = score => {
  const value = score !== null && score !== undefined ? parseFloat(score) : NaN;
  if (isNaN(value)) {
    return '--';
  }
  if (value > 4.5) {
    return 'Level 5';
  }
  if (value > 3.5) {
    return 'Level 4';
  }
  if (value > 2.5) {
    return 'Level 3';
  }
  if (value > 1.5) {
    return 'Level 2';
  }
  return 'Level 1';
};

const ReviewAssessmentParameter = () => {
  const [openAppModal, setOpenAppModal] = useState(false);
  const [openParameterQuestionsModal, setOpenParameterQuestionsModal] = useState(false);
  const { assessment, committeeDecisionLoading } = useSelector(state => state.Assessment);
  const { pendingQcActions = [], pendingRcScores = [] } = useSelector(state => state.Assessment);
  const { user } = useSelector(state => state.Account);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [isSendingBack, setIsSendingBack] = useState(false);
  const [_optionsData, setOptionsData] = useState(null);
  const [currentParameterIndex, setCurrentParameterIndex] = useState(0);
  const [showSendBack, setShowSendBack] = useState(false);
  const [showApplicationStoresModal, setShowApplicationStoresModal] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [committeeSendBackCount, setCommitteeSendBackCount] = useState(0);
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  // Rating-committee meeting context — committee is actively scoring here,
  // so RC is always applicable regardless of the assessment's backend status.
  const rcScoreApplicable = true;
  // Once the meeting decides this assessment (certified, or sent back on End Meeting) the
  // committee review is read-only — RC scores and send-backs can no longer be edited.
  const isReviewLocked = [ASSESSMENT_STATUS.CERTIFIED, ASSESSMENT_STATUS.COMMITTEE_FEEDBACK].includes(assessmentData?.status);
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
  const handleOpenAddParameterReviewModal = () => setOpenAddParameterReviewModal(true);
  const handleCloseAddParameterReviewModal = () => setOpenAddParameterReviewModal(false);
  const handleAddParametersSelect = selectedIds => {
    try {
      const selectedKeys = Array.isArray(selectedIds) ? selectedIds.map(String) : [];
      // Merge selected parameters into currently displayed list
      setDisplayParameters(prev => {
        const existing = Array.isArray(prev) ? prev : [];
        const map = new Map(existing.map(p => [String(p.id ?? p.title ?? p.name ?? ''), p]));
        (availableParameters || [])
          .filter(p => selectedKeys.includes(String(p.id)) || selectedKeys.includes(String(p.name)) || selectedKeys.includes(String(p.title)))
          .forEach(p => {
            const key = String(p.id ?? p.title ?? p.name ?? '');
            if (!map.has(key)) {
              map.set(key, p);
            }
          });
        return Array.from(map.values());
      });
    } catch (_e) {
      setDisplayParameters(availableParameters);
    }
    setOpenAddParameterReviewModal(false);
  };
  const handleCloseApplicationStoresModal = () => {
    setShowApplicationStoresModal(false);
  };
  const handleOpenAppModal = () => setOpenAppModal(true);

  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { assessmentId: assessmentIdFromUrl } = useParams();
  // Falls back to a literal, so without useMemo this is a new array on every render — and it
  // feeds the displayParameters effect below, which would then re-run and setState forever.
  const selectedParametersState = useMemo(() => location?.state?.selectedParameters || [], [location?.state?.selectedParameters]);
  // Prefer the id from the URL so a hard refresh / deep-link still resolves the assessment;
  // fall back to router state for navigations that only pass it that way.
  const assessmentIdFromState = assessmentIdFromUrl || location?.state?.assessmentId;

  const assessmentId = assessmentIdFromState || assessment?.data?.assessment?.id || assessment?.assessment?.id || assessment?.id;

  // Fetch-on-mount: unlike the View screen this screen had no data fetch of its own — it
  // relied entirely on Redux being pre-filled by ReviewParameterModal before navigation, so a
  // refresh (which resets Redux and clears router state) left it blank. Re-fetch from the URL id.
  useEffect(() => {
    if (assessmentIdFromState) {
      dispatch(getResponsesAction(assessmentIdFromState));
      dispatch(getAssessmentByIdAction(assessmentIdFromState));
    }
  }, [dispatch, assessmentIdFromState]);
  const hasPendingSendBack = Array.isArray(pendingQcActions) && pendingQcActions.some(p => String(p.assessmentId) === String(assessmentId) && p.type === 'markSendBack');
  const pendingRcScoresForAssessment = Array.isArray(pendingRcScores) ? pendingRcScores.filter(p => String(p.assessmentId) === String(assessmentId)) : [];

  // initial selection for AddParameterReviewModal will be derived from
  // currently displayed parameters so the modal shows only remaining ones
  // (deselected parameters).

  // Flags to control display/navigation for AppAssessmentParameter
  const showQuestionNumbers = true;
  const enableNavigation = true;

  // Certify modal state and handlers
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [showCertifiedSuccess, setShowCertifiedSuccess] = useState(false);
  const handleOpenCertifyModal = () => setShowCertifyModal(true);

  const handleCommitteeDecision = async () => {
    if (!hasAnyRole(user, ['operations_admin'])) {
      Logger.error('Unauthorized: user does not have committee decision role');
      return;
    }
    try {
      // Submit pending RC scores first via bulk API
      if (pendingRcScoresForAssessment.length > 0) {
        await dispatch(
          updateRcScoresAction({
            assessmentId: assessmentIdFromState,
            data: { scores: pendingRcScoresForAssessment.map(item => ({ questionId: item.questionId, rcScore: item.rcScore })) },
          }),
        ).unwrap();
      }

      await dispatch(
        committeeDecisionAction({
          assessmentId: assessmentIdFromState,
          data: { action: 'certify', remarks: '' },
        }),
      ).unwrap();

      // Re-fetch the server's authoritative post-certify values BEFORE clearing the
      // optimistic pendingRcScores overrides, so displayOverallScore never has a window
      // where it falls back to the stale pre-certify assessmentData.totalScore.
      await Promise.all([dispatch(getAssessmentByIdAction(assessmentIdFromState)).unwrap(), dispatch(getResponsesAction(assessmentIdFromState)).unwrap()]);

      dispatch(clearPendingRcScores(assessmentIdFromState));
      dispatch(clearPendingQc(assessmentIdFromState));
      handleConfirmCertify();
    } catch (error) {
      Logger.error('Committee decision failed:', error);
    }
  };

  const handleCloseSubmitModal = () => setShowSendBackModal(false);

  const handleSendBack = async () => {
    setIsSendingBack(true);
    try {
      // Submit pending RC scores first via bulk API
      if (pendingRcScoresForAssessment.length > 0) {
        await dispatch(
          updateRcScoresAction({
            assessmentId: assessmentIdFromState,
            data: { scores: pendingRcScoresForAssessment.map(item => ({ questionId: item.questionId, rcScore: item.rcScore })) },
          }),
        ).unwrap();
      }

      const feedback = (pendingQcActions || [])
        .filter(p => String(p.assessmentId) === String(assessmentIdFromState) && p.type === 'markSendBack')
        .map(p => ({ questionId: p.questionId || null, comment: p.comment || null }));

      const payload = { action: 'provide_feedback', remarks: '' };
      if (feedback.length) {
        payload.feedback = feedback;
      }

      await dispatch(committeeDecisionAction({ assessmentId: assessmentIdFromState, data: payload })).unwrap();
      dispatch(clearPendingRcScores(assessmentIdFromState));
      dispatch(clearPendingQc(assessmentIdFromState));
      setShowSendBackModal(false);
      handleSubmitSendBack();
    } catch (error) {
      Logger.error('Committee Send Back failed:', error);
    } finally {
      setIsSendingBack(false);
    }
  };
  const handleCloseCertifyModal = () => setShowCertifyModal(false);
  const handleConfirmCertify = () => {
    setShowCertifyModal(false);
    setShowCertifiedSuccess(true);
    setTimeout(() => {
      setShowCertifiedSuccess(false);
      navigate(-1);
    }, 2000);
  };

  const handleSubmitSendBack = () => {
    setShowCertifyModal(false);
    setShowSendBack(true);
    setTimeout(() => {
      setShowSendBack(false);
      navigate(-1);
    }, 2000);
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

    // If page was opened with selectedParametersState, use that to initialise
    if (Array.isArray(selectedParametersState) && selectedParametersState.length) {
      const dataList = selectedParametersState.map(sp => sp.bdata).filter(Boolean);
      if (dataList.length) {
        setDisplayParameters(dataList);
        return;
      }
      const selectedKeys = selectedParametersState.map(sp => (typeof sp === 'object' ? String(sp.id ?? sp.title ?? '') : String(sp)));
      setDisplayParameters(allParameters.filter(p => selectedKeys.includes(String(p.id)) || selectedKeys.includes(p.name) || selectedKeys.includes(p.title)));
      return;
    }

    // If API returned no available parameters, do not clear the existing display list.
    if (!Array.isArray(availableParameters) || availableParameters.length === 0) {
      return; // keep current `displayParameters` as-is
    }

    // Merge new API parameters into existing displayParameters using a
    // functional state update to avoid stale closures.
    setDisplayParameters(prev => {
      const existing = Array.isArray(prev) ? prev : [];
      if (existing.length === 0) {
        return availableParameters;
      }
      const map = new Map(existing.map(p => [String(p.id ?? p.title ?? p.name ?? ''), p]));
      (availableParameters || []).forEach(p => {
        const key = String(p.id ?? p.title ?? p.name ?? '');
        if (!map.has(key)) {
          map.set(key, p);
        }
      });
      return Array.from(map.values());
    });
  }, [selectedParametersState, allParameters, availableParameters]);

  // Compute the parameter-level RC aggregate including in-flight pending picks.
  // Mirrors the backend formula: rcScore = Σ(effectiveRcScore * weightage / 100)
  // where effectiveRcScore = pending.rcScore ?? response.rcScore ?? response.score.
  // Falls back to the API-provided parameter.rcScore when nothing has been touched.
  // Like the backend, the sum is only a score when every question carries a value; a
  // partial sum is a deflated number, so it renders as a dash (null) instead.
  const getDisplayRcScore = parameter => {
    const questions = Array.isArray(parameter?.questions) ? parameter.questions : [];
    if (questions.length === 0) {
      return parameter?.rcScore;
    }
    let hasAnyOverride = false;
    let total = 0;
    for (const q of questions) {
      const weightage = Number(q?.weightage ?? 0);
      const resp = q?.response ?? {};
      const pending = Array.isArray(pendingRcScores) ? pendingRcScores.find(p => String(p.assessmentId) === String(assessmentId) && String(p.questionId) === String(q?.id)) : null;
      if (pending) {
        hasAnyOverride = true;
      }
      const rawEffective = pending?.rcScore ?? resp?.rcScore ?? resp?.score ?? null;
      const effective = rawEffective !== null && rawEffective !== undefined ? parseFloat(rawEffective) : NaN;
      if (isNaN(effective)) {
        return null;
      }
      total += effective * (weightage / 100);
    }
    if (!hasAnyOverride) {
      return parameter?.rcScore;
    }
    return Number(total.toFixed(2));
  };

  // Live overall score, mirroring the backend Assessment::calculateScore()
  // (qci-samar-backend/app/Models/Assessment.php:664-705): a simple average of each
  // parameter's RC score across all assigned parameters. Reusing getDisplayRcScore means
  // in-flight pendingRcScores are reflected before they are persisted on Certify/Send Back,
  // so the header updates in real time. This is an optimistic preview — the backend stays
  // authoritative for the value persisted on certification. One known divergence: a
  // parameter with an unanswered question is null here and skipped, while calculateScore()
  // still counts its partial sum; only assessments submitted before the completeness gate
  // can be in that state.
  const displayOverallScore = (() => {
    const params = Array.isArray(availableParameters) ? availableParameters : [];
    let sum = 0;
    let counted = 0;
    for (const p of params) {
      const raw = getDisplayRcScore(p);
      const value = raw !== null && raw !== undefined ? parseFloat(raw) : NaN;
      if (!isNaN(value)) {
        sum += value;
        counted += 1;
      }
    }
    return counted > 0 ? Number((sum / counted).toFixed(2)) : assessmentData?.totalScore;
  })();

  // Enable Certify unless any question has been sent back. If any question
  // has status 'sent_back' the Certify action should be disabled.
  const allApproved = useMemo(() => {
    try {
      const allQuestions = (displayParameters || []).flatMap(p => p.questions || []);
      if (!allQuestions || allQuestions.length === 0) {
        return false;
      }
      const hasSentBack = allQuestions.some(q => String(q?.committeeReviewStatus) === 'sent_back');
      return !hasSentBack;
    } catch (_e) {
      return false;
    }
  }, [displayParameters]);

  // Number of distinct committee send-back rounds for this assessment. The backend
  // exposes no counter, so derive it from per-question feedback history: every
  // question flagged in a single send-back action gets a "Committee Feedback" entry
  // sharing that action's timestamp, so the count of distinct committee-feedback
  // timestamps equals the number of times the assessment was sent back.
  const questionIdsKey = useMemo(() => {
    const ids = (displayParameters || []).flatMap(p => (p.questions || []).map(q => q?.id)).filter(id => id != null);
    return Array.from(new Set(ids.map(String)))
      .sort()
      .join(',');
  }, [displayParameters]);

  useEffect(() => {
    let cancelled = false;
    const computeSendBackCount = async () => {
      const questionIds = questionIdsKey ? questionIdsKey.split(',') : [];
      if (!assessmentId || questionIds.length === 0) {
        setCommitteeSendBackCount(0);
        return;
      }
      try {
        const histories = await Promise.all(
          questionIds.map(qid =>
            dispatch(getQuestionFeedbackHistoryAction({ assessmentId, questionId: qid }))
              .unwrap()
              .catch(() => null),
          ),
        );
        const rounds = new Set();
        histories.forEach(res => {
          (res?.data?.feedbacks || []).forEach(fb => {
            if (fb?.feedbackType === COMMITTEE_FEEDBACK_TYPE && fb?.createdAt) {
              // group all questions sent back together (same minute) into one round
              rounds.add(String(fb.createdAt).slice(0, 16));
            }
          });
        });
        if (!cancelled) {
          setCommitteeSendBackCount(rounds.size);
        }
      } catch (error) {
        Logger.error('Failed to compute committee send-back count:', error);
        if (!cancelled) {
          setCommitteeSendBackCount(0);
        }
      }
    };
    computeSendBackCount();
    return () => {
      cancelled = true;
    };
  }, [dispatch, assessmentId, questionIdsKey]);

  const sendBackLimitReached = committeeSendBackCount >= MAX_COMMITTEE_SEND_BACKS;

  return (
    <Layout
      isSubHeader
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <AppIconButton icon={Icons.back} label="Go back" iconClassName="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Review Assessment</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Committee Meetings</li>
                <div className="dot-separator" />
                <li>Meeting Details</li>
                <div className="dot-separator" />
                <li>Review Assessment</li>
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
                <div>
                  <div className="details-card">
                    <div className="top-details-card">
                      <div className="top-details-card-content">
                        <div className="top-right-details-card">
                          <div className="d-flex justify-content-between">
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
                                  <img src={Icons.enterpriseInfoDone} alt="" className="icon-24 margin-right-8" />
                                  <div>
                                    <p className="fs-12 fw-500 mb-0 text-3-color">Unit</p>
                                    <p className="fs-14 fw-500 mb-0 heading-color"> {applicationDetails?.unitName}</p>
                                  </div>
                                </div>
                                <div className="vertical-divider" />
                                <div className="d-flex align-items-center">
                                  <img src={Icons.enterpriseInfoDone} alt="" className="icon-24 margin-right-8" />
                                  <div>
                                    <p className="fs-12 fw-500 mb-0 text-3-color">Enterprise</p>
                                    <p className="fs-14 fw-500 mb-0 heading-color"> {applicationDetails?.organizationName}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="d-flex flex-column align-items-end">
                              <div className="d-flex gap-8 margin-bottom-10 align-items-center">
                                <AppButton variant="primary" size="small" title={'Certify'} onClick={handleOpenCertifyModal} disabled={!allApproved || hasPendingSendBack || isReviewLocked} />
                                {!sendBackLimitReached && (
                                  <AppButton variant="danger-primary" size="small" title={'Send Back'} onClick={() => setShowSendBackModal(true)} disabled={!hasPendingSendBack || isReviewLocked} />
                                )}
                              </div>
                              <AppButton variant="secondary" size="small" title={'View Application Details'} onClick={handleOpenAppModal} />
                              <AssessmentScoreSummary assessmentData={assessmentData} rcScoreApplicable={rcScoreApplicable} rcScore={displayOverallScore} className="margin-top-20">
                                <div className="details-level-box">
                                  <p className="fs-14 fw-500 heading-color mb-0">{ratingLevelFromScore(displayOverallScore)}</p>
                                  <p className="fs-12 fw-500 text-3-color mb-0">Rating</p>
                                </div>
                              </AssessmentScoreSummary>
                            </div>
                          </div>
                        </div>
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
                </div>

                <div className="parameter-details-card">
                  <div className="parameter-review-header">
                    <h3 className="fw-600 fs-20 heading-color mb-0">Parameters for Review</h3>
                    <AppButton
                      variant="primary"
                      size="small"
                      title="Add Parameters"
                      leftIcon={Icons.addMore}
                      leftIconStyle={'icon-14'}
                      onClick={handleOpenAddParameterReviewModal}
                      disabled={Array.isArray(availableParameters) && Array.isArray(displayParameters) && displayParameters.length >= availableParameters.length}
                    />
                  </div>
                  <div className="review-parameter-container">
                    {displayParameters.map(item => (
                      <AppAssessmentReviewParameter
                        key={item.id}
                        title={item.name || item.title}
                        question={item?.questions}
                        questionCount={item.questions?.length || item.questionCount || item.totalQuestions || 0}
                        completedCount={item.answeredQuestions || item.completedCount || 0}
                        totalCount={item.totalCount || item.questionCount || item.questions?.length || 0}
                        assignee={item.assignedAssessor?.name || item.assignee}
                        assigneeRole={item.assignedAssessor?.role || item.assigneeRole}
                        status={item.committeeReviewStatus}
                        statusIcon={true}
                        score={item.score}
                        rcScore={getDisplayRcScore(item)}
                        rcScoreApplicable={rcScoreApplicable}
                        questionNumbers={showQuestionNumbers}
                        navigate={enableNavigation}
                        mandatory={item.isMandatory}
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
      <AppParameterQuestionsModal
        open={openParameterQuestionsModal}
        onClose={handleCloseParameterQuestionsModal}
        parameterData={displayParameters}
        questions={displayParameters[currentParameterIndex]?.questions || []}
        assessmentId={assessmentIdFromState}
        initialQuestionIndex={currentQuestionIndex}
        sendBackBtn={!sendBackLimitReached}
        readOnly={isReviewLocked}
      />
      <AddParameterReviewModal
        open={openAddParameterReviewModal}
        onClose={handleCloseAddParameterReviewModal}
        onSelect={handleAddParametersSelect}
        initialSelected={Array.isArray(displayParameters) ? displayParameters.map(p => String(p.id)) : []}
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
        rightButtonLoading={committeeDecisionLoading}
        rightButtonClassName={'w-100 btn-primary'}
        rightButtonOnClick={handleCommitteeDecision}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={showCertifiedSuccess}
        image={Icons.successCircle}
        header={'Assessment certified successfully'}
        subHeader={''}
        handleClose={handleCloseCertifiedSuccess}
      />

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={showSendBack}
        image={Icons.successCircle}
        header={'Sent back to assessor successfully'}
        subHeader={''}
        // handleClose={handleCloseSendBack}
      />

      <ApplicationStoresModal
        open={showApplicationStoresModal}
        onClose={handleCloseApplicationStoresModal}
        type={applicationDetails?.sector === 'service' ? 'Services' : 'Stores'}
        stores={applicationDetails?.sector === 'service' ? applicationDetails?.svcDrdoVendorLabs : applicationDetails?.mfgDrdoVendorStores}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.redConfirmIcon}
        show={showSendBackModal}
        handleClose={handleCloseSubmitModal}
        header="Send Back to Assessor?"
        subHeader="The assessor will be notified to respond."
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={handleCloseSubmitModal}
        rightButton={'Send Back'}
        rightButtonLoading={isSendingBack}
        rightButtonClassName="w-100 danger-primary"
        rightButtonOnClick={handleSendBack}
      />
    </Layout>
  );
};

export default ReviewAssessmentParameter;
