import { Platform } from 'react-native';
import { Responsive } from './Layout';

/**
 * Base color palette
 * (Updated according to new design system)
 */
const PALETTE = {
  // Primary shades
  primary: '#3D8BFD',
  primaryDark: '#9EC5FE',
  primaryMedium: '#9DC6FE',
  primarySoft: '#E2EEFF',
  primaryPale: '#D8E8FF',
  primaryFaint: '#E2EEFF',
  primarySubtle: '#ECF3FF',
  primaryGhost: '#F5F9FF',

  // Text & Heading
  heading: '#071437',
  font1: '#252F4A',
  font2: '#4B5675',
  font3: '#78829D',
  font4: '#99A1B7',
  font5: '#C4CADA',

  // Neutral & Background
  outline: '#EBEDF3',
  background: '#F5F6FA',
  white: '#FFFFFF',

  // Info colors (Blue variants)
  infoPrimary: '#1B84FF',
  infoActive: '#056EE9',
  infoClarity: '#D1E6FF',
  infoLight: '#EFF6FF',

  // Success colors (Green variants)
  successPrimary: '#17C653',
  successActive: '#04B440',
  successClarity: '#D1F4DD',
  successLight: '#EAFFF1',

  // Warning colors (Orange/Yellow variants)
  warningPrimary: '#F6B100',
  warningActive: '#DFA000',
  warningClarity: '#FDEFCC',
  warningLight: '#FFF8DD',

  // Error colors (Red/Pink variants)
  errorPrimary: '#F8285A',
  errorActive: '#D81A48',
  errorClarity: '#FED4DE',
  errorLight: '#FFEEF3',

  // Shadow & overlays
  shadow: 'rgba(0, 0, 0, 0.2)',
  modalOverlay: '#646464E6',
  modalBackdrop: '#00000080'
};

/**
 * Semantic color system
 * Use these in components rather than direct hex values
 */
export const COLORS = {
  background: {
    primary: PALETTE.white,
    secondary: PALETTE.background,
    accent: PALETTE.outline,
    muted: PALETTE.primaryGhost,
    modalOverlay: PALETTE.modalOverlay,
    modalBackdrop: PALETTE.modalBackdrop
  },
  primary: {
    main: PALETTE.primary,
    dark: PALETTE.primaryDark,
    medium: PALETTE.primaryMedium,
    soft: PALETTE.primarySoft,
    pale: PALETTE.primaryPale,
    faint: PALETTE.primaryFaint,
    subtle: PALETTE.primarySubtle,
    ghost: PALETTE.primaryGhost,
    light: PALETTE.primarySoft,
    darkVariant: PALETTE.primaryDark
  },
  text: {
    heading: PALETTE.heading,
    primary: PALETTE.font1,
    secondary: PALETTE.font2,
    tertiary: PALETTE.font3,
    quaternary: PALETTE.font4,
    accent: PALETTE.font4,
    placeholder: PALETTE.font5,
    disabled: PALETTE.font5,
    white: PALETTE.white,
    inverse: PALETTE.white
  },
  font: {
    dark: PALETTE.font1,
    medium: PALETTE.font2,
    regular: PALETTE.font3,
    light: PALETTE.font4,
    pale: PALETTE.font5
  },
  info: {
    main: PALETTE.infoPrimary,
    primary: PALETTE.infoPrimary,
    active: PALETTE.infoActive,
    clarity: PALETTE.infoClarity,
    light: PALETTE.infoLight
  },
  success: {
    main: PALETTE.successPrimary,
    primary: PALETTE.successPrimary,
    active: PALETTE.successActive,
    clarity: PALETTE.successClarity,
    light: PALETTE.successLight
  },
  warning: {
    main: PALETTE.warningPrimary,
    primary: PALETTE.warningPrimary,
    active: PALETTE.warningActive,
    clarity: PALETTE.warningClarity,
    light: PALETTE.warningLight
  },
  error: {
    main: PALETTE.errorPrimary,
    primary: PALETTE.errorPrimary,
    active: PALETTE.errorActive,
    clarity: PALETTE.errorClarity,
    light: PALETTE.errorLight
  },
  button: {
    primary: PALETTE.primary,
    secondary: PALETTE.primaryDark,
    tertiary: PALETTE.outline,
    danger: PALETTE.errorPrimary,
    success: PALETTE.successPrimary,
    warning: PALETTE.warningPrimary,
    info: PALETTE.infoPrimary,
    disabledPrimary: PALETTE.primaryPale,
    disabledSecondary: PALETTE.outline,
    disabled: PALETTE.outline
  },
  border: {
    regular: PALETTE.outline,
    light: PALETTE.primarySubtle,
    medium: PALETTE.primaryPale,
    dark: PALETTE.primarySoft,
    focus: PALETTE.primary,
    primary: PALETTE.primary,
    success: PALETTE.successPrimary,
    warning: PALETTE.warningPrimary,
    error: PALETTE.errorPrimary,
    info: PALETTE.infoPrimary
  },
  icon: {
    primary: PALETTE.primary,
    secondary: PALETTE.font3,
    tertiary: PALETTE.font4,
    highlight: PALETTE.primary,
    disabled: PALETTE.font5,
    inverse: PALETTE.white
  },
  status: {
    success: PALETTE.successPrimary,
    successBackground: PALETTE.successLight,
    successText: PALETTE.successPrimary,
    warning: PALETTE.warningPrimary,
    warningBackground: PALETTE.warningLight,
    warningText: PALETTE.warningPrimary,
    danger: PALETTE.errorPrimary,
    error: PALETTE.errorPrimary,
    errorBackground: PALETTE.errorLight,
    errorText: PALETTE.errorPrimary,
    info: PALETTE.infoPrimary,
    infoBackground: PALETTE.infoLight,
    infoText: PALETTE.infoPrimary
  },
  surface: {
    primary: PALETTE.white,
    secondary: PALETTE.background,
    tertiary: PALETTE.outline,
    elevated: PALETTE.white
  }
};

