import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import { getQuestionFeedbackHistoryAction } from '../../redux/action/common/ApplicationAssessmentAction';
import { addPendingQc } from '../../redux/slices/common/AssessmentSlice';
import { isServiceSector } from '../../utils/assessmentExecution';
import { formatQuestionScore } from '../../utils/assessmentScoreUtils';
import { fetchAuthenticatedImageUrl } from '../../utils/FileUtils';
import { Logger } from '../../utils/logger';
import { AppAvatar, AppButton, AppModal, AppViewAssessmentQuestions } from '../base';
import AppCommonModal from './AppCommonModal';
import ImagePreviewModal from './ImagePreviewModal';
import ParameterReviewProgressModal from './ParameterReviewProgressModal';

const formatAssessmentStatus = status => {
  switch (status) {
    case 'Submitted For QC':
      return 'Submitted for Quality Check';
    case 'In Progress':
      return 'In Progress';
    case 'Committee Feedback':
      return 'Rating Committee Feedback';
    case 'Ready For Committee':
      return 'Ready For Committee Review';
    case 'QC Feedback':
      return 'Quality Check Feedback';
    case 'QC':
      return 'Quality Check';
    case 'Committee Review':
      return 'Committee Review';
    default:
      return status;
  }
};
const AppParameterViewQuestionsModal = ({ open, onClose, parameterData = [], questions = [], assessmentId, initialQuestionIndex = 0, Data }) => {
  const dispatch = useDispatch();
  const { assessment } = useSelector(state => state.Assessment || {});
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const isService = isServiceSector(assessmentData);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [openParameterReviewProgressModal, setOpenParameterReviewProgressModal] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [pendingAction, setPendingAction] = useState({ action: '', comment: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackImageBlobs, setFeedbackImageBlobs] = useState({});
  const feedbackImageBlobRefs = useRef({});
  const [feedbackImageLoading, setFeedbackImageLoading] = useState({});
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [imagePreviewAlt, setImagePreviewAlt] = useState('Feedback attachment');

  const handleOpenImagePreview = (src, alt = 'Feedback attachment') => {
    setImagePreviewSrc(src || Images.dummySite);
    setImagePreviewAlt(alt);
    setImagePreviewOpen(true);
  };

  // Get current question ID
  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionId = currentQuestion?.id;
  const currentQuestionStatus = String((currentQuestion && (currentQuestion.committeeReviewStatus || currentQuestion.response?.committeeReviewStatus)) || '').toLowerCase();

  // Fetch feedback history when question changes
  const fetchFeedbackHistory = useCallback(async () => {
    if (!assessmentId || !currentQuestionId) {
      setFeedbackHistory([]);
      return;
    }

    setFeedbackLoading(true);
    try {
      const response = await dispatch(
        getQuestionFeedbackHistoryAction({
          assessmentId,
          questionId: currentQuestionId,
        }),
      ).unwrap();

      // Transform API response to match UI format with nested clarifications
      const raw = response?.data?.feedbacks || [];
      const mapById = {};

      raw.forEach(fb => {
        mapById[fb.id] = {
          id: fb.id,
          user: fb.user?.name || 'Unknown User',
          role: fb.feedbackType || 'Feedback',
          timestamp: fb.createdAt
            ? new Date(fb.createdAt).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : '',
          message: fb.comment || '',
          rcScore: fb.rcScore,
          feedbackType: fb.feedbackType,
          color: getFeedbackColor(fb.feedbackType),
          rawFeedback: fb,
        };

        if (fb.clarification && fb.clarification.id) {
          const c = fb.clarification;
          mapById[fb.id].clarification = {
            id: c.id,
            user: c.user?.name || 'Unknown User',
            role: c.feedbackType || '',
            timestamp: c.createdAt
              ? new Date(c.createdAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })
              : '',
            message: c.comment || c.message || '',
            rcScore: c.rcScore,
            feedbackType: c.feedbackType,
            color: getFeedbackColor(c.feedbackType),
            rawFeedback: c,
          };
        }
      });

      const topLevel = [];
      raw.forEach(fb => {
        const node = mapById[fb.id];
        if (fb.inReplyTo && fb.inReplyTo.id && mapById[fb.inReplyTo.id]) {
          mapById[fb.inReplyTo.id].clarification = node;
        } else {
          topLevel.push(node);
        }
      });

      setFeedbackHistory(topLevel);
    } catch (error) {
      Logger.error('Failed to fetch feedback history:', error);
      setFeedbackHistory([]);
    } finally {
      setFeedbackLoading(false);
    }
  }, [dispatch, assessmentId, currentQuestionId]);

  // Helper to get color based on feedback type
  const getFeedbackColor = feedbackType => {
    switch (feedbackType) {
      case 'QC Feedback':
        return 'purple-text-color';
      case 'Committee Feedback':
        return 'danger-primary-color';
      case 'Send Back':
        return 'danger-primary-color';
      default:
        return 'text-3-color';
    }
  };

  // Fetch authenticated image blobs for feedback attachments, including nested clarifications
  useEffect(() => {
    const fetchBlobs = async () => {
      if (!feedbackHistory || feedbackHistory.length === 0) {
        setFeedbackImageBlobs({});
        return;
      }
      const blobs = {};
      const loading = {};
      await Promise.all(
        feedbackHistory.map(async item => {
          if (Array.isArray(item.rawFeedback?.attachments)) {
            blobs[item.id] = {};
            loading[item.id] = {};
            await Promise.all(
              item.rawFeedback.attachments.map(async att => {
                if (att.isImage && att.downloadUrl) {
                  loading[item.id][att.id] = true;
                  try {
                    const blobUrl = await fetchAuthenticatedImageUrl(att.downloadUrl);
                    if (blobUrl) {
                      blobs[item.id][att.id] = blobUrl;
                      feedbackImageBlobRefs.current[`${item.id}_${att.id}`] = blobUrl;
                    }
                  } catch {
                    // ignore
                  } finally {
                    loading[item.id][att.id] = false;
                  }
                }
              }),
            );
          }

          if (item.clarification && Array.isArray(item.clarification.rawFeedback?.attachments)) {
            const cid = item.clarification.id;
            blobs[cid] = {};
            loading[cid] = {};
            await Promise.all(
              item.clarification.rawFeedback.attachments.map(async att => {
                if (att.isImage && att.downloadUrl) {
                  loading[cid][att.id] = true;
                  try {
                    const blobUrl = await fetchAuthenticatedImageUrl(att.downloadUrl);
                    if (blobUrl) {
                      blobs[cid][att.id] = blobUrl;
                      feedbackImageBlobRefs.current[`${cid}_${att.id}`] = blobUrl;
                    }
                  } catch {
                    // ignore
                  } finally {
                    loading[cid][att.id] = false;
                  }
                }
              }),
            );
          }
        }),
      );
      setFeedbackImageBlobs(blobs);
      setFeedbackImageLoading(loading);
    };
    fetchBlobs();
    return () => {
      Object.values(feedbackImageBlobRefs.current).forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          Logger.warn('Failed to revoke blob URL:', url);
        }
      });
      feedbackImageBlobRefs.current = {};
    };
  }, [feedbackHistory]);

  useEffect(() => {
    if (open) {
      fetchFeedbackHistory();
    }
  }, [open, fetchFeedbackHistory]);

  // Set initial question index when modal opens or when initial index changes
  useEffect(() => {
    if (!open) {
      return;
    }
    const idx = Number.isInteger(Number(initialQuestionIndex)) ? Number(initialQuestionIndex) : 0;
    setCurrentQuestionIndex(Math.max(0, Math.min(idx, Math.max(0, questions.length - 1))));
  }, [open, initialQuestionIndex, questions.length]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPendingAction({ action: '', comment: '' });
      setValidationError('');
      setActionLoading(false);
    }
  }, [open]);

  // Reset pending action when question changes
  useEffect(() => {
    setPendingAction({ action: '', comment: '' });
    setValidationError('');
  }, [currentQuestionIndex]);

  const handleActionChangeFromChild = (action, comment) => {
    setPendingAction({ action, comment });
    setValidationError('');
  };

  const handleCloseSubmitModal = () => setShowSubmitModal(false);
  const handleConfirmSendBack = () => {
    setShowSubmitModal(false);
  };

  const modalTitle = <div>{parameterData[0]?.title || 'Parameter Questions'}</div>;

  const handlePrev = () => {
    setCurrentQuestionIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = async () => {
    const status = currentQuestionStatus;
    const allowed = ['sent_back', 'send_back', 'clarification_required', 'certified'];
    const alreadyActioned = allowed.includes(status);

    if (!alreadyActioned) {
      if (pendingAction.action === 'markSendBack' && !pendingAction.comment.trim()) {
        setValidationError('Comment is required for Send Back.');
        return;
      }

      setActionLoading(true);
      try {
        // Store pending QC action in redux for batch submission from AssessmentDetails
        const pendingItem = {
          assessmentId,
          questionId: currentQuestionId || null,
          type: pendingAction.action || 'approve',
          comment: pendingAction.comment ? pendingAction.comment.trim() : null,
          rcScore: currentQuestion?.response?.rcScore ?? currentQuestion?.rcScore ?? null,
          timestamp: Date.now(),
        };

        dispatch(addPendingQc(pendingItem));
      } catch (err) {
        Logger.error('Failed to store pending action:', err);
        setValidationError('Failed to store action. Please try again.');
        setActionLoading(false);
        return;
      }
      setActionLoading(false);
    }

    setPendingAction({ action: '', comment: '' });
    setValidationError('');
    setCurrentQuestionIndex(prev => {
      if (prev < questions.length - 1) {
        return prev + 1;
      }
      if (typeof onClose === 'function') {
        onClose();
      }
      return prev;
    });
  };

  const modalFooter = Data ? (
    <div className="d-flex justify-content-end w-100">
      <AppButton
        title={'Next'}
        size="medium"
        type="submit"
        rightIcon={Icons.arrowRight}
        rightIconStyle={'icon-16'}
        onClick={handleNext}
        disabled={!Array.isArray(questions) || questions.length === 0}
      />
    </div>
  ) : (
    <div className="rowBetween w-100">
      {currentQuestionIndex === 0 ? (
        <AppButton variant="tertiary" size="medium" title="Cancel" onClick={onClose} />
      ) : (
        <AppButton variant="tertiary" size="medium" title="Previous" onClick={handlePrev} />
      )}
      <AppButton
        title={currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Save & Next'}
        size="medium"
        type="submit"
        rightIcon={Icons.arrowRight}
        rightIconStyle={'icon-16'}
        onClick={handleNext}
        disabled={actionLoading || !Array.isArray(questions) || questions.length === 0}
      />
    </div>
  );

  const modalContent = (
    <div>
      <div className="questionSteps">
        <AppViewAssessmentQuestions
          questions={questions}
          currentQIndex={currentQuestionIndex}
          sendBackBtn={true}
          editComment={false}
          modalFooter={modalFooter}
          assessmentId={assessmentId}
          validationError={validationError}
          onActionChange={handleActionChangeFromChild}
          rcScoreApplicable={true}
        />
      </div>
      <div className="divider"></div>
      {/* Feedback Section - Question History */}
      <div className="details-card p-0">
        <div className="row">
          <div className="col-12">
            <h2 className="fs-16 fw-600 heading-color margin-bottom-24">Question History</h2>
            {feedbackLoading ? (
              <div className="text-center py-4">
                <span className="fs-14 text-3-color">Loading feedback history...</span>
              </div>
            ) : feedbackHistory.length === 0 ? (
              <div className="text-center py-4">
                <span className="fs-14 text-3-color">No feedback history available</span>
              </div>
            ) : (
              feedbackHistory.map((item, index) => (
                <div key={item.id}>
                  <div
                    className={`feedback-item-container sendBackTrailTimeline ${index === feedbackHistory.length - 1 && item.clarification ? 'short-timeline-item' : ''} ${
                      index === feedbackHistory.length - 1 && !item.clarification ? 'last-timeline-item' : ''
                    } margin-left-12`}>
                    <div className="d-flex margin-top-20">
                      <div className="feedback-avatar">
                        <AppAvatar
                          size="36"
                          alt={item.user}
                          src={item.role === 'Question Score Updated' || item.role === 'Rating Committee Feedback' ? Images[item.avatar] || Icons[item.avatar] || Images.defaultImage : undefined}>
                          {item.user}
                        </AppAvatar>
                      </div>
                      {/* Feedback Content */}
                      <div className="feedback-content margin-left-12 w-100">
                        {/* Header with name, role and timestamp */}
                        <div className="feedback-header d-flex align-items-center justify-content-between">
                          <div className="feedback-user-info">
                            <div className="d-flex align-items-center">
                              <h3 className="fs-16 fw-500 heading-color mb-0">{item.user}</h3>
                              <div className="dot-separator" />
                              <span className="fs-12 fw-400 text-3-color">{item.timestamp}</span>
                            </div>
                            <span className={`fs-12 fw-500 ${item.color}`}>{formatAssessmentStatus(item.role)}</span>
                          </div>
                        </div>

                        {/* Feedback Message */}
                        <div
                          className="feedback-message margin-top-10"
                          style={{
                            background: item.feedbackType === 'QC Feedback' ? 'var(--purple-clarity)' : item.feedbackType === 'Committee Feedback' ? 'var(--danger-light)' : 'var(--danger-light)',
                          }}>
                          {item.rcScore !== null && item.rcScore !== undefined && (
                            <div className="score-span fs-14 margin-bottom-6">
                              {'RC Score'}: <span className="fw-600">{formatQuestionScore(item.rcScore)}</span>
                            </div>
                          )}
                          {item.message && <p className="fs-14 fw-400 text-1-color mb-0">{item.message}</p>}
                          {/* Show image attachments using authenticated blob URLs */}
                          {Array.isArray(item.rawFeedback?.attachments) && item.rawFeedback.attachments.length > 0 && (
                            <div className="feedback-attachments d-flex flex-wrap gap-2 margin-top-8">
                              {item.rawFeedback.attachments.map(att =>
                                att.isImage ? (
                                  <div key={att.id} style={{ position: 'relative', width: 120, height: 120 }}>
                                    {feedbackImageLoading?.[item.id]?.[att.id] ? (
                                      <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 6 }}>
                                        <span className="spinner-border spinner-border-sm" />
                                      </div>
                                    ) : (
                                      <img
                                        src={feedbackImageBlobs?.[item.id]?.[att.id]}
                                        alt={att.fileName}
                                        style={{ maxWidth: 120, maxHeight: 120, borderRadius: 6, border: '1px solid #eee', objectFit: 'cover', cursor: 'pointer' }}
                                        onClick={() => handleOpenImagePreview(att.downloadUrl || feedbackImageBlobs?.[item.id]?.[att.id], att.fileName)}
                                        onError={e => {
                                          e.target.src = Images.dummySite;
                                        }}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <a key={att.id} href={att.downloadUrl} target="_blank" rel="noopener noreferrer" className="fs-12 fw-500 text-primary d-block" style={{ marginTop: 4 }}>
                                    {att.fileName}
                                  </a>
                                ),
                              )}
                            </div>
                          )}
                          {!item.message && !item.rcScore && <p className="fs-14 fw-400 text-3-color mb-0">No comment provided</p>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nested clarification (reply) */}
                  {item.clarification && (
                    <div className="feedback-item-container sendBackTrailTimeline short-timeline-item margin-left-60">
                      <div className="d-flex margin-top-28">
                        <div className="feedback-avatar">
                          <AppAvatar size="36" alt={item.clarification.user}>
                            {item.clarification.user}
                          </AppAvatar>
                        </div>
                        <div className="feedback-content margin-left-12 w-100">
                          <div className="feedback-header d-flex align-items-center justify-content-between">
                            <div className="feedback-user-info">
                              <div className="d-flex align-items-center">
                                <h3 className="fs-16 fw-500 heading-color mb-0">{item.clarification.user}</h3>
                                <div className="dot-separator" />
                                <span className="fs-12 fw-400 text-3-color">{item.clarification.timestamp}</span>
                              </div>
                              <span className={`fs-12 fw-500 ${item.clarification.color}`}>{formatAssessmentStatus(item.clarification.feedbackType)}</span>
                            </div>
                          </div>
                          <div className="feedback-message margin-top-10" style={{ background: item.clarification.feedbackType === 'QC Feedback' ? 'var(--purple-clarity)' : 'var(--danger-light)' }}>
                            {item.clarification.rcScore !== null && item.clarification.rcScore !== undefined && (
                              <div className="score-span fs-14">
                                {'RC Score'}: <span className="fw-600">{formatQuestionScore(item.clarification.rcScore)}</span>
                              </div>
                            )}
                            {item.clarification.message && <p className="fs-14 fw-400 text-1-color mb-0">{item.clarification.message}</p>}
                            {Array.isArray(item.clarification.rawFeedback?.attachments) && item.clarification.rawFeedback.attachments.length > 0 && (
                              <div className="feedback-attachments d-flex flex-wrap gap-2 margin-top-8">
                                {item.clarification.rawFeedback.attachments.map(att =>
                                  att.isImage ? (
                                    <div key={att.id} style={{ position: 'relative', maxWidth: 120, maxHeight: 120 }}>
                                      {feedbackImageLoading?.[item.clarification.id]?.[att.id] ? (
                                        <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', borderRadius: 6 }}>
                                          <span className="spinner-border spinner-border-sm" />
                                        </div>
                                      ) : (
                                        <img
                                          src={feedbackImageBlobs?.[item.clarification.id]?.[att.id]}
                                          alt={att.fileName}
                                          style={{ maxWidth: 120, maxHeight: 120, borderRadius: 6, border: '1px solid #eee', objectFit: 'cover', cursor: 'pointer' }}
                                          onClick={() => handleOpenImagePreview(att.downloadUrl || feedbackImageBlobs?.[item.clarification.id]?.[att.id], att.fileName)}
                                          onError={e => {
                                            e.target.src = Images.dummySite;
                                          }}
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <a key={att.id} href={att.downloadUrl} target="_blank" rel="noopener noreferrer" className="fs-12 fw-500 text-primary d-block" style={{ marginTop: 4 }}>
                                      {att.fileName}
                                    </a>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Review Progress */}
      {/* <div className="parameter-progress-row d-flex align-items-center justify-content-between" style={{ gap: 16 }}>
        <div className="d-flex align-items-center cursor-pointer flex-grow-1" style={{ gap: 12 }} onClick={handleOpenParameterReviewProgressModal}>
          <span className="fs-16 fw-500 primary-color parameterSteps" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ borderBottom: '1px solid #3D8BFD', display: 'inline-block', lineHeight: 1.2 }}>
              {completedCount}/{total} Parameter
            </span>
            <img src={Icons.infoCircle} alt="infoCircle" className="icon-18" />
          </span>
          <div
            style={{
              flex: 1,
              height: 8,
              backgroundColor: '#E8E8E8',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#04B440',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
        <div>
          <AppButton title="Save & Move to Next Parameter" rightIcon={Icons.arrowRight} rightIconStyle={'icon-16'} onClick={() => setShowSubmitModal(true)} />{' '}
        </div>
      </div> */}
      <ParameterReviewProgressModal open={openParameterReviewProgressModal} handleClose={() => setOpenParameterReviewProgressModal(false)} isService={isService} />
      <ImagePreviewModal show={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} src={imagePreviewSrc} alt={imagePreviewAlt} />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.redConfirmIcon}
        show={showSubmitModal}
        handleClose={handleCloseSubmitModal}
        header="Send Back for Review?"
        subHeader="This will return the parameters to the previous step for revision."
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={handleCloseSubmitModal}
        rightButton="Send Back"
        rightButtonClassName="w-100 danger-primary"
        rightButtonOnClick={handleConfirmSendBack}
      />
    </div>
  );

  // ...modalFooter is now defined above with handlers and state

  return (
    <AppCommonModal
      open={open}
      onClose={onClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '1100px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AppParameterViewQuestionsModal;
