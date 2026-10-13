import { format, isValid } from 'date-fns';
import { useRef } from 'react';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import { Haptic } from '../../utils/hapticUtils';
import AppButton from '../base/AppButton';
import { Header } from '../layout';
import { AppModal } from '../modals';
import AppFastImage from '../shared/FastImage';

// Full-screen, controlled picker for choosing site-tour photos as evidence.
// Mirrors the AddProduct screen chrome: an AppModal hosting the shared Header
// with a cross (close={true}). Purely presentational — selection state and the
// MAX-evidence/merge rules live in the parent; this renders `pictures`, reflects
// `selectedIds`, and reports taps via onToggle/onSelect/onClose.
const SiteTourPickerModal = ({
  visible,
  pictures = [],
  selectedIds = [],
  onToggle,
  onSelect,
  onClose,
  selectDisabled = false,
  maxImages = 5
}) => {
  // Toasts must render through a FlashMessage that lives INSIDE this native
  // Modal — the app-root instance sits behind it, so a limit warning fired
  // there is invisible. We call showMessage on this ref directly rather than
  // relying on the library's "last mounted instance wins" auto-routing, which
  // doesn't switch reliably when a Modal opens.
  const flashRef = useRef(null);

  const showLimitToast = () => {
    Haptic.warning();
    flashRef.current?.showMessage({
      message: 'Limit Reached',
      description: `You can add up to ${maxImages} images per question.`,
      type: 'warning',
      icon: 'warning',
      duration: 3000
    });
  };

  // onToggle returns false when the parent rejects the tap (limit reached).
  // Surface the warning on the in-modal FlashMessage so the user sees it.
  const handleToggle = (id) => {
    if (onToggle(id) === false) {
      showLimitToast();
    }
  };
  // Site tour photos carry a capturedAt timestamp; show it like the rest of the
  // app ("5 Nov 2024, 10:27 AM"). Guard invalid/missing values so a bad date
  // never renders "Invalid Date" or throws in the list.
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
    return (
      <TouchableOpacity
        style={styles.imageItem}
        onPress={() => handleToggle(item.id)}
        activeOpacity={0.8}>
        <View style={styles.imageWrap}>
          <AppFastImage uri={item.downloadUrl} style={styles.image} />
          {isSelected ? (
            <Image source={Icons.rightTick} style={styles.check} />
          ) : (
            <View style={styles.uncheck} />
          )}
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
    <AppModal visible={visible} onRequestClose={onClose}>
      <Header title="Pick From Site Tour" onPress={onClose} close={true} />
      <View style={styles.container}>
        <View style={{ flex: 1 }}>
          <FlatList
            data={pictures}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            contentContainerStyle={styles.grid}
            ItemSeparatorComponent={() => <View style={{ height: SPACING.sp12 }} />}
            columnWrapperStyle={styles.row}
            extraData={selectedIds}
          />
        </View>
        <View style={[commonStyles.paddingHorizontal16, commonStyles.paddingVertical16]}>
          <AppButton title="Select" size="large" onPress={onSelect} disabled={selectDisabled} />
        </View>
      </View>
      {/* Local instance so warning toasts render ABOVE this native Modal — the
          app-root FlashMessage sits behind it. Triggered via flashRef directly. */}
      <FlashMessage ref={flashRef} position="top" />
    </AppModal>
  );
};

const styles = {
  container: {
    flex: 1
  },
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
    // padding: SPACING.sp8,
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

export default SiteTourPickerModal;
