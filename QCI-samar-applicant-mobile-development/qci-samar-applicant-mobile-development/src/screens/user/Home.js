import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONTS_FAMILY, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import { getStatusConfig } from '../../constants/StatusConfig';
import { getUserDetails } from '../../redux/action/accountAction';
import { getApplications } from '../../redux/action/applicationAction';
import { getInitials, toTitleCase } from '../../utils';
import { subscribeToNetworkChanges } from '../../utils/checkInternetConnection';

const formatDateRange = (start, end) => {
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (!startDate && !endDate) {
    return null;
  }
  const fmt = d => (d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', options) : null);
  const startStr = fmt(startDate);
  const endStr = fmt(endDate);
  if (startStr && endStr) {
    return `${startStr} - ${endStr}`;
  }
  return startStr || endStr;
};

const Home = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const { userData } = useSelector(state => state.account);
  const { applications, applicationsLoading } = useSelector(state => state.application);

  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const user = userData?.user || {};

  const loadData = useCallback(() => {
    dispatch(getUserDetails());
    dispatch(getApplications({ sector: 'service' }));
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges(setIsOnline);
    return unsubscribe;
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(getUserDetails()),
      dispatch(getApplications({ sector: 'service' })),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  const openMeetingLink = async url => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open', 'No app is available to handle this link.');
    }
  };

  const renderApplicationCard = application => {
    const status = getStatusConfig(
      application.assessmentStatus,
      application.statusLabel || application.status,
    );
    const dateRange = formatDateRange(
      application.assessmentScheduledStartDate,
      application.assessmentScheduledEndDate,
    );
    return (
      <View key={application.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[commonStyles.bodyLargePrimary600]}>{application.applicationNumber}</Text>
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
        <Text style={[commonStyles.bodySmallSecondary600]}>
          {toTitleCase(application.organizationName)}
        </Text>
        {!!application.assessmentMeetingLink && (
          <TouchableOpacity
            style={styles.meetingRow}
            activeOpacity={0.6}
            onPress={() => openMeetingLink(application.assessmentMeetingLink)}>
            <Image source={Icons.vMeeting} style={commonStyles.iconSize14} />
            <Text style={styles.meetingText}>Meeting Link</Text>
            <Image source={Images.send} style={commonStyles.iconSize14} />
          </TouchableOpacity>
        )}
        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <Image source={Icons.calenderGrey} style={[commonStyles.iconSize14]} />
            <Text style={[commonStyles.bodySmallPrimary600]}>{dateRange || 'Not scheduled'}</Text>
          </View>
          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.6}
            onPress={() =>
              navigation.navigate('ApplicationDetail', {
                applicationId: application.id,
                assessmentId: application.assessmentId,
                applicationNumber: application.applicationNumber,
                companyName: application.organizationName,
                address: application.fullUnitAddress || application.unitAddress,
                type: (application.sector || '').toUpperCase(),
                status: application.status,
                assessmentStatus: application.assessmentStatus,
                meetingLink: application.assessmentMeetingLink,
                assessmentScheduledStartDate: application.assessmentScheduledStartDate,
                leadPunchedIn: application.leadPunchedIn,
                allocationLocked: application.allocationLocked,
                assessors: application.assessors,
                dateRange,
              })
            }>
            <Text style={styles.actionText}>{status.action}</Text>
            <Image source={Icons.arrowRight} style={styles.actionArrow} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const showInitialLoader = applicationsLoading && applications.length === 0 && !refreshing;

  return (
    <View style={[commonStyles.fill, commonStyles.backgroundColor]}>
      {/* Full-screen background (blue blobs fade to light) */}
      <ImageBackground source={Images.homeBg} resizeMode="cover" style={commonStyles.fill}>
        {/* Header */}
        <View style={styles.headerOverlay}>
          <View style={styles.userSection}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={styles.avatar}
              activeOpacity={0.6}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>
                  {getInitials(user.fullName || user.firstName || '')}
                </Text>
              </View>
            </TouchableOpacity>
            <View>
              <View style={[commonStyles.row, { gap: SPACING.sp4 }]}>
                <Text style={[commonStyles.bodyLargePrimary500]}>Hi,</Text>
                <Text style={[commonStyles.bodyLargePrimary600]}>
                  {user.firstName ? `${user.firstName}!` : ''}
                </Text>
              </View>
              {!!user.samarId && (
                <Text style={[commonStyles.bodySmallSecondary500]}>{user.samarId}</Text>
              )}
            </View>
          </View>
          <Image source={isOnline ? Icons.online : Icons.offline} style={styles.connectivityIcon} />
        </View>
        {/* Watermark logo */}
        <View pointerEvents="none" style={styles.watermark}>
          <Image source={Icons.samarLogoOne} style={styles.watermarkImage} />
        </View>
        {/* Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}>
          <Text style={[commonStyles.h2heading700, styles.sectionTitle]}>Applications</Text>
          {showInitialLoader ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.primary.main} />
            </View>
          ) : applications.length > 0 ? (
            applications.map(item => renderApplicationCard(item))
          ) : (
            <View style={styles.emptyState}>
              <Image source={Icons.emptyStateIcon} style={styles.emptyStateImage} />
              <Text style={styles.emptyStateText}>No Applications</Text>
            </View>
          )}
        </ScrollView>
      </ImageBackground>
    </View>
  );
};

const styles = {
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerOverlay: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    ...commonStyles.statusBarGap,
  },
  userSection: {
    ...commonStyles.row,
    alignItems: 'center',
    gap: SPACING.sp10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.circle,
    borderWidth: 1,
    borderColor: COLORS.primary.main,
    backgroundColor: COLORS.background.primary,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: BORDER_RADIUS.circle,
    backgroundColor: COLORS.primary.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.primary.main,
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
  },
  connectivityIcon: {
    width: 40,
    height: 30,
    resizeMode: 'contain',
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.background.primary,
    padding: 12,
    borderRadius: BORDER_RADIUS.br12,
    marginBottom: 12,
  },
  cardHeader: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    height: 20,
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.br6,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
  },
  meetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp6,
    marginTop: 12,
  },
  meetingText: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.primary.main,
  },
  cardFooter: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    marginTop: 16,
  },
  dateContainer: {
    ...commonStyles.row,
    gap: SPACING.sp6,
    alignItems: 'center',
  },
  actionRow: {
    ...commonStyles.row,
    alignItems: 'center',
  },
  actionText: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.primary.main,
    letterSpacing: 0.2,
  },
  actionArrow: {
    width: 12,
    height: 14,
    resizeMode: 'contain',
    tintColor: COLORS.primary.main,
  },
  loaderContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyState: {
    backgroundColor: COLORS.background.primary,
    paddingVertical: 40,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.br12,
    alignItems: 'center',
  },
  emptyStateImage: {
    width: 120,
    height: 60,
    marginBottom: 12,
    resizeMode: 'contain',
  },
  emptyStateText: {
    fontSize: FONT_SIZE.fs12,
    fontFamily: FONTS_FAMILY.SemiBold600,
    color: COLORS.text.secondary,
  },
  watermark: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  watermarkImage: {
    width: 134,
    height: 134,
    resizeMode: 'contain',
    opacity: 0.7,
  },
};

export default Home;
