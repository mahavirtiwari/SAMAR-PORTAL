import Clipboard from '@react-native-clipboard/clipboard';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles } from '../../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, SPACING } from '../../assets/theme/Theme';
import Icons from '../../constants/Icons';
import { Logger } from '../../utils/logger';
import { showCopyToast, showInfoToast } from '../../utils/toast';

// Online-assessment meeting link card. Self-contained: the video button opens
// the link, the copy button puts it on the clipboard. Both degrade gracefully
// when no link has been added for the assessment yet.
// Once the assessment is completed there's no longer a live meeting to join,
// so the card can be disabled — the buttons no-op (with a hint) and the card
// is visually muted.
const MeetingLinkCard = ({ meetingLink = '', disabled = false }) => {
  const handleJoin = () => {
    if (disabled) {
      showInfoToast('Assessment Completed', 'The meeting link is no longer available.');
      return;
    }
    if (!meetingLink) {
      showInfoToast(
        'No Meeting Link',
        'A meeting link has not been added for this assessment yet.'
      );
      return;
    }
    Linking.openURL(meetingLink).catch((err) => {
      Logger.error('Failed to open meeting link:', err);
      showInfoToast('Unable to Open', 'Could not open the meeting link.');
    });
  };

  const handleCopy = () => {
    if (disabled) {
      showInfoToast('Assessment Completed', 'The meeting link is no longer available.');
      return;
    }
    if (!meetingLink) {
      showInfoToast(
        'No Meeting Link',
        'A meeting link has not been added for this assessment yet.'
      );
      return;
    }
    Clipboard.setString(meetingLink);
    showCopyToast('Meeting link copied...');
  };

  return (
    <View style={[styles.meetingCard, disabled && styles.meetingCardDisabled]}>
      <View
        style={[
          commonStyles.row,
          styles.info,
          commonStyles.fill,
          { color: COLORS.background.muted }
        ]}>
        <View style={commonStyles.fill}>
          <Text style={[commonStyles.bodyMediumPrimary600]}>Meeting Link</Text>
          <Text style={[commonStyles.bodySmallTertiary500, { marginTop: Responsive.height(2) }]}>
            Join meeting with applicant for online assessment
          </Text>
        </View>
      </View>
      <View style={[commonStyles.row, styles.actions]}>
        <TouchableOpacity onPress={handleJoin} activeOpacity={0.7} disabled={disabled}>
          <Image source={Icons.meetingLink} style={[styles.actionIcon]} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} disabled={disabled}>
          <Image source={Icons.meetingCopy} style={[styles.actionIcon]} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  meetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.muted,
    borderColor: COLORS.primary.soft,
    borderWidth: 1,
    justifyContent: 'space-between',
    gap: SPACING.sp12,
    borderRadius: BORDER_RADIUS.br12,
    padding: Responsive.width(12),
    marginTop: Responsive.height(16)
  },
  meetingCardDisabled: {
    opacity: 0.5
  },
  info: {
    gap: SPACING.sp12,
    alignItems: 'center'
  },
  actions: {
    gap: SPACING.sp8,
    alignItems: 'center'
  },
  actionIcon: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    resizeMode: 'contain'
  }
});

export default MeetingLinkCard;
