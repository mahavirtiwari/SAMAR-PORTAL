import React from 'react';
import { Image } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { Responsive } from '../assets/theme/Layout';
import { COLORS } from '../assets/theme/Theme';
import Icons from '../constants/Icons';
import { Haptic } from './hapticUtils';

export function showSuccessToast(title, message) {
  Haptic.success();
  showMessage({
    message: title,
    description: message,
    type: 'success',
    duration: 2000,
    icon: 'success',
  });
}

// Check icon for the copy toast: render the asset as-is, no badge background
// and no tint so the toastCheck artwork shows in its own colors.
const renderCopyToastIcon = () =>
  React.createElement(Image, {
    source: Icons.toastCheck,
    style: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
      marginRight: 4,
    },
  });

// Shared options for the single-line dark "pill" copy confirmation. Exported so
// it can also be fired on a Modal-local FlashMessage (the app-root instance sits
// behind native Modals, so toasts triggered there are invisible).
export function copyToastConfig(message) {
  return {
    message,
    type: 'default',
    backgroundColor: COLORS.text.heading,
    color: COLORS.background.primary,
    duration: 2000,
    icon: { icon: 'success', position: 'left' },
    renderFlashMessageIcon: renderCopyToastIcon,
    style: {
      backgroundColor: COLORS.text.heading,
      borderRadius: Responsive.width(50),
      marginHorizontal: Responsive.width(16),
      height: 32,
      paddingVertical: 0,
      paddingLeft: 4,
      paddingRight: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    titleStyle: {
      marginTop: 0,
      fontSize: 12,
      fontWeight: '500',
    },
  };
}

// Single-line dark "pill" confirmation used for copy-to-clipboard actions.
export function showCopyToast(message) {
  Haptic.success();
  showMessage(copyToastConfig(message));
}

export function showErrorToast(title, message) {
  Haptic.error();
  showMessage({
    message: title || 'Error',
    description: message,
    type: 'danger',
    duration: 3000,
    icon: 'danger',
  });
}

export function showInfoToast(title, message) {
  showMessage({
    message: title,
    description: message,
    type: 'info',
    duration: 3000,
    icon: 'info',
  });
}

export function showWarningToast(title, message) {
  Haptic.warning();
  showMessage({
    message: title,
    description: message,
    type: 'warning',
    duration: 3000,
    icon: 'warning',
  });
}
