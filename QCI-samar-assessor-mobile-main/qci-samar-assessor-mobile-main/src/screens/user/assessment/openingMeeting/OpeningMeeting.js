import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
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
import { AppCommonModal } from '../../../../components/modals';
import { AppBottomSheet } from '../../../../components/shared';
import AppScrollView from '../../../../components/shared/AppScrollView';
import ApplicationLoader from '../../../../components/shared/Loader';
import ScreenLoader from '../../../../components/shared/ScreenLoader';
import UserInitial from '../../../../components/shared/UserInitial';
import Icons from '../../../../constants/Icons';
import {
  getAssessmentByIdAction,
  getStepProgressAction
} from '../../../../redux/action/assessmentAction';
import {
  addExternalParticipantAction,
  addOpeningCommentAction,
  createMeetingAction,
  deleteExternalParticipantAction,
  getMeetingDetailsAction,
  updateCommentAction
} from '../../../../redux/action/meetingAction';
import { persistCapture, stampCapture } from '../../../../services/offline/capturePipeline';
import {
  getImagePickerOptions,
  isInitialLoad,
  Logger,
  shouldShowApplicationLoader
} from '../../../../utils';
import { mapApiError } from '../../../../utils/errorMessages';
import { acquireCaptureCoords } from '../../../../utils/location';
import { ensurePermission } from '../../../../utils/permissions';
import { resolveTeamRole } from '../../../../utils/teamRole';
import { showErrorToast, showWarningToast } from '../../../../utils/toast';

