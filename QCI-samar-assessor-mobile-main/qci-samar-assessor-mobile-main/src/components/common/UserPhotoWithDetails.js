import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useCallback } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles, layout } from '../../assets/theme/Styles';
import { COLORS } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import { AppThumbnailView } from '../base';

const UserPhotoWithDetails = ({
  userID,
  name,
  NameOrPhoto,
  designation,
  dateOfBirth,
  blueTick,
  threeDot,
  isOwner,
  isYou,
  close,
  members,
  id,
  nameinitial,
  toggleSelection,
  toggleselect,
  notselectable,
  threedotclick,
  styleContainerInner,
  closeRBSheet,
  dimension,
  typography
}) => {
  const _navigation = useNavigation();

  const navigateToProfile = useCallback(() => {
    // Employee profile screen is not implemented yet; this is a no-op.
  }, []);

  const handlePress = useCallback(() => {
    if (!toggleSelection) {
      if (!notselectable) {
        navigateToProfile();
      }
    } else {
      toggleselect();
    }
  }, [toggleSelection, notselectable, navigateToProfile, toggleselect]);

  const renderAdminBadge = () =>
    isOwner && (
      <View style={styles.adminBadge}>
        <Text style={[commonStyles.tenWhite700, styles.adminText]}>ADMIN</Text>
      </View>
    );

  const renderDateOfBirth = () =>
    dateOfBirth && (
      <View style={styles.rowCenter}>
        <Image source={Icons.Cake} style={styles.cakeIcon} />
        <Text style={[commonStyles.twelveWhite500, styles.dateText]}>
          {format(new Date(dateOfBirth), 'd MMM')}
        </Text>
      </View>
    );

  const renderThreeDotIcon = () =>
    threeDot && (
      <TouchableOpacity activeOpacity={0.6} onPress={threedotclick}>
        <Image source={Icons.moreIcon} style={styles.blueTick} />
      </TouchableOpacity>
    );

  const renderCloseIcon = () =>
    close && (
      <TouchableOpacity activeOpacity={0.6} onPress={toggleselect}>
        <Image source={Icons.crossRed} style={styles.blueTick} />
      </TouchableOpacity>
    );

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={handlePress}
      style={[
        styles.containerInner,
        styleContainerInner,
        {
          paddingHorizontal: Responsive.width(10),
          backgroundColor: blueTick ? 'rgba(120, 128, 255, 0.05)' : 'transparent'
        }
      ]}>
      <View style={styles.rowCenter}>
        <AppThumbnailView
          nameOrPhoto={NameOrPhoto}
          profileDetailsId={id}
          OutermostContainerStyle={{
            ...styles.profilePicBx
          }}
          nameinitial={nameinitial}
          backgroundColor={{ backgroundColor: COLORS.primary.light }}
          textColor={commonStyles.purpleText}
          dimension={dimension || commonStyles.dimension50}
          typography={typography || commonStyles.typography50}
        />
        <View style={styles.detailsContainer}>
          <View style={styles.rowCenter}>
            {userID && (
              <Text style={[commonStyles.twelveWhite600, styles.userIDText]}>{userID}</Text>
            )}
            {renderAdminBadge()}
          </View>
          <View style={layout.fill}>
            <Text numberOfLines={1} style={[commonStyles.sixteenWhite600, styles.nameText]}>
              {name}
            </Text>
            {isYou && (
              <Text style={[commonStyles.sixteenWhite600, styles.nameText]}>{' (You)'}</Text>
            )}
          </View>
          <View>
            {designation && (
              <Text numberOfLines={1} style={[commonStyles.twelveWhite500, styles.designationText]}>
                {designation}
              </Text>
            )}
            {members && (
              <Text style={[commonStyles.twelveWhite500, styles.membersText]}>
                {members} Members
              </Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.rightContainer}>
        {renderDateOfBirth()}
        {blueTick && <Image source={Icons.blueTick} style={styles.blueTick} />}
        {renderThreeDotIcon()}
        {renderCloseIcon()}
      </View>
    </TouchableOpacity>
  );
};

export default UserPhotoWithDetails;

const styles = StyleSheet.create({
  blueTick: {
    height: Responsive.height(20),
    resizeMode: 'contain',
    width: Responsive.width(20)
  },
  containerInner: {
    borderRadius: 16,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Responsive.width(15),
    paddingVertical: Responsive.height(10),
    alignItems: 'center'
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  detailsContainer: {
    paddingLeft: Responsive.width(10),
    flex: 1,
    paddingRight: Responsive.width(10)
  },
  userIDText: {
    color: COLORS.primary.main
  },
  adminBadge: {
    backgroundColor: COLORS.status.successBg,
    height: Responsive.height(12),
    paddingHorizontal: Responsive.width(4),
    marginLeft: Responsive.width(3),
    justifyContent: 'center',
    borderRadius: 2
  },
  adminText: {
    color: COLORS.status.success,
    textTransform: 'uppercase'
  },

  nameText: {
    color: COLORS.text.secondary,
    marginBottom: Responsive.height(2),
    flex: 1
  },
  designationText: {
    color: COLORS.text.tertiary
  },
  membersText: {
    color: COLORS.text.tertiary
  },
  cakeIcon: {
    width: Responsive.width(15),
    height: Responsive.height(15),
    resizeMode: 'contain',
    marginRight: Responsive.width(4)
  },
  dateText: {
    color: COLORS.primary.main
  }
});
