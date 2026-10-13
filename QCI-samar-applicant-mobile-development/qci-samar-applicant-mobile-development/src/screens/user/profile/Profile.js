import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Image, ImageBackground, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AppSettings from '../../../../appsettings';
import { Responsive } from '../../../assets/theme/Layout';
import { commonStyles } from '../../../assets/theme/Styles';
import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  FONTS_FAMILY,
  SPACING,
} from '../../../assets/theme/Theme';
import ScreenWrapper from '../../../components/layout/ScreenWrapper';
import AppCommonModal from '../../../components/modals/AppCommonModal';
import Icons from '../../../constants/Icons';
import Images from '../../../constants/Images';
import { getUserDetails, logoutAction } from '../../../redux/action/accountAction';
import { getInitials } from '../../../utils';

/**
 * Profile — shows the signed-in user's details from Redux (account.userData)
 * and handles logout. User details are refreshed on focus, falling back to the
 * AsyncStorage cache seeded at login when offline.
 */

export default function Profile() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { userData } = useSelector(state => state.account);
  const user = userData?.user || {};
  const fullName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ');
  const phone = user.phone || user.phoneNumber || user.mobile;
  const [logoutModal, setLogoutModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      dispatch(getUserDetails());
    }, [dispatch]),
  );

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleLogout = () => {
    // Dispatch the thunk and let it run; it invalidates the backend session,
    // clears tokens/cache, and dispatches resetStore. Flipping isLoggedIn to
    // false in the reducer swaps ApplicationNavigator to PublicNavigator, so no
    // manual navigation is needed here. Close the modal immediately so the
    // confirm tap feels responsive.
    setLogoutModal(false);
    dispatch(logoutAction());
  };

  return (
    <View style={styles.container}>
      <ScreenWrapper scrollable={false} showLogo={true} logoSize={140}>
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
                <View style={styles.defaultProfileImageInner}>
                  <Text
                    style={{
                      fontSize: FONT_SIZE.fs44,
                      fontFamily: FONTS_FAMILY.SemiBold,
                      color: COLORS.primary.main,
                    }}>
                    {getInitials(fullName)}
                  </Text>
                </View>
              </View>
            </View>
          </ImageBackground>
          {/* Profile Info */}
          <View style={styles.profileInfo}>
            {!!user.samarId && <Text style={styles.userId}>{user.samarId}</Text>}
            <Text style={styles.userName}>{fullName}</Text>
            {!!user.email && <Text style={styles.userEmail}>{user.email}</Text>}
            {!!phone && <Text style={styles.userPhone}>{phone}</Text>}
          </View>
        </View>
        <View style={styles.menuSectionWrapper}>
          {/* Menu Section */}
          <View style={styles.menuSection}>
            {/* Support */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Support')}
              activeOpacity={0.6}>
              <View style={styles.menuItemLeft}>
                <View style={styles.guideBookIcon}>
                  <Image source={Icons.support} style={styles.menuIcon} />
                </View>
                <Text style={styles.menuItemText}>Support</Text>
              </View>
              <Image source={Icons.arrowRight} style={styles.arrowIcon} />
            </TouchableOpacity>
          </View>
          <View style={[styles.menuSection, commonStyles.fill]}>
            {/* Logout */}
            <TouchableOpacity
              style={styles.logoutItem}
              onPress={() => setLogoutModal(true)}
              activeOpacity={0.6}>
              <View style={styles.menuItemLeft}>
                <View style={styles.logoutIcon}>
                  <Image source={Icons.logout} style={styles.menuIcon} />
                </View>
                <Text style={styles.logoutText}>Logout</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        {/* Footer */}
        <View style={styles.footerSection}>
          <View style={styles.logoContainer}>
            <Image source={Images.drdo} style={styles.drdo} />
            <View style={styles.logoSeparator} />
            <Image source={Images.government} style={styles.governmentLogo} />
            <View style={styles.logoSeparator} />
            <Image source={Images.qci} style={styles.qciLogo} />
          </View>
          <Text style={styles.versionText}>
            Version {AppSettings.VERSION_DISPLAY || '1.0.0'}
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
        subTitle="Are you sure you want to log out from the app?"
        twoButtonModal={true}
        leftButtonText="Cancel"
        LeftonPress={() => setLogoutModal(false)}
        rightButtonText="Logout"
        onPress={handleLogout}
        leftvariant="secondary"
        variant="danger"
      />
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background.secondary,
  },
  headerSection: {
    backgroundColor: COLORS.background.primary,
    paddingBottom: 30,
  },
  gradientHeader: {
    height: 130,
    resizeMode: 'cover',
    marginBottom: 66,
  },
  headerButton: {
    position: 'absolute',
    top: 40,
    left: Responsive.width(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: Responsive.width(8),
  },
  backIcon: {
    ...commonStyles.iconSize24,
    tintColor: COLORS.text.white,
  },
  headerTitle: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.white,
  },
  profileImageContainer: {
    marginTop: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultProfileImage: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.circle,
    marginTop: 80,
    backgroundColor: COLORS.background.primary,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3D8BFD',
  },
  defaultProfileImageInner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: BORDER_RADIUS.circle,
    backgroundColor: '#ECF3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
  },
  userId: {
    ...commonStyles.FontFamily_SemiBold600,
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.fs12,
  },
  userName: {
    ...commonStyles.FontFamily_SemiBold600,
    color: COLORS.text.heading,
    fontSize: FONT_SIZE.fs20,
    marginTop: 2,
  },
  userEmail: {
    ...commonStyles.bodySmallTertiary500,
    fontSize: FONT_SIZE.fs12,
    marginTop: 10,
  },
  userPhone: {
    ...commonStyles.bodySmallPrimary500,
    fontSize: FONT_SIZE.fs12,
    marginTop: 6,
  },
  menuSectionWrapper: {
    flex: 1,
    backgroundColor: COLORS.background.accent,
  },
  menuSection: {
    ...commonStyles.paddingHorizontal16,
    backgroundColor: COLORS.background.primary,
    marginTop: 4,
    paddingVertical: 20,
  },
  menuItem: {
    ...commonStyles.rowSpaceBetween,
    // paddingBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border.light,
    marginBottom: 12,
  },
  logoutItem: {
    ...commonStyles.rowSpaceBetween,
  },
  menuItemLeft: {
    ...commonStyles.row,
    gap: SPACING.sp10,
  },
  guideBookIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.br10,
    borderColor: COLORS.info.clarity,
    backgroundColor: COLORS.info.light,
    borderWidth: 1,
  },
  logoutIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.br10,
    borderColor: COLORS.error.clarity,
    borderWidth: 1,
  },
  menuIcon: {
    height: 20,
    width: 20,
    resizeMode: 'contain',
  },
  menuItemText: {
    ...commonStyles.bodyLargePrimary600,
  },
  logoutText: {
    ...commonStyles.bodyLargePrimary600,
    color: COLORS.error.active,
  },
  arrowIcon: {
    width: Responsive.width(6),
    height: 10,
    tintColor: COLORS.text.primary,
  },
  footerSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: COLORS.background.primary,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  logoSeparator: {
    width: 1,
    height: 20,
    backgroundColor: '#EBEDF3',
  },
  governmentLogo: {
    height: 32,
    width: 21,
    resizeMode: 'contain',
  },
  drdo: {
    height: 32,
    width: 32,
    resizeMode: 'contain',
  },
  versionText: {
    ...commonStyles.bodySmallTertiary500,
  },
  qciLogo: {
    height: 32,
    width: 25,
    resizeMode: 'contain',
  },
};
