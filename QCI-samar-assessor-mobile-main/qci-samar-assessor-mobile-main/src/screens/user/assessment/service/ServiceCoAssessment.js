import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../../assets/theme/Layout';
import { commonStyles } from '../../../../assets/theme/Styles';
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONTS_FAMILY,
  SPACING
} from '../../../../assets/theme/Theme';
import MeetingLinkCard from '../../../../components/assessment/MeetingLinkCard';
import { Header } from '../../../../components/layout';
import { AppCommonModal, PointOfContactModal } from '../../../../components/modals';
import { CheckInSuccessScreen, SubmitSuccessScreen } from '../../../../components/shared';
import AppScrollView from '../../../../components/shared/AppScrollView';
import AppFastImage from '../../../../components/shared/FastImage';
import ApplicationLoader from '../../../../components/shared/Loader';
import Icons from '../../../../constants/Icons';
import {
  getAllAssessmentsAction,
  getAssessmentByIdAction,
  getAttendanceStatusAction,
  getStepProgressAction
} from '../../../../redux/action/assessmentAction';
import { getAssessmentParametersAction } from '../../../../redux/action/assessmentParameterAction';
import { resetAssessmentParameterSliceState } from '../../../../redux/slices/assessmentParameterSlice';
import { resetAssessmentResponseSliceState } from '../../../../redux/slices/assessmentResponseSlice';
import {
  resetAssessmentByIdState,
  resetStepProgressState
} from '../../../../redux/slices/assessmentSlice';
import { resetBasicInformationSliceState } from '../../../../redux/slices/basicInformationSlice';
import { resetMeetingSliceState } from '../../../../redux/slices/meetingSlice';
import { resetSiteSliceState } from '../../../../redux/slices/siteSlice';
import { idFromServer } from '../../../../services/database/ids';
import { getMeetingByType } from '../../../../services/database/repositories/meetingsRepo';
import {
  formatDate,
  getAssessmentWindowOpenDate,
  isAssessmentWindowOpen
} from '../../../../utils/dateUtils';
import { checkFreeDiskSpace, formatBytes } from '../../../../utils/diskSpace';
import getAssessmentPercentage from '../../../../utils/getAssessmentPercentage';
import { Logger } from '../../../../utils/logger';
import { showWarningToast } from '../../../../utils/toast';
import AssessmentFooter from '../shared/AssessmentFooter';
import { styles } from '../shared/assessmentStepsStyles';
import PunchModal from '../shared/PunchModal';
import useLocationWarmup from '../shared/useLocationWarmup';
import useOutboxSync from '../shared/useOutboxSync';
import usePunchFlow from '../shared/usePunchFlow';

// Status pill: label + themed colors per assessment status. Mirrors Home's
// getStatusMeta so the detail badge matches the list (scheduled / in_progress /
// completed). 'mobile_complete' isn't surfaced on the co-assessor detail badge.
const getStatusMeta = (status) => {
  switch (status) {
    case 'scheduled':
      return {
        label: 'Scheduled',
        color: COLORS.status.infoText,
        backgroundColor: COLORS.status.infoBackground
      };
    case 'completed':
    case 'mobile_complete':
      return {
        label: 'Completed',
        color: COLORS.status.successText,
        backgroundColor: COLORS.status.successBackground
      };
    case 'in_progress':
    default:
      return {
        label: 'In Progress',
        color: COLORS.status.warningText,
        backgroundColor: COLORS.status.warningBackground
      };
  }
};

