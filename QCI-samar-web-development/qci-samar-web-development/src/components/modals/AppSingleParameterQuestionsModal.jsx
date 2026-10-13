import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { COMMENT_MAX_LENGTH } from '../../constants/appConstants';
import { ASSESSMENT_STATUS } from '../../constants/assessmentStatus';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import {
  deleteResponseEvidenceAction,
  getQuestionFeedbackHistoryAction,
  getResponseEvidencesAction,
  getResponsesAction,
  getSiteTourPicturesAction,
  getStepProgressAction,
  submitResponseAction,
  updateResponseByQuestionAction,
  uploadResponseEvidenceAction,
} from '../../redux/action/common/ApplicationAssessmentAction';
import { postQuestionClarificationAction, updateQuestionClarificationAction } from '../../redux/action/common/AssessmentAction';
import { isMemberExecutionLocked, isServiceSector, resolveTeamRole } from '../../utils/assessmentExecution';
import { formatQuestionScore, resolveDisplayedSelectedOption } from '../../utils/assessmentScoreUtils';
import { fetchAuthenticatedImageFile, fetchAuthenticatedImageUrl, normalizeUploadFileName } from '../../utils/FileUtils';
import { formatDateTime } from '../../utils/formatters';
import { Logger } from '../../utils/logger';
import { hasRole } from '../../utils/roleUtils';
import { AppAssessmentEvidenceImage, AppAvatar, AppButton, AppInput, AppModal } from '../base';
import { toastError, toastSuccess, toastWarning } from '../base/toast';
import EditCommentModal from '../modals/EditCommentModal';
import AppCommonModal from './AppCommonModal';
import ImagePreviewModal from './ImagePreviewModal';
import ParameterReviewProgressModal from './ParameterReviewProgressModal';

// State for feedback image blobs

// Attachments are limited to 5120 KB (5 MB) per file.
const MAX_ATTACHMENT_SIZE_KB = 5120;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_KB * 1024;

// Response evidence is capped at 5 images per question (mirrors mobile).
const MAX_EVIDENCE_IMAGES = 5;

// Clarification replies accept at most 5 attachments (backend validation rejects more).
const MAX_CLARIFICATION_ATTACHMENTS = 5;

const generateClientUuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
    case 'Committee Review':
      return 'Committee Review';
    default:
      return status;
  }
};
const AppSingleParameterQuestionsModal = ({
  open,
  onClose,
  questions = [],
  assessmentId,
  initialQuestionIndex = 0,
  score,
  editComment = false,
  propParameterId,
  parameterData = [],
  data = undefined,
  onActionChange,
  qualitycheckfeedback = false,
  readyforcommitteereview = false,
  certified = false,
  committeeReviewFeedback = false,
  qualityCheck = false,
}) => {
  // Move these above all useState calls
  const { user } = useSelector(state => state.Account);
  const { responses, updateResponseByQuestionResult, punchStatus, siteTourPictures } = useSelector(state => state.ApplicationAssessment);
  const { assessment } = useSelector(state => state.Assessment);
  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  const coAssessorsList = Array.isArray(assessmentData?.coAssessors) ? assessmentData.coAssessors.map(c => c?.id ?? c) : [];
  const isCoAssessor = Boolean(user && coAssessorsList.includes(user.id));

  const parameter = propParameterId ? responses?.parameters?.find(p => String(p.id) === String(propParameterId)) : null;
  const questionsSource = questions && Array.isArray(questions) && questions.length > 0 ? questions : (parameter?.questions ?? responses?.questions);
  const getDefaultAnswers = () => {
    const defaults = {};
    const questions = Array.isArray(questionsSource)
      ? questionsSource
      : questionsSource && typeof questionsSource === 'object'
        ? Object.keys(questionsSource)
            ?.map(k => ({ key: k, ...questionsSource[k] }))
            .sort((a, b) => {
              const ak = Number(a.key);
              const bk = Number(b.key);
              if (!Number.isNaN(ak) && !Number.isNaN(bk)) {
                return ak - bk;
              }
              return 0;
            })
            ?.map(q => ({ id: q.id ?? q.key, questionText: q.questionText ?? q.title ?? '', options: q.options, response: q.response ?? {} }))
        : [];
    const addDefaultsToQuestions = arr =>
      arr.map(q => ({
        ...q,
        assessedAt: q.assessedAt || (q.response && q.response.assessedAt) || new Date().toISOString(),
        assessorRemarks: q.assessorRemarks || (q.response && q.response.assessorRemarks) || 'No comment provided.',
      }));
    const _questionsList = Array.isArray(questionsSource)
      ? addDefaultsToQuestions(questionsSource)
      : questionsSource && typeof questionsSource === 'object'
        ? addDefaultsToQuestions(
            Object.keys(questionsSource)
              ?.map(k => ({ key: k, ...questionsSource[k] }))
              .sort((a, b) => {
                const ak = Number(a.key);
                const bk = Number(b.key);
                if (!Number.isNaN(ak) && !Number.isNaN(bk)) {
                  return ak - bk;
                }
                return 0;
              })
              ?.map(q => ({ id: q.id ?? q.key, questionText: q.questionText ?? q.title ?? '', options: q.options, response: q.response ?? {} })),
          )
        : [];
    const rcScoreApplicable = committeeReviewFeedback || certified;
    questions.forEach(q => {
      const resolved = resolveDisplayedSelectedOption(q?.response, rcScoreApplicable);
      // Leave unanswered questions blank — never pre-select an option; the assessor
      // must make an explicit choice (the backend also rejects a missing option).
      const defaultOpt = resolved !== '' ? resolved : '';
      defaults[q.id] = typeof defaultOpt !== 'undefined' && defaultOpt !== null ? String(defaultOpt) : '';
    });
    return defaults;
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };
  useEffect(() => {
    if (updateResponseByQuestionResult) {
      setModalOpen(false);
    }
  }, [updateResponseByQuestionResult]);
  // Normalize option structures from server into [{id,text}, ...]
  const normalizeOptions = opts => {
    if (Array.isArray(opts)) {
      return opts
        ?.map((o, i) => {
          if (o == null) {
            return null;
          }
          if (typeof o === 'string' || typeof o === 'number') {
            return { id: String(i), text: String(o) };
          }
          return { id: String(o.id ?? i), text: o.text ?? o.optionText ?? o.label ?? '', ...o };
        })
        .filter(Boolean);
    }
    if (opts && typeof opts === 'object') {
      const keys = Object.keys(opts).filter(k => opts[k] != null);
      const numericKeys = keys.every(k => !Number.isNaN(Number(k)));
      const orderedKeys = numericKeys
        ? keys
            .map(k => Number(k))
            .sort((a, b) => a - b)
            .map(String)
        : keys;
      return orderedKeys
        ?.map((k, i) => {
          const v = opts[k];
          if (v == null) {
            return null;
          }
          if (typeof v === 'string' || typeof v === 'number') {
            return { id: String(k ?? i), text: String(v) };
          }
          return { id: String(v.id ?? k ?? i), text: v.text ?? v.optionText ?? v.label ?? '', ...v };
        })
        .filter(Boolean);
    }
    return [];
  };

  // ...existing code...
  const dispatch = useDispatch();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [openParameterReviewProgressModal, setOpenParameterReviewProgressModal] = useState(false);
  const computeInitialIndex = () => {
    const idx = Number.isInteger(Number(initialQuestionIndex)) ? Number(initialQuestionIndex) : 0;
    const max = Math.max(0, Array.isArray(questions) ? questions.length - 1 : 0);
    return Math.max(0, Math.min(idx, max));
  };

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(computeInitialIndex);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [_validationError, setValidationError] = useState('');
  const [_pendingAction, setPendingAction] = useState({ action: '', comment: '' });
  const [_actionLoading, setActionLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState(getDefaultAnswers());
  const [_selectedAction, setSelectedAction] = useState('');
  const [sendBackComment, setSendBackComment] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [comment, setComment] = useState();
  const [uploadedImages, setUploadedImages] = useState([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([]);
  const [editSaveLoading, setEditSaveLoading] = useState(false);
  const [replySaveLoadingId, setReplySaveLoadingId] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [_hasSubmittedComment, setHasSubmittedComment] = useState(false);
  const [editingClarificationId, setEditingClarificationId] = useState(null);
  const [_replyToFeedbackId, setReplyToFeedbackId] = useState(null);
  const [successModal, setSuccessModal] = useState(false);
  const [feedbackImageBlobs, setFeedbackImageBlobs] = useState({});
  const feedbackImageBlobRefs = useRef({});
  const [feedbackImageLoading, setFeedbackImageLoading] = useState({});
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [imagePreviewAlt, setImagePreviewAlt] = useState('Feedback attachment');
  const [answerRemarks, setAnswerRemarks] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [remarksError, setRemarksError] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [answerSaving, setAnswerSaving] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [refreshedEvidences, setRefreshedEvidences] = useState(null);
  const [siteTourPickerOpen, setSiteTourPickerOpen] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState([]);
  const [pickerImageUrls, setPickerImageUrls] = useState({});
  const pickerBlobRefs = useRef({});
  const fetchTimeoutRef = useRef(null);
  const fetchTokenRef = useRef(0);

  // Effect: fetch authenticated image blobs for feedback attachments.
  // Downloads are committed incrementally and already-downloaded blobs are reused across
  // refetches, so existing images never blank when the feedback history refreshes (e.g. right
  // after the assessor posts a reply). Blob URLs are revoked on unmount, not on every change.
  useEffect(() => {
    if (!feedbackHistory || feedbackHistory.length === 0) {
      setFeedbackImageBlobs({});
      setFeedbackImageLoading({});
      return undefined;
    }

    let cancelled = false;

    // Flatten every image attachment (top-level feedback + nested clarification) with its owner id.
    const targets = [];
    feedbackHistory.forEach(item => {
      if (Array.isArray(item.rawFeedback?.attachments)) {
        item.rawFeedback.attachments.forEach(att => {
          if (att.isImage && att.downloadUrl) {
            targets.push({ ownerId: item.id, att });
          }
        });
      }
      if (item.clarification && Array.isArray(item.clarification.rawFeedback?.attachments)) {
        item.clarification.rawFeedback.attachments.forEach(att => {
          if (att.isImage && att.downloadUrl) {
            targets.push({ ownerId: item.clarification.id, att });
          }
        });
      }
    });

    // Show a spinner immediately for attachments not yet downloaded, instead of a blank image.
    setFeedbackImageLoading(prev => {
      const next = { ...prev };
      targets.forEach(({ ownerId, att }) => {
        const alreadyLoaded = Boolean(feedbackImageBlobRefs.current[`${ownerId}_${att.id}`]);
        next[ownerId] = { ...(next[ownerId] || {}), [att.id]: !alreadyLoaded };
      });
      return next;
    });

    Promise.all(
      targets.map(async ({ ownerId, att }) => {
        const key = `${ownerId}_${att.id}`;
        // Reuse a previously downloaded blob so existing images never blank on refetch.
        if (feedbackImageBlobRefs.current[key]) {
          setFeedbackImageBlobs(prev => ({ ...prev, [ownerId]: { ...(prev[ownerId] || {}), [att.id]: feedbackImageBlobRefs.current[key] } }));
          return;
        }
        try {
          const blobUrl = await fetchAuthenticatedImageUrl(att.downloadUrl);
          if (cancelled) {
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
            }
            return;
          }
          if (blobUrl) {
            feedbackImageBlobRefs.current[key] = blobUrl;
            setFeedbackImageBlobs(prev => ({ ...prev, [ownerId]: { ...(prev[ownerId] || {}), [att.id]: blobUrl } }));
          }
        } catch {
          // ignore
        } finally {
          if (!cancelled) {
            setFeedbackImageLoading(prev => ({ ...prev, [ownerId]: { ...(prev[ownerId] || {}), [att.id]: false } }));
          }
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [feedbackHistory]);

  // Revoke all downloaded feedback-image blob URLs when the modal unmounts.
  useEffect(() => {
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
  }, []);
  const handleAddImages = () => {
    const input = document.getElementById('single-image-upload-input');
    if (input) {
      input.click();
    }
  };

  const handleImageUpload = e => {
    const files = filterOversizedFiles(Array.from(e.target.files || []));
    e.target.value = '';
    if (files.length === 0) {
      return;
    }
    // Cap the total staged attachments at the backend limit (existing kept + newly added).
    const remaining = MAX_CLARIFICATION_ATTACHMENTS - uploadedImages.length;
    if (remaining <= 0) {
      toastWarning(`You can attach up to ${MAX_CLARIFICATION_ATTACHMENTS} images.`);
      return;
    }
    const accepted = files.slice(0, remaining);
    if (files.length > remaining) {
      toastWarning(`You can attach up to ${MAX_CLARIFICATION_ATTACHMENTS} images.`);
    }
    const newImages = accepted.map((rawFile, idx) => {
      // Rewrite mismatched extensions (e.g. .jfif → .jpg) so the backend doesn't 422 the upload.
      const file = normalizeUploadFileName(rawFile);
      return { id: Date.now() + idx, url: URL.createObjectURL(file), name: file.name, file };
    });
    setUploadedImages(prev => [...newImages, ...prev]);
  };

  const removeImage = id => {
    setUploadedImages(prev => {
      const imageToRemove = prev.find(img => String(img.id) === String(id));
      if (imageToRemove && !imageToRemove.file && imageToRemove.id !== undefined && imageToRemove.id !== null) {
        setRemovedAttachmentIds(prevIds => (prevIds.includes(String(imageToRemove.id)) ? prevIds : [...prevIds, String(imageToRemove.id)]));
      }
      return prev.filter(img => String(img.id) !== String(id));
    });
  };

  const handleOpenImagePreview = (src, alt = 'Feedback attachment') => {
    setImagePreviewSrc(src || Images.dummySite);
    setImagePreviewAlt(alt);
    setImagePreviewOpen(true);
  };

  // ...existing code...
  // Get current question from normalized source and its ID
  const currentQuestion = questionsSource?.[currentQuestionIndex];
  const currentQuestionId = currentQuestion?.id;
  // default status to 'pending' when not provided
  const currentQuestionStatus = ((currentQuestion && (currentQuestion.committeeReviewStatus || currentQuestion.response?.committeeReviewStatus)) || 'pending').toString().toLowerCase();

  useEffect(() => {
    setRefreshedEvidences(null);
  }, [currentQuestionId]);

  // Initialize comment from current question so UI reflects edits immediately
  useEffect(() => {
    const initial = currentQuestion?.response?.assessorRemarks ?? currentQuestion?.assessorRemarks ?? '';
    setComment(initial);
  }, [currentQuestion]);

  const handleSaveComment = async newComment => {
    setComment(newComment);

    const questionId = currentQuestion?.id;

    if (assessmentId && questionId) {
      const selectedOpt = selectedAnswers?.[questionId] ?? currentQuestion?.response?.selectedOption ?? '';
      await dispatch(updateResponseByQuestionAction({ assessmentId, questionId, data: { assessorRemarks: newComment, selectedOption: selectedOpt } }));
      await dispatch(getResponsesAction(assessmentId));
      setSuccessModal(true);

      setTimeout(() => {
        setSuccessModal(false);
      }, 3000);
    }
  };

  // Fetch feedback history for a specific question id (guard against stale responses)
  const fetchFeedbackHistory = useCallback(
    async (qid, token) => {
      const questionIdToFetch = qid || currentQuestionId;
      if (!assessmentId || !questionIdToFetch) {
        setFeedbackHistory([]);
        return;
      }

      // mark loading only for the latest token
      if (token === fetchTokenRef.current) {
        setFeedbackLoading(true);
      }
      try {
        const response = await dispatch(
          getQuestionFeedbackHistoryAction({
            assessmentId,
            questionId: questionIdToFetch,
          }),
        ).unwrap();

        // Transform API response to match UI format

        // Convert flat feedback list into top-level feedbacks with optional nested `clarification`
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

          // If API already provided a nested clarification object on this feedback, normalize it too
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

        // Only set state if this response belongs to the latest fetch token and matches current question
        if (token === fetchTokenRef.current && questionIdToFetch === currentQuestionId) {
          setFeedbackHistory(topLevel);
        }
      } catch (error) {
        Logger.error('Failed to fetch feedback history:', error);
        if (token === fetchTokenRef.current && questionIdToFetch === currentQuestionId) {
          setFeedbackHistory([]);
        }
      } finally {
        if (token === fetchTokenRef.current && questionIdToFetch === currentQuestionId) {
          setFeedbackLoading(false);
        }
      }
    },
    [dispatch, assessmentId, currentQuestionId],
  );

  // Helper to get color based on feedback type
  const getFeedbackColor = feedbackType => {
    switch (feedbackType) {
      case 'QC Feedback':
        return 'purple-text-color';
      case 'Assessor Clarification':
        return 'blue-text-color';
      case 'Send Back':
        return 'danger-primary-color';
      case 'Committee Feedback':
      case 'Rating Committee Feedback':
        return 'danger-primary-color';
      default:
        return 'text-3-color';
    }
  };

  // Helper to detect assessor clarification without strict equality checks
  const isAssessorClarification = node => {
    if (!node) {
      return false;
    }
    const candidate = (node.feedbackType || node.role || node.rawFeedback?.feedbackType || '').toString().toLowerCase();
    return candidate.includes('assessor');
  };

  const latestClarificationId = feedbackHistory.reduce((latestId, item) => {
    const clarification = item?.clarification;
    if (!clarification) {
      return latestId;
    }

    const currentCreatedAt = clarification?.rawFeedback?.createdAt || clarification?.timestamp || clarification?.createdAt || '';
    const currentTime = currentCreatedAt ? new Date(currentCreatedAt).getTime() : 0;
    if (!latestId) {
      return { id: clarification.id, time: currentTime };
    }

    return currentTime >= latestId.time ? { id: clarification.id, time: currentTime } : latestId;
  }, null)?.id;

  // Set initial question index when modal opens or when initial index changes
  useEffect(() => {
    if (!open) {
      return;
    }
    const idx = Number.isInteger(Number(initialQuestionIndex)) ? Number(initialQuestionIndex) : 0;
    setCurrentQuestionIndex(Math.max(0, Math.min(idx, Math.max(0, questions.length - 1))));
  }, [open, initialQuestionIndex, questions.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    // debounce rapid question changes and cancel previous scheduled fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    // bump token for this scheduled fetch
    fetchTokenRef.current += 1;
    const token = fetchTokenRef.current;

    fetchTimeoutRef.current = setTimeout(() => {
      fetchFeedbackHistory(currentQuestionId, token);
      fetchTimeoutRef.current = null;
    }, 120);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [open, currentQuestionId, fetchFeedbackHistory]);

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

  // ── Assessor answering (service sector) ──
  // Gate: viewer is a team member of THIS assessment, sector is service, the
  // assessment is editable, the assessment_parameters step is actionable for the
  // role, and the parameter is assigned to the viewer (lead may answer any).
  const { isLead, isTeamMember } = resolveTeamRole(assessmentData, user?.id);
  const activeParameter = parameter || (Array.isArray(parameterData) ? parameterData[0] : parameterData) || null;
  const assignedAssessorId = activeParameter?.assignedAssessor?.id ?? activeParameter?.assigned_assessor?.id;
  const assignedToMe = isLead || (assignedAssessorId != null && `${assignedAssessorId}` === `${user?.id}`);
  const isPunchedIn = !!(punchStatus?.isPunchedIn ?? punchStatus?.is_punched_in);
  // Editable while the assessment is running, but locked once this member has
  // submitted their own field work (per-member cutover, not the whole-assessment
  // status which lags until every member is done). Editable throughout the
  // punch-in window; step sequencing no longer gates answering.
  const editableStatus = [ASSESSMENT_STATUS.IN_PROGRESS, ASSESSMENT_STATUS.MOBILE_COMPLETE].includes(assessmentData?.status) && !isMemberExecutionLocked(assessmentData, user?.id);
  const canAnswer = Boolean(!data && isTeamMember && isServiceSector(assessmentData) && editableStatus && isPunchedIn && assignedToMe);

  // Seed the editable remarks from the current question's saved response when
  // the assessor may answer it.
  useEffect(() => {
    if (!canAnswer) {
      return;
    }
    setAnswerRemarks(currentQuestion?.response?.assessorRemarks ?? '');
    setAnswerError('');
    setRemarksError('');
  }, [currentQuestion, canAnswer]);

  // Load the applicant site-tour pool once the answering flow is active — it is
  // the only evidence source for service-sector questions.
  useEffect(() => {
    if (open && canAnswer && assessmentId) {
      dispatch(getSiteTourPicturesAction(assessmentId));
    }
  }, [open, canAnswer, assessmentId, dispatch]);

  // Fetch authenticated thumbnails for the picker while it is open.
  useEffect(() => {
    if (!siteTourPickerOpen) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      const map = {};
      await Promise.all(
        siteTourPool.map(async pic => {
          if (!pic?.downloadUrl) {
            return;
          }
          const url = await fetchAuthenticatedImageUrl(pic.downloadUrl);
          if (url) {
            pickerBlobRefs.current[pic.id] = url;
            map[pic.id] = url;
          }
        }),
      );
      if (!cancelled) {
        setPickerImageUrls(map);
      }
    };
    load();
    return () => {
      cancelled = true;
      Object.values(pickerBlobRefs.current).forEach(u => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
      pickerBlobRefs.current = {};
    };
  }, [siteTourPickerOpen, siteTourPictures]);

  const _handleActionChange = event => {
    const val = event.target.value;
    setSelectedAction(val);

    if (val !== 'markSendBack') {
      setSendBackComment('');
    }

    if (onActionChange) {
      onActionChange(val, val === 'markSendBack' ? sendBackComment : '');
    }
  };

  const handleCloseSubmitModal = () => setShowSubmitModal(false);
  const handleConfirmSendBack = () => {
    setShowSubmitModal(false);
  };
  const handleOptionSelect = async (questionId, optionId) => {
    if (optionsDisabled) {
      return;
    }
    const optionStr = optionId == null ? '' : String(optionId);
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionStr,
    }));

    // In the assessor answering flow the option is persisted explicitly via Save
    // (together with mandatory remarks), not on each selection.
    if (canAnswer) {
      setAnswerError('');
      return;
    }

    try {
      if (assessmentId && questionId) {
        await dispatch(submitResponseAction({ assessmentId, questionId, data: { selectedOption: optionId } })).unwrap();
        // Refresh responses so UI binds to latest server state
        dispatch(getResponsesAction(assessmentId));
      }
    } catch (err) {
      Logger.error('Failed to submit response:', err);
    }
  };

  const siteTourPool = Array.isArray(siteTourPictures) ? siteTourPictures : siteTourPictures?.pictures || [];
  const currentEvidences =
    refreshedEvidences ??
    (currentQuestion && currentQuestion.response && Array.isArray(currentQuestion.response.evidences)
      ? currentQuestion.response.evidences
      : Array.isArray(currentQuestion?.evidence)
        ? currentQuestion.evidence
        : []);

  const refreshEvidences = async questionId => {
    try {
      const response = await dispatch(getResponseEvidencesAction({ assessmentId, questionId })).unwrap();
      setRefreshedEvidences(response?.data?.evidences || response?.data || response || []);
    } catch (err) {
      Logger.error('Failed to refresh evidences:', err);
    }
  };

  const handleSaveAnswer = async () => {
    const questionId = currentQuestion?.id;
    const selectedOpt = selectedAnswers?.[questionId] ?? currentQuestion?.response?.selectedOption ?? '';
    const remarks = (answerRemarks || '').trim();
    if (!selectedOpt) {
      setAnswerError('Please select an option.');
      return;
    }
    if (!remarks) {
      setRemarksError('Comment is required.');
      return;
    }
    if (currentEvidences.length === 0) {
      setEvidenceError('Please attach at least one evidence image.');
      return;
    }
    if (!assessmentId || !questionId) {
      return;
    }
    setAnswerSaving(true);
    onClose?.();
    try {
      await dispatch(updateResponseByQuestionAction({ assessmentId, questionId, data: { selectedOption: selectedOpt, assessorRemarks: remarks } })).unwrap();
      await Promise.all([dispatch(getResponsesAction(assessmentId)), dispatch(getStepProgressAction(assessmentId))]);
      toastSuccess('Response saved successfully');
    } catch (err) {
      Logger.error('Failed to save response:', err);
      toastError('Failed to save response');
    } finally {
      setAnswerSaving(false);
    }
  };

  // Site-tour photos already attached as evidence for this question. The reliable link is
  // sourceSiteTourPictureId, which the backend now stores. Evidence saved
  // before that has no link, so the file name / description fallback stays for those rows. It is
  // a guess: two pictures sharing a title match each other.
  const evidenceMatchesPicture = (evidence, pic) => {
    if (evidence?.sourceSiteTourPictureId != null) {
      return String(evidence.sourceSiteTourPictureId) === String(pic.id);
    }
    if (evidence?.fileName && pic?.fileName) {
      return evidence.fileName === pic.fileName;
    }
    if (evidence?.description && pic?.title) {
      return evidence.description === pic.title;
    }
    return false;
  };

  // Site-tour picture id -> the evidence record it was attached as, so unticking can detach it.
  const attachedEvidenceByPictureId = {};
  siteTourPool.forEach(pic => {
    const match = currentEvidences.find(evidence => evidenceMatchesPicture(evidence, pic));
    if (match) {
      attachedEvidenceByPictureId[pic.id] = match;
    }
  });
  const attachedSiteTourIds = Object.keys(attachedEvidenceByPictureId).map(key => siteTourPool.find(pic => String(pic.id) === String(key))?.id);

  // Evidence not sourced from the site tour (direct uploads) still counts toward the cap.
  const otherEvidenceCount = currentEvidences.length - attachedSiteTourIds.length;

  const openSiteTourPicker = () => {
    setPickerSelectedIds(attachedSiteTourIds);
    setSiteTourPickerOpen(true);
  };

  const closeSiteTourPicker = () => {
    setSiteTourPickerOpen(false);
    setPickerSelectedIds([]);
  };

  const togglePickerImage = id => {
    setPickerSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (otherEvidenceCount + prev.length >= MAX_EVIDENCE_IMAGES) {
        toastWarning(`You can add up to ${MAX_EVIDENCE_IMAGES} images per question.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleAttachSiteTourEvidence = async () => {
    const questionId = currentQuestion?.id;
    // The picker is a two-way sync of the question's site-tour evidence: newly ticked
    // photos are uploaded, and photos unticked since it opened are detached.
    const newlyPickedIds = pickerSelectedIds.filter(id => !attachedSiteTourIds.includes(id));
    const unpickedIds = attachedSiteTourIds.filter(id => !pickerSelectedIds.includes(id));
    if (!questionId || (newlyPickedIds.length === 0 && unpickedIds.length === 0)) {
      closeSiteTourPicker();
      return;
    }
    setEvidenceBusy(true);
    try {
      for (const pictureId of unpickedIds) {
        const evidenceId = attachedEvidenceByPictureId[pictureId]?.id;
        if (evidenceId) {
          await dispatch(deleteResponseEvidenceAction({ assessmentId, questionId, evidenceId })).unwrap();
        }
      }
      const picked = siteTourPool.filter(p => newlyPickedIds.includes(p.id));
      for (const pic of picked) {
        const file = await fetchAuthenticatedImageFile(pic.downloadUrl, pic.fileName || pic.title, `site-tour-${pic.id}`);
        if (!file) {
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', pic.title || 'Site tour evidence');
        formData.append('clientUuid', generateClientUuid());
        // Links the evidence back to its site-tour photo so the picker can show it as attached.
        formData.append('sourceSiteTourPictureId', pic.id);
        if (pic.capturedAt) {
          formData.append('capturedAt', pic.capturedAt);
        }
        if (pic.latitude != null) {
          formData.append('latitude', pic.latitude);
        }
        if (pic.longitude != null) {
          formData.append('longitude', pic.longitude);
        }
        await dispatch(uploadResponseEvidenceAction({ assessmentId, questionId, formData })).unwrap();
      }
      await refreshEvidences(questionId);
      await dispatch(getResponsesAction(assessmentId));
      setEvidenceError('');
      toastSuccess(newlyPickedIds.length > 0 ? 'Evidence attached successfully' : 'Evidence removed');
    } catch (err) {
      Logger.error('Failed to update evidence:', err);
      toastError('Failed to update evidence');
    } finally {
      setEvidenceBusy(false);
      closeSiteTourPicker();
    }
  };

  const handleRemoveEvidence = async evidenceId => {
    const questionId = currentQuestion?.id;
    if (!questionId || !evidenceId) {
      return;
    }
    setEvidenceBusy(true);
    try {
      await dispatch(deleteResponseEvidenceAction({ assessmentId, questionId, evidenceId })).unwrap();
      await refreshEvidences(questionId);
      await dispatch(getResponsesAction(assessmentId));
      toastSuccess('Evidence removed');
    } catch (err) {
      Logger.error('Failed to remove evidence:', err);
      toastError('Failed to remove evidence');
    } finally {
      setEvidenceBusy(false);
    }
  };

  const handleEditClick = () => {
    setModalOpen(true);
  };

  const questionStatus = String((currentQuestion && (currentQuestion.committeeReviewStatus || currentQuestion.response?.committeeReviewStatus)) || '').toLowerCase();
  const _showAction = !data && questionStatus === 'pending';
  // Determine if options should be disabled: assessors answering their assigned
  // parameters may always (re)select; otherwise read-only mode, an existing
  // selected option, or a non-'pending' status locks the choice.
  const optionsDisabled = canAnswer ? false : Boolean(data) || Boolean(currentQuestion?.response?.selectedOption) || currentQuestionStatus !== 'pending';
  const modalTitle = <div>Question {currentQuestionIndex + 1}</div>;
  const isAssessor = hasRole(user, 'assessor');
  const isScoreVisible = !isAssessor;
  const rcScoreApplicable = committeeReviewFeedback || certified;
  const modalContent = (
    <div>
      <div className="questionSteps">
        {/* <AppAssessmentQuestions
      questions={questions}
      currentQIndex={currentQuestionIndex}
      sendBackBtn={true}
      editComment={false}
      assessmentId={assessmentId}
      data={Data}
      validationError={validationError}
      onActionChange={handleActionChangeFromChild}
      /> */}
        <div className="row">
          {/* LEFT SIDE QUESTION */}
          <div className="col-12 col-md-8 support-form-section">
            {(qualitycheckfeedback || committeeReviewFeedback || qualityCheck) &&
              (() => {
                const serverReviewStatus = String(currentQuestion?.reviewStatus ?? currentQuestion?.response?.reviewStatus ?? '').toLowerCase();

                // Determine label based on server review status/type.
                // Only show label when status exists and is not 'pending'.
                const label = serverReviewStatus && serverReviewStatus !== 'pending' ? (serverReviewStatus === 'clarified' ? 'Responded' : 'Clarification Required') : null;

                if (!label) {
                  return null;
                }

                return (
                  <div className="d-flex justify-content-start">
                    <div
                      className="response-container d-inline-flex align-items-center margin-bottom-8"
                      style={{
                        backgroundColor: label === 'Responded' ? 'var(--info-light)' : 'var(--danger-light)',
                        color: label === 'Responded' ? 'var(--info-active)' : 'var(--danger-active)',
                      }}>
                      <div className="response-icon-container margin-right-4">
                        <img src={label === 'Responded' ? Icons.messageEdit : Icons.redFlag} alt="response icon" className="icon-14" />
                      </div>
                      <span className="fs-12 fw-500">{label}</span>
                    </div>
                  </div>
                );
              })()}
            <div>
              <div className="d-flex align-items-start gap-2 mb-3">
                <h3 className="fs-16 fw-600 heading-color mb-0">
                  <span>Q. </span>
                  {currentQuestion ? currentQuestion.questionText || currentQuestion.question || currentQuestion.title || '' : ''}
                </h3>
              </div>
              <FormControl fullWidth>
                <RadioGroup
                  value={
                    currentQuestion && selectedAnswers[currentQuestion.id] !== undefined
                      ? selectedAnswers[currentQuestion.id]
                      : resolveDisplayedSelectedOption(currentQuestion?.response, rcScoreApplicable)
                  }
                  onChange={e => currentQuestion && handleOptionSelect(currentQuestion.id, e.target.value)}>
                  {normalizeOptions(currentQuestion?.options)?.map(opt => (
                    <FormControlLabel
                      disabled={optionsDisabled}
                      key={opt.id}
                      value={opt.id}
                      control={
                        <Radio
                          icon={<img src={optionsDisabled ? Icons.disabledUncheck : Icons.defaultUncheck} className="icon-20" />}
                          checkedIcon={<img src={optionsDisabled ? Icons.disabledRadio : Icons.radioBtn} className="icon-20" />}
                        />
                      }
                      label={opt.text}
                      sx={{
                        '& .MuiFormControlLabel-label': {
                          fontSize: 'var(--fs-sm)',
                          fontFamily: 'Inter-Medium',
                          color: 'var(--text-2)',
                        },
                        '&.Mui-disabled .MuiFormControlLabel-label': {
                          color: '#949494 !important',
                        },
                      }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </div>
          </div>

          {/* RIGHT SIDE COMMENT + EVIDENCE */}
          <div className="col-12 col-md-4 ps-0">
            <div className="padding-left-24">
              {!score && isScoreVisible && (
                <>
                  <div className="d-flex gap-3">
                    <div className="score-box">
                      <span className="score-value text-primary fw-500 fs-20 margin-right-4">{formatQuestionScore(currentQuestion?.response?.score ?? currentQuestion?.score)}</span>
                      <span className="score-label fs-16 fw-500 text-2-color">{isServiceSector(assessmentData) ? 'RA Score' : 'SA Score'}</span>
                    </div>
                    <div className="score-box">
                      <span className="score-value text-primary fw-500 fs-20 margin-right-4">
                        {rcScoreApplicable ? formatQuestionScore(currentQuestion?.response?.rcScore ?? currentQuestion?.rcScore) : '-'}
                      </span>
                      <span className="score-label fs-16 fw-500 text-2-color">{'RC Score'}</span>
                    </div>
                  </div>
                  <p className="horizontal-seperator-20"></p>
                </>
              )}
              {canAnswer ? (
                <>
                  <h3 className="fs-16 fw-600 heading-color margin-bottom-16">Comment</h3>
                  <div className="margin-bottom-16">
                    <AppInput
                      inputType="textarea"
                      multiline
                      minRows={3}
                      maxRows={6}
                      label="Comment"
                      placeholder="Type your remarks here"
                      customWidth="w-100"
                      maxLength={COMMENT_MAX_LENGTH}
                      value={answerRemarks}
                      onChange={e => {
                        setAnswerRemarks(e.target.value);
                        if (answerError) {
                          setAnswerError('');
                        }
                        if (remarksError) {
                          setRemarksError('');
                        }
                      }}
                    />
                    <div className="d-flex justify-content-end">
                      <span className="fs-12 fw-500 text-3-color">
                        {(answerRemarks || '').length}/{COMMENT_MAX_LENGTH}
                      </span>
                    </div>
                    {answerError && <span className="error-text margin-top-4">{answerError}</span>}
                    {remarksError && <span className="error-text d-block margin-top-4">{remarksError}</span>}
                  </div>

                  {/* Evidence (from applicant site-tour pool) */}
                  <h4 className="fs-16 fw-600 heading-color margin-bottom-16">Evidence</h4>
                  <div className="row g-2 margin-bottom-16">
                    {currentEvidences.length === 0 ? (
                      <p className="text-muted">No Evidence</p>
                    ) : (
                      currentEvidences.map((evidence, idx) => (
                        <div className="col-12 col-md-6" key={evidence.id ?? idx}>
                          <div className="position-relative">
                            <AppAssessmentEvidenceImage evidence={evidence} />
                            <div
                              className="remove-image-btn"
                              onClick={e => {
                                e.stopPropagation();
                                if (!evidenceBusy) {
                                  handleRemoveEvidence(evidence.id);
                                }
                              }}>
                              <img src={Icons.whiteCross} alt="Remove" className="icon-8" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {currentEvidences.length < MAX_EVIDENCE_IMAGES && (
                      <div className="col-12 col-md-6 d-flex">
                        <button type="button" className="meeting-picture-picker__option w-100 h-100" onClick={openSiteTourPicker} disabled={evidenceBusy}>
                          <img src={Icons.pickImage} alt="" width="40" height="40" className="meeting-picture-picker__icon" />
                          <span>Pick from Site Tour</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {evidenceError && <span className="error-text d-block margin-top-4">{evidenceError}</span>}

                  <div className="margin-top-16 d-flex justify-content-end">
                    <AppButton variant="primary" size="small" title="Save" onClick={handleSaveAnswer} loading={answerSaving} disabled={answerSaving || evidenceBusy} />
                  </div>
                </>
              ) : (
                <>
                  {/* Comment */}
                  <h3 className="fs-16 fw-600 heading-color margin-bottom-16">Comment</h3>
                  <div className="rowBetween">
                    <div className="d-flex align-items-center">
                      <img src={Icons.calendarFill} className="icon-16" />
                      <div className="margin-left-2 fs-12 fw-500 text-3-color">
                        {currentQuestion && currentQuestion.response && currentQuestion.response.assessedAt
                          ? formatDateTime(currentQuestion.response.assessedAt)
                          : currentQuestion && currentQuestion.assessedAt
                            ? formatDateTime(currentQuestion.assessedAt)
                            : ''}
                      </div>
                    </div>
                    {editComment && <img src={Icons.edit} alt="edit" className="cursor-pointer icon-16 margin-left-4" onClick={handleEditClick} />}
                  </div>

                  <p className="fs-14 fw-400 text-2-color horizontal-seperator-20 margin-top-8">
                    {typeof comment !== 'undefined' && comment !== null ? comment : (currentQuestion?.response?.assessorRemarks ?? currentQuestion?.assessorRemarks ?? '')}
                  </p>

                  {/* Evidence */}
                  <h4 className="fs-16 fw-600 heading-color margin-bottom-16">Evidence</h4>

                  <div className="row g-2">
                    {currentEvidences.length === 0 ? (
                      <p className="text-muted">No Evidence</p>
                    ) : (
                      currentEvidences.map((evidence, idx) => (
                        <div className="col-12 col-md-6" key={idx}>
                          <AppAssessmentEvidenceImage evidence={evidence} />
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
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
                    } ${isAssessorClarification(item) ? 'margin-left-60' : 'margin-left-12'}`}>
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
                            <span className={`fs-12 fw-500 ${item.color}`}>{formatAssessmentStatus(item.feedbackType)}</span>
                          </div>
                          <div />
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
                          {Array.isArray(item.rawFeedback?.attachments) && item.rawFeedback.attachments.length > 0 && (
                            <div className="feedback-attachments d-flex flex-wrap gap-2 margin-top-8">
                              {item.rawFeedback.attachments.map(att =>
                                att.isImage ? (
                                  <div key={att.id} style={{ position: 'relative', maxWidth: 120, maxHeight: 120 }}>
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
                            <div>
                              {isAssessor &&
                                !isCoAssessor &&
                                item.clarification &&
                                !isEditMode &&
                                String(item.clarification.id) === String(latestClarificationId) &&
                                ((item.feedbackType === 'QC Feedback' && qualitycheckfeedback) || (item.feedbackType === 'Committee Feedback' && committeeReviewFeedback)) && (
                                  <img
                                    src={Icons.edit}
                                    alt="edit"
                                    className="cursor-pointer icon-16"
                                    onClick={() => {
                                      setFeedbackComment(prev => ({ ...prev, [item.clarification.id]: item.clarification.message || '' }));
                                      const imgs =
                                        item.clarification && Array.isArray(item.clarification.rawFeedback?.attachments)
                                          ? item.clarification.rawFeedback.attachments
                                              .filter(att => att && att.isImage)
                                              .map(att => ({
                                                id: att.id,
                                                url: feedbackImageBlobs?.[item.clarification.id]?.[att.id] || att.downloadUrl,
                                                name: att.fileName,
                                                file: null,
                                              }))
                                          : [];
                                      setUploadedImages(imgs);
                                      setRemovedAttachmentIds([]);
                                      setIsEditMode(true);
                                      setHasSubmittedComment(false);
                                      setReplyToFeedbackId(item.clarification.id);
                                      setEditingClarificationId(item.clarification.id);
                                    }}
                                  />
                                )}
                            </div>
                          </div>

                          {editingClarificationId === item.clarification.id &&
                          ((item.feedbackType === 'QC Feedback' && qualitycheckfeedback) || (item.feedbackType === 'Committee Feedback' && committeeReviewFeedback)) ? (
                            <div className="comment-input-section">
                              <div className="d-flex justify-content-end">
                                <AppButton
                                  variant="primary"
                                  size="small"
                                  title="Save"
                                  customClass="comment-submit-btn"
                                  loading={editSaveLoading}
                                  disabled={editSaveLoading || !(feedbackComment[editingClarificationId] && feedbackComment[editingClarificationId].trim())}
                                  onClick={async () => {
                                    if (editSaveLoading) {
                                      return;
                                    }
                                    const editText = feedbackComment[editingClarificationId] || '';
                                    if (editText.trim() || uploadedImages.length > 0) {
                                      setEditSaveLoading(true);
                                      const formData = new FormData();
                                      formData.append('comment', editText);
                                      const files = uploadedImages.filter(img => img && img.file).map(img => img.file);
                                      if (files.length > 0) {
                                        files.forEach(file => formData.append('attachments[]', file));
                                      }
                                      if (removedAttachmentIds.length > 0) {
                                        removedAttachmentIds.forEach(attachmentId => formData.append('removeAttachmentIds[]', attachmentId));
                                      }
                                      try {
                                        if (assessmentId && currentQuestionId && editingClarificationId) {
                                          await dispatch(updateQuestionClarificationAction({ assessmentId, questionId: currentQuestionId, feedbackId: editingClarificationId, formData })).unwrap();
                                          fetchTokenRef.current += 1;
                                          await fetchFeedbackHistory(currentQuestionId, fetchTokenRef.current);
                                          await dispatch(getResponsesAction(assessmentId));
                                          // Clear the edit inputs only after the update is confirmed saved and refetched, so a
                                          // failed update keeps the user's edited comment/images instead of silently wiping them.
                                          setFeedbackComment(prev => {
                                            const { [editingClarificationId]: _omit, ...rest } = prev;
                                            return rest;
                                          });
                                          setUploadedImages([]);
                                          setRemovedAttachmentIds([]);
                                          setHasSubmittedComment(true);
                                          setIsEditMode(false);
                                          setEditingClarificationId(null);
                                        }
                                      } catch (err) {
                                        Logger.error('Failed to update clarification:', err);
                                        toastError('Failed to save your changes. Please try again.');
                                      } finally {
                                        setEditSaveLoading(false);
                                      }
                                    }
                                  }}
                                  // leftIcon={Icons.commentSend}
                                  // leftIconStyle="icon-14"
                                />
                              </div>
                              <div className="w-100 margin-top-10 margin-bottom-16">
                                <AppInput
                                  inputType="textarea"
                                  label="Respond to Clarification"
                                  placeholder="Add a comment"
                                  customInputClass="feedback-textarea"
                                  customWidth="w-100"
                                  multiline={true}
                                  isRequired={true}
                                  value={feedbackComment[editingClarificationId] || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setFeedbackComment(prev => ({ ...prev, [editingClarificationId]: val }));
                                  }}
                                />
                              </div>
                              <AppButton
                                variant="secondary"
                                size="small"
                                title="Add Images"
                                leftIcon={Icons.galleryAdd}
                                leftIconStyle="icon-14"
                                customClass="add-images-btn text-nowrap"
                                onClick={handleAddImages}
                              />
                              <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} id="single-image-upload-input" />
                              {uploadedImages.length > 0 && (
                                <div className="uploaded-images-container margin-top-20 d-flex align-items-start gap-2">
                                  <div className="d-flex gap-3">
                                    {uploadedImages.map(image => (
                                      <div key={image.id} className="clarification-img position-relative">
                                        <img src={image.url} alt={image.name} className="img-fluid" />
                                        <div className="remove-image-btn" onClick={() => removeImage(image.id)}>
                                          <img src={Icons.whiteCross} alt="Remove" className="icon-8" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="feedback-message margin-top-10" style={{ background: item.feedbackType === 'QC Feedback' ? 'var(--purple-clarity)' : 'var(--danger-light)' }}>
                              {item.clarification.rcScore !== null && item.clarification.rcScore !== undefined && (
                                <div className="score-span fs-14 margin-bottom-6">
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
                              {!item.clarification.message && !item.clarification.rcScore && <p className="fs-14 fw-400 text-3-color mb-0">No comment provided</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Per-feedback Respond UI */}
                  {isAssessor &&
                    !isCoAssessor &&
                    !item.clarification &&
                    ((item.feedbackType === 'QC Feedback' && qualitycheckfeedback) || (item.feedbackType === 'Committee Feedback' && committeeReviewFeedback)) && (
                      <div className="response-section margin-top-12">
                        <div className="comment-input-section">
                          <div className="d-flex justify-content-end">
                            <AppButton
                              variant="primary"
                              size="small"
                              title="Comment"
                              customClass="comment-submit-btn"
                              loading={replySaveLoadingId === item.id}
                              disabled={replySaveLoadingId === item.id || !(feedbackComment[item.id] && feedbackComment[item.id].trim())}
                              onClick={async () => {
                                if (replySaveLoadingId === item.id) {
                                  return;
                                }
                                const respondText = feedbackComment[item.id] || '';
                                if (respondText.trim() || uploadedImages.length > 0) {
                                  setReplySaveLoadingId(item.id);
                                  const formData = new FormData();
                                  formData.append('comment', respondText);
                                  const files = uploadedImages.filter(img => img && img.file).map(img => img.file);
                                  if (files.length > 0) {
                                    files.forEach(file => formData.append('attachments[]', file));
                                  }
                                  // Attach parent feedback id so backend can nest this as clarification
                                  formData.append('parentFeedbackId', item.id);
                                  try {
                                    if (assessmentId && currentQuestionId) {
                                      await dispatch(postQuestionClarificationAction({ assessmentId, questionId: currentQuestionId, formData })).unwrap();
                                      fetchTokenRef.current += 1;
                                      await fetchFeedbackHistory(currentQuestionId, fetchTokenRef.current);
                                      await dispatch(getResponsesAction(assessmentId));
                                      // Clear the typed reply + staged images only after the reply is confirmed saved and
                                      // refetched. Clearing unconditionally (even on a failed post) is what made the
                                      // comment and images vanish and look like nothing was submitted.
                                      setFeedbackComment(prev => {
                                        const { [item.id]: _omit, ...rest } = prev;
                                        return rest;
                                      });
                                      setUploadedImages([]);
                                      setHasSubmittedComment(true);
                                    }
                                  } catch (err) {
                                    Logger.error('Failed to post clarification for feedback:', err);
                                    toastError('Failed to submit your response. Please try again.');
                                  } finally {
                                    setReplySaveLoadingId(null);
                                  }
                                }
                              }}
                              leftIcon={Icons.commentSend}
                              leftIconStyle="icon-14"
                            />
                          </div>
                          <div className="w-100 margin-top-10 margin-bottom-16">
                            <AppInput
                              inputType="textarea"
                              label="Respond to Clarification"
                              placeholder="Add a comment"
                              customInputClass="feedback-textarea"
                              customWidth="w-100"
                              multiline={true}
                              value={feedbackComment[item.id] || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setFeedbackComment(prev => ({ ...prev, [item.id]: val }));
                              }}
                            />
                          </div>
                          <AppButton
                            variant="secondary"
                            size="small"
                            title="Add Images"
                            leftIcon={Icons.galleryAdd}
                            leftIconStyle="icon-14"
                            customClass="add-images-btn text-nowrap"
                            onClick={handleAddImages}
                          />
                          <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} id="single-image-upload-input" />

                          {uploadedImages.length > 0 && (
                            <div className="uploaded-images-container margin-top-20 d-flex align-items-start gap-2">
                              <div className="d-flex gap-3">
                                {uploadedImages.map(image => (
                                  <div key={image.id} className="clarification-img position-relative">
                                    <img src={image.url} alt={image.name} className="img-fluid" />
                                    <div className="remove-image-btn" onClick={() => removeImage(image.id)}>
                                      <img src={Icons.whiteCross} alt="Remove" className="icon-8" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* Per-feedback respond-to-clarification UI inserted inside each feedback item when needed */}
      <ParameterReviewProgressModal open={openParameterReviewProgressModal} handleClose={() => setOpenParameterReviewProgressModal(false)} isService={isServiceSector(assessmentData)} />
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
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} image={Icons.successCircle} show={successModal} header={'Comment updated successfully'} />
      <EditCommentModal show={modalOpen} handleClose={handleCloseModal} comment={comment} data={currentQuestion?.response} onSave={handleSaveComment} />
      <ImagePreviewModal show={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} src={imagePreviewSrc} alt={imagePreviewAlt} />
      <AppCommonModal
        open={siteTourPickerOpen}
        onClose={closeSiteTourPicker}
        modalHeader={<div>Pick from Site Tour</div>}
        modalContent={
          <div>
            {siteTourPool.length === 0 ? (
              <p className="text-muted text-center py-4">No site tour pictures available</p>
            ) : (
              <div className="row g-3">
                {siteTourPool.map(pic => {
                  const selected = pickerSelectedIds.includes(pic.id);
                  return (
                    <div className="col-6 col-md-4" key={pic.id}>
                      <div
                        className={`site-card position-relative ${selected ? 'border border-primary' : ''}`}
                        style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden' }}
                        onClick={() => togglePickerImage(pic.id)}>
                        <img
                          src={pickerImageUrls[pic.id]}
                          alt={pic.title || 'Site tour'}
                          className="w-100"
                          style={{ height: 120, objectFit: 'cover' }}
                          onError={e => {
                            e.target.src = Images.dummySite;
                          }}
                        />
                        {selected && (
                          <div className="position-absolute" style={{ top: 6, right: 6 }}>
                            <img src={Icons.roundTick} alt="selected" className="icon-20" />
                          </div>
                        )}
                      </div>
                      {pic.title && <p className="fs-12 text-2-color margin-top-4 mb-0 text-truncate">{pic.title}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="d-flex justify-content-end margin-top-16">
              <AppButton
                variant="primary"
                size="small"
                title="Select"
                onClick={handleAttachSiteTourEvidence}
                loading={evidenceBusy}
                disabled={
                  evidenceBusy || (pickerSelectedIds.filter(id => !attachedSiteTourIds.includes(id)).length === 0 && attachedSiteTourIds.filter(id => !pickerSelectedIds.includes(id)).length === 0)
                }
              />
            </div>
          </div>
        }
        paperSx={{
          width: { xs: '100%', sm: '90%', md: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
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
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '1100px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AppSingleParameterQuestionsModal;
