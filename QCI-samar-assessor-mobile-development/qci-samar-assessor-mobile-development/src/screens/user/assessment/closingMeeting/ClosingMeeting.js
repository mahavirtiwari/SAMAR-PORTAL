import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../../../assets/theme/Theme';
import { AppButton } from '../../../../components';
import AppInput from '../../../../components/base/textInput/AppInput';
import ImageUploaderUI from '../../../../components/common/ImageUploaderUI';
import { Header } from '../../../../components/layout';
import { AppCommonModal, AppModal } from '../../../../components/modals';
import { AppBottomSheet, CheckInSuccessScreen } from '../../../../components/shared';
import AppScrollView from '../../../../components/shared/AppScrollView';
import ApplicationLoader from '../../../../components/shared/Loader';
import UserInitial from '../../../../components/shared/UserInitial';
import Icons from '../../../../constants/Icons';
import Images from '../../../../constants/Images';
import {
  getAssessmentByIdAction,
  getStepProgressAction
} from '../../../../redux/action/assessmentAction';
import {
  addClosingCommentAction,
  addExternalParticipantAction,
  closingMeetingAction,
  deleteExternalParticipantAction,
  getClosingMeetingDetailsAction,
  getMeetingDetailsAction,
  updateCommentAction
} from '../../../../redux/action/meetingAction';
import { persistCapture, stampCapture } from '../../../../services/offline/capturePipeline';
import { getImagePickerOptions, isInitialLoad, Logger } from '../../../../utils';
import { acquireCaptureCoords } from '../../../../utils/location';
import { ensurePermission } from '../../../../utils/permissions';
import { resolveTeamRole } from '../../../../utils/teamRole';
import { showErrorToast, showWarningToast } from '../../../../utils/toast';
import PunchModal from '../shared/PunchModal';
import usePunchFlow from '../shared/usePunchFlow';
import ViewAllComments from './ViewAllComments';

const MAX_RECORDING_LINKS = 5;