const ServiceCoAssessment = ({ route }) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const isFocused = useIsFocused();
  const { assessmentId } = route.params || {};
  const [pocModalVisible, setPocModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLocalOpeningMeeting, setHasLocalOpeningMeeting] = useState(false);
  // Onsite assessment needs at least 1 GB free so photos/data can be captured offline.
  const [diskState, setDiskState] = useState({ sufficient: true, freeBytes: 0, checked: false });

  // Reset all assessment-related Redux slices when assessmentId changes
  // Also cleans up on unmount to avoid stale state when navigating away
  useEffect(() => {
    // Clear previous assessment data to prevent cache issues
    dispatch(resetAssessmentByIdState());
    dispatch(resetStepProgressState());
    dispatch(resetAssessmentParameterSliceState());
    dispatch(resetAssessmentResponseSliceState());
    dispatch(resetSiteSliceState());
    dispatch(resetMeetingSliceState());
    dispatch(resetBasicInformationSliceState());

    // Then fetch new assessment data
    dispatch(getAttendanceStatusAction(assessmentId));

    return () => {
      dispatch(resetAssessmentByIdState());
      dispatch(resetStepProgressState());
    };
  }, [assessmentId, dispatch]);

  useEffect(() => {
    dispatch(getAssessmentByIdAction(assessmentId));
    dispatch(getStepProgressAction(assessmentId));
    dispatch(getAssessmentParametersAction(assessmentId));
  }, [assessmentId, dispatch]);

  // Re-check free disk space whenever the screen regains focus so the banner
  // clears as soon as the user frees space and returns from device settings.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      checkFreeDiskSpace().then((result) => {
        if (!cancelled) {
          setDiskState({ ...result, checked: true });
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const localId = idFromServer(assessmentId);
          const meeting = await getMeetingByType(localId, 'opening');
          if (!cancelled) {
            setHasLocalOpeningMeeting(!!meeting);
          }
        } catch (err) {
          Logger.warn('Failed to check local opening meeting', err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [assessmentId])
  );

  // Refetch step progress on every focus: opening_meeting is completed on the
  // LEAD's device, so returning from a child screen is the co-assessor's
  // natural moment to learn the Site Tour lock has lifted.
  useFocusEffect(
    useCallback(() => {
      dispatch(getAllAssessmentsAction());
      dispatch(getStepProgressAction(assessmentId));
    }, [dispatch, assessmentId])
  );

  const { userData } = useSelector((state) => state.account);
  const { assessmentParameters, assessmentParametersLoading } = useSelector(
    (state) => state.assessmentParameter
  );
  const {
    assessmentData,
    assessmentDataLoading,
    attendanceStatus,
    attendanceStatusLoading,
    punchInLoading,
    punchOutLoading,
    stepProgress: stepProgressRaw,
    stepProgressAssessmentId
  } = useSelector((state) => state.assessment);
  // Ignore step progress that belongs to a previously open assessment. The
  // store has a single shared stepProgress slot, so on this screen's first
  // render it can still hold the prior assessment's steps (and a slow fetch can
  // resolve late) — bleeding e.g. a completed assessment's ticks onto a freshly
  // opened scheduled one until a manual refresh. Only trust progress stamped
  // with THIS assessment's id.
  const stepProgress =
    String(stepProgressAssessmentId) === String(assessmentId) ? stepProgressRaw : null;

  const isPunchedIn = attendanceStatus?.isPunchedIn === true;
  const isPunchActionLoading = punchInLoading || punchOutLoading || attendanceStatusLoading;
  const completionPct = getAssessmentPercentage(stepProgress?.data?.steps, false);
  const apiStatus = assessmentData?.assessment?.status;
  // Completed when this role's local steps are 100% done OR the assessment has
  // been completed on mobile / on the server. The latter keeps the screen locked
  // (e.g. the meeting-link card) even if local step progress wasn't 100%.
  const isCompleted =
    completionPct === 100 || apiStatus === 'mobile_complete' || apiStatus === 'completed';
  // The meeting link is disabled ONLY once the assessment is completed on mobile
  // (server status), not merely at 100% local progress or other completed states.
  const isMobileComplete = apiStatus === 'mobile_complete';

  // Status badge: once this role's steps are 100% done, show Completed (the API
  // never sends 'completed' here). Otherwise defer to the server status so a
  // not-yet-started assessment reads 'Scheduled' instead of always 'In Progress'.
  const derivedStatus = isCompleted ? 'completed' : apiStatus || 'in_progress';
  const statusMeta = getStatusMeta(derivedStatus);

  // Block punch-in (start of onsite assessment) while free storage is under 1 GB.
  const lowStorage = diskState.checked && !diskState.sufficient;

  // Punch-in (start of the onsite assessment) opens on the scheduled start date.
  const scheduledStartDate = assessmentData?.assessment?.scheduledStartDate;
  // Parameter allocation opens 2 days before the scheduled start.
  const allocationWindowOpen = isAssessmentWindowOpen(scheduledStartDate, 2);
  const punchInWindowOpen = isAssessmentWindowOpen(scheduledStartDate, 0);
  const punchInWindowOpenDate = getAssessmentWindowOpenDate(scheduledStartDate, 0);
  const punchInWindowMessage = punchInWindowOpenDate
    ? `Available from ${formatDate(punchInWindowOpenDate)}.`
    : '';

  useLocationWarmup({ requestPermission: true });
  const punch = usePunchFlow({
    assessmentId,
    assessmentData,
    userData,
    lowStorage,
    diskState,
    dispatch
  });
  // Every step this role owns must be complete before the assessment can be
  // finished on mobile. Computed before the sync hook so it can drive the
  // footer state machine there — one source of truth shared with the lead screen.
  const roleRequiredSteps = ['site_pictures', 'site_tour', 'assessment_parameters'];
  const completedStepKeys = new Set(
    (stepProgress?.data?.steps || []).filter((s) => s.status === 'completed').map((s) => s.step)
  );
  const roleStepsComplete = roleRequiredSteps.every((k) => completedStepKeys.has(k));

  // step-progress currentStep is computed over the GLOBAL step order, which
  // interleaves lead-only steps; for a co-assessor it can point at a lead step
  // (e.g. basic_information) and so never lands on this role's next step. Derive
  // the role's own next incomplete step so the right card turns yellow.
  const roleCurrentStep = roleRequiredSteps.find((k) => !completedStepKeys.has(k)) ?? null;

  // A co-assessor's completion waits on no one else, so no co-assessor gate.
  const sync = useOutboxSync({
    assessmentId,
    navigation,
    isPunchedIn,
    roleStepsComplete,
    coAssessorGateActive: false
  });
  const { refreshSyncState } = sync;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(getAssessmentByIdAction(assessmentId));
      await dispatch(getStepProgressAction(assessmentId));
      await dispatch(getAssessmentParametersAction(assessmentId));
      // Re-read the server completion gate (canComplete) too, so the Submit
      // button enables in place once a co-assessor finishes — without it,
      // pull-to-refresh left the gate stale and forced a remount via Home.
      await refreshSyncState();
    } finally {
      setRefreshing(false);
    }
  }, [assessmentId, dispatch, refreshSyncState]);

  // This screen stays MOUNTED behind child screens (stack navigator). Those
  // children dispatch the same assessment-slice actions, flipping these
  // shared loading flags — so without the focus guard this effect would pop
  // the global loader over whatever child screen is currently on top. Only
  // drive the loader while we're the focused screen.
  useEffect(() => {
    // Never touch the shared global loader while a child screen is on top:
    // children dispatch the same assessment-slice actions, re-running this
    // effect, and an unconditional hide() in the else would yank the loader
    // out from under the child (e.g. the opening-meeting save flow). Only
    // manage it while we're the focused screen.
    if (!isFocused) {
      return;
    }
    if (assessmentDataLoading || attendanceStatusLoading || assessmentParametersLoading) {
      ApplicationLoader.show('serviceCoAssessment');
    } else {
      ApplicationLoader.hide('serviceCoAssessment');
    }
  }, [assessmentDataLoading, attendanceStatusLoading, assessmentParametersLoading, isFocused]);

  // Parameter Allocation now lives in its own card above Site Assessment,
  // independent of punch-in/punch-out. Lead can assign/update; co-assessor
  // can only view. Counts are derived from the parameters' assigned team member.
  const allocationParams = [
    ...(assessmentParameters?.mandatoryParameters || []),
    ...(assessmentParameters?.optionalParameters || [])
  ];
  const allocationTeamMembers =
    assessmentParameters?.teamMembers || assessmentData?.assessment?.teamMembers || [];
  const isAllocated = (assessmentParameters?.summary?.assignedCount || 0) > 0;

  // Parameters allocated to the current user specifically. A co-assessor can't
  // punch in until the lead has assigned at least one parameter to them.
  // Match by the assignee's USER id (carried on each parameter as
  // assignedTeamMember.user.id, available offline) — the locally-mirrored
  // teamMembers carry no membership id, so currentTeamMember.id is undefined
  // offline and matching on it wrongly blocked the co-assessor's punch-in.
  const currentTeamMember = allocationTeamMembers.find(
    (m) => m?.userId === userData?.user?.id || m?.user?.id === userData?.user?.id
  );
  const myAllocationCount = allocationParams.filter((p) => {
    const assigneeUserId = p?.assignedTeamMember?.user?.id;
    return assigneeUserId != null
      ? String(assigneeUserId) === String(userData?.user?.id)
      : !!p.assignedToTeamMemberId && p.assignedToTeamMemberId === currentTeamMember?.id;
  }).length;
  const coPunchInBlocked = myAllocationCount === 0;

  const handleAllocationPress = () => {
    // Co-assessors don't allocate parameters — that's the lead's screen. Skip
    // the allocation list and take them straight to their own assigned
    // parameters (matched by user id, since the offline mirror lacks a
    // membership id on currentTeamMember).
    const myTeamMember =
      currentTeamMember ||
      allocationTeamMembers.find(
        (m) => m?.userId === userData?.user?.id || m?.user?.id === userData?.user?.id
      );
    navigation.navigate('AssignedParameters', {
      item: myTeamMember,
      assessmentId: assessmentId
    });
  };

  const contactPerson = assessmentData?.assessment?.application;

  // Online-assessment meeting link the applicant joins. Falls back across a few
  // likely field names so the card works regardless of where the API surfaces it.
  const meetingLink =
    assessmentData?.assessment?.meetingLink ||
    assessmentData?.assessment?.onlineMeetingLink ||
    assessmentData?.assessment?.application?.meetingLink ||
    '';

  // The co-assessor's Site Tour depends on the lead: it stays locked until the
  // lead's opening meeting is completed. opening_meeting is a team-global step
  // the co's device never captures locally, so its status arrives via the
  // server sync that getStepProgressAction folds into the local step progress
  // (and which persists for offline use). The lead reads it straight off their
  // own local opening-meeting row.
  const openingMeetingCompleted =
    stepProgress?.data?.steps?.some(
      (s) => s.step === 'opening_meeting' && s.status === 'completed'
    ) || hasLocalOpeningMeeting;
  const coSiteTourUnlocked = openingMeetingCompleted;
  // The opening-meeting lock (lock icon + warning banner) only makes sense once
  // the onsite assessment has actually started. Before punch-in every Site
  // Assessment step reads as Not Started (grey); singling out Site Tour with a
  // yellow "enabled after opening meeting" banner then wrongly looks In Progress.
  const siteTourLocked = isPunchedIn && !coSiteTourUnlocked;

  const getStatusIcon = (status) => {
    // No step is "in progress" until the assessor has punched in — every Site
    // Assessment step is gated on punch-in, so before then they all read as
    // Not Started (grey), not the yellow current-step highlight.
    const isCurrentStep =
      isPunchedIn &&
      (stepProgress?.data?.currentStep === status ||
        (roleRequiredSteps.includes(status) && roleCurrentStep === status));
    if (isCurrentStep) {
      return { icon: Icons.yellowTick, iconBg: COLORS.warning.light, color: COLORS.text.primary };
    } else if (
      stepProgress?.data?.steps?.some(
        (step) => step.status === 'completed' && step?.step === status
      )
    ) {
      return {
        icon: Icons.tickGreenCircle,
        iconBg: COLORS.success.light,
        color: COLORS.text.primary
      };
    }
    return { icon: Icons.clock, iconBg: COLORS.background.accent, color: COLORS.text.tertiary };
  };

  const assessmentSteps = [
    {
      id: 2,
      title: 'Site Pictures',
      icon: getStatusIcon('site_pictures').icon,
      iconBg: getStatusIcon('site_pictures').iconBg,
      status: 'active',
      route: 'SitePictures',
      color: getStatusIcon('site_pictures').color
    },
    {
      id: 4,
      title: 'Site Tour',
      icon: siteTourLocked ? Icons.lock : getStatusIcon('site_tour').icon,
      iconBg: getStatusIcon('site_tour').iconBg,
      status: 'pending',
      route: 'SiteTour',
      locked: siteTourLocked,
      color: siteTourLocked ? COLORS.text.secondary : getStatusIcon('site_tour').color
    },
    {
      id: 6,
      title: 'Assessment Parameter',
      icon: getStatusIcon('assessment_parameters').icon,
      iconBg: getStatusIcon('assessment_parameters').iconBg,
      status: 'pending',
      route: 'AssessmentParametersList',
      color: getStatusIcon('assessment_parameters').color
    }
  ];

  const handleStepPress = async (step) => {
    const stepRouteToKey = {
      SitePictures: 'site_pictures',
      AddBasicInformation: 'basic_information',
      OpeningMeeting: 'opening_meeting',
      SiteTour: 'site_tour',
      AssessmentParametersList: 'assessment_parameters',
      ClosingMeeting: 'closing_meeting'
    };
    const stepKey = stepRouteToKey[step.route];
    const isPunchedIn = attendanceStatus?.isPunchedIn;
    // Outside the punch-in window the capture flow is closed, but a step that is
    // already complete must still open — read-only — so the assessor can review
    // the work before submitting. This used to swallow the tap entirely while the
    // rows stayed visually enabled, which read as "the screen will not open".
    if (!isPunchedIn) {
      const alreadyCompleted = (stepProgress?.data?.steps || []).some(
        (s) => s.step === stepKey && s.status === 'completed'
      );
      if (alreadyCompleted && step.route) {
        navigation.navigate(step.route, {
          assessmentId: assessmentId,
          assessmentData: assessmentData,
          readOnly: true
        });
        return;
      }
      showWarningToast('Punch in required', 'Punch in to start working on this step.');
      return;
    }
    let steps = stepProgress?.data?.steps;
    // Co-assessor's Site Tour is gated on the lead's opening meeting being
    // completed and synced — and the lead completes it on ANOTHER device, so
    // re-check the server at the moment of the tap: the lock may have lifted
    // since this screen last fetched.
    if (step.locked) {
      ApplicationLoader.show('stepRecheck');
      try {
        const fresh = await dispatch(getStepProgressAction(assessmentId)).unwrap();
        steps = fresh?.data?.steps ?? steps;
      } catch (err) {
        Logger.warn('Locked-step recheck failed:', err?.message);
      } finally {
        ApplicationLoader.hide('stepRecheck');
      }
      const openingMeetingDone = steps?.some(
        (s) => s.step === 'opening_meeting' && s.status === 'completed'
      );
      if (!openingMeetingDone) {
        showWarningToast(
          'Waiting for Lead',
          'The lead must complete and sync the opening meeting first. Make sure you are connected to the internet and tap again to re-check.'
        );
        return;
      }
    }
    const isCompleted = steps?.some((s) => s.step === stepKey && s.status === 'completed');
    // Gate on the first incomplete step the CURRENT ROLE is responsible for —
    // not the global currentStep. A co-assessor's steps are interleaved with
    // lead-only ones (allocation, meetings, basic info); gating on the global
    // current step would stall them on a step they can never complete.
    const completedKeys = new Set(
      (steps || []).filter((s) => s.status === 'completed').map((s) => s.step)
    );
    const roleStepKeys = ['site_pictures', 'site_tour', 'assessment_parameters'];
    const nextStepKey = roleStepKeys.find((k) => !completedKeys.has(k));
    if (isCompleted || stepKey === nextStepKey) {
      if (step.route) {
        navigation.navigate(step.route, {
          assessmentId: assessmentId,
          assessmentData: assessmentData
        });
      }
    }
  };

  const openInGoogleMaps = (address) => {
    if (!address) {
      return;
    }

    const encodedAddress = encodeURIComponent(address);

    const url = Platform.select({
      ios: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`
    });

    Linking.openURL(url).catch((err) => {
      Logger.error('Failed to open Google Maps:', err);
    });
  };

  const renderStepItem = ({ item }) => {
    // Disable AssessmentParameter step if not completed and not current step
    return (
      <TouchableOpacity
        style={localStyles.stepItem}
        onPress={() => {
          handleStepPress(item);
        }}
        activeOpacity={1}
        disabled={false}>
        <View style={[commonStyles.rowSpaceBetween]}>
          <View style={[commonStyles.row, localStyles.gap12]}>
            <View
              style={[
                commonStyles.center,
                {
                  width: Responsive.width(34),
                  height: Responsive.height(34),
                  borderRadius: BORDER_RADIUS.br8,
                  backgroundColor: item.iconBg
                }
              ]}>
              <Image source={item.icon} style={[commonStyles.iconSize20]} />
            </View>
            <View style={localStyles.flexShrink1}>
              <Text style={[localStyles.stepTitle, { color: item.color }]}>{item.title}</Text>
            </View>
          </View>
          <Image source={Icons.arrowSquareRightBlack} style={[commonStyles.iconSize20]} />
        </View>
        {item.locked ? (
          <View style={styles.warningContainer}>
            <Image source={Icons.warningIcon} style={[commonStyles.iconSize18]} />
            <Text style={styles.warningText}>Site tour will be enabled after opening meeting.</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (assessmentDataLoading) {
    return (
      <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
        <Header title="Assessment" back={true} sync={true} onSynced={refreshSyncState} />
      </View>
    );
  }
  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      <Header title="Assessment" back={true} sync={true} onSynced={refreshSyncState} />
      <View style={[commonStyles.fill]}>
        <AppScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={[commonStyles.fill]}>
            <View style={[commonStyles.padding16, { backgroundColor: COLORS.background.primary }]}>
              <View style={styles.assessmentInfo}>
                {/* <View style={styles.iconContainer}>
                  <Image source={Icons.building1} style={[commonStyles.iconSize40]} />
                </View> */}
                <View style={styles.assessmentDetails}>
                  <View
                    style={[
                      commonStyles.row,
                      { alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }
                    ]}>
                    <View style={[commonStyles.row, localStyles.appNumberRow]}>
                      <Text style={[commonStyles.bodyLargeHeading600]}>
                        {assessmentData?.assessment?.application?.applicationNumber}
                      </Text>
                      {!!assessmentData?.assessment?.application?.sector && (
                        <Text
                          style={[
                            localStyles.sectorText,
                            String(assessmentData.assessment.application.sector)
                              .trim()
                              .toLowerCase() === 'manufacturing'
                              ? localStyles.sectorManufacturing
                              : localStyles.sectorService
                          ]}>
                          {`• ${assessmentData.assessment.application.sector}`}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        localStyles.statusBadge,
                        { backgroundColor: statusMeta.backgroundColor }
                      ]}>
                      <Text style={[localStyles.statusBadgeText, { color: statusMeta.color }]}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>
                  <View style={[commonStyles.row, { gap: SPACING.sp8 }]}>
                    <Image source={Icons.buildings} style={[commonStyles.iconSize16]} />
                    <Text style={[commonStyles.bodySmallSecondary600, localStyles.unitNameText]}>
                      {assessmentData?.assessment?.application?.unitName}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.locationRow, { marginTop: Responsive.height(14) }]}>
                <Image source={Icons.locationIcon} style={styles.locationIcon} />
                <View style={commonStyles.fill}>
                  <Text
                    style={[
                      commonStyles.bodySmallTertiary500,
                      commonStyles.fill,
                      { color: COLORS.text.primary }
                    ]}>
                    {assessmentData?.assessment?.application?.fullUnitAddress ||
                      assessmentData?.assessment?.application?.unitAddress}
                  </Text>
                  <Pressable
                    onPress={() =>
                      openInGoogleMaps(
                        assessmentData?.assessment?.application?.fullUnitAddress ||
                          assessmentData?.assessment?.application?.unitAddress
                      )
                    }
                    style={styles.locationRow}>
                    <Text
                      style={[commonStyles.bodySmallTertiary500, { color: COLORS.button.primary }]}>
                      View on Map
                    </Text>
                    <Image source={Icons.sendLocation} style={[commonStyles.iconSize14]} />
                  </Pressable>
                </View>
              </View>
              <View style={[commonStyles.rowSpaceBetween, localStyles.scheduleRow]}>
                <View style={[commonStyles.row, localStyles.gap8]}>
                  <Image source={Icons.calenderGrey} style={[commonStyles.iconSize16]} />
                  <Text style={[commonStyles.bodySmallPrimary600]}>
                    {assessmentData?.assessment?.scheduledStartDate &&
                    assessmentData?.assessment?.scheduledEndDate
                      ? `${format(
                          new Date(assessmentData.assessment.scheduledStartDate),
                          'd MMM'
                        )} - ${format(
                          new Date(assessmentData.assessment.scheduledEndDate),
                          'd MMM, yyyy'
                        )}`
                      : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPocModalVisible(true)} activeOpacity={0.6}>
                  <Text
                    style={[commonStyles.bodySmallPrimary600, { color: COLORS.button.primary }]}>
                    View POC
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Meeting Link — join the online assessment meeting with the
                  applicant (video button) or copy the link to share (copy button). */}
              <MeetingLinkCard
                meetingLink={meetingLink}
                disabled={isMobileComplete || sync.mobileCompleted}
              />
              {/* Parameter Allocation — independent of punch-in/punch-out.
                  Lead can assign/update; co-assessor can only view.
                  Pending: light-blue fill + blue border. Allocated: white + grey border. */}
              <View
                style={[
                  styles.allocationCard,

                  {
                    backgroundColor: isAllocated
                      ? COLORS.text.white
                      : allocationWindowOpen
                        ? COLORS.primary.subtle
                        : COLORS.background.secondary,
                    borderColor: isAllocated ? COLORS.border.regular : COLORS.border.dark
                  }
                ]}>
                <View style={[commonStyles.row, localStyles.gap12]}>
                  <View style={[commonStyles.center, styles.allocationIcon]}>
                    <Image
                      source={
                        isAllocated
                          ? Icons.parameterAllocationGreen
                          : allocationWindowOpen
                            ? Icons.parameterAllocationblue
                            : Icons.disabledParameter
                      }
                      style={[commonStyles.iconSize35]}
                    />
                  </View>
                  <View style={commonStyles.fill}>
                    <Text style={[commonStyles.bodyMediumPrimary600]}>Allocated Parameters</Text>
                    {isAllocated ? (
                      <View style={[commonStyles.row, localStyles.allocationCounts]}>
                        <Text style={styles.allocationCountText}>{myAllocationCount}</Text>
                        <Text style={[commonStyles.bodySmallTertiary500]}>Assigned to you</Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          commonStyles.bodySmallTertiary500,
                          { marginTop: Responsive.height(2) }
                        ]}>
                        Assign parameters among assessors
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={allocationWindowOpen ? handleAllocationPress : undefined}
                    activeOpacity={0.6}>
                    <View style={[commonStyles.rowCenter, localStyles.gap4]}>
                      <Text
                        style={[
                          commonStyles.bodySmallPrimary600,
                          {
                            color: allocationWindowOpen
                              ? COLORS.button.primary
                              : COLORS.text.tertiary
                          }
                        ]}>
                        {'View'}
                      </Text>
                      <Image
                        source={Icons.arrowRight}
                        style={[
                          localStyles.arrowIcon,
                          {
                            tintColor: allocationWindowOpen
                              ? COLORS.button.primary
                              : COLORS.text.tertiary
                          }
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
              {/* <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${completionPct}%`,
                        backgroundColor: COLORS.success.active
                      }
                    ]}
                  />
                </View>
                <Text style={[commonStyles.bodyXSmallSecondary600]}>{completionPct}%</Text>
              </View> */}
            </View>
            <View
              style={[
                commonStyles.rowSpaceBetween,
                commonStyles.paddingHorizontal16,
                { marginTop: Responsive.height(16) }
              ]}>
              <Text
                style={[
                  commonStyles.FontFamily_SemiBold600,
                  { fontSize: FONT_SIZE.fs18, color: COLORS.text.heading }
                ]}>
                Site Assessment
              </Text>
              {
                <View
                  style={{
                    width: Responsive.width(90),
                    height: Responsive.height(20),
                    backgroundColor: COLORS.background.accent,
                    ...commonStyles.center,
                    borderRadius: BORDER_RADIUS.br4
                  }}>
                  <Text style={[commonStyles.bodyXSmallTertiary700, commonStyles.textTransform]}>
                    {'CO ASSESSOR'}
                  </Text>
                </View>
              }
            </View>
            {/* Punch-In / Punch-Out — first card in the Site Assessment section.
                Hidden only once THIS assessor's own steps are done and they're
                punched out. Gating on the global closing meeting tied the
                co-assessor to the lead: the lead completing the closing meeting
                made the co's card vanish before they could even punch in. */}
            {(() => {
              if (roleStepsComplete && !isPunchedIn) {
                return null;
              }
              return (
                <View style={commonStyles.paddingHorizontal16}>
                  {!isPunchedIn && lowStorage ? (
                    <View style={commonStyles.paddingHorizontal16}>
                      <View style={styles.storageWarningBanner}>
                        <Image
                          source={Icons.warningIcon}
                          style={[commonStyles.iconSize18, { tintColor: COLORS.text.white }]}
                        />
                        <Text style={styles.storageWarningText}>
                          You have less than 1GB storage on your device (
                          {formatBytes(diskState.freeBytes)} free). Free up space to start the
                          onsite assessment.
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {!isPunchedIn && !punchInWindowOpen ? (
                    <View style={{ marginTop: Responsive.height(18) }}>
                      <View style={styles.storageWarningBanner}>
                        <Image
                          source={Icons.warningIcon}
                          style={[commonStyles.iconSize18, { tintColor: COLORS.text.white }]}
                        />
                        <Text style={styles.storageWarningText}>
                          Punch-In opens on the assessment start date.
                          {punchInWindowMessage ? ` ${punchInWindowMessage}` : ''}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {!isPunchedIn ? (
                    <View style={styles.punchCard}>
                      <View style={[commonStyles.row, localStyles.gap12]}>
                        <View
                          style={[
                            commonStyles.center,
                            styles.punchIconCircle
                            // { backgroundColor: COLORS.success.light }
                          ]}>
                          <Image
                            source={
                              coPunchInBlocked || !punchInWindowOpen
                                ? Icons.disabledCheckIn
                                : Icons.checkIn
                            }
                            style={[commonStyles.iconSize35]}
                          />
                        </View>
                        <View style={commonStyles.fill}>
                          <Text style={[commonStyles.bodyMediumPrimary600]}>Punch-In Required</Text>
                          <Text
                            style={[
                              commonStyles.bodySmallTertiary500,
                              { marginTop: Responsive.height(2) }
                            ]}>
                            {!punchInWindowOpen
                              ? punchInWindowMessage ||
                                'Punch-In opens on the assessment start date'
                              : coPunchInBlocked
                                ? 'Waiting for the lead assessor to allocate parameters to you'
                                : 'Punch-In to start the assessment'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.punchButton,
                          {
                            backgroundColor:
                              isPunchActionLoading ||
                              coPunchInBlocked ||
                              lowStorage ||
                              !punchInWindowOpen
                                ? COLORS.background.accent
                                : COLORS.success.light
                          }
                        ]}
                        onPress={punch.handleCheckInPress}
                        disabled={
                          isPunchActionLoading ||
                          isPunchedIn ||
                          coPunchInBlocked ||
                          lowStorage ||
                          !punchInWindowOpen
                        }
                        activeOpacity={0.6}>
                        <Text
                          style={[
                            commonStyles.bodyMediumPrimary600,
                            {
                              color:
                                coPunchInBlocked || lowStorage || !punchInWindowOpen
                                  ? COLORS.text.tertiary
                                  : COLORS.success.active
                            }
                          ]}>
                          Punch-In
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.punchCard}>
                      <View style={[commonStyles.row, localStyles.gap10]}>
                        <View style={styles.punchAvatar}>
                          <AppFastImage
                            uri={
                              attendanceStatus?.lastAttendance?.selfiePath ||
                              attendanceStatus?.lastAttendance?.selfieUrl
                            }
                            style={{ width: 35, height: 35 }}
                            useImageBackground={true}
                            resizeMode="cover"
                            borderRadius={BORDER_RADIUS.br20}></AppFastImage>
                        </View>
                        <View style={commonStyles.fill}>
                          <View style={[commonStyles.row, localStyles.gap8]}>
                            <Image
                              style={{
                                height: Responsive.height(14),
                                width: Responsive.width(14)
                              }}
                              source={Icons.calendar}
                            />
                            <Text style={localStyles.punchTimeText}>
                              {attendanceStatus?.lastAttendance?.recordedAt
                                ? format(
                                    new Date(attendanceStatus.lastAttendance.recordedAt),
                                    'd MMM yyyy, hh:mm a'
                                  )
                                : ''}
                            </Text>
                          </View>
                          <View style={[commonStyles.row, localStyles.punchLocationRow]}>
                            <Image
                              style={{
                                height: Responsive.height(14),
                                width: Responsive.width(14)
                              }}
                              source={Icons.locationIcon}
                            />
                            <Text style={localStyles.punchCoordsText}>
                              {attendanceStatus?.lastAttendance?.latitude},{' '}
                              {attendanceStatus?.lastAttendance?.longitude}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.punchButton, { backgroundColor: COLORS.error.clarity }]}
                        onPress={punch.handlePunchOut}
                        disabled={isPunchActionLoading}
                        activeOpacity={0.6}>
                        <Text
                          style={[
                            commonStyles.bodyMediumPrimary600,
                            { color: COLORS.error.active }
                          ]}>
                          Punch-Out
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })()}
            <FlatList
              data={assessmentSteps}
              renderItem={renderStepItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              contentContainerStyle={{
                paddingHorizontal: Responsive.width(16),
                paddingBottom: Responsive.height(20)
              }}
            />
          </View>
        </AppScrollView>
        <AssessmentFooter sync={sync} />
      </View>
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
      {/* Success Screen */}
      <CheckInSuccessScreen
        visible={punch.showSuccessScreen}
        onComplete={punch.handleSuccessComplete}
        location={
          punch.userLocation
            ? `${punch.userLocation.latitude}, ${punch.userLocation.longitude}`
            : 'Location not available'
        }
        time={punch.currentTime}
      />
      {/* Point of Contact — opened from "View POC" */}
      <PointOfContactModal
        visible={pocModalVisible}
        onClose={() => setPocModalVisible(false)}
        contactPerson={contactPerson}
      />
      {/* Submitted Successfully! — shown after the server-confirmed cutover,
          auto-dismisses after 3s, then returns to the previous screen. */}
      <SubmitSuccessScreen
        visible={sync.showSubmitSuccess}
        applicationNumber={assessmentData?.assessment?.application?.applicationNumber}
        startDate={assessmentData?.assessment?.scheduledStartDate}
        endDate={assessmentData?.assessment?.scheduledEndDate}
        onComplete={() => {
          sync.setShowSubmitSuccess(false);
          navigation.goBack();
        }}
      />
      <AppCommonModal
        showmodal={sync.showDeleteDataModal}
        imgsrc={Icons.deleteIcon}
        title="Clear Local Data?"
        subTitle="This will permanently remove assessment from your local device. Assessment data has already been saved, please login on web portal to continue."
        onPress={sync.handleDeleteData}
        twoButtonModal={true}
        leftButtonText="Cancel"
        rightButtonText="Delete"
        leftvariant="secondary"
        variant="danger"
        LeftbuttonTextColor={COLORS.button.primary}
        leftButtonColor={'#E2EEFF'}
        LeftonPress={() => sync.setShowDeleteDataModal(false)}
      />
      <AppCommonModal
        showmodal={sync.showCompleteMobileModal}
        title="Complete on Mobile?"
        subTitle="Once you complete on mobile you can't collect or change any more data for this assessment. Continue?"
        onPress={sync.handleCompleteMobile}
        twoButtonModal={true}
        leftButtonText="Cancel"
        rightButtonText="Complete"
        leftvariant="secondary"
        variant="primary"
        LeftbuttonTextColor={COLORS.button.primary}
        leftButtonColor={'#E2EEFF'}
        LeftonPress={() => sync.setShowCompleteMobileModal(false)}
      />
    </View>
  );
};

const localStyles = StyleSheet.create({
  stepItem: {
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: Responsive.width(10),
    paddingVertical: Responsive.height(10),
    borderRadius: BORDER_RADIUS.br10,
    marginTop: Responsive.height(10),
    opacity: 1
  },
  gap4: { gap: SPACING.sp4 },
  gap8: { gap: SPACING.sp8 },
  gap10: { gap: SPACING.sp10 },
  gap12: { gap: SPACING.sp12 },
  flexShrink1: { flexShrink: 1 },
  stepTitle: { fontSize: 16, fontWeight: '500' },
  unitNameText: { width: '80%' },
  scheduleRow: {
    marginTop: Responsive.height(8),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    paddingBottom: Responsive.height(16)
  },
  allocationCounts: { gap: SPACING.sp8, marginTop: Responsive.height(4) },
  arrowIcon: { width: 10, height: 10, resizeMode: 'contain' },
  avatarInitials: { color: COLORS.success.active, fontWeight: 'bold' },
  punchTimeText: { fontSize: 12, color: COLORS.text.primary, fontFamily: FONTS_FAMILY.SemiBold600 },
  punchLocationRow: { gap: SPACING.sp8, marginTop: 4 },
  punchCoordsText: { color: COLORS.primary.main, fontSize: 12 },
  statusBadge: {
    paddingHorizontal: Responsive.width(8),
    paddingVertical: Responsive.height(2),
    borderRadius: BORDER_RADIUS.br4,
    alignSelf: 'flex-start'
  },
  statusBadgeText: {
    fontSize: FONT_SIZE.fs10,
    textTransform: 'uppercase',
    ...commonStyles.FontFamily_SemiBold600
  },

  sectorText: {
    fontSize: FONT_SIZE.fs12,
    textTransform: 'uppercase',
    ...commonStyles.FontFamily_SemiBold600
  },
  sectorService: {
    color: '#7239EA'
  },
  sectorManufacturing: {
    color: '#3D8BFD'
  },
  appNumberRow: {
    alignItems: 'center',
    gap: SPACING.sp6,
    flexShrink: 1
  }
});

export default ServiceCoAssessment;
