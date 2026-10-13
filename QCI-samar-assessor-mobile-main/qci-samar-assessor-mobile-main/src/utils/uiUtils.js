import { Dimensions, PixelRatio, Platform } from 'react-native';

/**
 * UI utility functions for the application
 *
 * These functions help with responsive design, UI calculations,
 * and other layout-related operations.
 */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions for scaling
const baseWidth = 375; // iPhone 8 width
const baseHeight = 667; // iPhone 8 height

/**
 * Converts a design size to a responsive width
 * @param {number} designSize - The width in design (usually Figma)
 * @returns {number} - The responsive width
 */
export const responsiveWidth = (designSize) => {
  const widthPercent = (designSize / baseWidth) * 100;
  return PixelRatio.roundToNearestPixel((SCREEN_WIDTH * widthPercent) / 100);
};

/**
 * Converts a design size to a responsive height
 * @param {number} designSize - The height in design (usu ally Figma)
 * @returns {number} - The responsive height
 */
export const responsiveHeight = (designSize) => {
  const heightPercent = (designSize / baseHeight) * 100;
  return PixelRatio.roundToNearestPixel((SCREEN_HEIGHT * heightPercent) / 100);
};

/**
 * Calculates responsive font size
 * @param {number} size - The font size in design
 * @returns {number} - The responsive font size
 */
export const responsiveFontSize = (size) => {
  const scale = Math.min(SCREEN_WIDTH / baseWidth, SCREEN_HEIGHT / baseHeight);
  const newSize = size * scale;

  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
};

/**
 * Checks if the device is a tablet
 * @returns {boolean} - Whether the device is a tablet
 */
export const isTablet = () => {
  const pixelDensity = PixelRatio.get();
  const adjustedWidth = SCREEN_WIDTH * pixelDensity;
  const adjustedHeight = SCREEN_HEIGHT * pixelDensity;

  return (adjustedWidth >= 1000 || adjustedHeight >= 1000) && pixelDensity < 2;
};

/**
 * Debounces a function call to improve performance
 * @param {Function} func - The function to debounce
 * @param {number} wait - The wait time in milliseconds
 * @returns {Function} - The debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// No domain-specific UI utilities are kept here, as this file is meant
// to contain only project-agnostic UI utilities
