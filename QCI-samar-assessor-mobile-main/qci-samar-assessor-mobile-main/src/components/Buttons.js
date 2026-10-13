import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Responsive } from '../assets/theme/Layout';
import { commonStyles } from '../assets/theme/Styles';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONTS } from '../assets/theme/Theme';

/**
 * Primary application button
 */
export default function ApplicationButton({
  onPress,
  content,
  buttonStyle,
  disabled,
  buttonTextStyle
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, buttonStyle]}>
      <Text style={[styles.buttonText, buttonTextStyle]}>{content}</Text>
      {/* <Text style={{ color: '#fff' }}>{content}</Text> */}
    </TouchableOpacity>
  );
}

/**
 * Secondary/View More button
 */
export function ApplicationViewMoreButton({ onPress, content, buttonStyle }) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={[styles.buttonViewMore, buttonStyle]}>
      <Text style={styles.buttonTextViewMore}>{content}</Text>
    </TouchableOpacity>
  );
}

/**
 * Outline button
 */
export function ApplicationOutlineButton({ onPress, content, buttonStyle, textstyle }) {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={onPress}
      style={[styles.outlinebutton, buttonStyle]}>
      <Text style={[styles.outlineButtonText, textstyle]}>{content}</Text>
    </TouchableOpacity>
  );
}

/**
 * Disabled button
 */
export function ApplicationDisableButton({ onPress, content, buttonStyle }) {
  return (
    <TouchableOpacity
      disabled
      activeOpacity={0.5}
      onPress={onPress}
      style={[styles.disabledButton, buttonStyle]}>
      <Text style={styles.buttonText}>{content}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    ...commonStyles.buttonPrimary
  },
  buttonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.xl,
    letterSpacing: 1
  },
  buttonTextViewMore: {
    color: COLORS.primary.main,
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZE.sm,
    letterSpacing: 0.5
  },
  buttonViewMore: {
    backgroundColor: COLORS.primary.light,
    borderRadius: BORDER_RADIUS.pill,
    height: Responsive.height(35),
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingBottom: Platform.OS === 'android' ? Responsive.height(2) : 0
  },
  disabledButton: {
    ...commonStyles.buttonDisabled
  },
  outlineButtonText: {
    color: COLORS.primary.main,
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZE.xl,
    letterSpacing: 1
  },
  outlinebutton: {
    ...commonStyles.buttonSecondary
  }
});
