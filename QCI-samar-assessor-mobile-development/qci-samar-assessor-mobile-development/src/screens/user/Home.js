import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONTS_FAMILY, SPACING } from '../../assets/theme/Theme';
import AppSkeletonPlaceholder from '../../components/base/AppSkeletonPlaceholder';
import { HomeSkeletonCard } from '../../components/skeleton/HomeSkeleton';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import { getUserDetails } from '../../redux/action/accountAction';
import {
  downloadAssessmentForOfflineAction,
  getAllAssessmentsAction,
  getDashboardDataAction,
  getStepProgressAction,
  syncAssessmentsFromServerAction
} from '../../redux/action/assessmentAction';
import { idFromServer } from '../../services/database/ids';
import {
  isMobileCompleted,
  isMobileRoleDone
} from '../../services/database/repositories/assessmentsRepo';
import { isAssessmentDownloaded } from '../../services/database/repositories/parametersRepo';
import { drainOutbox } from '../../services/offline/syncEngine';
import { getInitials } from '../../utils';
import {
  checkInternetConnection,
  subscribeToNetworkChanges
} from '../../utils/checkInternetConnection';
import getAssessmentPercentage from '../../utils/getAssessmentPercentage';
import { startLocationWarmup, stopLocationWarmup } from '../../utils/location';
import { Logger } from '../../utils/logger';
import { resolveTeamRole } from '../../utils/teamRole';

// What belongs in the "In Progress" section. A cut-over assessment
// (localMobileCompletedAt, set by Complete on Mobile) stays visible no matter
// where the server moves its status afterwards — only Delete Data removes a
// card from the device. mobile_complete covers the mirrored server status
// once every team member has cut over.
const isActiveAssessmentCard = (assessment) =>
  assessment.status === 'in_progress' ||
  assessment.status === 'mobile_complete' ||
  assessment.localMobileCompletedAt != null;

