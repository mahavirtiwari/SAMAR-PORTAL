import { Platform, StyleSheet } from 'react-native';
import { Responsive } from './Layout';
import { BORDER_RADIUS, BORDER_WIDTH, COLORS, FONT_SIZE, FONTS_FAMILY, SPACING } from './Theme';

/**
 * Typography styles for consistent text styling across the app
 */
export const typography = StyleSheet.create({
  // Font Family
  FontFamily_Thin100: {
    fontFamily: FONTS_FAMILY.Thin100
  },
  FontFamily_UltraLight200: {
    fontFamily: FONTS_FAMILY.UltraLight200
  },
  FontFamily_Light300: {
    fontFamily: FONTS_FAMILY.Light300
  },
  FontFamily_LightItalic300: {
    fontFamily: FONTS_FAMILY.LightItalic300
  },
  FontFamily_Regular400: {
    fontFamily: FONTS_FAMILY.Regular400
  },
  FontFamily_RegularItalic400: {
    fontFamily: FONTS_FAMILY.RegularItalic400
  },
  FontFamily_Medium500: {
    fontFamily: FONTS_FAMILY.Medium500
  },
  FontFamily_MediumItalic500: {
    fontFamily: FONTS_FAMILY.MediumItalic500
  },
  FontFamily_SemiBold600: {
    fontFamily: FONTS_FAMILY.SemiBold600
  },
  FontFamily_Bold700: {
    fontFamily: FONTS_FAMILY.Bold700
  },
  FontFamily_ExtraBold800: {
    fontFamily: FONTS_FAMILY.ExtraBold800
  },
  FontFamily_Heavy900: {
    fontFamily: FONTS_FAMILY.Heavy900
  },
  FontFamily_Black900: {
    fontFamily: FONTS_FAMILY.Black900
  },

  // Heading styles
  // h1_700: {
  //   fontFamily: FONTS_FAMILY.Bold700,
  //   fontSize: FONT_SIZE.fs24,
  //   color: COLORS.text.primary
  // },
  // h1_600: {
  //   fontFamily: FONTS_FAMILY.SemiBold600,
  //   fontSize: FONT_SIZE.fs24,
  //   color: COLORS.text.primary
  // },
  // h2: {
  //   fontFamily: FONTS_FAMILY.SemiBold600,
  //   fontSize: FONT_SIZE.fs22,
  //   color: COLORS.text.primary
  // },
  h1: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs20,
    color: COLORS.text.primary
  },
  h2heading700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.heading
  },
  h2heading600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs18,
    color: COLORS.text.heading
  },

  // Body text styles
  bodyLargeHeading700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.heading
  },
  bodyLargeHeading600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.heading
  },
  bodyLargeHeading500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.heading
  },
  bodyLargeHeading400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.heading
  },
  bodyLargePrimary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary
  },
  bodyLargePrimary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary
  },
  bodyLargePrimary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary
  },
  bodyLargePrimary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.primary
  },
  bodyLargeSecondary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.secondary
  },
  bodyLargeSecondary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.secondary
  },
  bodyLargeSecondary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.secondary
  },
  bodyLargeSecondary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.secondary
  },
  bodyLargeTertiary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.tertiary
  },
  bodyLargeTertiary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.tertiary
  },
  bodyLargeTertiary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.tertiary
  },
  bodyLargeTertiary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.tertiary
  },
  bodyLargeQuaternary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.quaternary
  },
  bodyLargeQuaternary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.quaternary
  },
  bodyLargeQuaternary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.quaternary
  },
  bodyLargeQuaternary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.quaternary
  },
  bodyLargeAccent700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.accent
  },
  bodyLargeAccent600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.accent
  },
  bodyLargeAccent500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.accent
  },
  bodyLargeAccent400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.accent
  },
  bodyLargePlaceholder700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.placeholder
  },
  bodyLargePlaceholder600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.placeholder
  },
  bodyLargePlaceholder500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.placeholder
  },
  bodyLargePlaceholder400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.placeholder
  },
  bodyLargeWhite700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.white
  },
  bodyLargeWhite600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.white
  },
  bodyLargeWhite500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.white
  },
  bodyLargeWhite400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs16,
    color: COLORS.text.white
  },

  bodyMediumHeading700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.heading
  },
  bodyMediumHeading600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.heading
  },
  bodyMediumHeading500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.heading
  },
  bodyMediumHeading400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.heading
  },
  bodyMediumPrimary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary
  },
  bodyMediumPrimary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary
  },
  bodyMediumPrimary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary
  },
  bodyMediumPrimary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.primary
  },
  bodyMediumSecondary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.secondary
  },
  bodyMediumSecondary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.secondary
  },
  bodyMediumSecondary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.secondary
  },
  bodyMediumSecondary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.secondary
  },
  bodyMediumTertiary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary
  },
  bodyMediumTertiary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary
  },
  bodyMediumTertiary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary
  },
  bodyMediumTertiary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.tertiary
  },
  bodyMediumQuaternary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.quaternary
  },
  bodyMediumQuaternary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.quaternary
  },
  bodyMediumQuaternary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.quaternary
  },
  bodyMediumQuaternary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.quaternary
  },
  bodyMediumAccent700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.accent
  },
  bodyMediumAccent600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.accent
  },
  bodyMediumAccent500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.accent
  },
  bodyMediumAccent400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.accent
  },
  bodyMediumPlaceholder700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.placeholder
  },
  bodyMediumPlaceholder600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.placeholder
  },
  bodyMediumPlaceholder500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.placeholder
  },
  bodyMediumPlaceholder400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.placeholder
  },
  bodyMediumWhite700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.white
  },
  bodyMediumWhite600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.white
  },
  bodyMediumWhite500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.white
  },
  bodyMediumWhite400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs14,
    color: COLORS.text.white
  },

  bodySmallHeading700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.heading
  },
  bodySmallHeading600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.heading
  },
  bodySmallHeading500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.heading
  },
  bodySmallHeading400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.heading
  },
  bodySmallPrimary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.primary
  },
  bodySmallPrimary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.primary
  },
  bodySmallPrimary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.primary
  },
  bodySmallPrimary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.primary
  },
  bodySmallSecondary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.secondary
  },
  bodySmallSecondary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.secondary
  },
  bodySmallSecondary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.secondary
  },
  bodySmallSecondary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.secondary
  },
  bodySmallTertiary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary
  },
  bodySmallTertiary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary
  },
  bodySmallTertiary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary
  },
  bodySmallTertiary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary
  },
  bodySmallQuaternary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.quaternary
  },
  bodySmallQuaternary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.quaternary
  },
  bodySmallQuaternary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.quaternary
  },
  bodySmallQuaternary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.quaternary
  },
  bodySmallAccent700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.accent
  },
  bodySmallAccent600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.accent
  },
  bodySmallAccent500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.accent
  },
  bodySmallAccent400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.accent
  },
  bodySmallPlaceholder700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.placeholder
  },
  bodySmallPlaceholder600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.placeholder
  },
  bodySmallPlaceholder500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.placeholder
  },
  bodySmallPlaceholder400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.placeholder
  },
  bodySmallWhite700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.white
  },
  bodySmallWhite600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.white
  },
  bodySmallWhite500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.white
  },
  bodySmallWhite400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.white
  },

  bodyXSmallHeading700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.heading
  },
  bodyXSmallHeading600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.heading
  },
  bodyXSmallHeading500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.heading
  },
  bodyXSmallHeading400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.heading
  },
  bodyXSmallPrimary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.primary
  },
  bodyXSmallPrimary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.primary
  },
  bodyXSmallPrimary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.primary
  },
  bodyXSmallPrimary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.primary
  },
  bodyXSmallSecondary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.secondary
  },
  bodyXSmallSecondary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.secondary
  },
  bodyXSmallSecondary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.secondary
  },
  bodyXSmallSecondary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.secondary
  },
  bodyXSmallTertiary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.tertiary
  },
  bodyXSmallTertiary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.tertiary
  },
  bodyXSmallTertiary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.tertiary
  },
  bodyXSmallTertiary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.tertiary
  },
  bodyXSmallQuaternary700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.quaternary
  },
  bodyXSmallQuaternary600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.quaternary
  },
  bodyXSmallQuaternary500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.quaternary
  },
  bodyXSmallQuaternary400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.quaternary
  },
  bodyXSmallAccent700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.accent
  },
  bodyXSmallAccent600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.accent
  },
  bodyXSmallAccent500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.accent
  },
  bodyXSmallAccent400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.accent
  },
  bodyXSmallPlaceholder700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.placeholder
  },
  bodyXSmallPlaceholder600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.placeholder
  },
  bodyXSmallPlaceholder500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.placeholder
  },
  bodyXSmallPlaceholder400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.placeholder
  },
  bodyXSmallWhite700: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.white
  },
  bodyXSmallWhite600: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.white
  },
  bodyXSmallWhite500: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.white
  },
  bodyXSmallWhite400: {
    fontFamily: FONTS_FAMILY.Regular400,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.text.white
  },

  // Special style for error messages
  error: {
    paddingTop: Responsive.height(2),
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: FONT_SIZE.fs10,
    color: COLORS.status.danger
  },
  errormsg: {
    paddingLeft: Responsive.width(35)
  },
  abstrickerrormsg: {
    paddingLeft: Responsive.width(41)
  }
});

