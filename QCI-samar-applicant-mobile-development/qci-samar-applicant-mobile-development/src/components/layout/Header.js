import { useNavigation } from '@react-navigation/native';
import { Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import SyncStatusButton from '../shared/SyncStatusButton';

// import { AppSkeletonPlaceholder, AppToggleSwitch } from '../base';

const Header = ({
  onPress,
  title,
  count,
  back,
  close,
  edit,
  headerStyle,
  editSkeleton = false,
  headerBottomStyle = true,
  fontSize = FONT_SIZE.fs18,
  search = false,
  searchOnPress,
  filterOnPress,
  toogleSwitch = false,
  toogle,
  tooglePress,
  filterActive = false,
  activeTab,
  onTabChange,
  exportDocumentUpload = false,
  filterDataOnPress,
  paddingBottom,
  filterDataActive = false,
  image,
  refreshIcon = false,
  syncStatus = false,
  onSynced,
}) => {
  const navigation = useNavigation();

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View
      style={[
        styles.header,
        commonStyles.statusBarGap,
        {
          ...headerStyle,
          backgroundColor: COLORS.background.primary,
          borderBottomColor: headerBottomStyle ? COLORS.border.regular : COLORS.background.primary,
          borderBottomWidth: headerBottomStyle ? Responsive.height(1) : Responsive.height(0),
        },
      ]}>
      <StatusBar backgroundColor={COLORS.background.primary} barStyle="dark-content" />
      <View
        style={[
          styles.applicationHeader,
          {
            paddingBottom: paddingBottom ?? Responsive.height(12),
          },
        ]}>
        <View style={[commonStyles.row, styles.headerLeft]}>
          {close ? (
            <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
              <View style={styles.rightArrow}>
                <Image source={Icons.closeCross} style={commonStyles.iconSize24} />
              </View>
            </TouchableOpacity>
          ) : null}
          {back ? (
            <TouchableOpacity onPress={handleBack} activeOpacity={0.6}>
              <View style={[styles.rightArrow]}>
                <Image source={Icons.backArrowIcon} style={[commonStyles.iconSize24]} />
              </View>
            </TouchableOpacity>
          ) : null}
          <View style={[commonStyles.row, styles.titleGroup]}>
            {image && (
              <View>
                <Image source={image} style={[commonStyles.iconSize30]} />
              </View>
            )}
            {title ? (
              <View style={[commonStyles.row, { flex: 1 }]}>
                <Text
                  numberOfLines={1}
                  style={[
                    commonStyles.FontFamily_SemiBold600,
                    { color: COLORS.text.heading, fontSize: fontSize },
                  ]}>
                  {title}
                </Text>
                {count && (
                  <Text
                    style={[
                      commonStyles.FontFamily_Medium500,
                      { color: COLORS.text.primary, fontSize: fontSize },
                    ]}>
                    {' '}
                    ({count})
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        </View>
        {syncStatus ? <SyncStatusButton onSynced={onSynced} /> : null}
        {edit ? (
          <TouchableOpacity onPress={onPress} style={styles.ptsContainer} activeOpacity={0.6}>
            <Image source={Icons.EditIcon} style={[commonStyles.iconSize24]} />
          </TouchableOpacity>
        ) : null}
        {refreshIcon ? (
          <TouchableOpacity onPress={onPress} style={styles.ptsContainer} activeOpacity={0.6}>
            <Image source={Icons.cloud} style={[commonStyles.iconSize24]} />
          </TouchableOpacity>
        ) : null}
        {/* {editSkeleton && (
          <AppSkeletonPlaceholder>
            <View
              style={{
                width: Responsive.width(25),
                height: Responsive.height(25),
                borderRadius: BORDER_RADIUS.br6
              }}
            />
          </AppSkeletonPlaceholder>
        )} */}

        {activeTab && (
          <View
            style={[
              commonStyles.rowSpaceBetween,
              {
                height: Responsive.height(50),
              },
            ]}>
            <View
              style={[
                commonStyles.row,
                {
                  width: Responsive.width(154),
                  height: Responsive.height(27),
                  backgroundColor: COLORS.border.main,
                  borderRadius: BORDER_RADIUS.br10,
                },
              ]}>
              <TouchableOpacity
                onPress={() => onTabChange && onTabChange('Container')}
                style={[
                  commonStyles.center,
                  {
                    height: Responsive.height(27),
                    width: Responsive.width(80),
                    backgroundColor:
                      activeTab === 'Container'
                        ? COLORS.background.main
                        : COLORS.background.transparent,
                    borderRadius: BORDER_RADIUS.br10,
                  },
                ]}>
                <Text
                  style={[
                    commonStyles.FontFamily_SemiBold600,
                    {
                      fontSize: FONT_SIZE.fs10,
                      color:
                        activeTab === 'Container' ? COLORS.text.onPrimary : COLORS.text.tertiary,
                    },
                  ]}>
                  Container
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onTabChange && onTabChange('Roro')}
                style={[
                  commonStyles.center,
                  {
                    height: Responsive.height(27),
                    width: Responsive.width(80),
                    backgroundColor:
                      activeTab === 'Roro' ? COLORS.background.main : COLORS.background.transparent,
                    borderRadius: BORDER_RADIUS.br10,
                  },
                ]}>
                <Text
                  style={[
                    commonStyles.FontFamily_Bold,
                    {
                      fontSize: FONT_SIZE.fs10,
                      color: activeTab === 'Roro' ? COLORS.text.onPrimary : COLORS.text.tertiary,
                    },
                  ]}>
                  RORO
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {exportDocumentUpload && (
          <TouchableOpacity
            onPress={filterOnPress}
            activeOpacity={0.6}
            style={[
              styles.filterSection,
              {
                backgroundColor: filterActive ? COLORS.primary.background : COLORS.primary.light,
              },
            ]}>
            <Image
              source={filterActive ? Icons.exportDocumentUpload : Icons.exportDocumentUpload}
              style={[commonStyles.iconSize20]}
            />
          </TouchableOpacity>
        )}
        {/* {search && (
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={searchOnPress}
              activeOpacity={0.6}
              style={styles.filterSection}>
              <Image source={Icons.searchIcons} style={[commonStyles.iconSize20]} />
            </TouchableOpacity> */}
        {filterActive && (
          <TouchableOpacity
            onPress={filterOnPress}
            activeOpacity={0.6}
            style={[
              styles.filterSection,
              {
                backgroundColor: filterActive ? COLORS.primary.background : COLORS.primary.light,
              },
            ]}>
            <Image
              source={filterActive ? Icons.filter : Icons.filter}
              style={[commonStyles.iconSize24]}
            />
          </TouchableOpacity>
        )}
        {/* {filterDataOnPress && (
              <TouchableOpacity
                onPress={filterDataOnPress}
                activeOpacity={0.6}
                style={[
                  styles.filterSection,
                  {
                    backgroundColor: !filterDataActive
                      ? COLORS.primary.light
                      : COLORS.primary.background
                  }
                ]}>
                {filterDataActive ? (
                  <Image source={Icons.filter} style={[commonStyles.iconSize20]} />
                ) : (
                  <Image
                    source={Icons.filter}
                    style={[commonStyles.iconSize20, { tintColor: COLORS.text.tertiary }]}
                  />
                )}
              </TouchableOpacity>
            )}
          </View> */}
        {/* )} */}
        {toogleSwitch && (
          <View style={[commonStyles.row, { gap: SPACING.sp10 }]}>
            <Text
              style={[
                commonStyles.FontFamily_Bold,
                { color: COLORS.text.success, fontSize: FONT_SIZE.fs12 },
              ]}>
              Only Active
            </Text>
            {/* <AppToggleSwitch
              isOn={toogle}
              onToggle={tooglePress}
              offColor={COLORS.border.main}
              onColor={COLORS.background.success}
            /> */}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rightArrow: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    marginRight: Responsive.width(8),
  },
  applicationHeader: {
    ...commonStyles.row,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
  },
  titleGroup: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.sp8,
  },
  ptsContainer: {
    marginLeft: Responsive.width(10),
  },
  header: {},
  headerContainer: {
    flexDirection: 'row',
    gap: SPACING.sp10,
  },

  filterSection: {
    ...commonStyles.center,
    height: Responsive.height(30),
    width: Responsive.width(30),
    backgroundColor: COLORS.primary.light,
    borderRadius: BORDER_RADIUS.br30,
  },
});

export default Header;
