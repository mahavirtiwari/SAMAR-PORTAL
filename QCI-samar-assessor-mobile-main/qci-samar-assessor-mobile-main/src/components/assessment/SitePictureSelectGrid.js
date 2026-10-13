import { format, isValid } from 'date-fns';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import AppFastImage from '../shared/FastImage';

// Inline multi-select grid over an applicant-uploaded picture pool (service
// sector). The assessor taps photos to toggle which become the assessment's
// official set. Selection state lives in the parent; this renders `pictures`,
// reflects `selectedIds`, and reports taps via onToggle. Item chrome mirrors
// SiteTourPickerModal so the two selection surfaces look identical.
const SitePictureSelectGrid = ({
  pictures = [],
  selectedIds = [],
  onToggle,
  readOnly = false,
  ListHeaderComponent,
  refreshControl
}) => {
  const formatCapturedAt = (value) => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    return isValid(date) ? format(date, 'd MMM yyyy, hh:mm a') : '';
  };

  const renderItem = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    const capturedAt = formatCapturedAt(item.capturedAt);
    const handlePress = readOnly || !onToggle ? undefined : () => onToggle(item.id);
    return (
      <TouchableOpacity
        style={styles.imageItem}
        onPress={handlePress}
        activeOpacity={readOnly ? 1 : 0.8}
        disabled={readOnly || !onToggle}>
        <View style={styles.imageWrap}>
          <AppFastImage uri={item.downloadUrl} style={styles.image} />
          {!readOnly &&
            (isSelected ? (
              <Image source={Icons.rightTick} style={styles.check} />
            ) : (
              <View style={styles.uncheck} />
            ))}
        </View>
        {!!item.title && (
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
        )}
        {!!capturedAt && (
          <Text style={styles.time} numberOfLines={1}>
            {capturedAt}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={pictures}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
      numColumns={2}
      contentContainerStyle={styles.grid}
      ItemSeparatorComponent={() => <View style={{ height: SPACING.sp12 }} />}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={ListHeaderComponent}
      extraData={selectedIds}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    />
  );
};

const styles = {
  grid: {
    paddingTop: Responsive.height(15),
    paddingBottom: Responsive.height(15)
  },
  row: {
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.sp8
  },
  imageItem: {
    width: '47%',
    marginBottom: SPACING.sp12,
    marginHorizontal: SPACING.sp4,
    borderWidth: 1,
    borderColor: COLORS.background.accent,
    borderRadius: BORDER_RADIUS.br12,
    backgroundColor: COLORS.background.primary
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    borderTopLeftRadius: BORDER_RADIUS.br12,
    borderTopRightRadius: BORDER_RADIUS.br12,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  title: {
    marginTop: SPACING.sp8,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary,
    fontFamily: commonStyles.FontFamily_SemiBold600.fontFamily,
    paddingHorizontal: SPACING.sp8
  },
  time: {
    marginTop: Responsive.height(2),
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary,
    paddingHorizontal: SPACING.sp8,
    paddingBottom: SPACING.sp8
  },
  check: {
    position: 'absolute',
    top: Responsive.width(8),
    right: Responsive.width(8),
    width: Responsive.width(24),
    height: Responsive.width(24),
    resizeMode: 'contain',
    borderRadius: Responsive.width(12)
  },
  uncheck: {
    position: 'absolute',
    top: Responsive.width(8),
    right: Responsive.width(8),
    width: Responsive.width(24),
    height: Responsive.width(24),
    borderRadius: Responsive.width(12),
    borderWidth: 1.5,
    borderColor: COLORS.background.primary,
    backgroundColor: 'rgba(0, 0, 0, 0.18)'
  }
};

export default SitePictureSelectGrid;
