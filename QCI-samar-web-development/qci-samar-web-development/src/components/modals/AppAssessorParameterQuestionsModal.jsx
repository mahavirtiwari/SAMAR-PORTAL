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
  getResponsesAction,
  getSiteTourPicturesAction,
  getStepProgressAction,
  submitResponseAction,
  updateResponseByQuestionAction,
  uploadResponseEvidenceAction,
} from '../../redux/action/common/ApplicationAssessmentAction';
import { onActivate } from '../../utils/a11y';
import { isMemberExecutionLocked, isServiceSector, resolveTeamRole } from '../../utils/assessmentExecution';
import { formatQuestionScore, resolveDisplayedSelectedOption } from '../../utils/assessmentScoreUtils';
import { fetchAuthenticatedImageFile, fetchAuthenticatedImageUrl } from '../../utils/FileUtils';
import { formatDateTime } from '../../utils/formatters';
import { Logger } from '../../utils/logger';
import { hasRole } from '../../utils/roleUtils';
import { AppAssessmentEvidenceImage, AppButton, AppInput, AppModal } from '../base';
import AppIconButton from '../base/AppIconButton';
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

const _formatAssessmentStatus = status => {
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
const AppAssessorParameterQuestionsModal = ({
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
  const _isCoAssessor = Boolean(user && coAssessorsList.includes(user.id));

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
  const [_feedbackLoading, setFeedbackLoading] = useState(false);
  const [_validationError, setValidationError] = useState('');
  const [_pendingAction, setPendingAction] = useState({ action: '', comment: '' });
  const [_actionLoading, setActionLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState(getDefaultAnswers());
  const [_selectedAction, setSelectedAction] = useState('');
  const [sendBackComment, setSendBackComment] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [comment, setComment] = useState();
  const [_uploadedImages, setUploadedImages] = useState([]);
  const [_removedAttachmentIds, setRemovedAttachmentIds] = useState([]);
  const [_editSaveLoading, _setEditSaveLoading] = useState(false);
  const [_replySaveLoadingId, _setReplySaveLoadingId] = useState(null);
  const [_feedbackComment, _setFeedbackComment] = useState({});
  const [_isEditMode, _setIsEditMode] = useState(false);
  const [_hasSubmittedComment, _setHasSubmittedComment] = useState(false);
  const [_editingClarificationId, _setEditingClarificationId] = useState(null);
  const [_replyToFeedbackId, _setReplyToFeedbackId] = useState(null);
  const [successModal, setSuccessModal] = useState(false);
  const [_feedbackImageBlobs, setFeedbackImageBlobs] = useState({});
  const feedbackImageBlobRefs = useRef({});
  const [_feedbackImageLoading, setFeedbackImageLoading] = useState({});
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
  const [imagePreviewAlt, setImagePreviewAlt] = useState('Feedback attachment');
  const [answerRemarks, setAnswerRemarks] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [remarksError, setRemarksError] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [answerSaving, setAnswerSaving] = useState(false);
  const [evidenceBusy] = useState(false);
  const [refreshedEvidences, setRefreshedEvidences] = useState(null);
  // Evidence is staged locally and persisted only on Save & Next (like option + remark). Holds the
  // desired evidence list for the current question: saved evidence objects plus pending site-tour
  // pool pictures (marked __pending) that upload on save.
  // Evidence changes are persisted only on Save & Next. Saved evidence is read live from the
  // response every render; these hold just the local diff — pool pictures staged to upload and
  // saved-evidence ids staged to remove — and both reset on navigation.
  // Carries the id of the question the diff was made on: the modal stays mounted across questions,
  // and two questions in different parameters can share a position, so position cannot identify it.
  const [stagedEvidence, setStagedEvidence] = useState({ questionId: null, pending: [], removedIds: [] });
  const [siteTourPickerOpen, setSiteTourPickerOpen] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState([]);
  const [pickerImageUrls, setPickerImageUrls] = useState({});
  const pickerBlobRefs = useRef({});
  const fetchTimeoutRef = useRef(null);
  const fetchTokenRef = useRef(0);

  // Effect: fetch authenticated image blobs for feedback attachments
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
          // top-level attachments
          if (Array.isArray(item.rawFeedback?.attachments)) {
            blobs[item.id] = blobs[item.id] || {};
            loading[item.id] = loading[item.id] || {};
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
            blobs[cid] = blobs[cid] || {};
            loading[cid] = loading[cid] || {};
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
  const _handleAddImages = () => {
    const input = document.getElementById('single-image-upload-input');
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
    const newImages = files.map((file, idx) => ({ id: Date.now() + idx, url: URL.createObjectURL(file), name: file.name, file }));
    setUploadedImages(prev => [...newImages, ...prev]);
    e.target.value = '';
  };

  const _removeImage = id => {
    setUploadedImages(prev => {
      const imageToRemove = prev.find(img => String(img.id) === String(id));
      if (imageToRemove && !imageToRemove.file && imageToRemove.id !== undefined && imageToRemove.id !== null) {
        setRemovedAttachmentIds(prevIds => (prevIds.includes(String(imageToRemove.id)) ? prevIds : [...prevIds, String(imageToRemove.id)]));
      }
      return prev.filter(img => String(img.id) !== String(id));
    });
  };

  const _handleOpenImagePreview = (src, alt = 'Feedback attachment') => {
    setImagePreviewSrc(src || Images.dummySite);
    setImagePreviewAlt(alt);
    setImagePreviewOpen(true);
  };

  // ...existing code...
  // Get current question from normalized source and its ID
  const currentQuestion = questionsSource?.[currentQuestionIndex];
  const currentQuestionId = currentQuestion?.id;
  const totalQuestions = questionsSource?.length || 0;
  // default status to 'pending' when not provided
  const currentQuestionStatus = ((currentQuestion && (currentQuestion.committeeReviewStatus || currentQuestion.response?.committeeReviewStatus)) || 'pending').toString().toLowerCase();

  useEffect(() => {
    setRefreshedEvidences(null);
    // Leaving a question discards its unsaved evidence pick, matching the remark and option, which
    // are re-seeded from the saved response. The identity guard on the staged diff is the safety
    // net for the case this effect cannot cover: two questions sharing a position.
    setStagedEvidence({ questionId: null, pending: [], removedIds: [] });
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
  const _isAssessorClarification = node => {
    if (!node) {
      return false;
    }
    const candidate = (node.feedbackType || node.role || node.rawFeedback?.feedbackType || '').toString().toLowerCase();
    return candidate.includes('assessor');
  };

  const _latestClarificationId = feedbackHistory.reduce((latestId, item) => {
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
  }, [currentQuestionId]);

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

  // Re-seed the editable answer (remark + option) from the current question's saved response
  // on every question change. Previous does not save, so this discards any unsaved edit and
  // keeps navigation showing the saved server answer instead of carrying stale data across
  // questions.
  useEffect(() => {
    if (!canAnswer) {
      return;
    }
    setAnswerRemarks(currentQuestion?.response?.assessorRemarks ?? '');
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestionId]: currentQuestion?.response?.selectedOption == null ? '' : String(currentQuestion.response.selectedOption),
    }));
    setAnswerError('');
    setRemarksError('');
    // Re-seed on question identity and when the saved answer VALUES arrive/change. Keying on the
    // primitive saved remark/option — not the response object — means a plain refetch that returns
    // the same saved answer does NOT re-run this (so it never wipes still-unsaved edits), while the
    // initial load still seeds the first question once its response finally arrives from the server.
  }, [currentQuestionId, canAnswer, currentQuestion?.response?.assessorRemarks, currentQuestion?.response?.selectedOption]);

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

  // `closeAfter` is the old single-question behaviour (Save closes the modal). The
  // Save & Next footer keeps the modal open and reports success so it can advance.
  const handleSaveAnswer = async ({ closeAfter = true } = {}) => {
    const questionId = currentQuestion?.id;
    const selectedOpt = selectedAnswers?.[questionId] ?? currentQuestion?.response?.selectedOption ?? '';
    const remarks = (answerRemarks || '').trim();
    const missingOption = !selectedOpt;
    const missingRemarks = !remarks;
    setAnswerError(missingOption ? 'Please select an option.' : '');
    setRemarksError(missingRemarks ? 'Comment is required.' : '');
    if (missingOption || missingRemarks) {
      return false;
    }
    if (!assessmentId || !questionId) {
      return false;
    }
    setAnswerSaving(true);
    if (closeAfter) {
      onClose?.();
    }
    try {
      // Persist staged evidence (uploads/deletes) first, then the option + remark, so the whole
      // answer saves as one Save & Next action.
      await persistStagedEvidence(questionId);
      await dispatch(updateResponseByQuestionAction({ assessmentId, questionId, data: { selectedOption: selectedOpt, assessorRemarks: remarks } })).unwrap();
      // Cleared before the refetch: once the save itself has succeeded there is nothing left to
      // retry, and leaving it set lets the refetched saved evidence and the still-pending picks
      // render together for a frame, showing each photo twice.
      setStagedEvidence({ questionId: null, pending: [], removedIds: [] });
      await Promise.all([dispatch(getResponsesAction(assessmentId)), dispatch(getStepProgressAction(assessmentId))]);
      toastSuccess('Response saved successfully');
      return true;
    } catch (err) {
      Logger.error('Failed to save response:', err);
      toastError('Failed to save response');
      return false;
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

  // The site-tour pool picture a staged evidence item represents: pending items carry it directly;
  // saved items are matched by sourceSiteTourPictureId / file name.
  const stagedPictureIdOf = item => {
    if (item?.__pending) {
      return item.__pic?.id ?? item.sourceSiteTourPictureId;
    }
    const pic = siteTourPool.find(p => evidenceMatchesPicture(item, p));
    return pic?.id ?? item?.sourceSiteTourPictureId ?? null;
  };
  // The staged diff belongs to one question. Reading it through this guard means a diff staged on
  // another question can never be rendered, instead of relying on a reset effect to clear it in time.
  const stagedIsForCurrentQuestion = stagedEvidence.questionId != null && String(stagedEvidence.questionId) === String(currentQuestionId);
  const pendingEvidences = stagedIsForCurrentQuestion ? stagedEvidence.pending : [];
  const removedSavedEvidenceIds = stagedIsForCurrentQuestion ? stagedEvidence.removedIds : [];

  // Saved evidence is read live from the response; the displayed list is saved-minus-removed plus
  // the pending picks, so navigation always reflects the current question with the local diff.
  const savedEvidences = Array.isArray(currentQuestion?.response?.evidences) ? currentQuestion.response.evidences : [];
  const displayedEvidences = [
    ...savedEvidences.filter(evidence => evidence?.id == null || !removedSavedEvidenceIds.includes(evidence.id)),
    ...pendingEvidences.map(pic => ({
      __pending: true,
      __pic: pic,
      id: `pending-${pic.id}`,
      downloadUrl: pic.downloadUrl,
      // Mirrors the `description` the upload sends, so the preview shows the comment before saving too.
      description: pic.title,
      latitude: pic.latitude,
      longitude: pic.longitude,
      capturedAt: pic.capturedAt,
      sourceSiteTourPictureId: pic.id,
    })),
  ];
  const attachedSiteTourIds = displayedEvidences.map(stagedPictureIdOf).filter(picId => picId != null);

  // Evidence not sourced from the site tour still counts toward the cap.
  const otherEvidenceCount = displayedEvidences.length - attachedSiteTourIds.length;

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
        // This picker is a full-height right-edge panel, so its Cancel/Select footer
        // sits at the same bottom-right corner the toast defaults to. Anchor to the
        // top-right instead so the warning never covers those buttons.
        toastWarning(`You can add up to ${MAX_EVIDENCE_IMAGES} images per question.`, { anchorOrigin: { vertical: 'top', horizontal: 'right' } });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleAttachSiteTourEvidence = () => {
    // Stage the picker selection locally; nothing is uploaded/deleted until Save & Next.
    const pickedSet = new Set(pickerSelectedIds.map(String));
    const savedPictureIds = new Set(savedEvidences.map(ev => String(stagedPictureIdOf(ev))));
    // Newly ticked pool pictures that aren't already saved evidence become pending uploads.
    setStagedEvidence({
      questionId: currentQuestionId,
      pending: siteTourPool.filter(pic => pickedSet.has(String(pic.id)) && !savedPictureIds.has(String(pic.id))),
      // Saved evidence whose picture is no longer ticked is staged for removal.
      removedIds: savedEvidences.filter(ev => ev?.id != null && !pickedSet.has(String(stagedPictureIdOf(ev)))).map(ev => ev.id),
    });
    setEvidenceError('');
    closeSiteTourPicker();
  };

  // Remove an evidence item locally (nothing is deleted server-side until Save & Next): a pending
  // pick is dropped; a saved item is staged for deletion.
  const handleRemoveStagedEvidence = item => {
    if (item?.__pending) {
      const picId = String(item.__pic?.id ?? item.sourceSiteTourPictureId);
      setStagedEvidence({
        questionId: currentQuestionId,
        pending: pendingEvidences.filter(pic => String(pic.id) !== picId),
        removedIds: removedSavedEvidenceIds,
      });
    } else if (item?.id != null) {
      setStagedEvidence({
        questionId: currentQuestionId,
        pending: pendingEvidences,
        removedIds: removedSavedEvidenceIds.includes(item.id) ? removedSavedEvidenceIds : [...removedSavedEvidenceIds, item.id],
      });
    }
  };

  // Persist the staged evidence diff against what the server holds for the question: delete saved
  // evidence removed from the staged list, upload the pending picks. Called from Save & Next.
  const persistStagedEvidence = async questionId => {
    for (const evidenceId of removedSavedEvidenceIds) {
      if (evidenceId != null) {
        await dispatch(deleteResponseEvidenceAction({ assessmentId, questionId, evidenceId })).unwrap();
      }
    }
    for (const pic of pendingEvidences) {
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
  const modalTitle = (
    <div>
      Question {currentQuestionIndex + 1}
      {totalQuestions > 0 ? `/${totalQuestions}` : ''}
    </div>
  );
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
            {(qualitycheckfeedback || committeeReviewFeedback) &&
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
                        <img src={label === 'Responded' ? Icons.messageEdit : Icons.redFlag} alt="" className="icon-14" />
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
                  <span className="asterics">*</span>
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
                          icon={<img alt="" src={optionsDisabled ? Icons.disabledUncheck : Icons.defaultUncheck} className="icon-20" />}
                          checkedIcon={<img alt="" src={optionsDisabled ? Icons.disabledRadio : Icons.radioBtn} className="icon-20" />}
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
              {answerError && <span className="error-text d-block margin-top-4">{answerError}</span>}
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
                  <div className="margin-bottom-16">
                    <AppInput
                      inputType="textarea"
                      multiline
                      minRows={3}
                      maxRows={6}
                      label="Comment"
                      placeholder="Type your comment here"
                      customWidth="w-100"
                      maxLength={COMMENT_MAX_LENGTH}
                      isRequired
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
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <span className="error-text">{remarksError || ''}</span>
                      <span className="fs-12 fw-500 text-3-color flex-shrink-0">
                        {(answerRemarks || '').length}/{COMMENT_MAX_LENGTH}
                      </span>
                    </div>
                  </div>

                  {/* Evidence (from applicant site-tour pool) — optional for the assessor. */}
                  <h4 className="fs-16 fw-600 heading-color margin-bottom-16">
                    Evidence <span className="fs-14 fw-500 text-3-color">(Optional)</span>
                  </h4>
                  <div className="row g-2 margin-bottom-16">
                    {displayedEvidences.map((evidence, idx) => (
                      <div className="col-12 col-md-6" key={evidence.id ?? idx}>
                        <div className="position-relative">
                          <AppAssessmentEvidenceImage evidence={evidence} />
                          <div
                            className="remove-image-btn"
                            {...onActivate(e => {
                              e.stopPropagation();
                              handleRemoveStagedEvidence(evidence);
                            })}>
                            <img src={Icons.whiteCross} alt="Remove" className="icon-8" />
                          </div>
                        </div>
                      </div>
                    ))}
                    {displayedEvidences.length < MAX_EVIDENCE_IMAGES && (
                      // With nothing attached the picker owns the full row; once there is
                      // evidence it sits beside the thumbnails.
                      <div className={`${displayedEvidences.length === 0 ? 'col-12' : 'col-6'} d-flex`}>
                        <button type="button" className="meeting-picture-picker__option w-100 h-100" onClick={openSiteTourPicker} disabled={evidenceBusy}>
                          <img src={Icons.pickImage} alt="" width="40" height="40" className="meeting-picture-picker__icon" />
                          <span>Pick from Site Tour</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {evidenceError && <span className="error-text d-block margin-top-4">{evidenceError}</span>}
                </>
              ) : (
                <>
                  {/* Comment */}
                  <h3 className="fs-16 fw-600 heading-color margin-bottom-16">Comment</h3>
                  <div className="rowBetween">
                    <div className="d-flex align-items-center">
                      <img alt="" src={Icons.calendarFill} className="icon-16" />
                      <div className="margin-left-2 fs-12 fw-500 text-3-color">
                        {currentQuestion && currentQuestion.response && currentQuestion.response.assessedAt
                          ? formatDateTime(currentQuestion.response.assessedAt)
                          : currentQuestion && currentQuestion.assessedAt
                            ? formatDateTime(currentQuestion.assessedAt)
                            : ''}
                      </div>
                    </div>
                    {editComment && <AppIconButton icon={Icons.edit} label="Edit" iconClassName="icon-16" className="margin-left-4" onClick={handleEditClick} />}
                  </div>

                  <p className="fs-14 fw-400 text-2-color horizontal-seperator-20 margin-top-8">
                    {typeof comment !== 'undefined' && comment !== null ? comment : (currentQuestion?.response?.assessorRemarks ?? currentQuestion?.assessorRemarks ?? '')}
                  </p>

                  {/* Evidence */}
                  <h4 className="fs-16 fw-600 heading-color margin-bottom-16">Evidence</h4>

                  <div className="row g-2">
                    {currentEvidences.map((evidence, idx) => (
                      <div className="col-12 col-md-6" key={idx}>
                        <AppAssessmentEvidenceImage evidence={evidence} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
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
        modalHeader={<div className="site-tour-picker__title">Pick from Site Tour</div>}
        modalContent={
          siteTourPool.length === 0 ? (
            <p className="text-muted text-center py-4">No site tour pictures available</p>
          ) : (
            // The pool can run to 150 photos, so the grid scrolls inside the modal body.
            <div className="site-tour-picker__grid">
              <div className="row g-3">
                {siteTourPool.map(pic => {
                  const selected = pickerSelectedIds.includes(pic.id);
                  return (
                    <div className="col-6 col-md-4" key={pic.id}>
                      <div className={`site-tour-picker__card ${selected ? 'site-tour-picker__card--selected' : ''}`} {...onActivate(() => togglePickerImage(pic.id))}>
                        <div className="site-tour-picker__thumb">
                          <img
                            src={pickerImageUrls[pic.id]}
                            alt={pic.title || 'Site tour'}
                            onError={e => {
                              e.target.src = Images.dummySite;
                            }}
                          />
                          <span className={`site-tour-picker__tick ${selected ? 'site-tour-picker__tick--on' : ''}`}>
                            {selected && <img src={Icons.roundTick} alt="selected" className="icon-20" />}
                          </span>
                        </div>
                        <div className="site-tour-picker__meta">
                          <p className="fs-14 fw-500 heading-color mb-0 text-truncate">{pic.title || 'Site Tour Photo'}</p>
                          <p className="fs-12 fw-400 text-3-color mb-0">{pic.capturedAt ? formatDateTime(pic.capturedAt) : ''}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        }
        modalFooter={
          <div className="d-flex justify-content-end gap-2 w-100">
            <AppButton variant="tertiary" size="medium" title="Cancel" onClick={closeSiteTourPicker} disabled={evidenceBusy} />
            <AppButton
              variant="primary"
              size="medium"
              title="Select"
              onClick={handleAttachSiteTourEvidence}
              loading={evidenceBusy}
              disabled={
                evidenceBusy || (pickerSelectedIds.filter(id => !attachedSiteTourIds.includes(id)).length === 0 && attachedSiteTourIds.filter(id => !pickerSelectedIds.includes(id)).length === 0)
              }
            />
          </div>
        }
        dialogProps={{ fullWidth: false }}
        paperSx={{
          position: 'fixed',
          top: 0,
          right: 0,
          margin: 0,
          height: '100%',
          maxHeight: '100%',
          width: { xs: '100%', sm: '520px', md: '600px' },
          maxWidth: '100vw',
          borderRadius: 0,
        }}
      />
    </div>
  );
  const isLastQuestion = currentQuestionIndex >= totalQuestions - 1;

  const handlePrevQuestion = () => {
    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
  };

  // Saves the current answer, then moves on. On the last question it closes instead.
  // A question the assessor cannot answer (read-only) just navigates.
  const handleSaveAndNext = async () => {
    if (canAnswer) {
      const saved = await handleSaveAnswer({ closeAfter: false });
      if (!saved) {
        return;
      }
    }
    if (isLastQuestion) {
      onClose?.();
      return;
    }
    setCurrentQuestionIndex(prev => Math.min(totalQuestions - 1, prev + 1));
  };

  const modalFooter =
    totalQuestions > 0 ? (
      <div className="rowBetween w-100">
        {currentQuestionIndex === 0 ? (
          <AppButton variant="tertiary" size="medium" title="Cancel" onClick={onClose} />
        ) : (
          <AppButton variant="tertiary" size="medium" title="Previous" onClick={handlePrevQuestion} />
        )}
        <AppButton
          title={canAnswer ? (isLastQuestion ? 'Finish' : 'Save & Next') : isLastQuestion ? 'Close' : 'Next'}
          size="medium"
          rightIcon={isLastQuestion ? undefined : Icons.rightWhiteArrow}
          rightIconStyle={'icon-16'}
          onClick={handleSaveAndNext}
          loading={answerSaving}
          disabled={answerSaving || evidenceBusy}
        />
      </div>
    ) : null;

  return (
    <AppCommonModal
      open={open}
      onClose={onClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '1100px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AppAssessorParameterQuestionsModal;