/**
 * Font families for cross-platform typography
 */
export const FONTS_FAMILY = {
  Thin100: Platform.select({
    android: 'Gilroy-Thin',
    ios: 'Gilroy-Thin'
  }),
  UltraLight200: Platform.select({
    android: 'Gilroy-UltraLight',
    ios: 'Gilroy-UltraLight'
  }),
  Light300: Platform.select({
    android: 'Gilroy-Light',
    ios: 'Gilroy-Light'
  }),
  LightItalic300: Platform.select({
    android: 'Gilroy-LightItalic',
    ios: 'Gilroy-LightItalic'
  }),
  Regular400: Platform.select({
    android: 'Gilroy-Regular',
    ios: 'Gilroy-Regular'
  }),
  RegularItalic400: Platform.select({
    android: 'Gilroy-RegularItalic',
    ios: 'Gilroy-RegularItalic'
  }),
  Medium500: Platform.select({
    android: 'Gilroy-Medium',
    ios: 'Gilroy-Medium'
  }),
  MediumItalic500: Platform.select({
    android: 'Gilroy-MediumItalic',
    ios: 'Gilroy-MediumItalic'
  }),
  SemiBold600: Platform.select({
    android: 'Gilroy-SemiBold',
    ios: 'Gilroy-SemiBold'
  }),
  Bold700: Platform.select({
    android: 'Gilroy-Bold',
    ios: 'Gilroy-Bold'
  }),
  ExtraBold800: Platform.select({
    android: 'Gilroy-ExtraBold',
    ios: 'Gilroy-ExtraBold'
  }),
  Heavy900: Platform.select({
    android: 'Gilroy-Heavy',
    ios: 'Gilroy-Heavy'
  }),
  Black900: Platform.select({
    android: 'Gilroy-Black',
    ios: 'Gilroy-Black'
  })
};

export const FONTS = FONTS_FAMILY;

/**
 * Border widths
 */
export const BORDER_WIDTH = {
  borderWidth: {
    thin: 1,
    medium: 2,
    thick: 3,
    extraThick: 4
  }
};

/**
 * Spacing system
 */
export const SPACING = {
  sp2: 2,
  sp4: 4,
  sp6: 6,
  sp8: 8,
  sp10: 10,
  sp12: 12,
  sp14: 14,
  sp15: 15,
  sp16: 16,
  sp18: 18,
  sp20: 20,
  sp22: 22,
  sp24: 24,
  sp26: 26,
  sp28: 28,
  sp30: 30,
  sp32: 32,
  sp34: 34,
  sp36: 36,
  sp38: 38,
  sp40: 40,
  sp42: 42,
  sp44: 44,
  sp46: 46,
  sp48: 48,
  sp50: 50,
  sp60: 60
};

/**
 * Border radius values
 */
export const BORDER_RADIUS = {
  br2: 2,
  br4: 4,
  br6: 6,
  br8: 8,
  br10: 10,
  br12: 12,
  br14: 14,
  br16: 16,
  br18: 18,
  br20: 20,
  br30: 30,
  pill: 50,
  circle: 1000
};

/**
 * Font sizes
 */
export const FONT_SIZE = {
  fs10: 10,
  fs12: 12,
  fs14: 14,
  fs16: 16,
  fs18: 18,
  fs20: 20,
  fs22: 22,
  fs24: 24,
  fs26: 26,
  fs28: 28,
  fs30: 30,
  fs32: 32,
  fs34: 34,
  fs36: 36,
  fs38: 38,
  fs40: 40,
  fs42: 42,
  fs44: 44
};

/**
 * Shadows
 */
export const SHADOWS = {
  primaryShadow: {
    ...Platform.select({
      ios: {
        shadowColor: PALETTE.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 20
      },
      android: {
        elevation: 10,
        shadowColor: PALETTE.shadow,
        borderRadius: 20
      }
    })
  },
  secondaryShadow: {
    ...Platform.select({
      ios: {
        shadowColor: PALETTE.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 16
      },
      android: {
        shadowColor: PALETTE.shadow,
        elevation: 15,
        borderRadius: 16,
        shadowOffset: { width: 10, height: 4 }
      }
    })
  }
};

/**
 * Navigation styles
 */
export const NAVIGATION = {
  tabs: {
    bottom: {
      style: {
        height: Platform.select({ ios: 75, android: 75 }),
        paddingTop: 5,
        backgroundColor: COLORS.background.primary,
        borderTopWidth: 0
      },
      iconStyle: {
        height: Responsive.height(45),
        width: Responsive.width(45),
        marginTop: Responsive.height(20),
        resizeMode: 'contain'
      }
    },
    top: {
      underline: {
        style: {},
        indicatorStyle: {
          borderBottomColor: COLORS.primary.dark,
          borderBottomWidth: BORDER_WIDTH.borderWidth.thick
        }
      },
      pill: {
        style: {
          alignSelf: 'center',
          backgroundColor: COLORS.background.secondary,
          borderRadius: BORDER_RADIUS.pill,
          borderWidth: 0,
          height: 'auto',
          width: '88%',
          elevation: 0
        },
        indicatorStyle: {
          backgroundColor: COLORS.primary.dark,
          borderRadius: BORDER_RADIUS.pill,
          height: '100%',
          position: 'absolute',
          zIndex: -1
        }
      }
    }
  }
};

const appTheme = {
  COLORS,
  FONTS_FAMILY,
  FONT_SIZE,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  BORDER_WIDTH,
  NAVIGATION
};

export default appTheme;