const Home = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(true);
  const dispatch = useDispatch();
  const { userData, userDataLoading } = useSelector((state) => state.account);
  const { allAssessments, allAssessmentsLoading } = useSelector((state) => state.assessment);
  const [refreshing, setRefreshing] = useState(false);
  const wasOnlineRef = useRef(true);
  const autoDownloadingRef = useRef(false);

  useEffect(() => {
    dispatch(getUserDetails());
  }, []);

  // Refetch the assessment list + dashboard every time Home regains focus (this
  // screen stays mounted in the stack, so a one-time mount fetch goes stale).
  // This is what makes a card disappear right after "Clear Local Data" (which
  // navigates back here) without the user having to pull-to-refresh.
  //
  // Depend on the user id too: on a cold start the focus fetch can run before
  // getUserDetails() resolves, so getAllAssessmentsAction sees a null user id
  // and returns the server list — which OMITS cut-over (Complete on Mobile)
  // assessments. Re-running once the id loads reads the local mirror instead,
  // which keeps the completed card visible. Without this the card only appeared
  // after a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      dispatch(getAllAssessmentsAction());
      dispatch(getDashboardDataAction());
    }, [dispatch, userData?.user?.id])
  );

  // Warm the GPS while the assessor browses Home so a fix is usually already in
  // hand by the time they open an assessment and capture — offline a first cold
  // fix is slow (no A-GPS/network assist). Focus-scoped: it stops when Home loses
  // focus, and the assessment screen holds its own warm-up from there
  // (reference-counted, so the chip never powers down between the two). Harmless
  // before the location permission is granted — armWatch stays inert and never
  // prompts; the in-context capture prompt still owns the grant.
  useFocusEffect(
    useCallback(() => {
      startLocationWarmup();
      return () => {
        stopLocationWarmup();
      };
    }, [])
  );

  // Whenever the assessment list changes, refresh each active card's local
  // progress. Pending-sync status now lives in the header (SyncStatusButton),
  // so it's no longer tracked per card here.
  // Also depend on the current user id: on login the assessment list can arrive
  // before userData loads, and refreshProgress computes a role-scoped (per-user)
  // percentage — without the id the cards render 0% until a manual refresh.
  useEffect(() => {
    if (!Array.isArray(allAssessments)) {
      return;
    }
    allAssessments.forEach((a) => {
      if (a?.id) {
        if (isActiveAssessmentCard(a)) {
          refreshProgress(a.id);
        }
      }
    });
    hydrateDownloadedIds(allAssessments);
    autoDownloadActionable();
  }, [allAssessments, userData?.user?.id]);
  useEffect(() => {
    checkConnection();

    const unsubscribe = subscribeToNetworkChanges((isConnected) => {
      setOnline(isConnected);
      // Auto-sync the moment connectivity returns so offline captures don't
      // sit unsynced until the user remembers to tap "Sync Now". The drain's
      // own in-process lock makes this safe alongside a manual sync.
      if (isConnected && !wasOnlineRef.current) {
        // Drain BEFORE re-downloading: the download replaces local parameter
        // payloads with the server copy, so running it while local mutations
        // (e.g. an allocation) are still queued would pull pre-mutation state
        // over them. Push first, then pull.
        (async () => {
          await autoDrain();
          autoDownloadActionable(true);
        })();
      }
      wasOnlineRef.current = isConnected;
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const autoDrain = async () => {
    try {
      const result = await drainOutbox();
      if (result.succeeded > 0) {
        dispatch(getAllAssessmentsAction());
        dispatch(getDashboardDataAction());
      }
    } catch (error) {
      Logger.warn('Auto-sync on reconnect failed:', error?.message);
    }
  };

  const checkConnection = async () => {
    const isConnected = await checkInternetConnection();
    setOnline(isConnected);
    wasOnlineRef.current = isConnected;
  };

  // Pull-to-refresh is the one place the spinner should reflect the server
  // round trip, so it awaits the sync-down rather than the mirror-first read.
  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(syncAssessmentsFromServerAction());
    await dispatch(getDashboardDataAction());
    setRefreshing(false);
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

  // Online-assessment meeting link the applicant joins. Falls back across a few
  // likely field names so it works regardless of where the API surfaces it.
  const resolveMeetingLink = (assessment) =>
    assessment?.meetingLink ||
    assessment?.onlineMeetingLink ||
    assessment?.application?.meetingLink ||
    '';

  const openMeetingLink = (link) => {
    if (!link) {
      return;
    }
    Linking.openURL(link).catch((err) => {
      Logger.error('Failed to open meeting link:', err);
    });
  };

  const [downloadedIds, setDownloadedIds] = useState([]);
  // Per-assessment offline preparation state: 'preparing' | 'failed'. An entry
  // is removed once the bundle is on the device. Downloads are best-effort and
  // were previously silent, so a dropped one was only discovered on site, with
  // no network left to fix it.
  const [offlineState, setOfflineState] = useState({});
  // Per-assessment local step progress (the [{ step, status }] array
  // computeLocalStepProgress returns), keyed by assessment id. Home shows the
  // same locally-derived, role-scoped percentage the details screen does.
  const [progressSteps, setProgressSteps] = useState({});

  const refreshProgress = async (assessmentId) => {
    try {
      // Go through getStepProgressAction (same source the details screen uses)
      // rather than computeLocalStepProgress directly: when online it mirrors the
      // server's authoritative step statuses into local storage before computing.
      // After a logout/login the local wipe clears the previously-synced steps,
      // so a direct local compute reads 0% until something re-pulls them — that
      // was why the index card progress reset while the details page (which calls
      // this action) stayed correct. Offline it falls back to the local compute.
      const result = await dispatch(getStepProgressAction(assessmentId)).unwrap();
      setProgressSteps((prev) => ({ ...prev, [assessmentId]: result?.data?.steps || [] }));
    } catch {
      // ignore — card percentage falls back to 0 until local data is available
    }
  };

  // Rebuild the set of already-downloaded assessments from SQLite so the
  // "Downloaded" state survives an app restart (in-memory state alone resets).
  const hydrateDownloadedIds = async (assessments) => {
    try {
      const checks = await Promise.all(
        assessments
          .filter((a) => a?.id)
          .map(async (a) => ({
            id: a.id,
            downloaded: await isAssessmentDownloaded(idFromServer(a.id))
          }))
      );
      const ids = checks.filter((c) => c.downloaded).map((c) => c.id);
      setDownloadedIds(ids);
    } catch {
      // ignore — downloaded badge is non-critical UI
    }
  };

  // Auto-download: when online, pull each actionable assessment's full bundle
  // (parameters, questions, team, AND all Basic-Information master lists) so the
  // team can go on-site without anyone tapping a download button. Sequential +
  // guarded. refresh=true (on reconnect) also re-pulls already-downloaded ones to
  // pick up allocation/schedule changes — safe, because the local mirror upserts
  // by stable id and never touches captured responses/photos/outbox.
  const autoDownloadActionable = async (refresh = false) => {
    if (autoDownloadingRef.current) {
      return;
    }
    if (!Array.isArray(allAssessments) || allAssessments.length === 0) {
      return;
    }
    const isConnected = await checkInternetConnection();
    if (!isConnected) {
      return;
    }
    autoDownloadingRef.current = true;
    try {
      const actionable = allAssessments.filter(
        (a) => a?.id && (a.status === 'scheduled' || a.status === 'in_progress')
      );
      for (const a of actionable) {
        try {
          // Skip assessments finished on this device: after Delete Data
          // (role done) a cleanup must not be undone by a re-download, and
          // after Complete on Mobile (cut over) nothing syncs down anymore.
          const localId = idFromServer(a.id);
          if ((await isMobileRoleDone(localId)) || (await isMobileCompleted(localId))) {
            continue;
          }
          const already = await isAssessmentDownloaded(idFromServer(a.id));
          if (already && !refresh) {
            continue;
          }
          setOfflineState((prev) => ({ ...prev, [a.id]: 'preparing' }));
          await dispatch(downloadAssessmentForOfflineAction(a.id)).unwrap();
          setDownloadedIds((prev) => (prev.includes(a.id) ? prev : [...prev, a.id]));
          setOfflineState((prev) => {
            const next = { ...prev };
            delete next[a.id];
            return next;
          });
        } catch (error) {
          Logger.warn(`[offline] auto-download failed for ${a.id}:`, error?.message);
          setOfflineState((prev) => ({ ...prev, [a.id]: 'failed' }));
        }
      }
    } finally {
      autoDownloadingRef.current = false;
    }
  };

  // Manual retry for one assessment whose preparation failed. Mirrors a single
  // iteration of the auto-download loop, so the two cannot drift apart.
  const retryOfflineDownload = async (assessmentId) => {
    setOfflineState((prev) => ({ ...prev, [assessmentId]: 'preparing' }));
    try {
      await dispatch(downloadAssessmentForOfflineAction(assessmentId)).unwrap();
      setDownloadedIds((prev) => (prev.includes(assessmentId) ? prev : [...prev, assessmentId]));
      setOfflineState((prev) => {
        const next = { ...prev };
        delete next[assessmentId];
        return next;
      });
    } catch (error) {
      Logger.warn(`[offline] retry failed for ${assessmentId}:`, error?.message);
      setOfflineState((prev) => ({ ...prev, [assessmentId]: 'failed' }));
    }
  };

  // Status pill: label + themed text/background color per assessment status.
  const getStatusMeta = (status) => {
    switch (status) {
      case 'in_progress':
        return {
          label: 'In Progress',
          color: COLORS.status.warningText,
          backgroundColor: COLORS.status.warningBackground
        };
      case 'scheduled':
        return {
          label: 'Scheduled',
          color: COLORS.status.infoText,
          backgroundColor: COLORS.status.infoBackground
        };
      case 'completed':
      case 'mobile_complete':
        return {
          label: status === 'mobile_complete' ? 'Completed on Mobile' : 'Completed',
          color: COLORS.status.successText,
          backgroundColor: COLORS.status.successBackground
        };
      default:
        return {
          label: status === 'mobile_complete' ? 'Completed on Mobile' : 'Completed',
          color: COLORS.status.successText,
          backgroundColor: COLORS.status.successBackground
        };
    }
  };

  // Whether this assessment is actually usable on site. The assessor needs to
  // know this BEFORE they leave, while there is still a network to fix it with;
  // a failed preparation used to be silent and only surfaced at the gate.
  const OfflineBadgeRow = ({ assessment }) => {
    const badge = renderOfflineBadge(assessment);
    if (!badge) {
      return null;
    }
    return <View style={{ marginTop: Responsive.height(6) }}>{badge}</View>;
  };

  const renderOfflineBadge = (assessment) => {
    const state = offlineState[assessment.id];
    if (state === 'preparing') {
      return (
        <View style={[commonStyles.row, { alignItems: 'center', gap: SPACING.sp4 }]}>
          <ActivityIndicator size="small" color={COLORS.primary.main} />
          <Text style={[commonStyles.bodyXSmallSecondary600]}>Preparing for offline…</Text>
        </View>
      );
    }
    if (state === 'failed') {
      return (
        <TouchableOpacity
          onPress={() => retryOfflineDownload(assessment.id)}
          activeOpacity={0.6}
          style={[commonStyles.row, { alignItems: 'center', gap: SPACING.sp4 }]}>
          <Text style={[commonStyles.bodyXSmallSecondary600, { color: COLORS.error.active }]}>
            Not ready for offline
          </Text>
          <Text
            style={[
              commonStyles.FontFamily_SemiBold600,
              {
                fontSize: FONT_SIZE.fs12,
                color: COLORS.primary.main,
                textDecorationLine: 'underline'
              }
            ]}>
            Retry
          </Text>
        </TouchableOpacity>
      );
    }
    if (downloadedIds.includes(assessment.id)) {
      return (
        <Text style={[commonStyles.bodyXSmallSecondary600, { color: COLORS.success.active }]}>
          Ready for offline
        </Text>
      );
    }
    return null;
  };

  const renderStatusBadge = (status) => {
    const meta = getStatusMeta(status);
    return (
      <View style={[styles.statusBadge, { backgroundColor: meta.backgroundColor }]}>
        <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
      </View>
    );
  };

  const renderInProgressAssessment = (assessment) => {
    const { isLead } = resolveTeamRole(assessment, userData?.user?.id);
    // Completion is derived from local mobile step progress, not a server
    // status — the API never sends 'completed'/'mobile_complete' here. When
    // every step is done (100%) show the Completed badge; otherwise In Progress.
    const percentage = getAssessmentPercentage(progressSteps[assessment.id], isLead);
    const derivedStatus = percentage === 100 ? 'completed' : 'in_progress';
    return (
      <View key={assessment.id} style={styles.assessmentCard}>
        <View style={styles.assessmentHeader}>
          <View style={styles.assessmentInfo}>
            <View style={styles.assessmentDetails}>
              <View
                style={[
                  commonStyles.row,
                  { alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }
                ]}>
                <Text style={[commonStyles.bodyLargeHeading600]}>
                  {assessment?.application?.applicationNumber}
                </Text>
                {renderStatusBadge(derivedStatus)}
              </View>
              <View style={styles.locationRow}>
                <Text numberOfLines={2} style={[commonStyles.bodySmallSecondary600]}>
                  {assessment?.application?.unitName}
                </Text>
              </View>
            </View>
          </View>
        </View>
        {resolveMeetingLink(assessment) ? (
          <View style={[styles.locationRow, { alignItems: 'flex-end' }]}>
            <Image source={Icons.video} style={[commonStyles.iconSize14]} />
            <Pressable onPress={() => openMeetingLink(resolveMeetingLink(assessment))}>
              <Text
                numberOfLines={1}
                style={[commonStyles.bodySmallSecondary600, { color: COLORS.primary.main }]}>
                Meeting Link
                <Image source={Icons.sendLocation} style={[commonStyles.iconSize14]} />
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.locationRow]}>
            <Image source={Icons.locationIcon} style={[commonStyles.iconSize16]} />
            <Pressable
              onPress={() =>
                openInGoogleMaps(
                  assessment?.application?.fullUnitAddress || assessment?.application?.unitAddress
                )
              }>
              <Text
                numberOfLines={2}
                style={[commonStyles.bodySmallSecondary600, { color: COLORS.text.primary }]}>
                {assessment?.application?.fullUnitAddress || assessment?.application?.unitAddress}
                {'  '}
                <Image source={Icons.sendLocation} style={[commonStyles.iconSize14]} />
              </Text>
            </Pressable>
          </View>
        )}
        {/* <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${percentage}%`,
                  backgroundColor:
                    percentage === 100 ? COLORS.success.active : COLORS.status.warning
                }
              ]}
            />
          </View>
          <Text style={[commonStyles.bodyXSmallSecondary600]}>{percentage}%</Text>
        </View> */}
        <OfflineBadgeRow assessment={assessment} />
        <View style={styles.assessmentFooter}>
          <View style={styles.dateContainer}>
            <Image source={Icons.calenderGrey} style={[commonStyles.iconSize14]} />
            <Text style={[commonStyles.bodySmallPrimary600]}>
              {format(new Date(assessment?.scheduledStartDate), 'd MMM')} -{' '}
              {format(new Date(assessment?.scheduledEndDate), 'd MMM, yyyy')}
            </Text>
          </View>
          <View
            style={[
              commonStyles.row,
              { gap: SPACING.sp12, alignItems: 'center', flexWrap: 'wrap' }
            ]}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('AssessmentStepsList', { assessmentId: assessment.id })
              }
              activeOpacity={0.6}
              style={[
                commonStyles.row,
                { gap: SPACING.sp2, alignItems: 'center', paddingVertical: Responsive.height(6) }
              ]}>
              <Text
                style={[
                  commonStyles.FontFamily_SemiBold600,
                  { fontSize: FONT_SIZE.fs12, color: COLORS.primary.main, letterSpacing: 0.2 }
                ]}>
                View Details
              </Text>
              <Image source={Icons.arrowRight} style={styles.arrowIcon} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderScheduledAssessment = (assessment) => {
    return (
      <View key={assessment.id} style={styles.scheduledCard}>
        <View style={styles.scheduledHeader}>
          <View style={styles.scheduledDetails}>
            <View
              style={[
                commonStyles.row,
                {
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  textTransform: 'uppercase'
                }
              ]}>
              <Text style={[commonStyles.bodyLargeHeading600]}>
                {assessment?.application?.applicationNumber}
              </Text>
              {renderStatusBadge(assessment.status)}
            </View>
            <View style={styles.locationRow}>
              <Text numberOfLines={2} style={[commonStyles.bodySmallSecondary600]}>
                {assessment?.application?.unitName}
              </Text>
            </View>
          </View>
          {/* {downloadedIds.includes(assessment.id) ? (
            <Image source={Icons.rightDownloadedTick} style={commonStyles.iconSize30} />
          ) : (
            // No button — assessments auto-download when online. Show a quiet
            // "preparing for offline" spinner until the bundle is on the device.
            <View style={[styles.downloadStatusIcon, styles.downloadLoader]}>
              <ActivityIndicator size="small" color={COLORS.primary.main} />
            </View>
          )} */}
        </View>
        {resolveMeetingLink(assessment) ? (
          <View style={[styles.locationRow, { alignItems: 'flex-end' }]}>
            <Image source={Icons.video} style={[commonStyles.iconSize14]} />
            <Pressable onPress={() => openMeetingLink(resolveMeetingLink(assessment))}>
              <Text
                numberOfLines={1}
                style={[commonStyles.bodySmallSecondary600, { color: COLORS.primary.main }]}>
                Meeting Link
                <Image source={Icons.sendLocation} style={[commonStyles.iconSize14]} />
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.locationRow, commonStyles.fill]}>
            <Image source={Icons.locationIcon} style={[commonStyles.iconSize14]} />
            <Pressable
              style={[commonStyles.row, commonStyles.fill]}
              onPress={() =>
                openInGoogleMaps(
                  assessment?.application?.fullUnitAddress || assessment?.application?.unitAddress
                )
              }>
              <Text
                numberOfLines={2}
                style={[commonStyles.bodySmallSecondary600, { color: COLORS.text.primary }]}>
                {assessment?.application?.fullUnitAddress || assessment?.application?.unitAddress}
                {'  '}
              </Text>
              <Image source={Icons.sendLocation} style={[commonStyles.iconSize14]} />
            </Pressable>
          </View>
        )}
        <OfflineBadgeRow assessment={assessment} />
        <View style={styles.scheduledFooter}>
          <View style={styles.dateContainer}>
            <Image source={Icons.calenderGrey} style={[commonStyles.iconSize14]} />
            <Text style={[commonStyles.bodySmallPrimary600]}>
              {format(new Date(assessment?.scheduledStartDate), 'd MMM')} -{' '}
              {format(new Date(assessment?.scheduledEndDate), 'd MMM, yyyy')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('AssessmentStepsList', { assessmentId: assessment.id })
            }
            activeOpacity={0.6}
            style={[
              commonStyles.row,
              { gap: SPACING.sp2, alignItems: 'center', paddingVertical: Responsive.height(6) }
            ]}>
            <Text
              style={[
                commonStyles.FontFamily_SemiBold600,
                { fontSize: FONT_SIZE.fs12, color: COLORS.primary.main, letterSpacing: 0.2 }
              ]}>
              View Details
            </Text>
            <Image source={Icons.arrowRight} style={styles.arrowIcon} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  // if (userDataLoading || allAssessmentsLoading) {
  //   return (
  //     <View style={{ flex: 1 }}>
  //       <HomeSkeleton />
  //     </View>
  //   );
  // }

  // Cards shown on Home: active (in-progress) first, then scheduled. Completed/
  // other statuses are excluded. renderItem picks the card UI by status.
  const visibleAssessments = [
    ...(allAssessments?.filter(isActiveAssessmentCard) || []),
    ...(allAssessments?.filter((assessment) => assessment.status === 'scheduled') || [])
  ];

  // Split by application sector so each scheme gets its own heading. Anything
  // not explicitly 'service' is treated as Manufacturing (the default scheme).
  const isServiceSector = (assessment) =>
    String(assessment?.application?.sector || '').toLowerCase() === 'service';
  const manufacturingAssessments = visibleAssessments.filter((a) => !isServiceSector(a));
  const serviceAssessments = visibleAssessments.filter(isServiceSector);

  // One headed section: title + either its cards or an empty-state placeholder.
  // Both schemes share the same card UI, so this avoids duplicating the block.
  const renderAssessmentSection = (heading, data) => (
    <>
      <Text
        style={[
          commonStyles.h2heading700,
          { marginTop: Responsive.height(16), marginBottom: Responsive.height(10) }
        ]}>
        {heading}
      </Text>
      {userDataLoading || allAssessmentsLoading ? (
        [1, 2].map((_, idx) => <HomeSkeletonCard key={idx} />)
      ) : data.length > 0 ? (
        // The page already scrolls as one ScrollView; a nested non-scrolling
        // FlatList here only earned the "VirtualizedLists should never be nested"
        // warning on every render. The list is a handful of cards, so plain
        // rendering is the right shape.
        <View style={styles.assessmentsContainer}>
          {data.map((item, index) => (
            <View key={item.id} style={index > 0 ? { marginTop: Responsive.height(12) } : null}>
              {isActiveAssessmentCard(item)
                ? renderInProgressAssessment(item)
                : renderScheduledAssessment(item)}
            </View>
          ))}
        </View>
      ) : (
        <View
          style={{
            backgroundColor: COLORS.background.primary,
            padding: Responsive.width(16),
            borderRadius: BORDER_RADIUS.br8,
            alignItems: 'center',
            marginBottom: Responsive.height(10)
          }}>
          <Image
            source={Icons.emptyStateIcon}
            style={{
              width: Responsive.width(120),
              height: Responsive.height(60),
              marginBottom: Responsive.height(12),
              resizeMode: 'contain'
            }}
          />
          <Text
            style={{
              fontSize: FONT_SIZE.fs12,
              fontFamily: FONTS_FAMILY.SemiBold600,
              color: '#4B5675'
            }}>
            No Assessment
          </Text>
        </View>
      )}
    </>
  );

  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      {/* Header Section */}
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <ImageBackground
        source={Images.homeBg}
        style={[
          commonStyles.fullScreen,
          {
            width: '100%',
            height: Platform.OS === 'ios' ? 170 : 158
          }
        ]}>
        <View style={[styles.headerOverlay, { paddingTop: insets.top + Responsive.height(10) }]}>
          <View style={styles.headerContent}>
            <View style={styles.userSection}>
              {userDataLoading || allAssessmentsLoading ? (
                <AppSkeletonPlaceholder>
                  <AppSkeletonPlaceholder.Item width={40} height={40} borderRadius={20} />
                </AppSkeletonPlaceholder>
              ) : (
                <View style={{ borderWidth: 1, borderRadius: 50, borderColor: '#7239EA' }}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Profile')}
                    style={{
                      borderWidth: 1,
                      borderRadius: 50,
                      borderColor: COLORS.text.white,
                      width: 38,
                      height: 38,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: '#7239EA20'
                    }}
                    activeOpacity={0.6}>
                    <Text style={{ color: '#7239EA', fontFamily: FONTS_FAMILY.Bold700 }}>
                      {getInitials(userData?.user?.firstName + ' ' + userData?.user?.lastName)}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {userDataLoading || allAssessmentsLoading ? (
                <AppSkeletonPlaceholder>
                  <AppSkeletonPlaceholder.Item width={120} height={16} />
                  <AppSkeletonPlaceholder.Item width={160} height={12} style={{ marginTop: 6 }} />
                </AppSkeletonPlaceholder>
              ) : (
                <View>
                  <View
                    style={[
                      commonStyles.row,
                      { gap: SPACING.sp4, marginBottom: Responsive.height(2) }
                    ]}>
                    <Text style={[commonStyles.bodyLargePrimary500]}>Hi,</Text>
                    <Text style={[commonStyles.bodyLargePrimary600]}>
                      {userData?.user?.firstName}!
                    </Text>
                  </View>
                  <Text style={[commonStyles.bodySmallSecondary500]}>
                    {userData?.user?.samarId}
                  </Text>
                </View>
              )}
            </View>
            {online ? (
              <Image source={Icons.online} style={styles.onlineIcon} />
            ) : (
              <Image source={Icons.offline} style={styles.onlineIcon} />
            )}
          </View>
          {/* <View style={styles.statsContainer}>
          {getDashboardData?.summaryCards?.map((item, index) => (
            <View style={styles.statCard} key={index}>
              <View style={styles.statHeader}>
                <Image
                  source={
                    item.label === 'Pending Responses'
                      ? Icons.syncPending
                      : item.label === 'Active Assessments'
                      ? Icons.calenderlaw
                      : Icons.completedAssignment
                  }
                  style={[commonStyles.iconSize20]}
                />
                <Text
                  style={
                    item.label === 'Pending Responses'
                      ? styles.pendingCount
                      : item.label === 'Active Assessments'
                      ? styles.scheduledCount
                      : styles.completedCount
                  }>
                  {item.value || 0}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[commonStyles.bodySmallSecondary600, commonStyles.textAlign]}>
                {item?.label == 'Pending Responses'
                  ? 'Pending Sync'
                  : item?.label === 'Active Assessments'
                  ? 'Scheduled'
                  : 'Completed'}
              </Text>
            </View>
          ))}
        </View> */}
        </View>
      </ImageBackground>
      {/* Content Section */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, paddingHorizontal: Responsive.width(16), marginTop: '-68' }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary.main]}
            tintColor={COLORS.primary.main}
          />
        }>
        {/* Each scheme gets its own heading; both in-progress and scheduled
            cards render under it (no per-status sub-headings). */}
        {renderAssessmentSection('Manufacturing', manufacturingAssessments)}
        {renderAssessmentSection('Service', serviceAssessments)}
        <View style={{ alignItems: 'center', padding: 16 }}>
          <Image
            style={{ width: Responsive.width(134), height: Responsive.height(134) }}
            source={Icons.samarLogoOne}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = {
  headerOverlay: {
    width: '100%',
    paddingHorizontal: Responsive.width(16),
    paddingBottom: Responsive.height(15)
  },
  headerContent: {
    flexDirection: 'row',
    position: 'relative',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statsContainer: {
    ...commonStyles.rowSpaceBetween,
    gap: 10,
    marginTop: Responsive.height(24)
  },
  statCard: {
    backgroundColor: COLORS.background.primary,
    paddingVertical: Responsive.height(10),
    paddingHorizontal: Responsive.width(16),
    borderRadius: BORDER_RADIUS.br8,
    flex: 1
  },
  statHeader: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    marginBottom: Responsive.height(8)
  },
  pendingCount: {
    ...commonStyles.FontFamily_SemiBold600,
    color: '#EF5E2B',
    fontSize: FONT_SIZE.fs22
  },
  scheduledCount: {
    ...commonStyles.FontFamily_SemiBold600,
    color: '#7239EA',
    fontSize: FONT_SIZE.fs22
  },
  completedCount: {
    ...commonStyles.FontFamily_SemiBold600,
    color: '#04B440',
    fontSize: FONT_SIZE.fs22
  },
  userSection: {
    ...commonStyles.row,
    gap: SPACING.sp8
  },
  userAvatar: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    borderRadius: BORDER_RADIUS.br20
  },
  onlineIcon: {
    width: 40,
    height: 30,
    resizeMode: 'contain'
  },
  sectionTitle: {
    marginTop: Responsive.height(24),
    marginBottom: Responsive.height(16)
  },
  assessmentsContainer: {
    marginBottom: Responsive.height(8)
  },
  assessmentsListContent: {
    gap: Responsive.height(16)
  },
  assessmentCard: {
    backgroundColor: COLORS.background.primary,
    padding: Responsive.width(12),
    borderRadius: BORDER_RADIUS.br12,
    gap: Responsive.height(10)
  },
  assessmentHeader: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'flex-start'
  },
  assessmentInfo: {
    flexDirection: 'row',
    gap: SPACING.sp10,
    flex: 1
  },
  iconContainer: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    borderRadius: BORDER_RADIUS.br10,
    backgroundColor: COLORS.border.light,
    ...commonStyles.center
  },
  clipboardIcon: {
    width: Responsive.width(24),
    height: Responsive.height(24)
  },
  assessmentDetails: {
    flex: 1,
    gap: Responsive.height(4)
  },
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
  locationRow: {
    flexDirection: 'row',
    gap: SPACING.sp4,
    width: '90%'
  },
  locationIcon: {
    width: Responsive.width(14),
    height: Responsive.height(14)
  },
  sizeContainer: {
    backgroundColor: COLORS.primary.primaryDark,
    paddingHorizontal: Responsive.width(12),
    paddingVertical: Responsive.height(6),
    borderRadius: BORDER_RADIUS.br6,
    alignSelf: 'flex-start',
    marginTop: Responsive.height(4)
  },
  syncButton: {
    ...commonStyles.row,
    gap: SPACING.sp6,
    alignItems: 'center'
  },
  syncIcon: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    tintColor: COLORS.primary.primaryDark
  },
  progressContainer: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    gap: Responsive.width(12),
    marginTop: Responsive.height(8)
  },
  progressBar: {
    flex: 1,
    height: Responsive.height(8),
    backgroundColor: COLORS.border.light,
    borderRadius: BORDER_RADIUS.br4,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.status.warning,
    borderRadius: BORDER_RADIUS.br4
  },
  assessmentFooter: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center'
  },
  dateContainer: {
    ...commonStyles.row,
    gap: SPACING.sp6,
    alignItems: 'center'
  },
  calendarIcon: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    tintColor: COLORS.text.secondary
  },
  actionButton: {
    backgroundColor: COLORS.primary.main,
    width: Responsive.width(100),
    height: Responsive.height(30),
    borderRadius: BORDER_RADIUS.br8,
    ...commonStyles.row,
    gap: SPACING.sp4,
    justifyContent: 'center'
  },
  arrowIcon: {
    width: Responsive.width(8),
    height: Responsive.height(9),
    tintColor: COLORS.text.main
  },
  scheduledContainer: {
    marginBottom: Responsive.height(24)
  },
  scheduledListContent: {
    gap: Responsive.height(16)
  },
  scheduledCard: {
    backgroundColor: COLORS.background.primary,
    padding: Responsive.width(12),
    borderRadius: BORDER_RADIUS.br10,
    gap: Responsive.height(10)
  },
  scheduledHeader: {
    flexDirection: 'row',
    gap: SPACING.sp10,
    alignItems: 'flex-start'
  },
  downloadStatusIcon: {
    width: Responsive.width(34),
    height: Responsive.width(34),
    borderRadius: BORDER_RADIUS.br10,
    resizeMode: 'contain'
  },
  downloadLoader: {
    backgroundColor: COLORS.primary.soft,
    ...commonStyles.center
  },
  scheduledIconContainer: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    borderRadius: BORDER_RADIUS.br10,
    backgroundColor: COLORS.background.secondary,
    ...commonStyles.center
  },
  scheduledCalendarIcon: {
    width: Responsive.width(24),
    height: Responsive.height(20)
  },
  scheduledDetails: {
    flex: 1,
    gap: Responsive.height(4)
  },
  scheduledFooter: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    marginTop: Responsive.height(8)
  }
};

export default Home;
