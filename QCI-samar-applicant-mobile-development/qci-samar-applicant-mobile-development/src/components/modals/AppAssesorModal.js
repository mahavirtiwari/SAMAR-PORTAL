import Clipboard from '@react-native-clipboard/clipboard';
import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONTS_FAMILY, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import { copyToastConfig, getInitials, Haptic } from '../../utils';

const AppAssesorModal = ({ visible, assessors = [], onClose }) => {
  // The app-root FlashMessage sits behind this native Modal, so the copy toast
  // is fired on this in-modal instance instead (mirrors PointOfContactModal).
  const flashRef = React.useRef(null);

  const copyToClipboard = (textToCopy, label) => {
    if (!textToCopy) {
      return;
    }
    Clipboard.setString(String(textToCopy));
    Haptic.success();
    flashRef.current?.showMessage(copyToastConfig(label));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={commonStyles.h2heading600}>Assessor(s)</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose}>
              <Image source={Icons.closeSquare} style={styles.closeIcon} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.assessorList}
            showsVerticalScrollIndicator={false}>
            {assessors.map((assessor, index) => {
              const isLead = !!assessor.isLead;
              const name = assessor.name || '—';
              const phone =
                assessor.phone || assessor.phoneNumber || assessor.mobile || assessor.mobileNumber;
              const email = assessor.email;
              const accent = isLead ? '#7239EA' : COLORS.primary.main;

              return (
                <View key={assessor.id ?? index} style={styles.assessorCard}>
                  <View style={styles.assessorHeader}>
                    <View style={[styles.avatarRing, { borderColor: accent }]}>
                      <View
                        style={[
                          styles.avatarInner,
                          isLead ? styles.leadAvatarInner : styles.coAssessorAvatarInner,
                        ]}>
                        <Text style={[styles.avatarText, { color: accent }]}>
                          {getInitials(name)}
                        </Text>
                      </View>
                    </View>
                    <View style={commonStyles.fill}>
                      <Text style={commonStyles.bodyLargePrimary600}>{name}</Text>
                      <Text style={styles.assessorRole}>
                        {isLead ? 'LEAD ASSESSOR' : 'CO ASSESSOR'}
                      </Text>
                    </View>
                  </View>
                  {!!phone && (
                    <View style={[styles.contactRow, styles.marginTop24]}>
                      <Image source={Icons.callActive} style={styles.contactIcon} />
                      <Text style={styles.contactText} numberOfLines={1}>
                        +91 {phone}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => copyToClipboard(phone, 'Phone number copied...')}>
                        <Image source={Icons.copy} style={styles.copyContactIcon} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {!!email && (
                    <>
                      <View style={styles.contactDivider} />
                      <View style={styles.contactRow}>
                        <Image source={Icons.smsActive} style={styles.contactIcon} />
                        <Text style={styles.contactText} numberOfLines={1}>
                          {email}
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => copyToClipboard(email, 'Email copied...')}>
                          <Image source={Icons.copy} style={styles.copyContactIcon} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
      {/* Modal-local toast host so copy confirmations render above the Modal.
          Center position mirrors the root + assessor app's copy toast. */}
      <FlashMessage ref={flashRef} position="center" />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.background.modalOverlay,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br20,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  modalHeader: {
    ...commonStyles.rowSpaceBetween,
    alignItems: 'center',
    marginBottom: 16,
  },
  closeIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  assessorList: {
    gap: Responsive.height(16),
  },
  assessorCard: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.br12,
    backgroundColor: COLORS.background.muted,
    borderColor: COLORS.primary.soft,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  assessorHeader: {
    ...commonStyles.row,
    alignItems: 'center',
    gap: SPACING.sp12,
  },
  avatarRing: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.circle,
    borderWidth: 1,
    padding: 1.5,
    backgroundColor: COLORS.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.circle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leadAvatarInner: {
    backgroundColor: '#F3ECFE',
  },
  coAssessorAvatarInner: {
    backgroundColor: COLORS.primary.subtle,
  },
  avatarText: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
  },
  assessorRole: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  contactDivider: {
    height: 1,
    backgroundColor: COLORS.border.dark,
    marginVertical: 12,
  },
  contactRow: {
    ...commonStyles.row,
    alignItems: 'center',
    gap: SPACING.sp4,
  },
  contactIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },
  contactText: {
    flex: 1,
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.primary.main,
  },
  copyContactIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: COLORS.text.tertiary,
  },
  marginTop24: {
    marginTop: Responsive.height(24),
  },
});

export default AppAssesorModal;
