import { Dimensions, PixelRatio, Platform } from 'react-native';

/**
 * UI utility functions for responsive design.
 */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions for scaling (iPhone 8)
const baseWidth = 375;
const baseHeight = 667;

/**
 * Converts a design size to a responsive width.
 */
export const responsiveWidth = designSize => {
  const widthPercent = (designSize / baseWidth) * 100;
  return PixelRatio.roundToNearestPixel((SCREEN_WIDTH * widthPercent) / 100);
};

/**
 * Converts a design size to a responsive height.
 */
export const responsiveHeight = designSize => {
  const heightPercent = (designSize / baseHeight) * 100;
  return PixelRatio.roundToNearestPixel((SCREEN_HEIGHT * heightPercent) / 100);
};

/**
 * Calculates a responsive font size.
 */
export const responsiveFontSize = size => {
  const scale = Math.min(SCREEN_WIDTH / baseWidth, SCREEN_HEIGHT / baseHeight);
  const newSize = size * scale;

  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
};
