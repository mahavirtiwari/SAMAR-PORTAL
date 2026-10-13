import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { commonStyles } from '../../assets/theme/Styles';
import {
  BORDER_RADIUS,
  BORDER_WIDTH,
  COLORS,
  FONT_SIZE,
  FONTS_FAMILY,
  SPACING
} from '../../assets/theme/Theme';
import { Haptic } from '../../utils/hapticUtils';

const AppButton = ({
  title,
  onPress,
  size = 'medium',
  variant = 'primary',
  disabled = false,
  width,
  progressDuration,
  customColors = {},
  backgroundColor,
  icon = false,
  iconStyle,
  textColor,
  loader = false
}) => {
  const animation = useRef(new Animated.Value(0)).current;
  const [buttonWidth, setButtonWidth] = useState(0);

  useEffect(() => {
    if (progressDuration) {
      animation.setValue(0);
      Animated.timing(animation, {
        toValue: 1,
        duration: progressDuration * 1000,
        useNativeDriver: false
      }).start();
    }
  }, [progressDuration, animation]);

  const buttonStyles = [
    styles.baseButton,
    styles[size],
    styles[variant],
    width && { width },
    progressDuration && { overflow: 'hidden' },
    disabled ? { backgroundColor: '#C4CADA' } : backgroundColor && { backgroundColor },
    variant === 'outline' &&
      !disabled && {
        backgroundColor: backgroundColor || customColors.background || COLORS.background.primary,
        borderColor: customColors.border || COLORS.primary.main,
        borderWidth: BORDER_WIDTH.borderWidth.thin
      }
  ];

  const textStyles = [
    styles.baseText,
    styles[`${size}Text`],
    styles[`${variant}Text`],
    disabled ? { color: COLORS.text.white } : null,
    variant === 'outline' && !disabled && { color: customColors.text || COLORS.primary.main },
    !disabled && textColor && { color: textColor }
  ];

  const animatedWidth = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, buttonWidth]
  });

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={(e) => {
        Haptic.light();
        onPress?.(e);
      }}
      activeOpacity={0.7}
      disabled={disabled}
      onLayout={(event) => setButtonWidth(event.nativeEvent.layout.width)}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={title}>
      {progressDuration && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: COLORS.primary.soft,
              width: animatedWidth,
              borderRadius: styles[size].borderRadius
            }
          ]}
        />
      )}
      <View style={[commonStyles.rowCenter, { gap: SPACING.sp6 }]}>
        {icon && <Image source={icon} style={[commonStyles.iconSize20, iconStyle]} />}
        {loader ? (
          <ActivityIndicator color={textColor || COLORS.text.white} />
        ) : (
          <Text style={textStyles}>{title}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

AppButton.propTypes = {
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  size: PropTypes.oneOf(['large', 'medium', 'small']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'outline', 'soft']),
  disabled: PropTypes.bool,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  progressDuration: PropTypes.number,
  customColors: PropTypes.shape({
    background: PropTypes.string,
    border: PropTypes.string,
    text: PropTypes.string
  }),
  backgroundColor: PropTypes.string,
  icon: PropTypes.any,
  iconStyle: PropTypes.any,
  textColor: PropTypes.string
};

const styles = StyleSheet.create({
  baseButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.sp10,
    paddingHorizontal: SPACING.sp4,
    borderRadius: BORDER_RADIUS.br8
  },

  // Size styles
  large: {
    borderRadius: BORDER_RADIUS.br10,
    height: 55
  },
  medium: {
    height: 45,
    borderRadius: BORDER_RADIUS.br8
  },
  small: {
    height: 35,
    borderRadius: BORDER_RADIUS.br6
  },

  // Variant button colors
  primary: {
    backgroundColor: COLORS.button.primary
  },
  secondary: {
    backgroundColor: COLORS.status.successBackground
  },
  danger: {
    backgroundColor: COLORS.button.danger
  },
  outline: {
    backgroundColor: COLORS.background.primary,
    borderColor: COLORS.primary.main,
    borderWidth: BORDER_WIDTH.borderWidth.thin
  },
  // Light filled "secondary action" look (e.g. Cancel beside a primary button):
  // soft blue fill, primary-blue text, no border.
  soft: {
    backgroundColor: COLORS.primary.soft
  },

  disabledButton: {
    backgroundColor: COLORS.button.disabled
  },

  // Base text styles
  baseText: {
    fontFamily: FONTS_FAMILY.Medium500,
    textAlign: 'center'
  },

  // Text size styles
  largeText: {
    fontSize: FONT_SIZE.fs16,
    fontFamily: FONTS_FAMILY.Bold700
  },
  mediumText: {
    fontSize: FONT_SIZE.fs14,
    fontFamily: FONTS_FAMILY.Bold700
  },
  smallText: {
    fontSize: FONT_SIZE.fs12,
    fontFamily: FONTS_FAMILY.Bold700
  },

  // Text color styles
  primaryText: {
    color: COLORS.text.white
  },
  secondaryText: {
    color: COLORS.text.white
  },
  dangerText: {
    color: COLORS.text.white
  },
  outlineText: {
    color: COLORS.text.primary
  },
  softText: {
    color: COLORS.primary.main
  },
  disabledText: {
    color: COLORS.text.tertiary
  }
});

export default AppButton;
