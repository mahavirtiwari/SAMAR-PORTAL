import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import { Logger } from '../../utils';
import ImageSyncBadge from '../common/ImageSyncBadge';
import AppFastImage from '../shared/FastImage';

const SiteTourImage = ({ item, onDelete, assessmentId, canDelete }) => {
  const [imageOpen, setImageOpen] = useState(false);
  // Real aspect ratio of the preview image so the modal box matches the
  // image exactly — without this, `contain` letterboxes inside a flex:1
  // box and the metadata footer floats detached below the image.
  const [aspectRatio, setAspectRatio] = useState(1);
  useEffect(() => {
    if (!item?.uri) {
      return;
    }
    Image.getSize(
      item.uri,
      (w, h) => {
        if (w && h) {
          setAspectRatio(w / h);
        }
      },
      err => Logger.warn('Failed to get site tour image size', err),
    );
  }, [item?.uri]);

  // Measure aspect ratio from the actually-loaded image too — Image.getSize()
  // can't fetch auth-protected remote URLs, so onLoad is the reliable source.
  const handleImageLoad = e => {
    const { width, height } = e?.nativeEvent?.source || {};
    if (width > 0 && height > 0) {
      setAspectRatio(width / height);
    }
  };

  // Fit the image box inside 90% x 80% of the screen while preserving the
  // image's aspect ratio — so the FULL image shows (no crop, no letterbox)
  // and the metadata footer stays flush with the image bottom.
  const { width: screenW, height: screenH } = useWindowDimensions();
  const availW = screenW * 0.96;
  const availH = screenH * 0.8;
  const boxW = Math.min(availW, availH * aspectRatio);
  const boxH = boxW / aspectRatio;

  return (
    <View style={{ padding: 16 }}>
      <Text
        style={[
          commonStyles.FontFamily_SemiBold600,
          { marginBottom: 6, fontSize: FONT_SIZE.fs14 },
        ]}>
        {item.title}
      </Text>
      <Pressable onPress={() => setImageOpen(true)} style={styles.uploadedImageClip}>
        {/* Image anchored to the bottom: when it's taller than the fixed clip
            box, the TOP overflows and gets clipped while the bottom stays visible. */}
        <AppFastImage
          uri={item.uri}
          style={[styles.uploadedImage, { aspectRatio }]}
          useImageBackground={true}
          resizeMode="cover"
          onLoad={handleImageLoad}
          borderRadius={BORDER_RADIUS.br12}
        />
        {canDelete && (
          <View style={styles.imageHeader}>
            <Pressable onPress={() => onDelete(item.id)}>
              <Image
                source={Icons.delete}
                style={{
                  height: 20,
                  width: 20,
                  margin: 10,
                }}></Image>
            </Pressable>
          </View>
        )}
        <ImageSyncBadge state={item.syncState} />
      </Pressable>
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
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}>
          <View style={[styles.modalImageWrapper, { width: boxW, height: boxH }]}>
            <AppFastImage
              uri={item.uri}
              useImageBackground={true}
              resizeMode="contain"
              onLoad={handleImageLoad}
              borderRadius={BORDER_RADIUS.br12}
              style={styles.modalImage}></AppFastImage>
            <Pressable
              onPress={() => setImageOpen(false)}
              hitSlop={12}
              style={styles.modalCloseButton}>
              <Image source={Icons.redCross} style={commonStyles.iconSize20}></Image>
            </Pressable>
          </View>
          {/* <Image style={{ width: '90%', height: '70%' }} source={{ uri: image }}></Image> */}
        </View>
      </Modal>
    </View>
  );
};
const styles = {
  uploadedByText: {
    ...commonStyles.FontFamily_Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary,
  },
  // Fixed-height window that clips the image. justifyContent: 'flex-end' pins the
  // image to the bottom; when it's taller than the box, the TOP overflows and
  // overflow: 'hidden' clips it — so the bottom of the photo always stays visible.
  uploadedImageClip: {
    width: '100%',
    height: Responsive.height(150),
    borderRadius: BORDER_RADIUS.br12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#000000',
  },
  uploadedImage: {
    width: '100%',
    // wide/short images still fill the box (no gap above); taller images grow
    // past the box via aspectRatio (set inline) and get clipped at the top
    minHeight: '100%',
    flexShrink: 0,
  },
  imageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'flex-end',
  },
  // width/height set inline from boxW/boxH (aspect-ratio fit of the real image)
  // so the box exactly matches the image — no letterbox, no fixed height.
  modalImageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.br12,
    overflow: 'hidden',
  },
  // Anchored to the image box's top-right corner (equal top/right insets via the
  // same scale) so the cross stays put across any aspect ratio or screen size.
  modalCloseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  modalUploadedByContainer: {
    gap: SPACING.sp4,
    marginTop: Responsive.height(12),
    justifyContent: 'center',
  },
};
export default SiteTourImage;
