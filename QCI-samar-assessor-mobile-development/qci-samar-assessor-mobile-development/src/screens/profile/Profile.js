import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Image, ImageBackground, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AppSettings from '../../../appsettings';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import { ScreenWrapper } from '../../components';
import { AppCommonModal } from '../../components/modals';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import { logoutAction } from '../../redux/action/accountAction';
import { countAllUnsynced } from '../../services/database/repositories/outboxRepo';
import { getInitials } from '../../utils';
import { Logger } from '../../utils/logger';
import { formatIndianPhoneNumber } from '../../utils/phoneUtils';

export default function Profile() {
  const navigation = useNavigation();
  const [logoutModal, setLogoutModal] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const dispatch = useDispatch();

  const { userData } = useSelector((state) => state.account);

  const handleGuideBookPress = useCallback(() => {
    Logger.info('Guide Book pressed');
    navigation.navigate('GuideBook');
  }, [navigation]);

  const handleAboutSamarPress = useCallback(() => {
    navigation.navigate('AboutSamar');
  }, [navigation]);

  const handleSupportPress = useCallback(() => {
    navigation.navigate('Support');
  }, [navigation]);

  const handleLogoutPress = useCallback(async () => {
    Logger.info('Logout pressed');
    try {
      setUnsyncedCount(await countAllUnsynced());
    } catch (error) {
      Logger.error('Failed to count unsynced items before logout:', error?.message);
      setUnsyncedCount(0);
    }
    setLogoutModal(true);
  }, []);

  const logoutSubTitle = useMemo(
    () =>
      unsyncedCount > 0
        ? `You have ${unsyncedCount} unsynced item${unsyncedCount === 1 ? '' : 's'}. ` +
          'Logging out permanently deletes all data on this device, including these unsynced ' +
          'item' +
          (unsyncedCount === 1 ? '' : 's') +
          ' — this cannot be undone. Log out anyway?'
        : 'Logging out permanently deletes all downloaded data from this device. Synced ' +
          'assessments can be downloaded again after you log back in. Log out?',
    [unsyncedCount]
  );
  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  return (
    <View style={styles.container}>
      <ScreenWrapper scrollable={false} showLogo={true}>
        <View style={styles.headerSection}>
          <ImageBackground source={Images.background} style={styles.gradientHeader}>
            {/* Header with Back Button */}
            <View style={styles.headerButton}>
              <TouchableOpacity activeOpacity={0.6} onPress={handleBackPress}>
                <Image source={Icons.backArrowIcon} style={styles.backIcon} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Profile</Text>
            </View>
            {/* Profile Image */}
            <View style={styles.profileImageContainer}>
              <View style={styles.defaultProfileImage}>
                <Text style={{ fontSize: FONT_SIZE.fs24 }}>
                  {getInitials(userData?.user?.fullName)}
                </Text>
              </View>
            </View>
          </ImageBackground>
          {/* Profile Info */}
          <View style={styles.profileInfo}>
            <Text style={styles.userId}>{userData?.user?.samarId}</Text>
            <Text style={styles.userName}>{userData?.user?.fullName}</Text>
            <Text style={styles.userEmail}>{userData?.user?.email}</Text>
            <Text style={styles.userPhone}>
              {formatIndianPhoneNumber(userData?.user?.mobileNumber)}
            </Text>
          </View>
        </View>
        {/* Menu Section */}
        <View style={styles.menuSection}>
          {/* Guide Book */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleGuideBookPress}
            activeOpacity={0.6}>
            <View style={styles.menuItemLeft}>
              <View style={styles.guideBookIcon}>
                <Image source={Icons.bookIcon} style={styles.menuIcon} />
              </View>
              <Text style={styles.menuItemText}>Guide Book</Text>
            </View>
            <Image source={Icons.arrowRight} style={styles.arrowIcon} />
          </TouchableOpacity>
          <View
            style={{
              height: Responsive.height(1),
              backgroundColor: COLORS.border.light,
              marginBottom: Responsive.height(12)
            }}
          />
          {/* Support */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleSupportPress}
            activeOpacity={0.6}>
            <View style={styles.menuItemLeft}>
              <View style={styles.guideBookIcon}>
                <Image source={Icons.messageQuestion} style={styles.menuIcon} />
              </View>
              <Text style={styles.menuItemText}>Support</Text>
            </View>
            <Image source={Icons.arrowRight} style={styles.arrowIcon} />
          </TouchableOpacity>
          <View
            style={{
              height: Responsive.height(1),
              backgroundColor: COLORS.border.light,
              marginBottom: Responsive.height(12)
            }}
          />
          {/* About SAMAR */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleAboutSamarPress}
            activeOpacity={0.6}>
            <View style={styles.menuItemLeft}>
              <View style={styles.guideBookIcon}>
                <Image source={Icons.InfoIcon} style={styles.menuIcon} />
              </View>
              <Text style={styles.menuItemText}>About SAMAR</Text>
            </View>
            <Image source={Icons.arrowRight} style={styles.arrowIcon} />
          </TouchableOpacity>
          <View
            style={{
              height: Responsive.height(1),
              backgroundColor: COLORS.border.light,
              marginBottom: Responsive.height(12)
            }}
          />
          {/* Logout */}
          <TouchableOpacity
            style={styles.logoutItem}
            onPress={handleLogoutPress}
            activeOpacity={0.6}>
            <View style={styles.menuItemLeft}>
              <View style={styles.logoutIcon}>
                <Image source={Icons.logout} style={styles.menuIcon} />
              </View>
              <Text style={styles.logoutText}>Logout</Text>
            </View>
          </TouchableOpacity>
        </View>
        {/* Footer */}
        <View style={styles.footerSection}>
          <View style={styles.logoContainer}>
            <Image source={Images.drdo} style={styles.drdo} />
            <View style={styles.logoSeparator} />
            <Image source={Images.government} style={styles.governmentLogo} />
            <View style={styles.logoSeparator} />
            <Image source={Images.qci} style={styles.qci} />
          </View>
          <Text style={styles.versionText}>
            Version {AppSettings.VERSION_DISPLAY}
            {AppSettings.COMMIT ? ` (${AppSettings.COMMIT})` : ''}
          </Text>
        </View>
      </ScreenWrapper>
      <AppCommonModal
        showmodal={logoutModal}
        imgsrc={Images.logoutIcon}
        LeftbuttonTextColor={COLORS.button.primary}
        leftButtonColor={'#E2EEFF'}
        title="Log out?"
        subTitle={logoutSubTitle}
        twoButtonModal={true}
        leftButtonText="Cancel"
        LeftonPress={() => setLogoutModal(false)}
        rightButtonText="Logout"
        onPress={async () => {
          await dispatch(logoutAction({ skipUnsyncedWarning: true, wipeData: true }));
          setLogoutModal(false);
        }}
        leftvariant="secondary"
        variant="danger"
      />
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background.secondary
  },
  headerSection: {
    backgroundColor: COLORS.background.primary,
    paddingBottom: Responsive.height(30)
  },
  gradientHeader: {
    height: Responsive.height(130),
    resizeMode: 'cover',
    marginBottom: Responsive.height(66)
  },
  headerButton: {
    position: 'absolute',
    top: Responsive.height(40),
    left: Responsive.width(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: Responsive.width(8)
  },
  backIcon: {
    ...commonStyles.iconSize24,
    tintColor: COLORS.text.white
  },
  headerTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.white
  },
  profileImageContainer: {
    marginTop: Responsive.height(25),
    justifyContent: 'center',
    alignItems: 'center'
  },
  defaultProfileImage: {
    width: Responsive.width(90),
    height: Responsive.width(90),
    borderRadius: Responsive.width(45),
    marginTop: Responsive.height(80),
    backgroundColor: '#F1ECFD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7239EA'
  },
  defaultProfileIcon: {
    width: Responsive.width(80),
    height: Responsive.width(80)
  },
  profileInfo: {
    alignItems: 'center'
  },
  userId: {
    ...commonStyles.FontFamily_SemiBold600,
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.fs12
  },
  userName: {
    ...commonStyles.FontFamily_SemiBold600,
    color: COLORS.text.heading,
    fontSize: FONT_SIZE.fs20,
    marginTop: Responsive.height(4)
  },
  userEmail: {
    ...commonStyles.bodySmallTertiary500,
    marginTop: Responsive.height(4)
  },
  userPhone: {
    ...commonStyles.bodySmallPrimary500,
    marginTop: Responsive.height(2)
  },
  menuSection: {
    ...commonStyles.paddingHorizontal16,
    backgroundColor: COLORS.background.primary,
    marginTop: Responsive.height(4),
    paddingVertical: Responsive.height(20),
    flex: 1
  },
  menuItem: {
    ...commonStyles.rowSpaceBetween,
    paddingBottom: Responsive.height(12)
  },
  logoutItem: {
    ...commonStyles.rowSpaceBetween
  },
  menuItemLeft: {
    ...commonStyles.row,
    gap: SPACING.sp10
  },
  guideBookIcon: {
    width: Responsive.width(36),
    height: Responsive.height(36),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.br10,
    borderColor: COLORS.info.clarity,
    backgroundColor: COLORS.info.light,
    borderWidth: 1
  },
  supportIcon: {
    width: Responsive.width(36),
    height: Responsive.height(36),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.br10,
    borderColor: COLORS.success.clarity,
    backgroundColor: COLORS.success.light,
    borderWidth: 1
  },
  logoutIcon: {
    width: Responsive.width(36),
    height: Responsive.height(36),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.br10,
    borderColor: COLORS.error.clarity,
    borderWidth: 1
  },
  menuIcon: {
    ...commonStyles.iconSize18
  },
  menuItemText: {
    ...commonStyles.bodyLargePrimary600
  },
  logoutText: {
    ...commonStyles.bodyLargePrimary600,
    color: COLORS.error.active
  },
  arrowIcon: {
    width: Responsive.width(6),
    height: Responsive.height(10),
    tintColor: COLORS.text.primary
  },
  footerSection: {
    alignItems: 'center',
    paddingVertical: Responsive.height(24),
    backgroundColor: COLORS.background.primary
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Responsive.height(16),
    gap: Responsive.width(8)
  },
  logoSeparator: {
    width: 1,
    height: Responsive.height(24),
    backgroundColor: COLORS.border.light
  },
  governmentLogo: {
    height: Responsive.height(32),
    width: Responsive.width(21),
    resizeMode: 'contain'
  },
  drdo: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain'
  },
  qci: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain'
  },
  versionText: {
    ...commonStyles.bodySmallTertiary500
  }
};
