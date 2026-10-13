import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import { getQuestionFeedbackHistoryAction, getResponsesAction } from '../../redux/action/common/ApplicationAssessmentAction';
import { postQuestionClarificationAction, updateQuestionClarificationAction } from '../../redux/action/common/AssessmentAction';
import { addPendingQc, addPendingRcScore } from '../../redux/slices/common/AssessmentSlice';
import { isServiceSector } from '../../utils/assessmentExecution';
import { formatQuestionScore, resolveDisplayedSelectedOption } from '../../utils/assessmentScoreUtils';
import { fetchAuthenticatedImageUrl } from '../../utils/FileUtils';
import { Logger } from '../../utils/logger';
import { AppAssessmentQuestions, AppAvatar, AppButton, AppInput, AppModal } from '../base';
import { toastError } from '../base/toast';
import AppCommonModal from './AppCommonModal';
import ImagePreviewModal from './ImagePreviewModal';
import ParameterReviewProgressModal from './ParameterReviewProgressModal';

// State for feedback image blobs

// Attachments are limited to 5120 KB (5 MB) per file.
const MAX_ATTACHMENT_SIZE_KB = 5120;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_KB * 1024;

// Filters out files exceeding the size limit and shows an error toast for them.
const filterOversizedFiles = files => {
  const valid = [];
  const oversized = [];
  files.forEach(file => {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      oversized.push(file.name);
    } else {
      valid.push(file);
    }
  });
  if (oversized.length > 0) {
    toastError(`Image must not be greater than ${MAX_ATTACHMENT_SIZE_KB / 1024} MB: ${oversized.join(', ')}`);
  }
  return valid;
};

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
    case 'Assessor Clarification':
      return 'Lead Assessor';
    case 'QC':
      return 'Quality Check';
    case 'Committee Review':
      return 'Committee Review';
    default:
      return status;
  }
};
const AppParameterQuestionsModal = ({ open, onClose, parameterData = [], questions = [], assessmentId, initialQuestionIndex = 0, Data, sendBackBtn = true, readOnly = false }) => {
  const dispatch = useDispatch();
  const pendingRcScores = useSelector(state => state.Assessment?.pendingRcScores ?? []);
  const pendingQcActions = useSelector(state => state.Assessment?.pendingQcActions ?? []);
  const { assessment } = useSelector(state => state.Assessment || {});
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const isService = isServiceSector(assessmentData);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [openParameterReviewProgressModal, setOpenParameterReviewProgressModal] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [pendingAction, setPendingAction] = useState({ action: '', comment: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedOptionByQuestion, setSelectedOptionByQuestion] = useState({});

  // Response / comment states and handlers (missing previously)
  const [_feedbackComment, _setFeedbackComment] = useState('');
  const [_submittedComments, _setSubmittedComments] = useState([]);
  const [_uploadedImages, setUploadedImages] = useState([]);
  const [_isEditMode, _setIsEditMode] = useState(false);
  const [_hasSubmittedComment, _setHasSubmittedComment] = useState(false);

  // Clarification states
  const [clarificationText, setClarificationText] = useState({});
  const [clarificationImages, setClarificationImages] = useState({});
  const [editingClarificationId, setEditingClarificationId] = useState(null);
  const [clarificationLoading, setClarificationLoading] = useState(false);

  // User and assessment data

  const _handleAddImages = () => {
    const input = document.getElementById('image-upload-input');
    if (input) {
      input.click();
    }
  };

  const _handleImageUpload = e => {
    const files = filterOversizedFiles(Array.from(e.target.files || []));
    if (files.length === 0) {
      e.target.value = '';
      return;
    }
    const newImages = files.map((file, idx) => ({ id: Date.now() + idx, url: URL.createObjectURL(file), name: file.name }));
    setUploadedImages(prev => [...newImages, ...prev]);
    // reset input
    e.target.value = '';
  };

  const _removeImage = id => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  };

  // Clarification handlers
  const _handleRespondToClarification = feedbackId => {
    setClarificationText(prev => ({ ...prev, [feedbackId]: '' }));
    setClarificationImages(prev => ({ ...prev, [feedbackId]: [] }));
  };

  const _handleEditClarification = clarification => {
    setEditingClarificationId(clarification.id);
    setClarificationText(prev => ({ ...prev, [clarification.id]: clarification.message || '' }));
    setClarificationImages(prev => ({ ...prev, [clarification.id]: [] }));
  };

  const handleClarificationImageUpload = (feedbackId, e) => {
    const files = filterOversizedFiles(Array.from(e.target.files || []));
    if (files.length === 0) {
      e.target.value = '';
      return;
    }
    const newImages = files.map((file, idx) => ({ id: Date.now() + idx, file, url: URL.createObjectURL(file), name: file.name }));
    setClarificationImages(prev => ({ ...prev, [feedbackId]: [...(prev[feedbackId] || []), ...newImages] }));
    e.target.value = '';
  };

  const handleRemoveClarificationImage = (feedbackId, imageId) => {
    setClarificationImages(prev => ({ ...prev, [feedbackId]: (prev[feedbackId] || []).filter(img => img.id !== imageId) }));
  };

  const _handlePostClarification = async feedbackId => {
    const text = clarificationText[feedbackId];
    const images = clarificationImages[feedbackId] || [];

    if (!text?.trim() && images.length === 0) {
      return;
    }

    setClarificationLoading(true);
    try {
      await dispatch(
        postQuestionClarificationAction({
          assessmentId,
          questionId: currentQuestionId,
          inReplyToId: feedbackId,
          comment: text?.trim() || '',
          attachments: images.map(img => img.file),
        }),
      ).unwrap();

      await dispatch(getResponsesAction(assessmentId));
      await fetchFeedbackHistory();

      setClarificationText(prev => ({ ...prev, [feedbackId]: '' }));
      setClarificationImages(prev => ({ ...prev, [feedbackId]: [] }));
    } catch (error) {
      Logger.error('Failed to post clarification:', error);
    } finally {
      setClarificationLoading(false);
    }
  };

  const handleUpdateClarification = async clarificationId => {
    const text = clarificationText[clarificationId];
    const images = clarificationImages[clarificationId] || [];

    if (!text?.trim() && images.length === 0) {
      return;
    }

    setClarificationLoading(true);
    try {
      await dispatch(
        updateQuestionClarificationAction({
          assessmentId,
          questionId: currentQuestionId,
          clarificationId,
          comment: text?.trim() || '',
          attachments: images.map(img => img.file),
        }),
      ).unwrap();

      await dispatch(getResponsesAction(assessmentId));
      await fetchFeedbackHistory();

      setEditingClarificationId(null);
      setClarificationText(prev => ({ ...prev, [clarificationId]: '' }));
      setClarificationImages(prev => ({ ...prev, [clarificationId]: [] }));
    } catch (error) {
      Logger.error('Failed to update clarification:', error);
    } finally {
      setClarificationLoading(false);
    }
  };

  const handleCancelClarification = feedbackId => {
    setClarificationText(prev => ({ ...prev, [feedbackId]: undefined }));
    setClarificationImages(prev => ({ ...prev, [feedbackId]: [] }));
    if (editingClarificationId === feedbackId) {
      setEditingClarificationId(null);
    }
  };

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

      // First create transformed nodes
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

        // If API already provided a nested clarification object, normalize it too
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

      // Attach replies as `clarification` on their parent feedback when `inReplyTo` is present
      const topLevel = [];
      raw.forEach(fb => {
        const node = mapById[fb.id];
        if (fb.inReplyTo && fb.inReplyTo.id && mapById[fb.inReplyTo.id]) {
          // attach as clarification to parent
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
  const [feedbackImageBlobs, setFeedbackImageBlobs] = useState({});
  const feedbackImageBlobRefs = useRef({});
  const [feedbackImageLoading, setFeedbackImageLoading] = useState({});
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [imagePreviewAlt, setImagePreviewAlt] = useState('Feedback attachment');

  // Effect: fetch authenticated image blobs for feedback attachments including nested clarifications
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

          // nested clarification attachments (if any)
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
      // Cleanup blob URLs
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
  // Helper to get color based on feedback type
  const getFeedbackColor = feedbackType => {
    switch (feedbackType) {
      case 'QC Feedback':
        return 'purple-text-color';
      case 'Committee Feedback':
        return 'danger-primary-color';
      case 'Send Back':
        return 'danger-primary-color';
      case 'Assessor Clarification':
        return 'blue-text-color';
      default:
        return 'text-3-color';
    }
  };

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

      const initialSelections = (Array.isArray(questions) ? questions : []).reduce((acc, q) => {
        if (!q?.id) {
          return acc;
        }
        const pending = Array.isArray(pendingRcScores) ? pendingRcScores.find(p => String(p.assessmentId) === String(assessmentId) && String(p.questionId) === String(q.id)) : null;
        const pendingSelected = pending?.selectedOption;
        // Modal is used in the live RC meeting (rcScoreApplicable=true): prefer in-session pending pick,
        // else derive from persisted rc_score (option == integer score), else fall back to assessor's pick.
        const selected = pendingSelected !== undefined && pendingSelected !== null && String(pendingSelected) !== '' ? pendingSelected : resolveDisplayedSelectedOption(q?.response, true);
        if (selected !== undefined && selected !== null && String(selected) !== '') {
          acc[q.id] = String(selected);
        }
        return acc;
      }, {});
      setSelectedOptionByQuestion(initialSelections);
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

  const handleSelectedOptionChange = (questionId, optionId) => {
    if (!questionId) {
      return;
    }

    setSelectedOptionByQuestion(prev => ({
      ...prev,
      [questionId]: optionId == null ? '' : String(optionId),
    }));
  };

  const handleCloseSubmitModal = () => setShowSubmitModal(false);
  const handleConfirmSendBack = () => {
    setShowSubmitModal(false);
  };

  // Unsaved if the local option pick or markSendBack action hasn't been
  // committed to pendingRcScores / pendingQcActions via Save & Next yet.
  const localSelectedForCurrent = currentQuestionId ? selectedOptionByQuestion[currentQuestionId] : undefined;
  const pendingRcForCurrent = currentQuestionId
    ? Array.isArray(pendingRcScores)
      ? pendingRcScores.find(p => String(p.assessmentId) === String(assessmentId) && String(p.questionId) === String(currentQuestionId))
      : null
    : null;
  const serverSelectedForCurrent = currentQuestion?.response?.selectedOption;
  const baselineSelectedForCurrent = pendingRcForCurrent ? pendingRcForCurrent.selectedOption : serverSelectedForCurrent;
  const hasUnsavedSelection =
    localSelectedForCurrent !== undefined && localSelectedForCurrent !== null && String(localSelectedForCurrent) !== '' && String(localSelectedForCurrent) !== String(baselineSelectedForCurrent ?? '');
  const hasUnsavedAction = Boolean(pendingAction.action);
  const hasUnsavedChanges = hasUnsavedSelection || hasUnsavedAction;

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };
  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const modalTitle = <div>{parameterData[0]?.title || 'Parameter Questions'}</div>;

  const handlePrev = () => {
    setCurrentQuestionIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = async () => {
    const status = currentQuestionStatus;
    const allowed = ['sent_back', 'send_back', 'clarification_required', 'certified'];
    const alreadyActioned = allowed.includes(status);

    const selectedOption = selectedOptionByQuestion[currentQuestionId];
    const serverSelectedOption = currentQuestion?.response?.selectedOption;
    const hasPendingResponseSelection = Boolean(
      currentQuestionId && selectedOption !== undefined && selectedOption !== null && String(selectedOption) !== '' && String(selectedOption) !== String(serverSelectedOption ?? ''),
    );

    // Committee changing an option must NOT mutate the assessor's response (SA score).
    // - If committee picked a different option: derive RC from the chosen option locally.
    // - If committee did not change the option: copy SA score into RC.
    // The bulk RC API flushes pendingRcScores on Certify / Send Back.
    // When the review is locked (meeting ended), never stage RC scores or actions — just navigate.
    if (!alreadyActioned && !readOnly) {
      if (hasPendingResponseSelection) {
        // BE serializes options as an object keyed by option number ({1: {text, score}, ...});
        // selectedOption is that key ("1"–"5"). Normalize both array and object forms.
        const rawOpts = currentQuestion?.options;
        let picked = null;
        if (Array.isArray(rawOpts)) {
          picked = rawOpts.find((o, i) => String(o?.id ?? i) === String(selectedOption));
        } else if (rawOpts && typeof rawOpts === 'object') {
          picked = rawOpts[selectedOption] ?? rawOpts[String(selectedOption)] ?? null;
        }
        const rawRcScore = picked?.score ?? picked?.optionScore ?? picked?.weight ?? picked?.value ?? null;
        const parsedRcScore = rawRcScore !== null && rawRcScore !== undefined ? parseFloat(rawRcScore) : NaN;
        if (!isNaN(parsedRcScore)) {
          dispatch(
            addPendingRcScore({
              assessmentId,
              questionId: currentQuestionId,
              rcScore: parsedRcScore,
              selectedOption: String(selectedOption),
            }),
          );
        } else {
          // Option lookup failed (likely null score in DB). Fall back to SA score so the
          // user is not blocked. Still log for backend follow-up.
          Logger.warn('Could not derive RC score from selected option; falling back to SA score', { questionId: currentQuestionId, selectedOption });
          const saScore = currentQuestion?.response?.score ?? currentQuestion?.score ?? null;
          const parsedSaScore = saScore !== null && saScore !== undefined ? parseFloat(saScore) : NaN;
          if (!isNaN(parsedSaScore)) {
            dispatch(
              addPendingRcScore({
                assessmentId,
                questionId: currentQuestionId,
                rcScore: parsedSaScore,
                selectedOption: String(selectedOption),
              }),
            );
          }
        }
      } else {
        const saScore = currentQuestion?.response?.score ?? currentQuestion?.score ?? null;
        const parsedSaScore = saScore !== null && saScore !== undefined ? parseFloat(saScore) : NaN;
        if (!isNaN(parsedSaScore)) {
          dispatch(
            addPendingRcScore({
              assessmentId,
              questionId: currentQuestionId,
              rcScore: parsedSaScore,
              selectedOption: String(serverSelectedOption ?? ''),
            }),
          );
        }
      }

      if (pendingAction.action === 'markSendBack' && !pendingAction.comment.trim()) {
        setValidationError('Comment is required for Send Back.');
        return;
      }

      setActionLoading(true);
      try {
        const existingPendingAction = Array.isArray(pendingQcActions)
          ? pendingQcActions.find(p => String(p.assessmentId) === String(assessmentId) && String(p.questionId) === String(currentQuestionId))
          : null;

        const resolvedActionType = pendingAction.action || existingPendingAction?.type || 'approve';
        const resolvedActionComment = pendingAction.action ? (pendingAction.comment ? pendingAction.comment.trim() : null) : (existingPendingAction?.comment ?? null);

        // Store pending QC action in redux for batch submission from AssessmentDetails
        const pendingItem = {
          assessmentId,
          questionId: currentQuestionId || null,
          type: resolvedActionType,
          comment: resolvedActionComment,
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
        <AppButton variant="tertiary" size="medium" title="Cancel" onClick={handleRequestClose} />
      ) : (
        <AppButton variant="tertiary" size="medium" title="Previous" onClick={handlePrev} />
      )}
      <AppButton
        title={readOnly ? (currentQuestionIndex === questions.length - 1 ? 'Close' : 'Next') : currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Save & Next'}
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
        <AppAssessmentQuestions
          questions={questions}
          currentQIndex={currentQuestionIndex}
          sendBackBtn={sendBackBtn}
          editComment={false}
          modalFooter={modalFooter}
          assessmentId={assessmentId}
          validationError={validationError}
          onActionChange={handleActionChangeFromChild}
          onSelectedOptionChange={handleSelectedOptionChange}
          rcScoreApplicable={true}
          readOnly={readOnly}
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

                        {/* Respond to clarification input */}
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

                          {editingClarificationId === item.clarification.id ? (
                            <div className="margin-top-16">
                              <AppInput
                                label={'Edit your clarification'}
                                placeholder="Edit your clarification..."
                                multiline
                                rows={3}
                                value={clarificationText[item.clarification.id]}
                                onChange={e => setClarificationText(prev => ({ ...prev, [item.clarification.id]: e.target.value }))}
                              />
                              {clarificationImages[item.clarification.id]?.length > 0 && (
                                <div className="d-flex flex-wrap gap-2 margin-top-8">
                                  {clarificationImages[item.clarification.id].map(img => (
                                    <div key={img.id} style={{ position: 'relative', width: 80, height: 80 }}>
                                      <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }} />
                                      <button
                                        onClick={() => handleRemoveClarificationImage(item.clarification.id, img.id)}
                                        style={{
                                          position: 'absolute',
                                          top: -8,
                                          right: -8,
                                          background: 'red',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '50%',
                                          width: 20,
                                          height: 20,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: 12,
                                        }}>
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="d-flex gap-2 margin-top-12">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  style={{ display: 'none' }}
                                  id={`edit-clarification-image-${item.clarification.id}`}
                                  onChange={e => handleClarificationImageUpload(item.clarification.id, e)}
                                />
                                <AppButton variant="tertiary" size="small" title="Add Image" onClick={() => document.getElementById(`edit-clarification-image-${item.clarification.id}`)?.click()} />
                                <AppButton
                                  variant="primary"
                                  size="small"
                                  title="Update"
                                  onClick={() => handleUpdateClarification(item.clarification.id)}
                                  disabled={clarificationLoading || (!clarificationText[item.clarification.id]?.trim() && clarificationImages[item.clarification.id]?.length === 0)}
                                />
                                <AppButton variant="secondary" size="small" title="Cancel" onClick={() => handleCancelClarification(item.clarification.id)} />
                              </div>
                            </div>
                          ) : (
                            <div className="feedback-message margin-top-10" style={{ background: item.feedbackType === 'QC Feedback' ? 'var(--purple-clarity)' : 'var(--danger-light)' }}>
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
                          )}
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
        rightButton="Confirm"
        rightButtonClassName="w-100 danger-primary"
        rightButtonOnClick={handleConfirmSendBack}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        image={Icons.warningIcon}
        show={showDiscardConfirm}
        handleClose={() => setShowDiscardConfirm(false)}
        header="Discard changes?"
        subHeader="Your selection for this question hasn't been saved. Click Save & Next to record it before closing."
        twoButtons
        leftButton="Keep Editing"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={() => setShowDiscardConfirm(false)}
        rightButton="Discard"
        rightButtonClassName="w-100 danger-primary"
        rightButtonOnClick={handleConfirmDiscard}
      />
    </div>
  );

  // ...modalFooter is now defined above with handlers and state

  return (
    <AppCommonModal
      open={open}
      onClose={handleRequestClose}
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

export default AppParameterQuestionsModal;
