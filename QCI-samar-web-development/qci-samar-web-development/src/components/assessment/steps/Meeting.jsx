import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { ASSESSMENT_STATUS } from '../../../constants/assessmentStatus';
import Icons from '../../../constants/Icons';
import Images from '../../../constants/Images';
import useGeolocation from '../../../hooks/useGeolocation';
import useLiveRefresh from '../../../hooks/useLiveRefresh';
import {
  addMeetingParticipantAction,
  createMeetingAction,
  getClosingMeetingAction,
  getOpeningMeetingAction,
  getResponsesAction,
  getStepProgressAction,
  removeMeetingParticipantAction,
  updateMeetingCommentsAction,
} from '../../../redux/action/common/ApplicationAssessmentAction';
import { getAssessmentByIdAction } from '../../../redux/action/common/AssessmentAction';
import { isMemberExecutionLocked, isServiceSector, resolveTeamRole } from '../../../utils/assessmentExecution';
import { getCachedImageUrl } from '../../../utils/FileUtils';
import { formatCoordinates, formatDateTimeOrDash, formatPersonName } from '../../../utils/formatters';
import { hasRole } from '../../../utils/roleUtils';
import { AppButton, AppInput, AppWebcamCapture } from '../../base';
import AppCommentCard from '../../base/AppCommentCard';
import ParticipantCard from '../../base/ParticipantCard';
import { toastError, toastSuccess } from '../../base/toast';
import AppCommonModal from '../../modals/AppCommonModal';
import SitePictureDetailsModal from '../../modals/SitePictureDetailsModal';

// An enterprise representative is a participant with no linked assessment team member;
// participantType is not reliably set on every payload, so it cannot be the only test.
const isExternalParticipant = participant => participant?.participantType === 'external' || !participant?.teamMember;

// Map a raw team role onto the label shown against an assessor's remark.
const roleLabel = role => {
  const normalized = String(role || '').toLowerCase();
  if (normalized.includes('lead')) {
    return 'Lead Assessor';
  }
  if (normalized.includes('co')) {
    return 'Co-Assessor';
  }
  return 'Assessor';
};

/**
 * Shared Meeting component for Steps 3 (Opening) and 7 (Closing) of Assessment
 * @param {Object} props
 * @param {'opening' | 'closing'} props.type - Type of meeting
 * @param {Function} props.onEditComment - Callback when editing a comment
 * @param {Function} props.onSaved - Called once the save succeeded and step progress is refreshed; the host advances to the next step. Read-only viewers omit it.
 */
