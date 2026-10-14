import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Image,
  Linking,
  Platform,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../../assets/theme/Layout';
import { commonStyles } from '../../../assets/theme/Styles';
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONTS_FAMILY,
  SPACING,
} from '../../../assets/theme/Theme';
import Header from '../../../components/layout/Header';
import AppAssesorModal from '../../../components/modals/AppAssesorModal';
import AppScrollView from '../../../components/shared/AppScrollView';
import Icons from '../../../constants/Icons';
import Images from '../../../constants/Images';
import { getStatusConfig } from '../../../constants/StatusConfig';
import { getApplications, getStepProgress } from '../../../redux/action/applicationAction';
import { showCopyToast, toTitleCase } from '../../../utils';

// While any step is still locked, the applicant is waiting on the lead assessor
// (punch-in, allocation, opening meeting). We refresh the lock state on this
// cadence (±20% jitter, so applicants do not poll in step) so the gate opens on
// its own, then stop once nothing is locked. A failed poll doubles the wait, up
// to LOCK_POLL_MAX_MS, so an outage is not met by a steady stream of polls.
const LOCK_POLL_INTERVAL_MS = 60000;
const LOCK_POLL_JITTER = 0.2;
const LOCK_POLL_MAX_MS = 5 * 60 * 1000;

const STEPS = [
  {
    key: 'SitePictures',
    progressKey: 'site_pictures',
    title: 'Site Pictures',
    lockedHint: 'Opens once the lead assessor punches in and allocates the assessment parameters.',
  },
  {
    key: 'SiteTour',
    progressKey: 'site_tour',
    title: 'Site Tour',
    lockedHint: 'Opens once the lead completes the opening meeting.',
  },
];