/**
 * Layout styles for consistent component layouts
 **/
export const layout = StyleSheet.create({
  // Flexbox containers
  container: {
    flex: 1
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  column: {
    flexDirection: 'column'
  },
  textCenter: {
    textAlign: 'center'
  },
  alignItems: {
    alignItems: 'center'
  },
  columnCenter: {
    flexDirection: 'column',
    alignItems: 'center'
  },
  columnSpaceBetween: {
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  justifyContentFlexEnd: {
    justifyContent: 'flex-end'
  },
  alignItemsFlexStart: {
    alignItems: 'flex-start'
  },
  flexWrapWrap: {
    flexWrap: 'wrap'
  },
  textTransform: {
    textTransform: 'uppercase'
  },
  flexDirectionRow: { flexDirection: 'row' },
  italicFont: { fontStyle: 'italic' },
  normalFont: { fontStyle: 'normal' },

  // Common containers
  fill: {
    flex: 1
  },
  fullWidth: {
    width: '100%'
  },
  fillGrow: {
    flexGrow: 1
  },

  // Spacing helpers
  marginSm: {
    margin: SPACING.sp8
  },
  marginMd: {
    margin: SPACING.sp16
  },
  marginLg: {
    margin: SPACING.sp24
  },
  paddingSm: {
    padding: SPACING.sp8
  },
  paddingMd: {
    padding: SPACING.sp16
  },
  paddingLg: {
    padding: SPACING.sp24
  },

  // Position helpers
  relative: {
    position: 'relative'
  },
  absolute: {
    position: 'absolute'
  },

  textAlign: {
    textAlign: 'center'
  },

  // Other helpers style
  resizeMode: {
    resizeMode: 'contain'
  },
  lineThrough: {
    textDecorationLine: 'line-through'
  },
  iconSize12: {
    width: Responsive.width(12),
    height: Responsive.height(12),
    resizeMode: 'contain'
  },
  iconSize15: {
    width: Responsive.width(15),
    height: Responsive.height(15),
    resizeMode: 'contain'
  },
  iconSize14: {
    width: Responsive.width(14),
    height: Responsive.height(14),
    resizeMode: 'contain'
  },
  iconSize16: {
    width: Responsive.width(16),
    height: Responsive.height(16),
    resizeMode: 'contain'
  },
  iconSize18: {
    width: Responsive.width(18),
    height: Responsive.height(18),
    resizeMode: 'contain'
  },
  iconSize20: {
    width: Responsive.width(20),
    height: Responsive.height(20),
    resizeMode: 'contain'
  },
  iconSize21: {
    width: Responsive.width(21),
    height: Responsive.height(21),
    resizeMode: 'contain'
  },
  iconSize24: {
    width: Responsive.width(24),
    height: Responsive.height(24),
    resizeMode: 'contain'
  },
  iconSize30: {
    width: Responsive.width(30),
    height: Responsive.height(30),
    resizeMode: 'contain'
  },
  iconSize35: {
    width: Responsive.width(35),
    height: Responsive.height(35),
    resizeMode: 'contain'
  },
  iconSize40: {
    width: Responsive.width(40),
    height: Responsive.height(40),
    resizeMode: 'contain'
  },

  opacity: {
    opacity: 0.6
  },
  opacity1: {
    opacity: 1
  },
  dot: {
    backgroundColor: COLORS.text.placeholder,
    borderRadius: BORDER_RADIUS.br4,
    height: 4,
    marginHorizontal: Responsive.width(4),
    width: 4
  },
  padding16: { paddingHorizontal: Responsive.width(16), paddingVertical: Responsive.height(16) },
  margin16: { marginHorizontal: Responsive.width(16), marginVertical: Responsive.height(16) },
  paddingHorizontal16: { paddingHorizontal: Responsive.width(16) },
  marginHorizontal16: { marginHorizontal: Responsive.width(16) },
  paddingVertical16: { paddingVertical: Responsive.height(16) },
  padding15: { paddingHorizontal: Responsive.width(15), paddingVertical: Responsive.height(15) },
  paddingHorizontal15: { paddingHorizontal: Responsive.width(15) },
  marginHorizontal15: { marginHorizontal: Responsive.width(15) },
  paddingVertical15: { paddingVertical: Responsive.height(15) }
});

/**
 * Component styles for consistent component styling
 */
export const components = StyleSheet.create({
  // Card styles
  cardFlatlistWithMargin: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br20,
    paddingVertical: Responsive.height(10),
    paddingHorizontal: Responsive.height(10),
    marginHorizontal: Responsive.width(20),
    marginTop: Responsive.height(20)
  },
  cardFlatlist: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br20,
    paddingHorizontal: Responsive.height(20),
    paddingVertical: Responsive.height(20)
  },
  cardForm: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br20,
    paddingHorizontal: Responsive.height(20),
    paddingVertical: Responsive.height(10)
  },
  card: {
    backgroundColor: COLORS.background.primary,
    borderRadius: BORDER_RADIUS.br20,
    paddingVertical: Responsive.height(15),
    paddingHorizontal: Responsive.width(20)
  },
  // Bottom Button group styles
  buttonContainer: {
    backgroundColor: COLORS.background.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Platform.select({
      ios: Responsive.height(20),
      android: Responsive.height(15)
    }),
    paddingHorizontal: Responsive.width(20),
    paddingTop: Responsive.height(15)
  },

  // Dropdown styling
  dropdownContainer: {
    alignItems: 'center',
    // width: '100%',
    flexDirection: 'row',
    minHeight: Responsive.height(55)
  },
  dropdownIconContainer: {
    flexDirection: 'row',
    marginRight: Responsive.width(12),
    width: 'auto',
    justifyContent: 'center'
  },
  dropdownIcon: {
    height: Responsive.height(20),
    resizeMode: 'contain',
    width: Responsive.width(20)
  },
  dropdownTouchable: {
    borderBottomColor: COLORS.border.borderRegular,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    minHeight: Responsive.height(55)
  },
  dropdownText: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: 16,
    color: COLORS.text.placeholder
  },
  dropdownDarkText: {
    fontFamily: FONTS_FAMILY.Medium500,
    fontSize: 16,
    color: COLORS.text.secondary
  },
  dropdownBoldText: {
    fontFamily: FONTS_FAMILY.Bold700,
    fontSize: 16,
    color: COLORS.text.secondary
  },
  dropdownArrow: {
    width: Responsive.width(10.5),
    resizeMode: 'contain',
    tintColor: COLORS.text.accent
  },
  tagItem: {
    paddingRight: Responsive.width(12),
    paddingLeft: Responsive.width(12),
    height: Responsive.height(22),
    marginRight: Responsive.width(5),
    alignItems: 'center',
    borderRadius: 90,
    flexDirection: 'row',
    backgroundColor: COLORS.info.info200
  },
  tagIcon: {
    height: Responsive.height(15),
    width: Responsive.width(15),
    resizeMode: 'contain',
    marginRight: Responsive.width(5)
  },
  tagText: {
    fontFamily: FONTS_FAMILY.SemiBold600,
    fontSize: 10,
    color: COLORS.info.info400
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top'
  },
  descriptionContainer: {
    alignItems: 'flex-start',
    paddingTop: Platform.OS === 'android' ? Responsive.height(6) : Responsive.height(12)
  },
  descriptionIcon: {
    marginTop: Platform.OS === 'ios' ? Responsive.height(3) : Responsive.height(10)
  },
  lineContainer: {
    alignSelf: 'flex-end',
    height: Responsive.height(1),
    marginBottom: -1,
    marginVertical: Responsive.height(0),
    width: '87%'
  },
  bottomBorder: {
    flex: 1,
    resizeMode: 'cover',
    width: '100%'
  },

  // Input styles
  input: {
    height: 45,
    borderWidth: BORDER_WIDTH.borderWidth.thin,
    borderColor: COLORS.border.main,
    borderRadius: BORDER_RADIUS.br10,
    paddingHorizontal: SPACING.sp14,
    backgroundColor: COLORS.background.primary,
    color: COLORS.text.secondary,
    fontFamily: FONTS_FAMILY.FontFamily_Medium,
    fontSize: FONT_SIZE.fs10
  },
  label: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    color: COLORS.text.primary,
    fontSize: 14,
    fontFamily: FONTS_FAMILY.medium
  },
  rbSheetHeader: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.main,
    paddingBottom: Responsive.height(SPACING.sp16),
    marginBottom: Responsive.height(SPACING.sp16),
    paddingHorizontal: Responsive.width(SPACING.sp16),
    flexDirection: 'row'
  },
  backgroundColor: {
    backgroundColor: COLORS.background.secondary
  },
  statusBarGap: {
    paddingTop: Platform.select({
      ios: 60,
      android: 50
    })
  }
});

/**
 * Combined common styles
 */
export const commonStyles = StyleSheet.create({
  ...typography,
  ...layout,
  ...components
});