const ClosingMeeting = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const refRBSheet = useRef(null);
  const refLinkSheet = useRef(null);
  // Guards the capture flow: the location fix fetched before the camera opens
  // takes a moment, so block re-entry to stop repeated taps queueing captures.
  const capturingRef = useRef(false);
  // Guards the one-time auto-fill of representatives from the opening meeting,
  // and remembers which seeded reps the lead removed so they don't reappear.
  const openingParticipantsSeeded = useRef(false);
  const removedSeededRepKeys = useRef(new Set());
  const repKey = (p) =>
    `${(p?.name || '').trim().toLowerCase()}|${(p?.designation || '').trim().toLowerCase()}`;
  const [closingPicture, setClosingPicture] = useState(null);
  const [comment, setComment] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [participantDesignation, setParticipantDesignation] = useState('');
  const [pendingParticipants, setPendingParticipants] = useState([]);
  // IDs of server-saved reps the lead removed via the × icon. The delete API is
  // deferred until the meeting is saved, so backing out without saving discards
  // these removals and the reps reappear on the next load.
  const [pendingRemovedParticipantIds, setPendingRemovedParticipantIds] = useState([]);
  // Up to 5 optional meeting-recording URLs the lead can attach to the closing
  // meeting (service sector only). Seeded from the saved meeting on load; edited
  // locally and persisted on save through the same offline outbox path as the meeting.
  const [recordingLinks, setRecordingLinks] = useState([]);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState('');
  const [editingRecordingIndex, setEditingRecordingIndex] = useState(null);
  const [commentError, setCommentError] = useState('');
  const [showAllCommentsModal, setShowAllCommentsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [closingPictureError, setClosingPictureError] = useState('');
  const [participantsError, setParticipantsError] = useState('');
  const [modal, setModal] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  // Single flag that keeps the loader continuously visible for the whole
  // multi-step save. Without it, each sequential dispatch's own loading flag
  // toggles the boolean loader off/on between awaits, flashing it 2-3 times.
  const [isSaving, setIsSaving] = useState(false);

  const assessmentId = route?.params?.assessmentId;
  // readOnly is the post-punch-out review pass: the closing record stays fully
  // visible while every write affordance (picture, participants, comments,
  // recording links, save) is withheld.
  const readOnly = route?.params?.readOnly === true;
  const { userData } = useSelector((state) => state.account);
  const {
    closingMeetingDetails,
    deleteExternalParticipantLoading,
    addExternalParticipantLoading,
    addClosingCommentLoading,
    closingMeetingDetailLoading,
    closingMeetingDetailError,
    updateCommentLoading,
    closingMeetingLoading
  } = useSelector((state) => state.meeting);
  const { assessmentData, attendanceStatus } = useSelector((state) => state.assessment);
  const userId = userData?.user?.id;
  const comments = closingMeetingDetails?.meeting?.comments || [];
  const hasCommented = comments.some((cmt) => cmt.teamMember?.user?.id === userId);

  // Mirror the opening meeting: a representative is ALWAYS mandatory, satisfied
  // by either a server-saved external rep (canRemove) or a locally-added pending
  // one — not only when building a brand-new meeting.
  const savedRepsCount = (closingMeetingDetails?.teamMembers || []).filter(
    (m) => m?.canRemove && !pendingRemovedParticipantIds.includes(m?.participantId)
  ).length;
  const hasRepresentative = savedRepsCount + pendingParticipants.length > 0;

  // Single fetch+apply path: every reload of the meeting details (mount,
  // pull-to-refresh, after participant removal) mirrors the server's picture
  // into local state and resets the comment box in the same continuation.
  const fetchMeetingDetails = useCallback(
    () =>
      dispatch(getClosingMeetingDetailsAction({ assessmentId, type: 'closing' })).then((result) => {
        const meeting =
          result?.meta?.requestStatus === 'fulfilled' ? result?.payload?.meeting : null;
        if (meeting?.imageUrl) {
          setClosingPicture({
            uri: meeting.imageUrl,
            coordinates:
              meeting.latitude && meeting.longitude
                ? { latitude: meeting.latitude, longitude: meeting.longitude }
                : null,
            timestamp: meeting.conductedAt || new Date().toISOString(),
            syncState: meeting.syncState || 'synced'
          });
        }
        // Seed the always-open comment input with the lead's own saved comment
        // (if any) so it shows for editing; empty otherwise for a fresh add.
        const ownComment = meeting?.comments?.find(
          (c) => c?.teamMember?.user?.id === userData?.user?.id
        )?.comment;
        setComment(ownComment || '');
        // Mirror the saved recording links so they render (and stay editable for
        // the lead) on every reload — camelCase both online and from local hydrate.
        setRecordingLinks(Array.isArray(meeting?.recordingLinks) ? meeting.recordingLinks : []);
      }),
    [assessmentId, dispatch, userData?.user?.id]
  );

  useEffect(() => {
    if (!assessmentId) {
      return;
    }
    fetchMeetingDetails();
  }, [assessmentId, fetchMeetingDetails]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMeetingDetails();
    setRefreshing(false);
  };

  useEffect(() => {
    if (showSuccessScreen) {
      setTimeout(() => {
        setShowSuccessScreen(false);
      }, 1000);
    }
  }, [showSuccessScreen]);
  // Service-sector assessments are conducted online (meeting link, no site
  // visit), so a meeting screenshot from the device is allowed there. Every
  // other sector stays camera-only — captured-on-site evidence integrity.
  const sector = assessmentData?.assessment?.application?.sector;
  const isServiceSector = String(sector || '').toLowerCase() === 'service';

  const openCamera = async () => {
    if (capturingRef.current) {
      return;
    }
    capturingRef.current = true;
    try {
      const cameraGranted = await ensurePermission('camera');
      if (!cameraGranted) {
        return;
      }

      // Closing meeting photos are geo-verification evidence: obtain a valid fix
      // BEFORE the camera opens and block the capture entirely if none is
      // available. acquireCaptureCoords shows a single "Location Required" alert
      // and returns null on failure. The fix takes a moment, so hold a loader
      // over it — otherwise the button looks dead and gets tapped repeatedly.
      ApplicationLoader.show('closingMeetingCapture');
      const coords = await acquireCaptureCoords();
      ApplicationLoader.hide('closingMeetingCapture');
      if (!coords) {
        return;
      }

      const options = getImagePickerOptions({
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8
      });

      launchCamera(options, async (response) => {
        if (response.didCancel || response.error) {
          Logger.warn('Camera cancelled or error');
        } else if (response.assets && response.assets[0]) {
          await fetchLocationAndSaveImage(response.assets[0], coords);
        }
      });
    } finally {
      ApplicationLoader.hide('closingMeeting');
      capturingRef.current = false;
    }
  };

  // Gallery picker — service sector only. The picked image still flows through
  // fetchLocationAndSaveImage, so it's geo-stamped and persisted to durable
  // storage exactly like a camera capture. A gallery pick carries no reliable
  // capture-location metadata, so it goes through the same pre-pick gate.
  const openGallery = async () => {
    if (capturingRef.current) {
      return;
    }
    capturingRef.current = true;
    try {
      ApplicationLoader.show('closingMeetingCapture');
      const coords = await acquireCaptureCoords();
      ApplicationLoader.hide('closingMeetingCapture');
      if (!coords) {
        return;
      }

      const options = getImagePickerOptions({
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8
      });

      launchImageLibrary(options, async (response) => {
        if (response.didCancel || response.error) {
          Logger.warn('Gallery cancelled or error');
        } else if (response.assets && response.assets[0]) {
          await fetchLocationAndSaveImage(response.assets[0], coords);
        }
      });
    } finally {
      ApplicationLoader.hide('closingMeeting');
      capturingRef.current = false;
    }
  };

  useEffect(() => {
    if (
      isSaving ||
      addClosingCommentLoading ||
      closingMeetingDetailLoading ||
      updateCommentLoading ||
      deleteExternalParticipantLoading ||
      addExternalParticipantLoading ||
      closingMeetingLoading
    ) {
      ApplicationLoader.show('closingMeeting');
    } else {
      ApplicationLoader.hide('closingMeeting');
    }
  }, [
    isSaving,
    addClosingCommentLoading,
    closingMeetingDetailLoading,
    updateCommentLoading,
    deleteExternalParticipantLoading,
    addExternalParticipantLoading,
    closingMeetingLoading
  ]);

  const fetchLocationAndSaveImage = async (imageAsset, coords) => {
    // Coordinates are already resolved by the capture gate (acquireCaptureCoords)
    // before the camera/gallery opened.
    const timestamp = new Date().toISOString();
    try {
      const durableUri = await persistCapture({
        uri: imageAsset.uri,
        serverAssessmentId: assessmentId,
        bucket: 'meeting_closing',
        label: 'closing meeting photo'
      });
      setClosingPicture({
        uri: durableUri,
        coordinates: { latitude: coords.latitude, longitude: coords.longitude },
        timestamp,
        syncState: 'pending'
      });

      const stampedUri = await stampCapture({
        uri: durableUri,
        serverAssessmentId: assessmentId,
        bucket: 'meeting_closing',
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp,
        label: 'closing meeting photo'
      });
      setClosingPicture({
        uri: stampedUri,
        coordinates: { latitude: coords.latitude, longitude: coords.longitude },
        timestamp,
        syncState: 'pending'
      });
      Logger.info('Closing picture saved:', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp
      });
    } catch (error) {
      Logger.error('Image processing error:', error);
      // Capture/persist failed (empty file) — clear and ask for a retake rather
      // than staging a doomed raw uri.
      setClosingPicture(null);
      const message = typeof error === 'string' ? error : error?.message;
      showWarningToast('Capture Failed', message || 'Could not save the photo. Please retake it.');
    }
  };

  // API logic for save, similar to OpeningMeeting
  const createMeetingHandler = async ({ includeImage = true } = {}) => {
    if (!closingPicture) {
      showWarningToast('Required', 'Please capture closing picture before saving.');
      return;
    }

    try {
      const teamMembers = assessmentData?.assessment?.teamMembers || [];
      const currentMember = teamMembers.find(
        (m) => m?.userId === userData?.user?.id || m?.user?.id === userData?.user?.id
      );

      // Records the meeting photo + location + recording links. The comment and
      // participants are persisted by handleSaveAndNext's dedicated, dedup-aware
      // paths — sending them here too posted the comment (and each participant)
      // a second time on the first save, producing duplicates. imageUri is sent
      // only when the photo actually changed: a links-only save passes null so
      // upsertMeeting preserves the existing photo instead of wiping it.
      await dispatch(
        closingMeetingAction({
          assessmentId,
          teamMemberId: currentMember?.id ?? currentMember?.teamMemberId,
          imageUri: includeImage ? closingPicture.uri : null,
          latitude: closingPicture?.coordinates?.latitude,
          longitude: closingPicture?.coordinates?.longitude,
          recordingLinks: isServiceSector ? recordingLinks : undefined
        })
      ).unwrap();
    } catch (error) {
      Logger.error('Error saving closing meeting:', error);
      showErrorToast('Error', 'Failed to save closing meeting. Please try again.');
    }
  };

  // Remove comment add/edit logic
  // Pure validation for button disabling (no setState)
  const isFormValid = React.useMemo(() => {
    let valid = true;
    if (!closingPicture) {
      valid = false;
    }
    if (!hasRepresentative) {
      valid = false;
    }
    return valid;
  }, [closingPicture, hasRepresentative]);

  // Validation with error messages for submit
  const validateClosingMeetingFields = () => {
    let isValid = true;
    if (!closingPicture) {
      setClosingPictureError('Closing picture is required.');
      isValid = false;
    } else {
      setClosingPictureError('');
    }
    if (!hasRepresentative) {
      setParticipantsError('At least one extra participant is required.');
      isValid = false;
    } else {
      setParticipantsError('');
    }
    if (!hasCommented) {
      if (comment.trim().length < 1) {
        setCommentError('Comment is required.');
        isValid = false;
      } else {
        setCommentError('');
      }
    } else {
      setCommentError('');
    }
    return isValid;
  };
  const handleSaveAndNext = async ({ showPunchSuccess = false } = {}) => {
    // Validate comment: non-empty when the user can comment

    setIsSaving(true);
    try {
      const hasUri = closingPicture?.uri;
      // A freshly captured photo has a different uri than the one loaded from the
      // server/local store. Do NOT key off an "http" prefix: when punched in, the
      // meeting is hydrated from local SQLite and its imageUrl is a file:// path,
      // so the unchanged existing picture looked "new" — a comment-only update then
      // re-submitted the meeting with no image and upsertMeeting wiped the photo.
      const existingImageUrl = closingMeetingDetails?.meeting?.imageUrl;
      const isNewImage = !!hasUri && hasUri !== existingImageUrl;

      // Recording links ride on the closing-meeting POST, so re-submit the
      // meeting whenever the photo OR the links changed. A links-only change
      // sends no image (includeImage:false) so the existing photo is kept.
      const savedLinks = closingMeetingDetails?.meeting?.recordingLinks || [];
      const linksChanged =
        isServiceSector && JSON.stringify(recordingLinks) !== JSON.stringify(savedLinks);

      if (isNewImage || linksChanged) {
        await createMeetingHandler({ includeImage: isNewImage });
      }

      // Persist the comment: add it the first time, or update the lead's existing
      // comment when the always-open input was edited (the endpoint is keyed by
      // assessment + type, so update reuses the same upsert path as add).
      const originalOwnComment =
        comments.find((c) => c?.teamMember?.user?.id === userId)?.comment || '';
      if (!hasCommented && comment.trim().length >= 1) {
        await dispatch(
          addClosingCommentAction({
            assessmentId,
            data: {
              comment: comment.trim()
            }
          })
        );
      } else if (
        hasCommented &&
        comment.trim().length >= 1 &&
        comment.trim() !== originalOwnComment.trim()
      ) {
        await dispatch(
          updateCommentAction({
            assessmentId,
            type: 'closing',
            data: {
              comment: comment.trim()
            }
          })
        );
      }

      // Add pending participants after closing meeting API call. Skip any rep
      // already saved on the server so a second save / punch-out doesn't create
      // duplicate copies of the same representative.
      const savedRepKeys = new Set(
        (closingMeetingDetails?.teamMembers || [])
          .filter((m) => m.canRemove)
          .map((m) =>
            repKey({
              name: `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim(),
              designation: m.role
            })
          )
      );
      for (const participant of pendingParticipants) {
        if (savedRepKeys.has(repKey(participant))) {
          continue;
        }
        const val = {
          data: {
            name: participant.name,
            designation: participant.designation
          },
          assessmentId: assessmentId,
          type: 'closing'
        };
        await dispatch(addExternalParticipantAction(val));
        savedRepKeys.add(repKey(participant));
      }

      // Flush the deferred removals: reps the lead deleted via the × icon were
      // only hidden locally until now, so the delete API fires only on save.
      for (const participantId of pendingRemovedParticipantIds) {
        await dispatch(
          deleteExternalParticipantAction({
            assessmentId,
            type: 'closing',
            participantId
          })
        );
      }

      // Reload the meeting from the server BEFORE finishing so the screen reflects
      // what was just saved (picture, comment, participants). Without this, the
      // stale pre-save Redux state — no meeting yet, just-cleared pending reps —
      // flashed on screen between saving and navigating back, making it look like
      // the saved data had been lost.
      await fetchMeetingDetails();

      // Clear the local staging only AFTER the reload, so the just-saved reps stay
      // on screen continuously (server copy + dedup take over). Clearing earlier
      // briefly emptied the list and flashed the "Add a representative" warning.
      setPendingParticipants([]);
      setPendingRemovedParticipantIds([]);

      // User may have navigated back while saving — don't drive a second goBack on
      // an unmounted screen.
      if (!navigation.isFocused()) {
        return;
      }
      await dispatch(getStepProgressAction(assessmentId));
      await dispatch(getAssessmentByIdAction(assessmentId));
      navigation.goBack();
    } finally {
      setIsSaving(false);
    }
  };

  const punch = usePunchFlow({
    assessmentId,
    assessmentData,
    userData,
    dispatch,
    onPunchOutSuccess: () => handleSaveAndNext({ showPunchSuccess: true })
  });

  const handleAddParticipant = () => {
    if (participantName.trim() === '' || participantDesignation.trim() === '') {
      Logger && Logger.warn
        ? Logger.warn('Error: Please fill in both name and designation fields.')
        : null;
      return;
    }
    setPendingParticipants((prev) => [
      ...prev,
      {
        name: participantName,
        designation: participantDesignation
      }
    ]);
    setParticipantName('');
    setParticipantDesignation('');
    refRBSheet.current.close();
  };
  // Mirror the backend's `url|max:2048` rule: require an http(s) scheme and a
  // host so a malformed link is rejected before it reaches the outbox.
  const isValidRecordingLink = (value) => {
    const v = (value || '').trim();
    if (!v || v.length > 2048) {
      return false;
    }
    return /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v);
  };

  const handleSaveRecordingLink = () => {
    const value = linkInput.trim();
    if (!value) {
      setLinkError('Please enter a recording link.');
      return;
    }
    if (editingRecordingIndex === null && recordingLinks.length >= MAX_RECORDING_LINKS) {
      setLinkError(`You can add up to ${MAX_RECORDING_LINKS} recording links only.`);
      return;
    }
    if (!isValidRecordingLink(value)) {
      setLinkError('Enter a valid URL starting with http:// or https://');
      return;
    }
    if (
      recordingLinks.some(
        (link, index) =>
          index !== editingRecordingIndex && link.toLowerCase() === value.toLowerCase()
      )
    ) {
      setLinkError('This link has already been added.');
      return;
    }
    setRecordingLinks((prev) =>
      editingRecordingIndex === null
        ? [...prev, value]
        : prev.map((link, index) => (index === editingRecordingIndex ? value : link))
    );
    setLinkInput('');
    setLinkError('');
    setEditingRecordingIndex(null);
    refLinkSheet.current?.close();
  };

  const openRecordingLinkSheet = (index = null) => {
    setEditingRecordingIndex(index);
    setLinkInput(index === null ? '' : recordingLinks[index]);
    setLinkError('');
    refLinkSheet.current?.open();
  };

  const deleteRecordingLink = (index) => {
    setRecordingLinks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const deleteParticipant = async (id) => {
    // If it's a pending participant, remove from local state only
    if (typeof id === 'string' && id.startsWith('pending-')) {
      const removeIdx = Number(id.replace('pending-', ''));
      setPendingParticipants((prev) => {
        const removed = prev[removeIdx];
        // Remember a removed seeded rep so the opening-meeting auto-fill can't
        // bring it back.
        if (removed) {
          removedSeededRepKeys.current.add(repKey(removed));
        }
        return prev.filter((_, idx) => idx !== removeIdx);
      });
      return;
    }
    // Otherwise it's a server-saved rep: only hide it locally for now. The
    // delete API runs in handleSaveAndNext when the lead presses save, so
    // navigating back without saving leaves the rep untouched on the server.
    setPendingRemovedParticipantIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleSuccessComplete = () => {
    setShowSuccessScreen(false);
  };

  const { isLead: isLeadAssessor } = resolveTeamRole(
    assessmentData?.assessment,
    userData?.user?.id
  );

  // Pre-fill the closing meeting's representatives from the opening meeting so
  // the lead doesn't have to re-enter them. Runs once, only when building a new
  // closing meeting (none saved yet) and the lead hasn't added anyone locally.
  useEffect(() => {
    if (!assessmentId || !isLeadAssessor) {
      return;
    }
    if (closingMeetingDetailLoading) {
      return;
    }
    if (closingMeetingDetails?.meeting) {
      return;
    } // closing meeting already exists
    if (openingParticipantsSeeded.current) {
      return;
    }
    openingParticipantsSeeded.current = true;

    dispatch(getMeetingDetailsAction({ assessmentId, type: 'opening' })).then((result) => {
      if (result?.meta?.requestStatus !== 'fulfilled') {
        return;
      }
      const reps = (result?.payload?.meeting?.participants || [])
        .filter((p) => !p.teamMemberId && !p.isDefault)
        .map((p) => ({ name: p.name, designation: p.designation }));
      if (reps.length === 0) {
        return;
      }
      setPendingParticipants((prev) => {
        const existingKeys = new Set(prev.map(repKey));
        // Add only reps not already listed and not previously removed by the lead.
        const additions = reps.filter(
          (r) => !existingKeys.has(repKey(r)) && !removedSeededRepKeys.current.has(repKey(r))
        );
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
    });
  }, [
    assessmentId,
    isLeadAssessor,
    closingMeetingDetailLoading,
    closingMeetingDetails?.meeting,
    dispatch
  ]);

  const renderParticipant = (participant) => (
    <View key={participant.id} style={styles.participantItem}>
      <UserInitial
        name={participant.user?.firstName}
        lastName={`${participant.user?.lastName || ''}`}
        role={participant.role}
      />
      <View style={styles.participantInfo}>
        <Text style={[commonStyles.bodyMediumPrimary600]}>
          {`${participant?.user?.firstName || ''} ${participant?.user?.lastName || ''}`.trim()}
        </Text>
        <Text style={[commonStyles.bodySmallTertiary500]}>
          {participant.role == 'lead_assessor'
            ? 'Lead Assessor'
            : participant.role == 'co_assessor'
              ? 'Co-Assessor'
              : participant.role}
        </Text>
      </View>
      {participant.canRemove && isLeadAssessor && !readOnly && (
        <TouchableOpacity
          style={commonStyles.iconSize20}
          onPress={() => deleteParticipant(participant.participantId)}
          activeOpacity={0.6}>
          <Image source={Icons.redcross} style={commonStyles.iconSize20} />
        </TouchableOpacity>
      )}
    </View>
  );

  // Build the participant list shown in the UI. Saved members (assessors +
  // server-saved external reps) come first, then locally-seeded pending reps.
  // The list is then DEDUPED by person+role so a representative doesn't appear
  // 2-3 times — e.g. a rep seeded from the opening meeting that's also already
  // saved on the server, or repeated server copies from earlier saves.
  const displayParticipants = (() => {
    const teamMembers = (closingMeetingDetails?.teamMembers || []).filter(
      (m) => !pendingRemovedParticipantIds.includes(m?.participantId)
    );
    const leadAssessor = teamMembers.find((m) => m.role === 'lead_assessor');
    const otherMembers = teamMembers.filter((m) => m.role !== 'lead_assessor');
    const pending = pendingParticipants.map((p, idx) => {
      // The add-representative form has a single "Name" field, but the avatar
      // builds its initials from firstName + lastName. Split the typed name so a
      // rep like "John Doe" shows "JD" instead of just "J".
      const parts = String(p.name || '')
        .trim()
        .split(/\s+/);
      return {
        id: `pending-${idx}`,
        user: { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') },
        role: p.designation,
        isPending: true,
        canRemove: true,
        participantId: `pending-${idx}`
      };
    });
    const combined = [...(leadAssessor ? [leadAssessor] : []), ...otherMembers, ...pending];
    const seen = new Set();
    return combined.filter((m) => {
      const name = `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim().toLowerCase();
      const key = `${(m.role || '').toString().trim().toLowerCase()}|${name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  })();

  if (
    isInitialLoad(closingMeetingDetailLoading, closingMeetingDetails, closingMeetingDetailError)
  ) {
    return (
      <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
        <Header title="Closing Meeting" back={true} />
      </View>
    );
  }

  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      <Header title="Closing Meeting" back={true} />
      <AppScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={{ flex: 1 }}>
          {!isLeadAssessor &&
            !closingMeetingDetails?.meeting &&
            !pendingParticipants?.length > 0 && (
              <View style={{ backgroundColor: COLORS.background.primary }}>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.warning.primary,
                    padding: Responsive.height(8),
                    borderRadius: BORDER_RADIUS.br8,
                    marginTop: Responsive.height(15),
                    flexDirection: 'row',
                    paddingRight: 20,
                    backgroundColor: COLORS.warning.light,
                    gap: 10,
                    alignItems: 'center',
                    marginHorizontal: 16
                  }}>
                  <Image source={Icons.WarningAlert} style={commonStyles.iconSize18} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: COLORS.warning.primary }}>
                      You can provide your comments after the Lead Assessor completes the Closing
                      Meeting.
                    </Text>
                  </View>
                </View>
              </View>
            )}
          <View style={styles.imageSectionContainer}>
            <ImageUploaderUI
              title="Meeting Picture"
              image={closingPicture?.uri || closingPicture}
              coordinates={closingPicture?.coordinates}
              timestamp={closingPicture?.timestamp}
              syncState={closingPicture?.syncState}
              allowUpload={isServiceSector}
              onPress={() => {
                if (isLeadAssessor && !readOnly) {
                  openCamera();
                  setClosingPictureError('');
                }
              }}
              onUpload={() => {
                if (isLeadAssessor && !readOnly) {
                  openGallery();
                  setClosingPictureError('');
                }
              }}
              onDelete={() => setClosingPicture(null)}
              style={styles.imageUploader}
              isDelete={isLeadAssessor && !readOnly}
            />
            {closingPictureError ? (
              <Text style={{ color: COLORS.error.active, fontSize: 12 }}>
                {closingPictureError}
              </Text>
            ) : null}
          </View>
          <View style={styles.participantsSection}>
            <View style={styles.participantsHeader}>
              <View style={styles.participantsTitleContainer}>
                <Text style={styles.sectionTitle}>Participants</Text>
                <View style={styles.participantCountBadge}>
                  <Text style={styles.participantCount}>{displayParticipants.length}</Text>
                </View>
              </View>
              {isLeadAssessor && !readOnly && (
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => {
                    refRBSheet.current.open();
                  }}>
                  <Text style={styles.addButton}>+ Add Representative </Text>
                </TouchableOpacity>
              )}
            </View>
            {isLeadAssessor && !hasRepresentative && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.warning.primary,
                  padding: Responsive.height(8),
                  borderRadius: BORDER_RADIUS.br8,
                  marginBottom: Responsive.height(15),
                  flexDirection: 'row',
                  paddingRight: 20,
                  backgroundColor: COLORS.warning.light,
                  gap: 10,
                  alignItems: 'center'
                }}>
                <Image source={Icons.WarningAlert} style={commonStyles.iconSize18} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: COLORS.warning.primary }}>
                    Add at least one representative from the applicant organization to proceed.
                  </Text>
                </View>
              </View>
            )}
            <FlatList
              data={displayParticipants}
              renderItem={({ item }) => renderParticipant(item)}
              keyExtractor={(item) => item.id?.toString()}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              style={styles.participantsList}
              ItemSeparatorComponent={() => (
                <View
                  style={{
                    height: Responsive.height(1),
                    backgroundColor: COLORS.border.regular,
                    marginVertical: Responsive.height(12)
                  }}
                />
              )}
            />
            {participantsError ? (
              <Text style={{ color: COLORS.error.active, fontSize: 12 }}>{participantsError}</Text>
            ) : null}
          </View>
          <View style={[styles.commentsSection]}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
              <Text style={commonStyles.h2heading600}>
                Comments<Text style={{ color: COLORS.error.active, fontSize: 14 }}>*</Text>
              </Text>
              <Pressable
                onPress={() => {
                  setShowAllCommentsModal(true);
                }}>
                <Text
                  style={[
                    commonStyles.h2heading600,
                    { color: COLORS.button.primary, fontSize: 14 }
                  ]}>
                  View All Comments
                </Text>
              </Pressable>
            </View>
            <View>
              {closingMeetingDetails?.meeting?.comments?.length > 0 && (
                <View>
                  {closingMeetingDetails.meeting.comments.map((cmt, index) => {
                    const isLast = index === closingMeetingDetails.meeting.comments.length - 1;
                    const isOwnComment = cmt.teamMember?.user?.id === userId;
                    // The lead's own comment renders directly as an editable
                    // input (no edit toggle, no per-comment button) — prefilled
                    // with the saved comment on load. Edits persist with the main
                    // "Update Closing Meeting" save. Everyone else's is read-only.
                    if (isOwnComment && isLeadAssessor && !readOnly) {
                      return (
                        <View key={index}>
                          <View style={styles.commentInputContainer}>
                            <AppInput
                              maxLength={5000}
                              placeholderText={'Type your comment here'}
                              multiline={true}
                              addressInputStyle={styles.textAlignVertical}
                              heightInput={Responsive.height(100)}
                              value={comment}
                              onChange={(text) => {
                                setComment(text);
                                if (commentError && (text || '').trim().length >= 1) {
                                  setCommentError('');
                                }
                              }}
                              onFocus={() => setCommentError('')}
                            />
                            <Text style={styles.characterCount}>{comment.length}/5000</Text>
                          </View>
                          {commentError.length > 0 ? (
                            <Text style={{ color: COLORS.error.active, fontSize: 12 }}>
                              {commentError}
                            </Text>
                          ) : null}
                          {!isLast && (
                            <View
                              style={{
                                height: 1,
                                backgroundColor: COLORS.border.light,
                                marginVertical: Responsive.height(12)
                              }}
                            />
                          )}
                        </View>
                      );
                    }
                    return (
                      <View key={index}>
                        <View
                          style={{
                            marginTop: Responsive.height(15),
                            backgroundColor: COLORS.background.primary,
                            borderRadius: BORDER_RADIUS.br8
                          }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              marginBottom: Responsive.height(4),
                              gap: 10
                            }}>
                            <UserInitial
                              name={cmt.teamMember.user?.firstName}
                              role={cmt.teamMember.role}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  commonStyles.bodyMediumPrimary600,
                                  { marginBottom: Responsive.height(4) }
                                ]}>
                                {cmt.teamMember.user.firstName} {cmt.teamMember.user.lastName}
                              </Text>
                              <Text style={[commonStyles.bodySmallTertiary500]}>
                                {cmt.teamMember.role == 'lead_assessor'
                                  ? 'Lead Assessor'
                                  : 'Co-Assessor'}
                              </Text>
                            </View>
                            <View>
                              <View style={{ alignItems: 'center', flexDirection: 'row', gap: 5 }}>
                                <Text style={commonStyles.bodySmallTertiary700}>
                                  {cmt.createdAt
                                    ? format(new Date(cmt.createdAt), 'h:mm a')
                                    : ''}{' '}
                                </Text>
                                <View
                                  style={{
                                    height: 5,
                                    width: 5,
                                    borderRadius: 50,
                                    backgroundColor: '#C4CADA',
                                    alignSelf: 'center',
                                    marginVertical: Responsive.height(2)
                                  }}></View>
                                <Text style={commonStyles.bodySmallTertiary700}>
                                  {cmt.createdAt
                                    ? format(new Date(cmt.createdAt), 'd MMM, yyyy')
                                    : ''}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Text style={[commonStyles.bodyMediumPrimary400, { marginTop: 10 }]}>
                            {cmt.comment}
                          </Text>
                        </View>
                        {!isLast && (
                          <View
                            style={{
                              height: 1,
                              backgroundColor: COLORS.border.light,
                              marginVertical: Responsive.height(12)
                            }}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
            {/* Only show comment input if user hasn't commented yet */}
            {isLeadAssessor && !hasCommented && !readOnly && (
              <View style={styles.commentInputContainer}>
                <AppInput
                  maxLength={5000}
                  placeholderText={'Type your comment here'}
                  multiline={true}
                  addressInputStyle={styles.textAlignVertical}
                  heightInput={Responsive.height(100)}
                  value={comment}
                  onChange={(text) => {
                    setComment(text);
                    // Clear the "required" error live once the input is non-empty,
                    // instead of waiting for the next submit.
                    if (commentError && (text || '').trim().length >= 1) {
                      setCommentError('');
                    }
                  }}
                  onFocus={() => setCommentError('')}
                />
                <Text style={styles.characterCount}>{comment.length}/5000</Text>
              </View>
            )}
            {commentError.length > 0 ? (
              <Text style={{ color: COLORS.error.active, fontSize: 12 }}>{commentError}</Text>
            ) : null}
            {!closingMeetingDetails?.stepCompleted && closingMeetingDetails?.meeting && (
              <View
                style={{
                  padding: Responsive.height(8),
                  borderRadius: BORDER_RADIUS.br8,
                  marginTop: Responsive.height(15),
                  flexDirection: 'row',
                  flex: 1,
                  gap: 10,
                  alignItems: 'center'
                }}></View>
            )}
            {assessmentData?.assessment?.leadAssessor?.id !== userData?.user?.id &&
              isLeadAssessor &&
              !readOnly && (
                <Pressable
                  disabled={!isFormValid}
                  style={{
                    backgroundColor: isFormValid ? COLORS.button.primary : COLORS.button.disabled,
                    marginTop: 15,
                    padding: 15,
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    borderRadius: 12
                  }}
                  onPress={() => {
                    if (!validateClosingMeetingFields()) {
                      return;
                    } else {
                      setModal(true);
                    }
                  }}>
                  <Text style={{ color: COLORS.text.inverse }}>Add Comment</Text>
                </Pressable>
              )}
          </View>
          {isServiceSector && (
            <View style={[styles.participantsSection, styles.recordingsSection]}>
              <View style={styles.participantsHeader}>
                <View style={styles.participantsTitleContainer}>
                  <Text style={styles.recordingSectionTitle}>Meeting Recordings</Text>
                  <View style={styles.participantCountBadge}>
                    <Text
                      style={{
                        fontSize: FONT_SIZE.fs10,
                        color: COLORS.primary.main,
                        fontFamily: commonStyles.FontFamily_SemiBold600
                      }}>
                      <Text
                        style={{
                          fontSize: FONT_SIZE.fs12,
                          color: COLORS.primary.main,
                          fontFamily: commonStyles.FontFamily_Bold700
                        }}>
                        {recordingLinks.length}
                      </Text>{' '}
                      / {MAX_RECORDING_LINKS}
                    </Text>
                  </View>
                </View>
                {isLeadAssessor && !readOnly && recordingLinks.length < MAX_RECORDING_LINKS && (
                  <TouchableOpacity activeOpacity={0.6} onPress={() => openRecordingLinkSheet()}>
                    <Text style={styles.addButton}>+ Add Link</Text>
                  </TouchableOpacity>
                )}
              </View>
              {recordingLinks.length === 0 ? (
                <Text style={[commonStyles.bodySmallTertiary500]}>
                  {isLeadAssessor
                    ? 'No recording links added yet (optional).'
                    : 'No recording links added.'}
                </Text>
              ) : (
                recordingLinks.map((link, idx) => (
                  <View
                    key={`${link}-${idx}`}
                    style={[
                      styles.linkItem,
                      idx < recordingLinks.length - 1 && styles.linkItemWithDivider
                    ]}>
                    <View style={styles.linkContent}>
                      <Text style={styles.recordingTitle}>Recording {idx + 1}</Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={async () => {
                          try {
                            const supported = await Linking.canOpenURL(link);
                            if (supported) {
                              await Linking.openURL(link);
                            } else {
                              showWarningToast('Cannot open link', 'Invalid URL');
                            }
                          } catch (err) {
                            Logger.error('Error opening link', err);
                            showErrorToast('Error', 'Unable to open the link.');
                          }
                        }}>
                        <Text style={styles.recordingLink} numberOfLines={1} ellipsizeMode="tail">
                          {link}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {isLeadAssessor && !readOnly && (
                      <View style={styles.recordingActions}>
                        <TouchableOpacity
                          accessibilityLabel={`Edit recording ${idx + 1}`}
                          style={styles.recordingActionButton}
                          onPress={() => openRecordingLinkSheet(idx)}
                          activeOpacity={0.6}>
                          <Image source={Icons.edit} style={styles.editRecordingIcon} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityLabel={`Delete recording ${idx + 1}`}
                          style={styles.recordingActionButton}
                          onPress={() => deleteRecordingLink(idx)}
                          activeOpacity={0.6}>
                          <Image source={Icons.trash} style={styles.deleteRecordingIcon} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </View>
        {isLeadAssessor && !readOnly && (
          <View style={styles.buttonContainer}>
            <AppButton
              disabled={!closingPicture || !hasRepresentative}
              size="large"
              title={
                !closingMeetingDetails?.meeting
                  ? 'Complete Closing Meeting'
                  : 'Update Closing Meeting'
              }
              onPress={() => {
                if (!validateClosingMeetingFields()) {
                  return;
                } else {
                  setModal(true);
                }
              }}
              style={styles.saveButton}
            />
          </View>
        )}
      </AppScrollView>
      <AppModal visible={showAllCommentsModal}>
        <ViewAllComments
          visible={showAllCommentsModal}
          assessmentId={assessmentId}
          type="closing"
          onClose={() => setShowAllCommentsModal(false)}
        />
      </AppModal>
      <AppBottomSheet
        ref={refRBSheet}
        snapPoints={[
          Platform.select({
            android: 400,
            ios: 400
          })
        ]}>
        <View
          style={[
            commonStyles.center,
            {
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border.light,
              paddingBottom: Responsive.height(15)
            }
          ]}>
          <Text style={[commonStyles.h2heading600]}>Add Representative</Text>
        </View>
        <View style={[commonStyles.fill]}>
          <View
            style={[
              commonStyles.fill,
              commonStyles.paddingHorizontal16,
              { paddingVertical: Responsive.height(20) }
            ]}>
            <AppInput
              label={'Name'}
              maxLength={50}
              placeholderText={'Enter Name'}
              value={participantName}
              asterisk={true}
              onChange={setParticipantName}
            />
            <View style={{ paddingTop: Responsive.height(16) }}>
              <AppInput
                label={'Designation'}
                placeholderText={'Enter Designation'}
                maxLength={50}
                asterisk={true}
                value={participantDesignation}
                onChange={setParticipantDesignation}
              />
            </View>
          </View>
          <View
            style={[commonStyles.paddingHorizontal16, { paddingBottom: Responsive.height(10) }]}>
            <AppButton
              disabled={participantName.trim() === '' || participantDesignation.trim() === ''}
              size="large"
              title="Add Participant"
              onPress={handleAddParticipant}
              style={styles.addParticipantButton}
            />
          </View>
        </View>
      </AppBottomSheet>
      {isServiceSector && (
        <AppBottomSheet
          ref={refLinkSheet}
          snapPoints={[
            Platform.select({
              android: 320,
              ios: 320
            })
          ]}>
          <View
            style={[
              commonStyles.center,
              {
                borderBottomWidth: 1,
                borderBottomColor: COLORS.border.light,
                paddingBottom: Responsive.height(15)
              }
            ]}>
            <Text style={[commonStyles.h2heading600]}>
              {editingRecordingIndex === null ? 'Add Meeting Link' : 'Edit Meeting Link'}
            </Text>
          </View>
          <View style={[commonStyles.fill]}>
            <View
              style={[
                commonStyles.fill,
                commonStyles.paddingHorizontal16,
                { paddingVertical: Responsive.height(20) }
              ]}>
              <AppInput
                label={'Meeting Link'}
                placeholderText={'https://...'}
                value={linkInput}
                asterisk={true}
                maxLength={2048}
                cap={'none'}
                keyboardType={'url'}
                onChange={(text) => {
                  setLinkInput(text);
                  if (linkError) {
                    setLinkError('');
                  }
                }}
              />
              {linkError ? (
                <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 6 }}>
                  {linkError}
                </Text>
              ) : null}
            </View>
            <View
              style={[commonStyles.paddingHorizontal16, { paddingBottom: Responsive.height(10) }]}>
              <AppButton
                disabled={linkInput.trim() === ''}
                size="large"
                title={'Save'}
                onPress={handleSaveRecordingLink}
                style={styles.addParticipantButton}
              />
            </View>
          </View>
        </AppBottomSheet>
      )}
      <AppCommonModal
        showmodal={modal}
        imgsrc={Images.modalPendingImage}
        title="Complete Closing Meeting?"
        subTitle="After completing the Closing Meeting, you can punch out manually. Please log in to the web portal to review or update comments and submit the assessment for quality check."
        onPress={() => {
          setModal(false);
          // Complete the closing meeting only — punch-out is a separate,
          // manual step the user performs afterwards.
          handleSaveAndNext();
        }}
        twoButtonModal={true}
        leftButtonText="Cancel"
        leftButtonColor={COLORS.primary.soft}
        LeftbuttonTextColor={COLORS.primary.main}
        rightButtonText="Confirm"
        leftvariant="secondary"
        LeftonPress={() => {
          setModal(false);
        }}
      />
      <PunchModal
        visible={punch.checkInModalVisible}
        isPunchedIn={attendanceStatus?.isPunchedIn}
        onClose={punch.closeCheckInModal}
        onOpened={punch.handleModalOpened}
        selfieUri={punch.selfieUri}
        device={punch.device}
        isCameraActive={punch.isCameraActive}
        hasPermission={punch.hasPermission}
        cameraRef={punch.cameraRef}
        currentTime={punch.currentTime}
        userLocation={punch.userLocation}
        locationStatus={punch.locationStatus}
        onRetryLocation={punch.retryLocation}
        isCheckingIn={punch.isCheckingIn}
        onPunchIn={punch.handleCheckIn}
        onPunchOut={punch.handlePunchOutConfirm}
      />
      <CheckInSuccessScreen
        visible={showSuccessScreen}
        onComplete={handleSuccessComplete}
        location={
          punch.userLocation
            ? `${punch.userLocation.latitude}, ${punch.userLocation.longitude}`
            : 'Location not available'
        }
        time={punch.currentTime}
      />
    </View>
  );
};

const styles = {
  imageSectionContainer: {
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    marginBottom: Responsive.height(4)
  },
  imageUploader: {},
  participantsSection: {
    marginBottom: Responsive.height(4),
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    backgroundColor: COLORS.background.primary,
    marginTop: SPACING.sp4
  },
  recordingsSection: {
    paddingHorizontal: Responsive.width(24),
    paddingVertical: Responsive.height(24)
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sp16
  },
  participantsTitleContainer: {
    ...commonStyles.rowCenter,
    gap: SPACING.sp8
  },
  participantCountBadge: {
    height: 18,
    width: 34,
    borderRadius: BORDER_RADIUS.br12,
    backgroundColor: COLORS.primary.subtle,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sectionTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.heading
  },
  recordingSectionTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.heading
  },
  participantCount: {
    ...commonStyles.FontFamily_SemiBold600,
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs12
  },
  addButton: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs14,
    ...commonStyles.FontFamily_SemiBold600
  },
  participantsList: {
    flex: 0
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
    // paddingVertical: SPACING.sp12,
    // borderBottomWidth: 1,
    // borderBottomColor: COLORS.border.light,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sp16
  },
  linkItemWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light
  },
  linkContent: {
    flex: 1,
    minWidth: 0,
    paddingRight: 30
  },
  recordingTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    marginBottom: SPACING.sp2
  },
  recordingLink: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.info.main
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp8
  },
  recordingActionButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  editRecordingIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.info.main
  },
  deleteRecordingIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.error.active
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.br20,
    backgroundColor: COLORS.primary.soft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sp12
  },
  avatarText: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs16,
    ...commonStyles.FontFamily_SemiBold600
  },
  participantInfo: {
    flex: 1
  },
  removeButton: {
    padding: Responsive.width(8),
    borderRadius: BORDER_RADIUS.br20,
    backgroundColor: COLORS.error.light,
    marginLeft: SPACING.sp8
  },
  removeIcon: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    tintColor: COLORS.error.main
  },
  participantName: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    ...commonStyles.FontFamily_SemiBold600,
    marginBottom: SPACING.sp2
  },
  participantRole: {
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary,
    ...commonStyles.FontFamily_Regular400
  },
  commentsSection: {
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    backgroundColor: COLORS.background.primary
  },
  commentInputContainer: {
    backgroundColor: COLORS.background.secondary,
    borderRadius: BORDER_RADIUS.br8,
    marginTop: SPACING.sp12,
    position: 'relative'
  },
  commentInput: {
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.sp16,
    paddingVertical: SPACING.sp12,
    minHeight: Responsive.height(100),
    ...commonStyles.FontFamily_Regular400
  },
  characterCount: {
    position: 'absolute',
    bottom: SPACING.sp8,
    right: SPACING.sp12,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.placeholder,
    ...commonStyles.FontFamily_Regular400
  },
  addCommentButton: {
    backgroundColor: COLORS.border.regular,
    paddingHorizontal: SPACING.sp20,
    paddingVertical: SPACING.sp10,
    borderRadius: BORDER_RADIUS.br6,
    alignSelf: 'flex-start'
  },
  addCommentText: {
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.fs14,
    ...commonStyles.FontFamily_Medium500
  },
  saveButton: {
    marginTop: SPACING.sp20
  },
  buttonContainer: {
    paddingHorizontal: Responsive.width(16),
    paddingVertical: Responsive.height(16),
    backgroundColor: COLORS.background.primary
  },
  addParticipantButton: {
    marginTop: 0
  },
  deleteButton: {
    backgroundColor: COLORS.error.main,
    width: Responsive.width(20),
    height: Responsive.height(20),
    borderRadius: BORDER_RADIUS.br14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  deleteButtonText: {
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs18,
    lineHeight: FONT_SIZE.fs18
  },
  textAlignVertical: {
    textAlignVertical: 'top'
  }
};

export default ClosingMeeting;
