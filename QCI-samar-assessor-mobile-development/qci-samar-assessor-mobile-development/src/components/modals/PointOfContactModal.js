import Clipboard from '@react-native-clipboard/clipboard';
import { useRef } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import { formatIndianPhoneNumber } from '../../utils';
import { Haptic } from '../../utils/hapticUtils';
import { copyToastConfig } from '../../utils/toast';

const PointOfContactModal = ({ visible, onClose, contactPerson }) => {
  // The app-root FlashMessage sits behind this native Modal, so the copy toast
  // is fired on this in-modal instance instead (mirrors SiteTourPickerModal).
  const flashRef = useRef(null);

  const copyToClipboard = (textToCopy, label) => {
    Clipboard.setString(textToCopy);
    Haptic.success();
    flashRef.current?.showMessage(copyToastConfig(label));
  };
  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.pocBackdrop} onPress={onClose}>
        <Pressable style={styles.pocSheet} onPress={() => undefined}>
          <View style={[commonStyles.rowSpaceBetween, { alignItems: 'center' }]}>
            <Text
              style={[
                commonStyles.FontFamily_SemiBold600,
                { fontSize: FONT_SIZE.fs18, color: COLORS.text.heading }
              ]}>
              Point Of Contact
            </Text>
            <TouchableOpacity style={styles.pocClose} onPress={onClose} activeOpacity={0.6}>
              <Image source={Icons.close} style={[commonStyles.iconSize24]} />
            </TouchableOpacity>
          </View>

          <View style={styles.pocCard}>
            <View style={[commonStyles.row, { gap: SPACING.sp12, alignItems: 'center' }]}>
              <View style={[commonStyles.center]}>
                <Image source={Icons.PocUser} style={[commonStyles.iconSize35]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[commonStyles.bodyLargeHeading600]}>
                  {contactPerson?.contactPersonName || '—'}
                </Text>
                {!!contactPerson?.contactPersonDesignation && (
                  <Text
                    style={[
                      commonStyles.bodyXSmallTertiary700,
                      commonStyles.textTransform,
                      { marginTop: Responsive.height(2) }
                    ]}>
                    {contactPerson.contactPersonDesignation}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.pocDivider} />

            {!!contactPerson?.contactPersonMobile && (
              <View style={[commonStyles.row, { gap: SPACING.sp8, alignItems: 'center' }]}>
                <Image source={Icons.callActive} style={[commonStyles.iconSize16]} />
                <View style={[commonStyles.rowSpaceBetween, { flex: 1, alignItems: 'center' }]}>
                  <Text style={[commonStyles.bodySmallSecondary500]}>
                    {formatIndianPhoneNumber(contactPerson.contactPersonMobile)}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      copyToClipboard(contactPerson.contactPersonMobile, 'Phone number copied...')
                    }
                    activeOpacity={0.6}>
                    <Image source={Icons.copy} style={[commonStyles.iconSize16]} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!!contactPerson?.contactPersonEmail && (
              <View
                style={[
                  commonStyles.row,
                  { gap: SPACING.sp8, alignItems: 'center', marginTop: Responsive.height(10) }
                ]}>
                <Image source={Icons.smsActive} style={[commonStyles.iconSize16]} />
                <View style={[commonStyles.rowSpaceBetween, { flex: 1, alignItems: 'center' }]}>
                  <Text
                    style={[commonStyles.bodySmallSecondary500, { flexShrink: 1 }]}
                    numberOfLines={1}
                    onPress={() =>
                      copyToClipboard(contactPerson.contactPersonEmail, 'Email copied...')
                    }>
                    {contactPerson.contactPersonEmail}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      copyToClipboard(contactPerson.contactPersonEmail, 'Email copied...')
                    }
                    activeOpacity={0.6}>
                    <Image source={Icons.copy} style={[commonStyles.iconSize16]} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
      {/* In-modal toast host — the app-root FlashMessage is behind this Modal.
          Use the same center position as the root so it matches the meeting-link toast. */}
      <FlashMessage ref={flashRef} position="center" />
    </Modal>
  );
};

export default PointOfContactModal;

const styles = StyleSheet.create({
  pocBackdrop: {
    flex: 1,
    backgroundColor: COLORS.background.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Responsive.width(20)
  },
  pocSheet: {
    width: '100%',
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br20,
    paddingTop: Responsive.width(14),
    paddingHorizontal: Responsive.width(20),
    paddingBottom: Responsive.height(20),
    gap: Responsive.height(16)
  },
  pocClose: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    borderRadius: Responsive.width(14),
    backgroundColor: COLORS.background.accent,
    ...commonStyles.center
  },
  pocCard: {
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: BORDER_RADIUS.br12,
    backgroundColor: COLORS.primary.ghost,
    padding: Responsive.width(16)
  },
  pocDivider: {
    height: 1,
    backgroundColor: COLORS.border.light,
    marginVertical: Responsive.height(12)
  }
});