const OpeningMeeting = ({ route }) => {
  // readOnly is the post-punch-out review pass: the meeting record stays fully
  // visible while every write affordance (picture, participants, comments, save)
  // is withheld.
  const { assessmentId, readOnly = false } = route.params;
  const navigation = useNavigation();
  const refRBSheet = useRef(null);
  // Guards the capture flow: the location fix fetched before the camera opens
  // takes a moment, so block re-entry to stop repeated taps queueing captures.
  const capturingRef = useRef(false);
  const dispatch = useDispatch();
  const [openingPicture, setOpeningPicture] = useState(null);
  const [comment, setComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [participantName, setParticipantName] = useState('');
  const [participantDesignation, setParticipantDesignation] = useState('');
  const [tempParticipants, setTempParticipants] = useState([]);
  const [deletedParticipants, setDeletedParticipants] = useState([]);
  const [successModal, setSuccessModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [openingPictureError, setOpeningPictureError] = useState('');
  const [_participantsError, setParticipantsError] = useState('');

  useEffect(() => {
    if (!assessmentId) {
      return;
    }
    dispatch(getMeetingDetailsAction({ assessmentId, type: 'opening' }));
  }, [assessmentId, dispatch]);

  const {
    meetingDetails,
    deleteExternalParticipantLoading,
    addExternalParticipantLoading,
    meetingDetailsLoading,
    meetingDetailsError
  } = useSelector((state) => state.meeting);
  const { assessmentData } = useSelector((state) => state.assessment);
  const { userData } = useSelector((state) => state.account);

  // A meeting comment's owner is the nested teamMember.user.id (what the render
  // uses). The flat teamMember.userId that the populate / change-detection /
  // save paths used before is undefined in the API shape, so they never matched
  // the current user — which left a saved comment blank on reopen, mislabeled
  // the button, and re-added a comment instead of updating it. Match both forms
  // defensively so it's robust to either shape.
  const isCurrentUserComment = useCallback(
    (c) =>
      c?.teamMember?.user?.id === userData?.user?.id ||
      c?.teamMember?.userId === userData?.user?.id,
    [userData?.user?.id]
  );

  useEffect(() => {
    if (meetingDetails?.meeting) {
      const meeting = meetingDetails.meeting;
      if (meeting.imageUrl) {
        setOpeningPicture({
          uri: meeting.imageUrl,
          coordinates:
            meeting.latitude && meeting.longitude
              ? { latitude: meeting.latitude, longitude: meeting.longitude }
              : null,
          timestamp: meeting.conductedAt || new Date().toISOString(),
          syncState: meeting.syncState || 'synced'
        });
      }
      if (meeting.comments?.length > 0) {
        const userComment = meeting.comments.find(isCurrentUserComment);
        if (userComment) {
          setComment(userComment.comment || '');
        }
      }
    }
  }, [meetingDetails, isCurrentUserComment]);
  // Determine if there's at least one representative that can be removed (external)
  const originalServerRemovableCount = useRef(null);
  const serverRemovableCount =
    (meetingDetails?.teamMembers || []).filter((m) => m?.canRemove).length || 0;
  if (originalServerRemovableCount.current === null && meetingDetails) {
    originalServerRemovableCount.current = serverRemovableCount;
  }
  const localRepsCount = tempParticipants?.length || 0;
  // Visible server reps exclude locally-deleted ones
  const visibleServerCount = Math.max(0, serverRemovableCount - deletedParticipants.length);
  const hasRepresentative = visibleServerCount + localRepsCount > 0;

  // Detect changes to image/comment/participants to switch label to 'Update Meeting'
  const originalUserComment =
    meetingDetails?.meeting?.comments?.find(isCurrentUserComment)?.comment || '';
  const commentChanged = (comment || '').trim() !== (originalUserComment || '').trim();
  const meetingImageUrl = meetingDetails?.meeting?.imageUrl || '';
  const imageChanged =
    !!openingPicture &&
    (!meetingDetails?.meeting ||
      !meetingImageUrl ||
      !openingPicture.uri?.startsWith?.('http') ||
      openingPicture.uri !== meetingImageUrl);
  const participantsChanged =
    localRepsCount > 0 ||
    visibleServerCount !== (originalServerRemovableCount.current ?? serverRemovableCount);
  const isExistingMeeting = !!meetingDetails?.meeting;
  // Persist whether a meeting existed on initial load so label stays 'Update Meeting'
  const originalMeetingExists = useRef(null);
  useEffect(() => {
    if (originalMeetingExists.current === null && meetingDetails) {
      originalMeetingExists.current = !!meetingDetails?.meeting;
    }
  }, [meetingDetails]);

  const primaryButtonLabel =
    originalMeetingExists.current === true ? 'Update Meeting' : 'Save & Next';

  const commentValid = (comment || '').trim().length >= 1;
  const hasChanges = imageChanged || commentChanged || participantsChanged;
  // Enable primary button when required fields are present and there are changes for existing meetings.
  // For new meetings, comment must be valid. For existing meetings, allow participant-only or image-only
  // changes to enable the button even if the comment is empty.
  const primaryButtonEnabled =
    !!openingPicture &&
    hasRepresentative &&
    !deleteExternalParticipantLoading &&
    !addExternalParticipantLoading &&
    !meetingDetailsLoading &&
    (!isExistingMeeting
      ? commentValid
      : hasChanges && (commentValid || imageChanged || participantsChanged));
  // Service-sector assessments are conducted online (meeting link, no site
  // visit), so a meeting screenshot from the gallery is allowed there. Every
  // other sector stays camera-only — captured-on-site evidence integrity.
  const sector = assessmentData?.assessment?.application?.sector;
  const isServiceSector = String(sector || '').toLowerCase() === 'service';
  const fetchLocationAndSaveImage = async (imageAsset, coords) => {
    // Coordinates are already resolved by the capture gate (acquireCaptureCoords)
    // before the camera/gallery opened.
    const timestamp = new Date().toISOString();
    try {
      const durableUri = await persistCapture({
        uri: imageAsset.uri,
        serverAssessmentId: assessmentId,
        bucket: 'meeting_opening',
        label: 'opening meeting photo'
      });
      setOpeningPicture({
        uri: durableUri,
        coordinates: { latitude: coords.latitude, longitude: coords.longitude },
        timestamp,
        syncState: 'pending'
      });

      const stampedUri = await stampCapture({
        uri: durableUri,
        serverAssessmentId: assessmentId,
        bucket: 'meeting_opening',
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp,
        label: 'opening meeting photo'
      });
      setOpeningPicture({
        uri: stampedUri,
        coordinates: { latitude: coords.latitude, longitude: coords.longitude },
        timestamp,
        syncState: 'pending'
      });
      Logger.info('Opening picture saved:', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp
      });
    } catch (error) {
      Logger.error('Image processing error:', error);
      // Capture/persist failed (empty file) — clear and ask for a retake rather
      // than staging a doomed raw uri.
      setOpeningPicture(null);
      const message = typeof error === 'string' ? error : error?.message;
      showWarningToast('Capture Failed', message || 'Could not save the photo. Please retake it.');
    }
  };

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

      // Opening meeting photos are geo-verification evidence: obtain a valid fix
      // BEFORE the camera opens and block the capture entirely if none is
      // available. acquireCaptureCoords shows a single "Location Required" alert
      // and returns null on failure. The fix takes a moment, so hold a loader
      // over it — otherwise the button looks dead and gets tapped repeatedly.
      ApplicationLoader.show('openingMeetingCapture');
      const coords = await acquireCaptureCoords();
      ApplicationLoader.hide('openingMeetingCapture');
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
      ApplicationLoader.hide('openingMeeting');
      capturingRef.current = false;
    }
  };

  // Gallery picker — service sector only (see openImagePicker). The picked image
  // still flows through fetchLocationAndSaveImage, so it's geo-stamped and
  // persisted to durable storage exactly like a camera capture. A gallery pick
  // carries no reliable capture-location metadata, so it goes through the same
  // pre-pick location gate.
  const openGallery = async () => {
    if (capturingRef.current) {
      return;
    }
    capturingRef.current = true;
    try {
      ApplicationLoader.show('openingMeetingCapture');
      const coords = await acquireCaptureCoords();
      ApplicationLoader.hide('openingMeetingCapture');
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
      ApplicationLoader.hide('openingMeeting');
      capturingRef.current = false;
    }
  };

  const deleteParticipant = async (id) => {
    // Toggle delete locally. If participant is local (temp), remove immediately.
    Logger.info('Toggling delete for participant id:', id, tempParticipants);
    const isTemp = tempParticipants.some((p) => p.participantId == id);
    if (isTemp) {
      setTempParticipants((prev) => prev.filter((p) => p.participantId !== id));
      // If it was previously marked for deletion (unlikely), remove from deleted list
      setDeletedParticipants((prev) => prev.filter((d) => d !== id));
      return;
    }

    // For server participants, mark/unmark deletion locally. Do NOT call API now.
    setDeletedParticipants((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const createMeetingHandler = async () => {
    if (!openingPicture) {
      showWarningToast('Required', 'Please capture opening picture before saving.');
      return;
    }

    try {
      const teamMembers = assessmentData?.assessment?.teamMembers || [];
      const currentMember = teamMembers.find(
        (m) => m?.userId === userData?.user?.id || m?.user?.id === userData?.user?.id
      );

      await dispatch(
        createMeetingAction({
          assessmentId,
          teamMemberId: currentMember?.id ?? currentMember?.teamMemberId,
          imageUri: openingPicture?.uri,
          latitude: openingPicture?.coordinates?.latitude,
          longitude: openingPicture?.coordinates?.longitude,
          comment: (comment || '').trim() || undefined,
          participants: (tempParticipants || []).map((p) => ({
            name: p?.name,
            designation: p?.designation
          }))
        })
      ).unwrap();
    } catch (error) {
      Logger.error('Error saving opening meeting:', error);
      throw error;
    }
  };

  const validateOpeningMeetingFields = () => {
    let isValid = true;

    if (!openingPicture) {
      setOpeningPictureError('Opening picture is required.');
      isValid = false;
    } else {
      setOpeningPictureError('');
    }

    if (!hasRepresentative) {
      setParticipantsError('At least one extra participant is required.');
      isValid = false;
    } else {
      setParticipantsError('');
    }

    // Require comment only for new meetings or when the comment itself was changed.
    // Also always require if user has no existing comment (e.g. co-assessor adding first comment)
    const userHasNoExistingComment = !originalUserComment;
    if (!isExistingMeeting || commentChanged || userHasNoExistingComment) {
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

  const handleSaveAndNext = async () => {
    if (!validateOpeningMeetingFields()) {
      return;
    }

    // One loader for the whole multi-call sequence (see isMeetingBusy).
    setSubmitting(true);

    const hasUri = openingPicture?.uri;
    const meetingImageUrl = meetingDetails?.meeting?.imageUrl;
    let shouldCallCreateMeeting = false;
    if (hasUri) {
      // If no meeting exists, or image is new/changed, call createMeetingHandler
      if (!meetingDetails?.meeting) {
        shouldCallCreateMeeting = true;
      } else if (hasUri !== meetingImageUrl) {
        shouldCallCreateMeeting = true;
      } else if (!hasUri.startsWith('http')) {
        shouldCallCreateMeeting = true;
      }
    }
    Logger.info('Should call createMeetingHandler:', shouldCallCreateMeeting);

    // Each step is applied independently: a failure in one (e.g. the comment
    // update) must NOT strand the pending participant deletions below — that was
    // why a removed representative could come back ("not removed"). Failures are
    // collected and surfaced; only a fully clean save navigates away.
    const failures = [];
    // Track which pending participants actually persisted, but DON'T clear them
    // from local state until AFTER the meeting refetch below. Clearing mid-save
    // (before the server list repopulates) collapses the participant list, which
    // shows through the translucent loader as an "empty fields" flash.
    const addedParticipantIds = [];
    const removedParticipantIds = [];

    try {
      // 1. Only call createMeetingHandler if image is new/changed
      if (shouldCallCreateMeeting) {
        try {
          await createMeetingHandler();
        } catch (err) {
          Logger.error('Opening meeting photo save failed:', err);
          failures.push('meeting photo');
        }
      }

      // 2. Add/update the comment ONLY when it actually changed. Firing a no-op
      // update on every save added a failure point that could abort the
      // deletions in step 4.
      if (commentChanged && comment.trim() !== '') {
        try {
          const hasOwnComment = meetingDetails?.meeting?.comments?.some(isCurrentUserComment);
          if (!meetingDetails || !hasOwnComment) {
            await handlerAddCommment();
          } else {
            await handlerUpdateCommment();
          }
        } catch (err) {
          Logger.error('Opening meeting comment save failed:', err);
          failures.push('comment');
        }
      }

      // 3. Add any pending participants. Drop only the ones that actually saved
      // so a failed add stays pending for the next attempt.
      if (tempParticipants?.length > 0) {
        for (const participant of tempParticipants) {
          const val = {
            assessmentId: assessmentId,
            type: 'opening',
            data: {
              name: `${participant.user.firstName} ${participant.user.lastName || ''}`.trim(),
              designation: participant.role
            }
          };
          try {
            await dispatch(addExternalParticipantAction(val)).unwrap();
            addedParticipantIds.push(participant.participantId);
          } catch (err) {
            Logger.error('Failed to add participant during save:', err);
            failures.push('a representative');
          }
        }
      }

      // 4. Apply any pending deletions to server. Independent per id: a failure
      // doesn't strand the others, and only successfully deleted ids leave the
      // pending set (failures stay queued for the next save).
      if (deletedParticipants?.length > 0) {
        for (const pid of deletedParticipants) {
          try {
            const val = { assessmentId: assessmentId, type: 'opening', participantId: pid };
            await dispatch(deleteExternalParticipantAction(val)).unwrap();
            removedParticipantIds.push(pid);
          } catch (err) {
            Logger.error('Failed to delete participant during save:', pid, err);
            failures.push('a removed representative');
          }
        }
      }

      await dispatch(getStepProgressAction(assessmentId));
      await dispatch(getAssessmentByIdAction(assessmentId));
      // Re-pull the meeting so the participant list reflects what actually
      // persisted — a queued/failed delete must not look "removed" in the UI.
      await dispatch(getMeetingDetailsAction({ assessmentId, type: 'opening' }));

      // Now that the refetched server list already includes the added reps (and
      // excludes the deleted ones), drop the local pending entries. Doing it here
      // — after the refetch — means the list transitions straight from "local"
      // to "server" with no empty gap flashing behind the loader.
      if (addedParticipantIds.length > 0) {
        setTempParticipants((prev) =>
          prev.filter((p) => !addedParticipantIds.includes(p.participantId))
        );
      }
      if (removedParticipantIds.length > 0) {
        setDeletedParticipants((prev) => prev.filter((id) => !removedParticipantIds.includes(id)));
      }

      if (failures.length > 0) {
        const what = [...new Set(failures)].join(', ');
        showErrorToast('Some changes not saved', `Could not save: ${what}. Please try again.`);
        return;
      }

      // Only navigate away on full success
      setSuccessModal(true);
      setTimeout(async () => {
        // User may have navigated back during the 2s window — don't fire
        // state updates / a second goBack on an unmounted screen.
        if (!navigation.isFocused()) {
          return;
        }
        setSuccessModal(false);

        navigation.goBack();
      }, 2000);
    } catch (error) {
      Logger.error('Opening meeting submission failed:', error);
      showErrorToast('Submission Failed', mapApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddParticipant = () => {
    if (participantName.trim() === '' || participantDesignation.trim() === '') {
      Logger.warn('Participant form incomplete: name or designation is empty.');
      return;
    }
    // The form captures a single "Name" field. Split it into first/last name so
    // the surname isn't left empty (the display and UserInitial both rely on
    // lastName). First word → firstName, the remainder → lastName.
    const nameParts = participantName.trim().split(/\s+/);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');
    setTempParticipants((prev) => [
      ...prev,
      {
        participantId: `${Date.now()}`,
        user: { firstName, lastName },
        role: participantDesignation,
        canRemove: true,
        isTemp: true
      }
    ]);
    setParticipantName('');
    setParticipantDesignation('');
    refRBSheet.current.close();
  };

  // When saving, apply pending deletions and additions to server

  const handlerAddCommment = async () => {
    const val = {
      assessmentId: assessmentId,
      type: 'opening',
      data: {
        comment: comment
      }
    };
    await dispatch(addOpeningCommentAction(val));
    // await dispatch(getMeetingDetailsAction({ assessmentId: assessmentId, type: 'opening' }));
  };

  const handlerUpdateCommment = async () => {
    const val = {
      assessmentId: assessmentId,
      type: 'opening',
      data: {
        comment: comment
      }
    };
    await dispatch(updateCommentAction(val));
    // await dispatch(getMeetingDetailsAction({ assessmentId: assessmentId, type: 'opening' }));
  };

  // The loader is owned by exactly two things:
  //   - the initial meeting-details fetch, which already uses ScreenLoader, and
  //   - the Save & Next sequence, tracked as ONE unit via `submitting`.
  // Save & Next fires several APIs back-to-back; watching the individual
  // request flags here would flip the loader off/on in the gaps between each
  // call. Tracking the whole sequence with a single flag keeps it shown
  // once, start to finish.
  const showInitialLoader = isInitialLoad(
    meetingDetailsLoading,
    meetingDetails,
    meetingDetailsError
  );
  const isMeetingBusy = submitting || (!showInitialLoader && meetingDetailsLoading);

  useEffect(() => {
    if (shouldShowApplicationLoader({ showInitialLoader, isBusy: isMeetingBusy })) {
      ApplicationLoader.show('openingMeeting');
    } else {
      ApplicationLoader.hide('openingMeeting');
    }

    return () => {
      ApplicationLoader.hide('openingMeeting');
    };
  }, [showInitialLoader, isMeetingBusy]);
  const renderParticipant = (participant) => (
    <View key={participant.id} style={styles.participantItem}>
      <UserInitial
        name={participant.user?.firstName}
        lastName={`${participant.user?.lastName || ''}`}
        role={participant.role}
      />
      <View style={styles.participantInfo}>
        <Text style={[commonStyles.bodyMediumPrimary600]}>
          {participant.user?.firstName} {participant.user?.lastName}
        </Text>
        <Text style={[commonStyles.bodySmallTertiary500]}>
          {participant.role == 'lead_assessor'
            ? 'Lead Assessor'
            : participant.role == 'co_assessor'
              ? 'Co-Assessor'
              : participant.role}
        </Text>
      </View>
      {isLeadAssessor && participant.canRemove && !readOnly && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteParticipant(participant.participantId)}
          activeOpacity={0.6}>
          <Text style={styles.deleteButtonText}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const { isLead: isLeadAssessor } = resolveTeamRole(
    assessmentData?.assessment,
    userData?.user?.id
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(getMeetingDetailsAction({ assessmentId, type: 'opening' }));
    setRefreshing(false);
  };

  if (showInitialLoader) {
    return (
      <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
        <Header title="Opening Meeting" back={true} />
        <ScreenLoader />
      </View>
    );
  }

  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      <Header title="Opening Meeting" back={true} />
      <AppScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={{ flex: 1 }}>
          <View style={styles.imageSectionContainer}>
            <ImageUploaderUI
              title="Meeting Picture"
              image={openingPicture?.uri || openingPicture}
              allowUpload={isServiceSector}
              onPress={() => {
                if (isLeadAssessor && !readOnly) {
                  setOpeningPictureError('');
                  openCamera();
                }
              }}
              onUpload={() => {
                if (isLeadAssessor && !readOnly) {
                  setOpeningPictureError('');
                  openGallery();
                }
              }}
              onDelete={() => setOpeningPicture(null)}
              isDelete={isLeadAssessor && !readOnly}
              coordinates={openingPicture?.coordinates}
              timestamp={openingPicture?.timestamp}
              syncState={openingPicture?.syncState}
              style={styles.imageUploader}
            />
            {openingPictureError ? (
              <Text style={{ color: COLORS.error.active, fontSize: 12, marginTop: 4 }}>
                {openingPictureError}
              </Text>
            ) : null}
          </View>
          <View style={styles.participantsSection}>
            <View style={styles.participantsHeader}>
              <View style={styles.participantsTitleContainer}>
                <Text style={styles.sectionTitle}>Participants</Text>
                <View style={styles.participantCountBadge}>
                  <Text style={styles.participantCount}>
                    {(() => {
                      const teamMembers = meetingDetails?.teamMembers || [];
                      const filteredServer = teamMembers.filter((m) => {
                        const pid = m.participantId ?? m.id;
                        return !deletedParticipants.includes(pid);
                      });
                      return (filteredServer.length || 0) + (tempParticipants?.length || 0);
                    })()}
                  </Text>
                </View>
              </View>
              {isLeadAssessor && !readOnly && (
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => {
                    // Start each "Add Participant" sheet with empty inputs so a
                    // previously typed (but not submitted) name/designation
                    // doesn't carry over.
                    setParticipantName('');
                    setParticipantDesignation('');
                    refRBSheet.current.open();
                  }}>
                  <Text style={styles.addButton}>+ Add Representative </Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Hide the warning while a save or fetch is in flight: the save
                flow clears tempParticipants before the meeting refetch repopulates
                the server list, so hasRepresentative briefly reads false and the
                banner would flash. isMeetingBusy spans that whole window (and the
                initial load), so the warning only shows once the data settles. */}
            {!hasRepresentative && !isMeetingBusy && (
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
                    Please add at least one representative from the Enterprise Unit to continue.
                  </Text>
                </View>
              </View>
            )}
            <FlatList
              data={(() => {
                const teamMembers = meetingDetails?.teamMembers || [];
                // Exclude participants marked for deletion so tapping cross removes them locally
                const filteredServer = teamMembers.filter((m) => {
                  const pid = m.participantId ?? m.id;
                  return !deletedParticipants.includes(pid);
                });
                const leadAssessor = filteredServer.find((m) => m.role === 'lead_assessor');
                const others = filteredServer.filter((m) => m.role !== 'lead_assessor');
                return leadAssessor
                  ? [leadAssessor, ...others, ...tempParticipants]
                  : [...others, ...tempParticipants];
              })()}
              renderItem={({ item }) => renderParticipant(item)}
              keyExtractor={(item) => item.participantId || item.id}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              style={styles.participantsList}
              ItemSeparatorComponent={() => (
                <View
                  style={{
                    height: 1,
                    backgroundColor: COLORS.border.regular,
                    marginVertical: Responsive.height(10)
                  }}
                />
              )}
            />
          </View>
          <View style={styles.commentsSection}>
            <Text style={commonStyles.h2heading600}>
              Comments
              <Text style={{ color: COLORS.error.active, fontSize: FONT_SIZE.fs14 }}>*</Text>
            </Text>
            <View>
              {/* The creator edits their own comment in the input below, so the
                  list is hidden for them while editing is possible. In the
                  post-punch-out review the input is gone, so the list must show
                  for everyone or the creator sees no comments at all. */}
              {(readOnly || meetingDetails?.meeting?.creator?.id !== userData?.user?.id) &&
              meetingDetails?.meeting?.comments?.length > 0 ? (
                <View>
                  {meetingDetails?.meeting?.comments?.map((cmt, index) => {
                    const isOwnComment = cmt.teamMember.user.id === userData?.user?.id;
                    if (
                      editingCommentId === cmt.id &&
                      isOwnComment &&
                      isLeadAssessor &&
                      !readOnly
                    ) {
                      // Show comment input and Add Comment button for editing
                      return (
                        <View
                          key={index}
                          style={{
                            marginTop: Responsive.height(15),
                            backgroundColor: COLORS.background.primary,
                            borderRadius: BORDER_RADIUS.br8
                          }}>
                          <View style={styles.commentInputContainer}>
                            <AppInput
                              placeholderText={'Type your comment here'}
                              multiline={true}
                              maxLength={5000}
                              addressInputStyle={styles.textAlignVertical}
                              heightInput={Responsive.height(100)}
                              value={comment}
                              onChange={setComment}
                              onFocus={() => setCommentError('')}
                              // errors={commentError ? [commentError] : []}
                            />
                            <Text style={styles.characterCount}>{comment.length}/5000</Text>
                          </View>
                          {commentError.length > 0 ? (
                            <Text style={{ color: COLORS.error.active, fontSize: 12 }}>
                              {commentError}
                            </Text>
                          ) : null}
                          <Pressable
                            onPressIn={handleSaveAndNext}
                            style={{
                              backgroundColor: COLORS.button.primary,
                              marginTop: 15,
                              paddingHorizontal: 15,
                              paddingVertical: 10,
                              alignItems: 'center',
                              alignSelf: 'flex-start',
                              borderRadius: 12
                            }}>
                            <Text style={{ color: COLORS.text.inverse }}>Add Comment</Text>
                          </Pressable>
                        </View>
                      );
                    }
                    // Show mapped comment if not editing
                    return (
                      <View
                        key={index}
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
                            lastName={cmt.teamMember.user?.lastName}
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
                                {format(new Date(cmt.createdAt), 'h:mm a')}{' '}
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
                                {format(new Date(cmt.createdAt), 'd MMM, yyyy')}
                              </Text>
                            </View>
                            {isOwnComment && isLeadAssessor && !readOnly && (
                              <View style={{ alignItems: 'flex-end' }}>
                                <Pressable
                                  onPress={() => {
                                    setEditingCommentId(cmt.id);
                                    setComment(cmt.comment);
                                  }}>
                                  <Image
                                    source={Icons.edit}
                                    style={{
                                      width: 16,
                                      height: 16,
                                      tintColor: COLORS.icon.regular,
                                      marginTop: Responsive.height(8)
                                    }}
                                  />
                                </Pressable>
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={[commonStyles.bodyMediumPrimary400, { marginTop: 10 }]}>
                          {cmt.comment}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
            {isLeadAssessor &&
              !readOnly &&
              (meetingDetails?.meeting?.creator?.id === userData?.user?.id ||
                !(meetingDetails?.meeting?.comments || []).some(
                  (cmt) => cmt.teamMember?.user?.id === userData?.user?.id
                )) && (
                <View style={styles.commentInputContainer}>
                  <AppInput
                    maxLength={1000}
                    placeholderText={'Type your comment here'}
                    multiline={true}
                    addressInputStyle={styles.textAlignVertical}
                    heightInput={Responsive.height(100)}
                    value={comment}
                    onChange={setComment}
                    onFocus={() => setCommentError('')}
                    // errors={commentError ? [commentError] : []}
                  />
                  <Text style={styles.characterCount}>{comment.length}/1000</Text>
                </View>
              )}
            {commentError.length > 0 ? (
              <Text style={{ color: COLORS.error.active, fontSize: 12 }}>{commentError}</Text>
            ) : null}
            {!isLeadAssessor &&
              !readOnly &&
              meetingDetails?.meeting?.comments.filter(
                (cmt) => cmt.teamMember.user.id === userData?.user?.id
              ).length === 0 && (
                <Pressable
                  style={{
                    backgroundColor: COLORS.button.primary,
                    marginTop: 15,
                    paddingHorizontal: 15,
                    paddingVertical: 10,
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    borderRadius: 12
                  }}
                  onPress={handleSaveAndNext}>
                  <Text style={{ color: COLORS.text.inverse }}>Add Comment</Text>
                </Pressable>
              )}
          </View>
        </View>
        {isLeadAssessor && !readOnly && (
          <View style={styles.buttonContainer}>
            <AppButton
              disabled={!primaryButtonEnabled}
              size="large"
              title={primaryButtonLabel}
              onPress={handleSaveAndNext}
              style={styles.saveButton}
            />
          </View>
        )}
      </AppScrollView>
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
              maxLength={50}
              label={'Name'}
              asterisk={true}
              placeholderText={'Enter Name'}
              value={participantName}
              onChange={setParticipantName}
            />
            <View style={{ paddingTop: Responsive.height(16) }}>
              <AppInput
                maxLength={50}
                label={'Designation'}
                asterisk={true}
                placeholderText={'Enter Designation'}
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
      <AppCommonModal
        showmodal={successModal}
        imgsrc={Icons.success}
        title={
          meetingDetails?.meeting === null ? 'Opening Meeting Completed' : 'Opening Meeting Updated'
        }
        subTitle={
          meetingDetails?.meeting === null
            ? 'Your opening meeting has been completed successfully.'
            : 'Your opening meeting has been updated successfully.'
        }
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
    backgroundColor: COLORS.background.primary
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
    paddingHorizontal: Responsive.width(10),
    paddingVertical: Responsive.height(3),
    borderRadius: BORDER_RADIUS.br12,
    backgroundColor: COLORS.primary.subtle
  },
  sectionTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.heading
  },
  participantCount: {
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs12
  },
  addButton: {
    ...commonStyles.FontFamily_SemiBold600,
    color: COLORS.primary.main,
    fontSize: FONT_SIZE.fs14
  },
  participantsList: {
    flex: 0
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
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
    width: 20,
    height: 20,
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

export default OpeningMeeting;
