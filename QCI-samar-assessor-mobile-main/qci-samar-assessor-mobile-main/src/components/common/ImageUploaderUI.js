import { useState } from 'react';
import { Image, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import AppFastImage from '../shared/FastImage';
import ImageSyncBadge from './ImageSyncBadge';

const ImageUploaderUI = ({
  title,
  image,
  onPress,
  onDelete,
  showMetadata = true,
  coordinates,
  timestamp = new Date(),
  uploadedBy,
  isDelete,
  style = {},
  onEdit,
  // 'synced' | 'pending' | 'failed' — renders the corner saved/unsaved badge.
  // Omitted (e.g. the capture-preview sheet) shows no badge.
  syncState,
  // Service-sector meetings are conducted online, so a screenshot from the
  // device is allowed alongside a live capture. When `allowUpload` is set the
  // empty placeholder shows two cards — "Capture Picture" (onPress) and
  // "Upload from Device" (onUpload) — matching the screenshot. Every other
  // sector keeps the single camera-only placeholder.
  allowUpload = false,
  onUpload
}) => {
  const [imageOpen, setImageOpen] = useState(false);
  // Drive the image height off its real aspect ratio so it stays full-width
  // without distortion. Falls back to 4:3 until the image reports its size.
  // NOTE: measured from the actually-loaded (cached/local) image via onLoad,
  // because Image.getSize() can't fetch auth-protected remote URLs.
  const [aspectRatio, setAspectRatio] = useState(4 / 3);

  const handleImageLoad = (e) => {
    const { width, height } = e?.nativeEvent?.source || {};
    if (width > 0 && height > 0) {
      setAspectRatio(width / height);
    }
  };

  return (
    <View style={[styles.pictureSection, style]}>
      {title && (
        <Text style={styles.sectionTitle}>
          {title}
          <Text style={{ color: COLORS.error.active }}>*</Text>
        </Text>
      )}
      {image ? (
        // Display uploaded image with metadata and delete option
        <View style={styles.uploadedImageContainer}>
          <Pressable onPress={() => setImageOpen(true)} style={styles.uploadedImageClip}>
            {/* Image anchored to the bottom: when it's taller than the fixed clip
                box, the TOP overflows and gets clipped while the bottom stays visible. */}
            <AppFastImage
              uri={image}
              resizeMode="cover"
              useImageBackground={true}
              onLoad={handleImageLoad}
              style={[styles.uploadedImage, { aspectRatio }]}
            />
            <View style={styles.imageHeader}>
              {isDelete && (
                <Pressable onPress={onDelete} style={styles.deleteButton}>
                  <Image source={Icons.redCross} style={styles.deleteIcon} />
                </Pressable>
              )}
              {onEdit && (
                <Pressable onPress={onEdit} style={styles.deleteButton}>
                  <Image source={Icons.editImageIcons} style={commonStyles.iconSize30} />
                </Pressable>
              )}
            </View>
            <ImageSyncBadge state={syncState} />
          </Pressable>
        </View>
      ) : allowUpload && onUpload ? (
        // Service sector: capture live OR upload an existing screenshot.
        <View style={styles.sourceRow}>
          <TouchableOpacity
            style={[styles.pictureContainer, styles.sourceCard]}
            onPress={() => onPress?.()}
            activeOpacity={0.6}>
            <View style={styles.capturePlaceholder}>
              <Image source={Icons.cameraIcon} style={[commonStyles.iconSize40]} />
              <Text style={styles.captureText}>Capture Picture</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pictureContainer, styles.sourceCard]}
            onPress={() => onUpload?.()}
            activeOpacity={0.6}>
            <View style={styles.capturePlaceholder}>
              <Image source={Icons.gallery} style={[commonStyles.iconSize40]} />
              <Text style={styles.captureText}>Upload from Device</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        // Display upload placeholder
        <TouchableOpacity
          style={styles.pictureContainer}
          onPress={() => onPress?.()}
          activeOpacity={0.6}>
          <View style={styles.capturePlaceholder}>
            <Image source={Icons.cameraIcon} style={[commonStyles.iconSize40]} />
            <Text style={styles.captureText}>Capture Picture</Text>
          </View>
        </TouchableOpacity>
      )}
      <Modal
        visible={imageOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setImageOpen(false)}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}>
          <View style={styles.modalCard}>
            <View style={styles.modalImageWrapper}>
              <AppFastImage
                uri={image}
                useImageBackground={true}
                resizeMode="contain"
                borderRadius={BORDER_RADIUS.br12}
                onLoad={handleImageLoad}
                style={[styles.modalImage, { aspectRatio }]}></AppFastImage>
              <Pressable
                onPress={() => setImageOpen(false)}
                hitSlop={12}
                style={styles.modalCloseButton}>
                <Image source={Icons.redCross} style={styles.modalCloseIcon} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = {
  pictureSection: {},
  sectionTitle: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.heading,
    marginBottom: 4
  },
  pictureContainer: {
    backgroundColor: COLORS.background.muted,
    borderRadius: BORDER_RADIUS.br12,
    borderWidth: 2,
    borderColor: COLORS.primary.soft,
    borderStyle: 'dashed',
    minHeight: Responsive.height(120),
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  sourceRow: {
    flexDirection: 'row',
    gap: SPACING.sp12
  },
  sourceCard: {
    flex: 1
  },
  capturePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sp20,
    paddingHorizontal: SPACING.sp8
  },
  captureText: {
    marginTop: Responsive.height(5),
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.primary.main,
    textAlign: 'center'
  },
  uploadedImageContainer: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br12
  },
  // Fixed-height window that clips the image. justifyContent: 'flex-end' pins the
  // image to the bottom; when it's taller than the box, the TOP overflows and
  // overflow: 'hidden' clips it — so the bottom of the photo always stays visible.
  uploadedImageClip: {
    width: '100%',
    height: 150,
    borderRadius: BORDER_RADIUS.br12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#000000'
  },
  uploadedImage: {
    width: '100%',
    // ensures wide/short images still fill the box (no gap above); taller images
    // grow past the box via aspectRatio (set inline) and get clipped at the top
    minHeight: '100%',
    flexShrink: 0
  },
  imageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'flex-end'
  },
  deleteButton: {
    margin: Responsive.height(8),
    height: Responsive.height(24)
  },
  trashIcon: {
    height: Responsive.height(24),
    width: Responsive.height(24)
  },
  imageFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#4B567599',
    padding: Responsive.height(8),
    borderBottomLeftRadius: BORDER_RADIUS.br12,
    borderBottomRightRadius: BORDER_RADIUS.br12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp10
  },
  mapIcon: {
    height: Responsive.height(26),
    width: Responsive.height(26)
  },
  metadataContainer: {
    flex: 1
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sp4
  },
  smallIcon: {
    height: Responsive.height(12),
    width: Responsive.height(12)
  },
  metadataText: {
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs12,
    ...commonStyles.FontFamily_Regular400
  },
  uploadedByContainer: {
    flexDirection: 'row',
    gap: SPACING.sp4,
    marginTop: Responsive.height(6)
  },
  // Positioning context so the close button can anchor to the card's top-right
  // corner regardless of the image's aspect ratio or the screen size.
  modalCard: {
    width: '96%',
    alignItems: 'center'
  },
  modalImageWrapper: {
    width: '100%',
    maxHeight: Responsive.height(490),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff'
    // Shadow needs an opaque background on the SAME view to render
    // (iOS computes the shadow from it; Android elevation needs it too).
  },
  // Sits inside the card's padded top-right corner so it reads as part of the
  // card on every aspect ratio, instead of hanging off the corner.
  modalCloseButton: {
    position: 'absolute',
    top: Responsive.height(10),
    right: Responsive.height(10)
  },
  modalCloseIcon: {
    width: Responsive.height(22),
    height: Responsive.height(22)
  },
  modalImage: {
    // full width; height driven by `aspectRatio` (set inline). The wrapper's
    // maxHeight + overflow:'hidden' caps very tall images WITHOUT shrinking width.
    width: '100%',
    borderRadius: BORDER_RADIUS.br12,
    overflow: 'hidden',
    backgroundColor: COLORS.background.primary
  },
  modalUploadedByContainer: {
    marginTop: Responsive.height(12),
    justifyContent: 'center'
  },
  uploadedByLabel: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary
  },
  uploadedByName: {
    ...commonStyles.FontFamily_SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.primary
  },
  deleteIcon: {
    width: Responsive.height(20),
    height: Responsive.height(20)
  }
};

export default ImageUploaderUI;