const ApplicationDetail = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const params = route.params || {};

  // Narrow selectors that return primitives, so an unchanged poll (same flags,
  // same completed steps) yields an equal value and React skips the re-render —
  // only a genuine change on the server re-renders the screen.
  const leadPunchedInLive = useSelector(state => {
    const app = state.application.applications.find(a => a.id === params.applicationId);
    return app ? !!app.leadPunchedIn : !!params.leadPunchedIn;
  });
  const allocationListLive = useSelector(state => {
    const app = state.application.applications.find(a => a.id === params.applicationId);
    return app ? !!app.allocationLocked : !!params.allocationLocked;
  });
  // The step-progress response carries this assessment's allocation gate too,
  // so the poll can follow it without reloading the whole applications list.
  // Kept per screen (not read from the shared store slice) so another
  // assessment's progress can never open this one's gate.
  const [progressAllocationLocked, setProgressAllocationLocked] = useState(null);
  const allocationLive = progressAllocationLocked ?? allocationListLive;
  const completedStepsSignature = useSelector(state => {
    const data = state.application.stepProgress?.data || state.application.stepProgress;
    const steps = Array.isArray(data?.steps) ? data.steps : [];
    return steps
      .filter(step => (step.status || '').toString().toLowerCase() === 'completed')
      .map(step => (step.step || '').toString())
      .sort()
      .join(',');
  });
  const completedStepKeys = new Set(
    completedStepsSignature ? completedStepsSignature.split(',') : [],
  );

  // One source of truth per step state — icon, circle background, and icon tint.
  // Completed always shows a green tick; a still-locked step shows a grayed
  // clock; an unlocked step that isn't complete yet is in progress, so it shows
  // a warning clock. The backend only reports completed/pending, so the unlock
  // gate — not the pending flag — is what distinguishes "not started" from
  // "in progress".
  const getStepStatusIcon = progressKey => {
    if (completedStepKeys.has(progressKey)) {
      return {
        icon: Icons.tickGreenCircle,
        iconBg: COLORS.success.light,
        color: COLORS.success.active,
        textColor: COLORS.text.primary,
      };
    }
    if (!isStepUnlocked(progressKey)) {
      return {
        icon: Icons.clock,
        iconBg: COLORS.background.accent,
        color: COLORS.text.quaternary,
        textColor: COLORS.text.tertiary,
      };
    }
    return {
      icon: Icons.clock,
      iconBg: COLORS.warning.light,
      color: COLORS.warning.active,
      textColor: COLORS.text.primary,
    };
  };
  const assessors = Array.isArray(params.assessors) ? params.assessors : [];
  const [assessorsVisible, setAssessorsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  // Step progress: opening meeting + allocation gate. Rejects on failure so the
  // poll can back off.
  const fetchStepProgress = useCallback(async () => {
    if (!params.assessmentId) {
      return;
    }
    const response = await dispatch(getStepProgress(params.assessmentId)).unwrap();
    const data = response?.data || response;
    if (typeof data?.allocationLocked === 'boolean') {
      setProgressAllocationLocked(data.allocationLocked);
    }
  }, [params.assessmentId, dispatch]);

  // The two upload gates flip on the server as the lead assessor works, so both
  // sources feed the lock state: step progress (opening meeting, allocation)
  // and the applications list (punch-in). Focus, foreground and pull-to-refresh
  // refresh both together.
  const refreshLockState = useCallback(
    () =>
      Promise.all([
        fetchStepProgress().catch(() => undefined),
        dispatch(getApplications({ sector: 'service' })),
      ]),
    [fetchStepProgress, dispatch],
  );

  // Refresh on every focus (mount + returning from a step screen) so the gate
  // reflects assessor activity that happened while the applicant was away.
  useFocusEffect(
    useCallback(() => {
      refreshLockState();
    }, [refreshLockState]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshLockState();
    } finally {
      setRefreshing(false);
    }
  }, [refreshLockState]);

  const application = {
    applicationNumber: params.applicationNumber,
    type: params.type,
    status: params.status,
    assessmentStatus: params.assessmentStatus,
    companyName: params.companyName,
    address: params.address || '-',
    dateRange: params.dateRange || 'Not scheduled',
  };
  const status = getStatusConfig(application.assessmentStatus, application.status);
  // Each capture step mirrors its own server-side gate, so a step only becomes
  // tappable once the backend would actually accept the upload:
  //  - Site pictures open once the lead assessor is on site (punched in) AND has
  //    locked parameter allocation — both are enforced by the upload endpoint.
  //  - Site tour opens only after the lead completes the opening meeting — that
  //    save is what flips the assessment to in_progress, which the site-tour
  //    upload endpoint requires.
  // The flags come from the live selectors above (fresh applications list), so
  // the gate opens without the applicant leaving this screen; they fall back to
  // the frozen route params until the list has loaded.
  const leadPunchedIn = !!params.assessmentId && leadPunchedInLive;
  const allocationDone = allocationLive;
  const sitePicturesUnlocked = leadPunchedIn && allocationDone;
  const openingMeetingDone = completedStepKeys.has('opening_meeting');
  // A step opens once its gate is met (and a completed step always opens — see
  // isStepUnlocked), but capturing or replacing evidence is allowed only while
  // the lead is still on site (currently punched in). After the lead punches
  // out the step opens read-only, so the applicant can review what they
  // submitted without re-capturing into an upload the server would now reject.
  // Mirrors the assessor app's post-punch-out review pass.
  const sitePicturesEditable = sitePicturesUnlocked;
  const siteTourEditable = openingMeetingDone && leadPunchedIn;
  // A completed step stays open regardless of the live gate — once the applicant
  // has submitted it, a later flip of the punch-in/allocation flags must not
  // re-lock it behind the "waiting on the lead" hint.
  const isStepUnlocked = progressKey => {
    if (completedStepKeys.has(progressKey)) {
      return true;
    }
    return progressKey === 'site_tour' ? openingMeetingDone : sitePicturesUnlocked;
  };

  const hasLockedStep = STEPS.some(step => !isStepUnlocked(step.progressKey));

  // Read by the poll through a ref so a flip does not restart its timer.
  const leadPunchedInRef = useRef(leadPunchedIn);
  leadPunchedInRef.current = leadPunchedIn;

  // One poll tick. Step progress is the only thing polled once the lead is on
  // site. The punch-in flag exists only on the applications list (step progress
  // does not carry it), so the list is reloaded only while that gate is closed.
  const pollLockState = useCallback(async () => {
    const progress = fetchStepProgress();
    const list = leadPunchedInRef.current
      ? null
      : dispatch(getApplications({ sector: 'service' })).unwrap();
    await Promise.all([progress, list]);
  }, [fetchStepProgress, dispatch]);

  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  // Poll only while a step is still locked, this screen is in front and the app
  // is in the foreground, so an applicant sitting on the locked screen sees it
  // unlock on its own; the poll stops the moment everything is unlocked, the
  // screen loses focus or the app is backgrounded.
  useEffect(() => {
    if (!isFocused || !hasLockedStep || !appActive || !params.assessmentId) {
      return undefined;
    }
    let cancelled = false;
    let timerId = null;
    let delayMs = LOCK_POLL_INTERVAL_MS;
    const schedule = () => {
      const jitter = 1 - LOCK_POLL_JITTER + Math.random() * 2 * LOCK_POLL_JITTER;
      timerId = setTimeout(tick, Math.round(delayMs * jitter));
    };
    const tick = async () => {
      try {
        await pollLockState();
        delayMs = LOCK_POLL_INTERVAL_MS;
      } catch {
        delayMs = Math.min(delayMs * 2, LOCK_POLL_MAX_MS);
      }
      if (!cancelled) {
        schedule();
      }
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [isFocused, hasLockedStep, appActive, params.assessmentId, pollLockState]);

  // Track foreground/background for the poll above. Returning to the foreground
  // is also the moment fresh assessor activity is likely, so refresh right away
  // rather than waiting for the next poll tick.
  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }
    setAppActive(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      setAppActive(active);
      if (active && hasLockedStep) {
        refreshLockState();
      }
    });
    return () => subscription.remove();
  }, [isFocused, hasLockedStep, refreshLockState]);

  // Site pictures have two upload gates; show the applicant the one they are
  // actually waiting on rather than the generic both-gates hint.
  const getLockedHint = step => {
    if (step.progressKey !== 'site_pictures') {
      return step.lockedHint;
    }
    if (leadPunchedIn && !allocationDone) {
      return 'Opens once the lead assessor allocates the assessment parameters.';
    }
    if (!leadPunchedIn && allocationDone) {
      return 'Opens once the lead assessor has punched in.';
    }
    return step.lockedHint;
  };

  const openExternalUrl = async (url, emptyMessage) => {
    if (!url) {
      Alert.alert('Not available', emptyMessage);
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open', 'No app is available to handle this link.');
    }
  };

  const openMeetingLink = () =>
    openExternalUrl(params.meetingLink, 'No meeting link has been shared yet.');

  const openMap = () => {
    if (!params.address) {
      Alert.alert('Not available', 'No address is available for this unit.');
      return;
    }
    const query = encodeURIComponent(params.address);
    openExternalUrl(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      'No address is available for this unit.',
    );
  };

  const copyMeetingLink = () => {
    if (!params.meetingLink) {
      Alert.alert('Not available', 'No meeting link has been shared yet.');
      return;
    }
    Clipboard.setString(params.meetingLink);
    showCopyToast('Meeting link copied');
  };

  const openAssessors = () => {
    if (assessors.length === 0) {
      Alert.alert('Not available', 'No assessors have been assigned yet.');
      return;
    }
    setAssessorsVisible(true);
  };

  return (
    <View style={[commonStyles.fill, { backgroundColor: COLORS.background.secondary }]}>
      <Header title={'Application'} back={true} headerBottomStyle={true} />
      <AppScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary.main]}
            tintColor={COLORS.primary.main}
          />
        }>
        <View style={styles.infoCard}>
          <View style={styles.infoHeaderRow}>
            <View style={styles.titleRow}>
              <Text style={[commonStyles.bodyLargePrimary600]}>
                {application.applicationNumber}
              </Text>
              <View
                style={{
                  width: 4,
                  height: 4,
                  backgroundColor: '#C4CADA',
                  borderRadius: 3,
                }}
              />
              <Text style={styles.typeText}>{application.type}</Text>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: status.background,
                  borderColor: status.border,
                },
              ]}>
              <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={[commonStyles.bodySmallSecondary600, { marginTop: 4 }]}>
            {toTitleCase(application.companyName)}
          </Text>
          {/* Address */}
          <View style={styles.addressRow}>
            <Image source={Icons.locationIcon} style={commonStyles.iconSize16} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={commonStyles.bodySmallSecondary600}>{application.address}</Text>
              <TouchableOpacity style={styles.linkRow} activeOpacity={0.6} onPress={openMap}>
                <Text style={styles.linkText}>View on Map</Text>
                <Image source={Images.send} style={commonStyles.iconSize14} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.dateAssessorRow}>
            <View style={styles.dateContainer}>
              <Image source={Icons.calenderGrey} style={[commonStyles.iconSize16]} />
              <Text style={[commonStyles.bodySmallPrimary600]}>{application.dateRange}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.6} onPress={openAssessors}>
              <Text style={styles.linkText}>View Assessor(s)</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <View style={styles.meetingCard}>
            <View style={{ flex: 1, paddingRight: Responsive.width(10) }}>
              <Text style={[commonStyles.bodyMediumPrimary600]}>Meeting Link</Text>
              <Text
                style={[commonStyles.bodySmallSecondary500, { marginTop: Responsive.height(2) }]}>
                Join meeting with assessors for online assessment
              </Text>
            </View>
            <View style={[commonStyles.row, { gap: SPACING.sp10 }]}>
              <TouchableOpacity activeOpacity={0.7} onPress={openMeetingLink}>
                <Image source={Icons.meetingLink} style={commonStyles.iconSize35} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={copyMeetingLink}>
                <Image source={Icons.copyMeeting} style={commonStyles.iconSize35} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={[commonStyles.paddingHorizontal16, commonStyles.paddingVertical20]}>
          <Text style={commonStyles.h2heading600}>Online Assessment</Text>
          <View style={styles.stepsContainer}>
            {STEPS.map(step => {
              const unlocked = isStepUnlocked(step.progressKey);
              const stepStatus = getStepStatusIcon(step.progressKey);
              const stepEditable =
                step.progressKey === 'site_pictures' ? sitePicturesEditable : siteTourEditable;
              return (
                <TouchableOpacity
                  key={step.key}
                  style={styles.stepCard}
                  activeOpacity={0.6}
                  disabled={!unlocked}
                  onPress={() =>
                    navigation.navigate(step.key, {
                      assessmentId: params.assessmentId,
                      applicationId: params.applicationId,
                      applicationNumber: application.applicationNumber,
                      readOnly: !stepEditable,
                    })
                  }>
                  <View style={[styles.stepRow, !unlocked && { opacity: 0.5 }]}>
                    <View style={styles.stepLeft}>
                      <View style={[styles.stepIconCircle, { backgroundColor: stepStatus.iconBg }]}>
                        <Image
                          source={stepStatus.icon}
                          style={[styles.stepIcon, { tintColor: stepStatus.color }]}
                        />
                      </View>
                      <Text
                        style={[
                          commonStyles.bodyLargeTertiary600,
                          { color: stepStatus.textColor },
                        ]}>
                        {step.title}
                      </Text>
                    </View>
                    <Image source={Icons.arrowSquareRightBlack} style={styles.chevron} />
                  </View>
                  {!unlocked && (
                    <View style={styles.warningContainer}>
                      <Image
                        source={Icons.warningIcon}
                        style={[commonStyles.iconSize16, { tintColor: COLORS.text.white }]}
                      />
                      <Text style={styles.warningText}>{getLockedHint(step)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </AppScrollView>
      <AppAssesorModal
        visible={assessorsVisible}
        assessors={assessors}
        onClose={() => setAssessorsVisible(false)}
      />
    </View>
  );
};

const styles = {
  header: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: Responsive.width(16),
    paddingTop: Platform.OS === 'android' ? Responsive.height(16) : Responsive.height(14),
    paddingBottom: Responsive.height(14),
  },
  headerLeft: {
    ...commonStyles.row,
    alignItems: 'center',
    gap: SPACING.sp10,
  },
  headerTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.heading,
  },
  syncRow: {
    ...commonStyles.row,
    alignItems: 'center',
    gap: SPACING.sp6,
  },
  warningIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  unsyncedText: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.warning.active,
  },
  syncIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: COLORS.primary.main,
  },
  cloudIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    tintColor: COLORS.success.primary,
  },
  infoCard: {
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoHeaderRow: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'flex-start',
  },
  titleRow: {
    ...commonStyles.row,
    alignItems: 'center',
    gap: SPACING.sp6,
    flexShrink: 1,
  },
  typeText: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs10,
    color: '#7239EA',
  },
  badge: {
    paddingHorizontal: Responsive.width(8),
    height: 20,
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.br6,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
  },
  addressRow: {
    flexDirection: 'row',
    gap: SPACING.sp4,
    marginTop: 16,
  },
  linkRow: {
    ...commonStyles.row,
    alignItems: 'center',
    gap: SPACING.sp2,
    marginTop: 4,
  },
  linkText: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.primary.main,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border.light,
    marginTop: Responsive.height(16),
  },
  dateAssessorRow: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    marginTop: Responsive.height(12),
  },
  dateContainer: {
    ...commonStyles.row,
    gap: SPACING.sp6,
    alignItems: 'center',
  },
  meetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.muted,
    borderRadius: BORDER_RADIUS.br12,
    borderWidth: 1,
    borderColor: COLORS.border.dark,
    padding: 10,
    marginTop: 16,
    gap: 8,
  },
  stepsContainer: {
    marginTop: 12,
    gap: 12,
  },
  warningContainer: {
    borderRadius: Responsive.height(8),
    paddingHorizontal: Responsive.width(20),
    paddingVertical: Responsive.height(8),
    marginHorizontal: Responsive.width(20),
    marginBottom: Responsive.height(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp10,
    backgroundColor: COLORS.warning.active,
    ...commonStyles.center,
  },
  warningText: {
    ...commonStyles.FontFamily_Bold700,
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs14,
  },
  stepCard: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br10,
    overflow: 'hidden',
  },
  stepRow: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  stepLeft: {
    ...commonStyles.row,
    alignItems: 'center',
    gap: SPACING.sp10,
  },
  stepIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: COLORS.text.tertiary,
  },
  chevron: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
};

export default ApplicationDetail;