const Meeting = ({ type = 'opening', onEditComment, onSaved }) => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const [modalOpen, setModalOpen] = useState(false);

  const isOpening = type === 'opening';
  const { user } = useSelector(state => state.Account);
  const { assessment } = useSelector(state => state.Assessment);

  const {
    openingMeeting,
    openingMeetingLoading,
    openingMeetingError,
    openingMeetingPendingComments,
    closingMeeting,
    closingMeetingLoading,
    closingMeetingError,
    closingMeetingPendingComments,
    punchStatus,
    meetingActionLoading,
    responses,
    responsesLoading,
  } = useSelector(state => state.ApplicationAssessment);

  const assessmentData = assessment?.data?.assessment || assessment?.assessment || assessment;
  // Editable while the assessment is running, but locked the moment this member
  // submits their own field work — the per-member cutover, not the lagging
  // whole-assessment status.
  const isEditableStatus =
    (assessmentData?.status === ASSESSMENT_STATUS.SCHEDULED || assessmentData?.status === ASSESSMENT_STATUS.IN_PROGRESS || assessmentData?.status === ASSESSMENT_STATUS.MOBILE_COMPLETE) &&
    !isMemberExecutionLocked(assessmentData, user?.id);
  const isPunchedIn = !!(punchStatus?.isPunchedIn ?? punchStatus?.is_punched_in);

  const canEditComments = isEditableStatus;

  const meeting = isOpening ? openingMeeting : closingMeeting;
  const loading = isOpening ? openingMeetingLoading : closingMeetingLoading;
  const error = isOpening ? openingMeetingError : closingMeetingError;
  const meetingData = meeting;
  // "No saved meeting yet" keys off the persisted participants, not meetingData's
  // truthiness: the GET can return a truthy-but-empty envelope for a not-yet-created
  // meeting, which would otherwise suppress the closing-meeting seed and the capture form.
  const hasSavedParticipants = Array.isArray(meetingData?.participants) && meetingData.participants.length > 0;
  const { isLead } = resolveTeamRole(assessmentData, user?.id);
  // Editable throughout the punch-in window; step sequencing no longer gates capture.
  const canLeadCapture = isLead && isServiceSector(assessmentData) && isEditableStatus && isPunchedIn;
  const { getPosition } = useGeolocation();
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoPreviewRef = useRef(null);
  const photoInputRef = useRef(null);
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  // Whether the shot taken in the camera modal uploads immediately (saved view) or is
  // held for the meeting form (first capture).
  const [cameraAutoSave, setCameraAutoSave] = useState(false);
  // Saved view only: the lead dropped the saved picture and is choosing a replacement.
  const [replacingPhoto, setReplacingPhoto] = useState(false);
  const [comment, setComment] = useState('');
  const [newComment, setNewComment] = useState('');
  const [draftParticipants, setDraftParticipants] = useState([]);
  const [participantName, setParticipantName] = useState('');
  const [participantDesignation, setParticipantDesignation] = useState('');
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [seeded, setSeeded] = useState(false);
  // Closing meeting only: lead-facing modal listing every assessor remark left on the
  // assessment parameters (step 6), so the lead can review them before closing.
  const [parameterCommentsOpen, setParameterCommentsOpen] = useState(false);
  // Closing-meeting recording links (0-5 URLs). Editable only by the lead.
  const [recordingLinks, setRecordingLinks] = useState([]);
  const [recordingLinkInput, setRecordingLinkInput] = useState('');
  const [recordingLinkEditorOpen, setRecordingLinkEditorOpen] = useState(false);
  // null = adding a new link; a number = editing the link at that index.
  const [recordingLinkEditIndex, setRecordingLinkEditIndex] = useState(null);
  const [linksSeeded, setLinksSeeded] = useState(false);
  const [_savingLinks, setSavingLinks] = useState(false);

  useEffect(() => {
    if (id) {
      if (isOpening) {
        dispatch(getOpeningMeetingAction(id));
      } else {
        dispatch(getClosingMeetingAction(id));
      }
    }
  }, [dispatch, id, isOpening]);

  // The photo and comments synced from the assessors' phones appear without a reload.
  useLiveRefresh(
    () => {
      const arg = { assessmentId: id, silent: true };
      return dispatch(isOpening ? getOpeningMeetingAction(arg) : getClosingMeetingAction(arg));
    },
    { enabled: !!id },
  );

  // Closing meeting seeds its participants from the opening meeting.
  useEffect(() => {
    if (!isOpening && canLeadCapture && !hasSavedParticipants && id) {
      dispatch(getOpeningMeetingAction(id));
    }
  }, [dispatch, id, isOpening, canLeadCapture, hasSavedParticipants]);

  // The backend attaches the assessor team members to the meeting only once it is
  // created, so before the first save the lead is shown from the assessment team.
  const leadParticipant = useMemo(() => {
    // The lead is carried either as a teamMembers row (role lead_assessor) or as the
    // assessment's separate leadAssessor field — resolveTeamRole treats both as the lead,
    // so the roster row is not guaranteed. Fall back to leadAssessor so the lead shows in
    // the capture form up front, before the backend attaches them on save.
    const lead = (assessmentData?.teamMembers || []).find(member => member.role === 'lead_assessor') || assessmentData?.leadAssessor;
    if (!lead) {
      return null;
    }
    const leadUser = lead.user || lead;
    return {
      id: `team-member-${lead.id}`,
      name: [leadUser.firstName, leadUser.lastName].filter(Boolean).join(' ') || leadUser.name || lead.name || 'Lead Assessor',
      role: 'Lead Assessor',
      avatar: leadUser.profileImageUrl || lead.profileImageUrl || null,
    };
  }, [assessmentData]);

  const openingSeedParticipants = useMemo(() => {
    const op = openingMeeting?.meeting || openingMeeting;
    return (op?.participants || [])
      .filter(isExternalParticipant)
      .map(p => ({ name: p.name || '', designation: p.designation || '' }))
      .filter(p => p.name);
  }, [openingMeeting]);

  useEffect(() => {
    if (!isOpening && canLeadCapture && !hasSavedParticipants && !seeded && openingSeedParticipants.length > 0) {
      setDraftParticipants(openingSeedParticipants);
      setSeeded(true);
    }
  }, [isOpening, canLeadCapture, hasSavedParticipants, seeded, openingSeedParticipants]);

  // The lead reviews the assessment-parameter remarks from the closing meeting, so pull
  // the step-6 responses (already cached in the slice when arriving from that step).
  useEffect(() => {
    if (!isOpening && isLead && id && !responses) {
      dispatch(getResponsesAction(id));
    }
  }, [dispatch, id, isOpening, isLead, responses]);

  // Flatten the responses tree into per-parameter groups: the assigned assessor plus every
  // assessor remark left on that parameter's questions.
  const parameterCommentGroups = useMemo(() => {
    const parameters = responses?.parameters || [];
    return parameters
      .map(param => {
        const assessor = param.assignedAssessor || {};
        return {
          parameterId: param.id,
          parameterName: param.name || param.parameterName || param.title || 'Parameter',
          assessorName: assessor.name || assessor.user?.name || '',
          assessorRole: roleLabel(assessor.role),
          assessorAvatar: assessor.profileImageUrl || assessor.user?.profileImageUrl || null,
          remarks: (param.questions || []).map(q => (q.response?.assessorRemarks || '').trim()).filter(Boolean),
        };
      })
      .filter(group => group.remarks.length > 0);
  }, [responses]);

  const parameterCommentsCount = useMemo(() => parameterCommentGroups.reduce((total, group) => total + group.remarks.length, 0), [parameterCommentGroups]);

  // Seed the recording-link editor once from the saved closing meeting.
  useEffect(() => {
    if (!isOpening && !linksSeeded && meetingData) {
      setRecordingLinks(Array.isArray(meetingData.recordingLinks) ? meetingData.recordingLinks : []);
      setLinksSeeded(true);
    }
  }, [isOpening, linksSeeded, meetingData]);

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

  const [meetingImageSrc, setMeetingImageSrc] = useState(null);
  const [meetingModalImageSrc, setMeetingModalImageSrc] = useState(null);
  // Set right after a photo replacement uploads: tells the image effect to hold the
  // local preview until the refetched server image has loaded, then swap without a flash.
  const pendingPhotoSwapRef = useRef(false);

  // Fetch authenticated blob URL for meeting image to avoid direct unauthenticated <img> requests.
  // The card shows the thumbnail rendition; the blob URL belongs to the shared image cache
  // (which revokes it on eviction), so the live refresh does not re-download it.
  useEffect(() => {
    const url = meeting?.imageUrl;
    let cancelled = false;

    const load = async () => {
      if (!meeting?.id || !url) {
        setMeetingImageSrc(null);
        return;
      }

      try {
        const blobUrl = await getCachedImageUrl(url, { thumb: true });
        if (!cancelled && blobUrl) {
          setMeetingImageSrc(blobUrl);
          if (pendingPhotoSwapRef.current) {
            // The freshly uploaded photo has now loaded from the server; only now drop
            // the local preview so the picture area swaps seamlessly (no old-image flash).
            pendingPhotoSwapRef.current = false;
            if (photoPreviewRef.current) {
              try {
                URL.revokeObjectURL(photoPreviewRef.current);
              } catch {
                // ignore
              }
              photoPreviewRef.current = null;
            }
            setPhotoFile(null);
            setPhotoPreview(null);
            setReplacingPhoto(false);
          }
        }
      } catch {
        // ignore
      }
    };

    load();

    return () => {
      cancelled = true;
    };
    // imageUrl is a dependency: replacing the photo keeps the same meeting id but
    // returns a new URL, so keying on id alone leaves the stale blob on screen.
  }, [meeting?.id, meeting?.imageUrl]);

  // Full-size photo for the modal, loaded only when it opens; the thumbnail stands in meanwhile.
  useEffect(() => {
    const url = meeting?.imageUrl;
    setMeetingModalImageSrc(null);
    if (!modalOpen || !url) {
      return undefined;
    }
    let cancelled = false;
    getCachedImageUrl(url).then(blobUrl => {
      if (!cancelled && blobUrl) {
        setMeetingModalImageSrc(blobUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [modalOpen, meeting?.imageUrl]);

  useEffect(
    () => () => {
      if (photoPreviewRef.current) {
        try {
          URL.revokeObjectURL(photoPreviewRef.current);
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  // Returns the accepted file so callers can act on it without waiting for state.
  const handlePhotoChange = file => {
    if (photoPreviewRef.current) {
      try {
        URL.revokeObjectURL(photoPreviewRef.current);
      } catch {
        // ignore
      }
      photoPreviewRef.current = null;
    }
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return null;
    }

    const allowedImageTypes = ['image/jpeg', 'image/png'];
    const extension = file.name?.split('.').pop()?.toLowerCase();
    if (!allowedImageTypes.includes(file.type) || !['jpg', 'jpeg', 'png'].includes(extension)) {
      setFormErrors(prev => ({ ...prev, photo: 'Only .jpg, .jpeg, and .png files are supported.' }));
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors(prev => ({ ...prev, photo: 'File size cannot exceed 5MB.' }));
      return null;
    }

    const preview = URL.createObjectURL(file);
    photoPreviewRef.current = preview;
    setPhotoFile(file);
    setPhotoPreview(preview);
    setShowCameraCapture(false);
    setFormErrors(prev => ({ ...prev, photo: undefined }));
    return file;
  };

  const handleClearPhoto = () => {
    handlePhotoChange(null);
    setShowCameraCapture(false);
    setFormErrors(prev => ({ ...prev, photo: undefined }));
  };

  // A shot from the camera modal follows the same path as a device upload: it closes the
  // modal, previews, and (in the saved view) uploads straight away.
  const handleCameraCapture = file => {
    const accepted = handlePhotoChange(file);
    if (accepted && cameraAutoSave) {
      handleSaveMeetingPhoto(accepted);
    }
  };

  const cameraModal = (
    <AppCommonModal
      open={showCameraCapture}
      onClose={() => setShowCameraCapture(false)}
      modalHeader={<div>Capture Picture</div>}
      modalContent={<AppWebcamCapture onCapture={handleCameraCapture} disabled={saving || meetingActionLoading} fileNamePrefix={`${type}-meeting`} allowUpload={false} autoStart />}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '640px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
      // See PunchModal.jsx: the camera-unavailable fallback's native file picker loses to MUI's
      // Dialog focus trap without this, so "Upload Photo" silently never completes.
      dialogProps={{ disableEnforceFocus: true }}
    />
  );

  // Lead-only trigger shown in the closing meeting; opens the parameter-comments modal.
  const parameterCommentsTrigger =
    !isOpening && isLead ? (
      <AppButton
        type="button"
        variant="link"
        size="small"
        customClass="px-0"
        title={`View All Parameter Comments${parameterCommentsCount > 0 ? ` (${parameterCommentsCount})` : ''}`}
        onClick={() => setParameterCommentsOpen(true)}
      />
    ) : null;

  const parameterCommentsModal = (
    <AppCommonModal
      open={parameterCommentsOpen}
      onClose={() => setParameterCommentsOpen(false)}
      modalHeader={<div className="fs-18 fw-600 text-1-color">Parameter-Wise Comments</div>}
      modalContent={
        responsesLoading && parameterCommentGroups.length === 0 ? (
          <div className="d-flex justify-content-center py-4">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : parameterCommentGroups.length === 0 ? (
          <p className="text-muted mb-0">No parameter comments have been added yet.</p>
        ) : (
          <div>
            {parameterCommentGroups.map((group, groupIndex) => (
              <div key={group.parameterId}>
                {groupIndex > 0 ? <div className="horizontal-seperator margin-top-20 margin-bottom-20"></div> : null}
                <div className="d-flex align-items-center gap-2 margin-bottom-16">
                  <span className="fs-16 fw-600 text-4-color">{String(groupIndex + 1).padStart(2, '0')}</span>
                  <h4 className="fs-16 fw-600 text-1-color mb-0">{group.parameterName}</h4>
                </div>
                {group.assessorName ? (
                  <div className="margin-bottom-8">
                    <ParticipantCard participant={{ name: group.assessorName, role: group.assessorRole, avatar: group.assessorAvatar }} />
                  </div>
                ) : null}
                <div className="d-flex flex-column">
                  {group.remarks.map((remark, remarkIndex) => (
                    <p
                      key={remarkIndex}
                      className={`fs-14 fw-400 text-2-color mb-0 ${remarkIndex !== group.remarks.length - 1 ? 'bottom-seperator' : ''}`}
                      style={{ paddingTop: 12, paddingBottom: 12 }}>
                      {remark}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      }
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );

  // The picture area always shows the current image (a freshly picked one, or the one
  // already saved on the meeting) with a cross to drop it; the pickers appear only when
  // there is no image. `autoSave` is the saved-meeting view, where a replacement uploads
  // straight away — on first capture the photo goes up with the rest of the meeting form.
  const renderMeetingPictureSection = ({ autoSave = false, savedImageSrc = null } = {}) => {
    const onPicked = file => {
      const accepted = handlePhotoChange(file);
      if (accepted && autoSave) {
        handleSaveMeetingPhoto(accepted);
      }
    };

    const onFileInput = event => {
      onPicked(event.target.files?.[0] || null);
      // Allow selecting the same file again after a preview has been cleared.
      event.target.value = '';
    };

    const currentImage = photoPreview || (replacingPhoto ? null : savedImageSrc);

    return (
      <>
        {currentImage ? (
          <div className="site-card meeting-picture-preview">
            <div className="site-image-wrapper" onClick={photoPreview ? undefined : handleOpenModal}>
              <img
                src={currentImage}
                alt={`${type} meeting screenshot`}
                className="site-image"
                onError={e => {
                  e.target.src = Images.dummySite;
                }}
              />
              {!photoPreview && (
                <div className="site-overlay">
                  {formatCoordinates(meetingData?.latitude, meetingData?.longitude) && <div className="overlay-text">{formatCoordinates(meetingData?.latitude, meetingData?.longitude)}</div>}
                  <div className="overlay-text">{formatDateTimeOrDash(meetingData?.conductedAt)}</div>
                </div>
              )}
            </div>
            <div
              className="meeting-picture-preview__remove"
              onClick={() => {
                if (saving || meetingActionLoading) {
                  return;
                }
                if (photoPreview) {
                  handleClearPhoto();
                } else {
                  setReplacingPhoto(true);
                }
              }}>
              <img src={Icons.redCross} alt="Remove picture" width="16" height="16" />
            </div>
          </div>
        ) : (
          <>
            <div className="meeting-picture-picker" aria-label="Meeting picture options">
              <button
                type="button"
                className="meeting-picture-picker__option"
                onClick={() => {
                  setFormErrors(prev => ({ ...prev, photo: undefined }));
                  setCameraAutoSave(autoSave);
                  setShowCameraCapture(true);
                }}
                disabled={saving || meetingActionLoading}>
                <img src={Icons.camera} alt="" width="40" height="40" className="meeting-picture-picker__icon" />
                <span>Capture Picture</span>
              </button>
              <button
                type="button"
                className="meeting-picture-picker__option"
                onClick={() => {
                  setFormErrors(prev => ({ ...prev, photo: undefined }));
                  photoInputRef.current?.click();
                }}
                disabled={saving || meetingActionLoading}>
                <img src={Icons.galleryUpload} alt="" width="40" height="40" className="meeting-picture-picker__icon" />
                <span>Upload from Device</span>
              </button>
              <input ref={photoInputRef} type="file" accept=".jpg,.jpeg,.png" className="d-none" onChange={onFileInput} />
            </div>
            <p className="meeting-picture-picker__help">Only .jpg, .jpeg, .png files. Max file size 5MB.</p>
          </>
        )}
        {formErrors.photo && <span className="error-text d-block margin-top-4">{formErrors.photo}</span>}
      </>
    );
  };

  const handleAddDraftParticipant = () => {
    const name = participantName.trim();
    const designation = participantDesignation.trim();
    if (!name || !designation) {
      setFormErrors(prev => ({ ...prev, participantName: !name ? 'Name is required' : undefined, participantDesignation: !designation ? 'Designation is required' : undefined }));
      return false;
    }
    setDraftParticipants(prev => [...prev, { name, designation }]);
    setParticipantName('');
    setParticipantDesignation('');
    setFormErrors(prev => ({ ...prev, participantName: undefined, participantDesignation: undefined, participants: undefined }));
    return true;
  };

  const handleRemoveDraftParticipant = index => {
    setDraftParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const refetchMeeting = () => dispatch(isOpening ? getOpeningMeetingAction(id) : getClosingMeetingAction(id));

  const isValidRecordingLink = value => {
    if (typeof value !== 'string' || value.length > 2048) {
      return false;
    }
    try {
      const url = new URL(value.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Duplicate detection key. Scheme and host are case-insensitive per RFC 3986, but the
  // path/query are not — a recording id like /watch?v=aB differs from /watch?v=Ab, so only
  // the origin is lowercased. A trailing slash on the path carries no meaning here.
  const recordingLinkKey = value => {
    try {
      const url = new URL(value.trim());
      const path = url.pathname.replace(/\/+$/, '');
      return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${path}${url.search}${url.hash}`;
    } catch {
      return value.trim();
    }
  };

  const isDuplicateRecordingLink = (value, links) => links.some(existing => recordingLinkKey(existing) === recordingLinkKey(value));

  // Guards the payload: the editor seeds from the server, which may still hold duplicates
  // saved before this validation existed.
  const toSavableRecordingLinks = links => {
    const seen = new Set();
    return links
      .filter(isValidRecordingLink)
      .filter(link => {
        const key = recordingLinkKey(link);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  };

  // Add/edit a recording link happens in a modal (better on small screens than the inline row).
  const openRecordingLinkModal = (index = null) => {
    setRecordingLinkEditIndex(index);
    setRecordingLinkInput(index != null ? recordingLinks[index] : '');
    setFormErrors(prev => ({ ...prev, recordingLink: undefined }));
    setRecordingLinkEditorOpen(true);
  };

  const closeRecordingLinkModal = () => {
    setRecordingLinkEditorOpen(false);
    setRecordingLinkEditIndex(null);
    setRecordingLinkInput('');
    setFormErrors(prev => ({ ...prev, recordingLink: undefined }));
  };

  const handleSaveRecordingLink = () => {
    const link = recordingLinkInput.trim();
    if (!link) {
      setFormErrors(prev => ({ ...prev, recordingLink: 'Enter a recording link' }));
      return;
    }
    if (!isValidRecordingLink(link)) {
      setFormErrors(prev => ({ ...prev, recordingLink: 'Enter a valid URL starting with http:// or https:// (max 2048 characters)' }));
      return;
    }
    const isEditing = recordingLinkEditIndex != null;
    // Exclude the row being edited from the duplicate check so re-saving it unchanged is allowed.
    const others = isEditing ? recordingLinks.filter((_, i) => i !== recordingLinkEditIndex) : recordingLinks;
    if (isDuplicateRecordingLink(link, others)) {
      setFormErrors(prev => ({ ...prev, recordingLink: 'This recording link has already been added.' }));
      return;
    }
    if (!isEditing && recordingLinks.length >= 5) {
      setFormErrors(prev => ({ ...prev, recordingLink: 'You can add up to 5 recording links' }));
      return;
    }
    setRecordingLinks(prev => (isEditing ? prev.map((existing, i) => (i === recordingLinkEditIndex ? link : existing)) : [...prev, link]));
    closeRecordingLinkModal();
  };

  const handleRemoveRecordingLink = index => {
    setRecordingLinks(prev => prev.filter((_, i) => i !== index));
  };

  const renderRecordingLinkModal = () => (
    <AppCommonModal
      open={recordingLinkEditorOpen}
      onClose={closeRecordingLinkModal}
      modalHeader={<div className="fs-18 fw-600 text-1-color">{recordingLinkEditIndex != null ? 'Edit Recording Link' : 'Add Recording Link'}</div>}
      modalContent={
        <AppInput
          label="Recording Link (URL)"
          value={recordingLinkInput}
          onChange={e => {
            setRecordingLinkInput(e.target.value);
            setFormErrors(prev => ({ ...prev, recordingLink: undefined }));
          }}
          maxLength={2048}
          multiline
          minRows={2}
          maxRows={6}
          error={formErrors.recordingLink}
        />
      }
      modalFooter={
        <div className="d-flex justify-content-end gap-2 w-100">
          <AppButton variant="tertiary" size="medium" title="Cancel" onClick={closeRecordingLinkModal} />
          <AppButton size="medium" title={recordingLinkEditIndex != null ? 'Save' : 'Add'} onClick={handleSaveRecordingLink} />
        </div>
      }
      paperSx={{ width: { xs: '100%', sm: '90%', md: '520px' }, maxWidth: '98vw', margin: { xs: 1, sm: 2 } }}
    />
  );

  // Save links against an already-created closing meeting (no image re-upload).
  const handleSaveRecordingLinks = async () => {
    const validLinks = toSavableRecordingLinks(recordingLinks);
    // At least one recording link is mandatory on the closing meeting.
    if (validLinks.length === 0) {
      setFormErrors(prev => ({ ...prev, recordingLink: 'Please add at least one meeting recording link to continue.' }));
      return;
    }
    setSavingLinks(true);
    try {
      const formData = new FormData();
      // Backend overwrites latitude/longitude/conducted_at from the request on every save,
      // so re-send the existing values to avoid wiping them on a links-only update.
      if (meetingData?.latitude != null) {
        formData.append('latitude', meetingData.latitude);
      }
      if (meetingData?.longitude != null) {
        formData.append('longitude', meetingData.longitude);
      }
      if (meetingData?.conductedAt) {
        formData.append('conductedAt', meetingData.conductedAt);
      }
      validLinks.forEach(link => formData.append('recordingLinks[]', link));
      await dispatch(createMeetingAction({ assessmentId: id, type, formData })).unwrap();
      await refetchMeeting();
      toastSuccess('Recording links saved');
    } catch (err) {
      toastError(err?.message || 'Failed to save recording links');
    } finally {
      setSavingLinks(false);
    }
  };

  const handleSaveMeeting = async () => {
    const errors = {};
    if (!photoFile) {
      errors.photo = 'Meeting Picture is required';
    }
    if (draftParticipants.length === 0) {
      errors.participants = 'Please add at least one representative from the Enterprise Unit to continue.';
    }
    if (!comment.trim()) {
      errors.comment = 'Meeting comment is required';
    }
    // Closing meeting additionally requires at least one recording link, but
    // recording links are a service-sector-only feature.
    if (!isOpening && isServiceSector(assessmentData) && recordingLinks.filter(isValidRecordingLink).length === 0) {
      errors.recordingLink = 'Please add at least one meeting recording link to continue.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const coords = await getPosition();
      const formData = new FormData();
      formData.append('image', photoFile);
      formData.append('conductedAt', new Date().toISOString());
      if (coords?.latitude != null) {
        formData.append('latitude', coords.latitude);
      }
      if (coords?.longitude != null) {
        formData.append('longitude', coords.longitude);
      }
      // Recording links live on the closing meeting only. camelCase key: the request
      // middleware rejects snake_case and converts recordingLinks -> recording_links.
      if (!isOpening) {
        toSavableRecordingLinks(recordingLinks).forEach(link => formData.append('recordingLinks[]', link));
      }

      await dispatch(createMeetingAction({ assessmentId: id, type, formData })).unwrap();
      if (comment.trim()) {
        await dispatch(updateMeetingCommentsAction({ assessmentId: id, type, data: { comment: comment.trim() } })).unwrap();
      }
      for (const participant of draftParticipants) {
        await dispatch(addMeetingParticipantAction({ assessmentId: id, type, data: { name: participant.name, designation: participant.designation } })).unwrap();
      }

      await refetchMeeting();
      // Awaited so the host's step gating sees this step as completed before it advances.
      await dispatch(getStepProgressAction(id));
      // First opening-meeting save moves the assessment to in_progress server-side.
      if (isOpening) {
        dispatch(getAssessmentByIdAction(id));
      }
      toastSuccess(`${isOpening ? 'Opening' : 'Closing'} meeting saved`);
      onSaved?.();
    } catch (err) {
      toastError(err?.message || `Failed to save ${type} meeting`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMeetingPhoto = async (file = photoFile) => {
    if (!file) {
      setFormErrors(prev => ({ ...prev, photo: 'Meeting Picture is required' }));
      return;
    }

    setSaving(true);
    try {
      const coords = await getPosition();
      const formData = new FormData();
      formData.append('image', file);
      formData.append('conductedAt', new Date().toISOString());
      if (coords?.latitude != null) {
        formData.append('latitude', coords.latitude);
      }
      if (coords?.longitude != null) {
        formData.append('longitude', coords.longitude);
      }

      await dispatch(createMeetingAction({ assessmentId: id, type, formData })).unwrap();
      await refetchMeeting();
      dispatch(getStepProgressAction(id));
      // Keep the local preview visible; the image effect drops it only once the refetched
      // server image has loaded, so the picture swaps without a flash of the old photo.
      pendingPhotoSwapRef.current = true;
      toastSuccess(`${isOpening ? 'Opening' : 'Closing'} meeting photo updated`);
    } catch (err) {
      toastError(err?.message || `Failed to update ${type} meeting photo`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSavedParticipant = async () => {
    const name = participantName.trim();
    const designation = participantDesignation.trim();
    if (!name || !designation) {
      setFormErrors(prev => ({ ...prev, participantName: !name ? 'Name is required' : undefined, participantDesignation: !designation ? 'Designation is required' : undefined }));
      return false;
    }
    try {
      await dispatch(addMeetingParticipantAction({ assessmentId: id, type, data: { name, designation } })).unwrap();
      setParticipantName('');
      setParticipantDesignation('');
      setFormErrors(prev => ({ ...prev, participantName: undefined, participantDesignation: undefined }));
      await refetchMeeting();
      toastSuccess('Participant added');
      return true;
    } catch (err) {
      toastError(err?.message || 'Failed to add participant');
      return false;
    }
  };

  const handleRemoveSavedParticipant = async participantId => {
    try {
      await dispatch(removeMeetingParticipantAction({ assessmentId: id, type, participantId })).unwrap();
      await refetchMeeting();
      toastSuccess('Participant removed');
    } catch (err) {
      toastError(err?.message || 'Failed to remove participant');
    }
  };

  const handleAddComment = async () => {
    const text = newComment.trim();
    if (!text) {
      setFormErrors(prev => ({ ...prev, newComment: 'Comment is required' }));
      return false;
    }
    try {
      await dispatch(updateMeetingCommentsAction({ assessmentId: id, type, data: { comment: text } })).unwrap();
      setNewComment('');
      setFormErrors(prev => ({ ...prev, newComment: undefined }));
      await refetchMeeting();
      toastSuccess('Comment added');
      return true;
    } catch (err) {
      toastError(err?.message || 'Failed to add comment');
      return false;
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        Failed to load {type} meeting: {error?.message || 'Unknown error'}
      </div>
    );
  }

  const pendingComments = (isOpening ? openingMeetingPendingComments : closingMeetingPendingComments) || [];

  const openParticipantModal = () => {
    setParticipantName('');
    setParticipantDesignation('');
    setFormErrors(prev => ({ ...prev, participantName: undefined, participantDesignation: undefined }));
    setParticipantModalOpen(true);
  };

  const closeParticipantModal = () => {
    setParticipantName('');
    setParticipantDesignation('');
    setFormErrors(prev => ({ ...prev, participantName: undefined, participantDesignation: undefined }));
    setParticipantModalOpen(false);
  };

  const addRepresentativeTrigger = (
    <button type="button" className="meeting-recordings__add-link ms-auto" onClick={openParticipantModal}>
      + Add Representative
    </button>
  );

  const renderParticipantModal = onAdd => (
    <AppCommonModal
      open={participantModalOpen}
      onClose={closeParticipantModal}
      modalHeader={<div className="fs-18 fw-600 text-1-color">Add Representative</div>}
      modalContent={
        <div className="d-flex flex-column gap-3">
          <div>
            <AppInput
              label="Name"
              value={participantName}
              onChange={e => {
                setParticipantName(e.target.value);
                setFormErrors(prev => ({ ...prev, participantName: undefined, participants: undefined }));
              }}
              isRequired
              error={formErrors.participantName}
            />
          </div>
          <div>
            <AppInput
              label="Designation"
              value={participantDesignation}
              onChange={e => {
                setParticipantDesignation(e.target.value);
                setFormErrors(prev => ({ ...prev, participantDesignation: undefined, participants: undefined }));
              }}
              isRequired
              error={formErrors.participantDesignation}
            />
          </div>
        </div>
      }
      modalFooter={
        <div className="d-flex justify-content-end gap-2 w-100">
          <AppButton variant="tertiary" size="medium" title="Cancel" onClick={closeParticipantModal} disabled={meetingActionLoading} />
          <AppButton
            size="medium"
            title="Add"
            onClick={async () => {
              const ok = await onAdd();
              if (ok) {
                closeParticipantModal();
              }
            }}
            loading={meetingActionLoading}
          />
        </div>
      }
      paperSx={{ width: { xs: '100%', sm: '90%', md: '520px' }, maxWidth: '98vw', margin: { xs: 1, sm: 2 } }}
    />
  );
  const renderRecordingLinksEditor = _onSave => (
    <div className="meeting-recordings margin-top-20">
      <div className="horizontal-seperator margin-bottom-20"></div>
      <div className="meeting-recordings__header">
        <div className="meeting-recordings__title">
          <span>Meeting Recordings</span>
          <div className="meeting-recordings__count">
            {recordingLinks.length} <span>/ 5</span>
          </div>
        </div>
        {recordingLinks.length < 5 && (
          <button type="button" className="meeting-recordings__add-link" onClick={() => openRecordingLinkModal()}>
            + Add Link
          </button>
        )}
      </div>
      {recordingLinks.length === 0 && (
        <div className="meeting-participants__notice" role="note">
          <img src={Icons.infoWarning} alt="" width="16" height="16" className="meeting-participants__notice-icon" />
          <span>Please add at least one meeting recording link to continue.</span>
        </div>
      )}
      {recordingLinks.length > 0 ? (
        <div className="meeting-recordings__list">
          {recordingLinks.map((link, index) => (
            <div className="meeting-recordings__item" key={`${link}-${index}`}>
              <div className="meeting-recordings__link-details">
                <p>Recording {index + 1}</p>
                <a href={link} target="_blank" rel="noopener noreferrer" title={link}>
                  {link}
                </a>
              </div>
              <div className="meeting-recordings__actions">
                <button type="button" className="meeting-recordings__action" onClick={() => openRecordingLinkModal(index)} aria-label={`Edit recording ${index + 1}`}>
                  <img src={Icons.editPencil} alt="" />
                </button>
                <button type="button" className="meeting-recordings__action" onClick={() => handleRemoveRecordingLink(index)} aria-label={`Remove recording ${index + 1}`}>
                  <img src={Icons.trash} alt="" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {/* A save-time error (from Save Recording Links) has no input to attach to while the modal is closed. */}
      {!recordingLinkEditorOpen && formErrors.recordingLink && <span className="error-text d-block margin-top-8">{formErrors.recordingLink}</span>}
      {renderRecordingLinkModal()}
    </div>
  );
  const renderRecordingLinksReadOnly = () => {
    const links = Array.isArray(meetingData?.recordingLinks) ? meetingData.recordingLinks : [];
    if (links.length === 0) {
      return null;
    }
    return (
      <div className="margin-top-20">
        <div className="horizontal-seperator margin-bottom-20"></div>
        <div className="d-flex align-items-center gap-8">
          <h4 className="fs-16 fw-600 heading-color margin-bottom-16">Meeting Recording Links</h4>
          <div className="meeting-recordings__count">
            {links.length} <span>/ 5</span>
          </div>
        </div>
        <div className="d-flex flex-column gap-2">
          {links.map((link, index) => (
            <div key={`${link}-${index}`}>
              <p className="fs-14 fw-500 heading-color mb-2">Recording {index + 1}</p>
              <a href={link} target="_blank" rel="noopener noreferrer" className="text-break" title={link}>
                {link}
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  };
  if (!hasSavedParticipants) {
    if (canLeadCapture) {
      return (
        <div className="row">
          <div className="col-12 col-md-6 right-border">
            <div className="padding-right-10">
              <h4 className="fs-16 fw-600 heading-color margin-bottom-14">Meeting Picture</h4>
              {renderMeetingPictureSection()}

              <div className="horizontal-seperator margin-top-20"></div>

              <div className="margin-top-20">
                <div className="meeting-participants__header margin-bottom-16">
                  <h4 className="fs-16 fw-600 heading-color mb-0">Participants</h4>
                  <span className="meeting-participants__count">{draftParticipants.length + (leadParticipant ? 1 : 0)}</span>
                  {addRepresentativeTrigger}
                </div>
                {draftParticipants.length === 0 && (
                  <div className="meeting-participants__notice" role="note">
                    <img src={Icons.infoWarning} alt="" width="16" height="16" className="meeting-participants__notice-icon" />
                    <span>Please add at least one representative from the Enterprise Unit to continue.</span>
                  </div>
                )}
                {leadParticipant || draftParticipants.length > 0 ? (
                  <div className="d-flex flex-column gap-3 margin-bottom-8">
                    {/* The lead assessor always attends; the backend attaches them on save,
                        so they are shown here up front and cannot be removed. */}
                    {leadParticipant && (
                      <div className="d-flex align-items-center justify-content-between">
                        <ParticipantCard participant={leadParticipant} />
                      </div>
                    )}
                    {draftParticipants.map((participant, index) => (
                      <div className="d-flex align-items-center justify-content-between" key={`${participant.name}-${index}`}>
                        <ParticipantCard participant={{ name: participant.name, role: participant.designation || 'Participant' }} />
                        <button type="button" className="meeting-participants__remove" onClick={() => handleRemoveDraftParticipant(index)} aria-label={`Remove ${participant.name}`}>
                          <img src={Icons.redCloseCircle} alt="" width="20" height="20" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">No participants added yet</p>
                )}
                {renderParticipantModal(handleAddDraftParticipant)}
                {formErrors.participants && <span className="error-text d-block margin-top-4">{formErrors.participants}</span>}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="padding-left-10">
              <div className="d-flex align-items-center justify-content-between margin-bottom-14">
                <h3 className="fs-16 fw-600 heading-color mb-0">Comment</h3>
                {parameterCommentsTrigger}
              </div>
              <AppInput
                label="Meeting Comment"
                multiline
                rows={5}
                value={comment}
                onChange={e => {
                  setComment(e.target.value);
                  if (e.target.value.trim()) {
                    setFormErrors(prev => ({ ...prev, comment: undefined }));
                  }
                }}
                error={formErrors.comment}
                isRequired
              />

              {!isOpening && renderRecordingLinksEditor(null)}
            </div>
          </div>

          <div className="col-12">
            <div className="margin-top-20 d-flex justify-content-end">
              <AppButton
                title={isOpening ? 'Save & Next' : 'Save'}
                onClick={handleSaveMeeting}
                loading={saving || meetingActionLoading}
                disabled={saving || meetingActionLoading}
                rightIcon={isOpening ? Icons.rightWhiteArrow : undefined}
              />
            </div>
          </div>
          {cameraModal}
          {parameterCommentsModal}
        </div>
      );
    }

    return (
      <div className="text-center py-5">
        <img src={Icons.emptyState || Images.defaultImage} alt="No meeting" className="mb-3" style={{ width: 100, opacity: 0.5 }} />
        <p className="text-muted">No {type} meeting recorded yet</p>
        {!isLead ? (
          <p className="text-muted mt-2">Live capture is available only to the lead assessor.</p>
        ) : (
          <p className="text-muted mt-2">Complete the earlier assessment steps to unlock the meeting capture UI.</p>
        )}
      </div>
    );
  }

  const participants = meetingData?.participants || [];
  const comments = meetingData?.comments || [];

  const allParticipants = participants
    .map(p =>
      isExternalParticipant(p)
        ? {
            id: p.id,
            name: p.name || 'External Participant',
            role: p.designation || 'External',
            avatar: null,
            isExternal: true,
            isLeadAssessor: false,
          }
        : {
            id: p.id,
            name: p.teamMember?.user?.firstName || p.teamMember?.user?.lastName || 'Unknown',
            role: p.teamMember?.role === 'lead_assessor' ? 'Lead Assessor' : p.teamMember?.role === 'co_assessor' ? 'Co Assessor' : 'Assessor',
            avatar: p.teamMember?.user?.profileImageUrl || null,
            isExternal: false,
            isLeadAssessor: p.teamMember?.role === 'lead_assessor',
          },
    )
    // The lead assessor heads the list, as in the capture form; the API returns no guaranteed order.
    .sort((a, b) => Number(b.isLeadAssessor) - Number(a.isLeadAssessor));

  const externalParticipants = allParticipants.filter(p => p.isExternal);

  const formattedComments = comments.map(c => ({
    id: c.id,
    userId: c.teamMember?.user?.id,
    name: c.teamMember?.user?.firstName || c.teamMember?.user?.lastName || 'Unknown',
    role: c.teamMember?.role === 'lead_assessor' ? 'Lead Assessor' : c.teamMember?.role === 'co_assessor' ? 'Co Assessor' : 'Assessor',
    avatar: c.teamMember?.user?.profileImageUrl || null,
    timestamp: formatDateTimeOrDash(c.updatedAt ?? c.createdAt),
    message: c.comment || c.content || '',
  }));

  // An assessor who has not yet commented can add one from the saved view.
  const hasMyComment = formattedComments.some(c => c.userId === user?.id);
  const canAddComment = canEditComments && hasRole(user, 'assessor') && !hasMyComment;

  // The saved view can be edited back into an invalid state — the picture dropped, every enterprise
  // representative removed — so it re-checks the same requirements as first capture before advancing.
  // Photo and participants already persist as they are edited; only a comment typed but not added is
  // still pending, so it is committed here. A failed save keeps the assessor on the step.
  const handleSaveAndNext = async () => {
    const hasPicture = !!(photoPreview || (!replacingPhoto && meetingImageSrc));
    if (!hasPicture) {
      setFormErrors(prev => ({ ...prev, photo: 'Meeting Picture is required' }));
      toastError('Meeting Picture is required');
      return;
    }
    if (externalParticipants.length === 0) {
      toastError('Please add at least one representative from the Enterprise Unit to continue.');
      return;
    }
    if (formattedComments.length === 0 && !newComment.trim()) {
      setFormErrors(prev => ({ ...prev, newComment: 'Comment is required' }));
      toastError('Meeting comment is required');
      return;
    }
    if (!isOpening && isServiceSector(assessmentData) && recordingLinks.filter(isValidRecordingLink).length === 0) {
      toastError('Please add at least one meeting recording link to continue.');
      return;
    }
    if (canAddComment && newComment.trim() && !(await handleAddComment())) {
      return;
    }
    onSaved?.();
  };

  return (
    <div className="row">
      <div className="col-12 col-md-6 right-border">
        <div className="padding-right-10">
          <h4 className="fs-16 fw-600 heading-color margin-bottom-14">Meeting Picture</h4>
          {canLeadCapture
            ? renderMeetingPictureSection({ autoSave: true, savedImageSrc: meetingImageSrc })
            : meetingImageSrc && (
                <div className="site-card cursor-pointer" onClick={handleOpenModal}>
                  <div className="site-image-wrapper">
                    <img
                      src={meetingImageSrc}
                      loading="lazy"
                      alt={`${type} Meeting`}
                      className="site-image"
                      onError={e => {
                        e.target.src = Images.dummySite;
                      }}
                    />
                    <div className="site-overlay">
                      {formatCoordinates(meetingData?.latitude, meetingData?.longitude) && <div className="overlay-text">{formatCoordinates(meetingData?.latitude, meetingData?.longitude)}</div>}
                      <div className="overlay-text">{formatDateTimeOrDash(meetingData?.conductedAt)}</div>
                    </div>
                  </div>
                </div>
              )}
        </div>
        <div className="horizontal-seperator margin-top-20"></div>
        <div className="margin-top-20">
          <div className="meeting-participants__header margin-bottom-16">
            <h4 className="fs-16 fw-600 heading-color mb-0">Participants</h4>
            <span className="meeting-participants__count">{allParticipants.length}</span>
            {canLeadCapture && addRepresentativeTrigger}
          </div>
          {externalParticipants.length === 0 && (
            <div className="meeting-participants__notice" role="note">
              <img src={Icons.infoWarning} alt="" width="16" height="16" className="meeting-participants__notice-icon" />
              <span>Please add at least one representative from the Enterprise Unit to continue.</span>
            </div>
          )}
          {allParticipants.length > 0 ? (
            <div className="d-flex flex-column gap-3">
              {allParticipants.map(participant => (
                <div className="d-flex align-items-center justify-content-between" key={participant.id}>
                  <ParticipantCard participant={participant} />
                  {canLeadCapture && participant.isExternal && (
                    <button
                      type="button"
                      className="meeting-participants__remove"
                      onClick={() => handleRemoveSavedParticipant(participant.id)}
                      disabled={meetingActionLoading}
                      aria-label={`Remove ${participant.name}`}>
                      <img src={Icons.redCloseCircle} alt="" width="20" height="20" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">No participants recorded</p>
          )}

          {canLeadCapture && renderParticipantModal(handleAddSavedParticipant)}
        </div>
      </div>
      <div className="col-12 col-md-6">
        <div className="padding-left-10">
          <div className="d-flex align-items-center justify-content-between margin-bottom-14">
            <h3 className="fs-16 fw-600 heading-color mb-0">Comments</h3>
            {parameterCommentsTrigger}
          </div>
          {formattedComments.length > 0 ? (
            <div className="d-flex flex-column gap-3">
              {formattedComments.map((comment, index) => (
                <div className={`padding-bottom-16 ${index !== formattedComments.length - 1 ? 'bottom-seperator' : ''}`} key={comment.id}>
                  <AppCommentCard comment={comment} onEdit={onEditComment} assessmentId={id} type={type} editComment={canEditComments && hasRole(user, 'assessor') && user.id === comment.userId} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">No comments yet</p>
          )}

          {canAddComment && (
            <div className="margin-top-16">
              <AppInput label="Add Comment" multiline rows={4} value={newComment} onChange={e => setNewComment(e.target.value)} error={formErrors.newComment} />
              <div className="margin-top-8 d-flex justify-content-end">
                <AppButton title="Add Comment" size="medium" onClick={handleAddComment} loading={meetingActionLoading} disabled={meetingActionLoading} />
              </div>
            </div>
          )}

          {pendingComments.length > 0 && (
            <div className="margin-top-20">
              <h4 className="fs-14 fw-500 text-warning margin-bottom-8">Pending Comments From:</h4>
              <div className="d-flex flex-wrap gap-2">
                {pendingComments.map(member => (
                  <span key={member.id} className="badge bg-warning text-dark">
                    {formatPersonName(member.user) || member.user?.name || 'Unknown'}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!isOpening && isServiceSector(assessmentData) && (canLeadCapture ? renderRecordingLinksEditor(handleSaveRecordingLinks) : renderRecordingLinksReadOnly())}
        </div>
      </div>

      {/* Read-only hosts pass no onSaved; the save action itself is lead + service-sector only. */}
      {onSaved && canLeadCapture && (
        <div className="col-12">
          <div className="margin-top-20 d-flex justify-content-end">
            <AppButton
              title={isOpening ? 'Save & Next' : 'Save'}
              onClick={handleSaveAndNext}
              loading={meetingActionLoading}
              disabled={meetingActionLoading}
              rightIcon={isOpening ? Icons.rightWhiteArrow : undefined}
            />
          </div>
        </div>
      )}

      {cameraModal}
      {parameterCommentsModal}

      <SitePictureDetailsModal
        open={modalOpen}
        onClose={handleCloseModal}
        selectedPicture={{
          title: `${isOpening ? 'Opening' : 'Closing'} Meeting Photo`,
          latitude: meetingData?.latitude,
          longitude: meetingData?.longitude,
          capturedAt: meetingData?.conductedAt,
        }}
        modalImageLoading={false}
        modalImageSrc={meetingModalImageSrc || meetingImageSrc}
      />
    </div>
  );
};

export default Meeting;
