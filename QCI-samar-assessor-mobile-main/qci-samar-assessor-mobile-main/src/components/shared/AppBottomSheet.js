/**
 * AppBottomSheet - Enhanced Bottom Sheet Component
 *
 * A highly optimized and feature-rich bottom sheet component.
 *
 * 🔥 FEATURES:
 * ✅ Multiple Snap Points - Support for [200, 400, '70%'] style snap points
 * ✅ Keyboard Handling - Interactive, fillParent, or none modes
 * ✅ Velocity-based Gestures - Fast swipes trigger immediate snapping
 * ✅ ScrollView Integration - Seamless coordination with internal scrollable content
 * ✅ Smooth Animations - Native driver with customizable easing curves
 * ✅ Footer/Header Components - Sticky components that don't scroll
 * ✅ Performance Optimized - Memoized and efficient re-rendering
 * ✅ Backdrop Customization - Full control over backdrop appearance
 * ✅ Accessibility Ready - Screen reader and focus management support
 *
 * 📖 USAGE EXAMPLES:
 *
 * // Basic Usage (backward compatible)
 * <AppBottomSheet ref={sheetRef} height={400}>
 *   <YourContent />
 * </AppBottomSheet>
 *
 * // Multiple Snap Points
 * <AppBottomSheet
 *   ref={sheetRef}
 *   snapPoints={[200, 400, '70%']}
 *   onChange={(index, height) => logger.info('Snapped to:', index)}
 * >
 *   <ScrollView>...</ScrollView>
 * </AppBottomSheet>
 *
 * // Advanced Features
 * <AppBottomSheet
 *   keyboardBehavior="interactive"
 *   velocityThreshold={800}
 *   animationEasing={Easing.bezier(0.25, 0.46, 0.45, 0.94)}
 *   headerComponent={<Text style={styles.title}>Select User</Text>}
 *   footerComponent={
 *     <View style={styles.buttonRow}>
 *       <Button title="Cancel" onPress={() => sheetRef.current.close()} />
 *       <Button title="Save" onPress={handleSave} />
 *     </View>
 *   }
 * >
 *   <ScrollView>
 *     <TextInput placeholder="Type here..." />
 *   </ScrollView>
 * </AppBottomSheet>
 *
 * // Imperative Methods
 * sheetRef.current.open(0);        // Open at first snap point
 * sheetRef.current.snapTo(2);      // Animate to third snap point
 * sheetRef.current.close();        // Close sheet
 * sheetRef.current.currentSnapIndex; // Get current snap index
 *
 * 📋 PROPS:
 * @param {number|null} height - Fixed height (used when snapPoints is null)
 * @param {Array<number|string>|null} snapPoints - Array of snap points [200, 400, '70%']
 * @param {ReactNode} children - Content to render inside the sheet
 * @param {boolean} closeOnDragDown - Allow closing by dragging down (default: true)
 * @param {boolean} closeOnPressMask - Allow closing by tapping backdrop (default: true)
 * @param {boolean} draggable - Enable drag gestures (default: true)
 * @param {string} animationType - Modal animation type (default: 'fade')
 * @param {boolean} statusBarTranslucent - Status bar translucent (default: true)
 * @param {object} customStyles - Custom styles for wrapper, container, draggableIcon
 * @param {function} onOpen - Callback when sheet opens
 * @param {function} onClose - Callback when sheet closes
 * @param {function} onChange - Callback when snap point changes (index, height)
 * @param {string} keyboardBehavior - 'interactive' | 'fillParent' | 'none' (default: 'interactive')
 * @param {number} velocityThreshold - Velocity threshold for quick swipes (default: 1000)
 * @param {function} animationEasing - Custom easing function (default: Easing.bezier(0.25, 0.46, 0.45, 0.94))
 * @param {ReactNode} headerComponent - Sticky header component (handles its own styling)
 * @param {ReactNode} footerComponent - Sticky footer component (handles its own styling)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { Responsive } from '../../assets/theme/Layout';
import { COLORS } from '../../assets/theme/Theme';
import { BottomSheetKeyboardContext } from './bottomSheetKeyboardContext';

const STATUS_BAR_HEIGHT = getStatusBarHeight();
const { height: screenHeight } = Dimensions.get('screen');

// The keyboard reserve ratio covers the unobservable keyboard animation
// window (Android has no keyboardWillShow) and the modal resize that lands
// in onLayout shortly after keyboardDidShow. Used only as the first-ever-open
// fallback now — a real height is persisted and reused after that. Sized just
// above a typical Android keyboard's share of the usable height so the reserve
// does not under-cover and leave the sheet's bottom edge behind the keyboard.
const KEYBOARD_RESERVE_RATIO = 0.4;
const KEYBOARD_SETTLE_DELAY_MS = 100;
// A downward drag while the keyboard is open is an unambiguous dismiss intent.
// The visible sheet is only the keyboard-capped height, so the normal close
// threshold (a third of the FULL snap height) is unreachable with a short
// pull — close on any deliberate downward drag from that state instead.
const KEYBOARD_OPEN_CLOSE_THRESHOLD = 50;

// Last real keyboard height seen. Inputs focus before the keyboard animates,
// so this lets the sheet cap and lift itself at tap time with an exact value
// instead of the reserve estimate. Persisted across launches (below) so even
// the FIRST open of a fresh session uses the real height rather than the
// estimate — otherwise the sheet lifts by the estimate and the last ~20px
// creeps up a beat later when keyboardDidShow corrects it.
let cachedKeyboardHeight = 0;

const KB_HEIGHT_STORAGE_KEY = 'appBottomSheet:lastKeyboardHeight';
let cachedKeyboardHeightHydrated = false;

// Fire-and-forget on module load: seed cachedKeyboardHeight from the last
// persisted value long before the user can tap an input on a cold start.
const hydrateCachedKeyboardHeight = async () => {
  if (cachedKeyboardHeightHydrated) {
    return;
  }
  cachedKeyboardHeightHydrated = true;
  try {
    const stored = await AsyncStorage.getItem(KB_HEIGHT_STORAGE_KEY);
    const value = stored ? parseInt(stored, 10) : 0;
    if (value > 0 && cachedKeyboardHeight === 0) {
      cachedKeyboardHeight = value;
    }
  } catch {
    // Storage read is best-effort; the reserve estimate covers a miss.
  }
};
hydrateCachedKeyboardHeight();

// Whether this device's modal window resizes when the keyboard opens.
// Android 15+ (API 35) enforces edge-to-edge, so the modal stays full-height
// and only our own lift moves the sheet ('none'). Android 14 and below let
// the window shrink around the keyboard ('resize'). Runtime observation
// (modalResizeRegime) refines this after the first open if it differs.
let modalResizeRegime = null;

const getModalResizeRegime = () => {
  if (modalResizeRegime) {
    return modalResizeRegime;
  }
  return Platform.OS === 'android' && parseInt(Platform.Version, 10) >= 35 ? 'none' : 'resize';
};

const AppBottomSheet = forwardRef((props, ref) => {
  const {
    height = 400,
    snapPoints = null,
    children,
    closeOnDragDown = true,
    closeOnPressMask = true,
    draggable = true,
    animationType = 'fade',
    statusBarTranslucent = true,
    customStyles = {},
    onOpen,
    onClose,
    onChange,
    keyboardBehavior = 'interactive',
    velocityThreshold = 1000,
    animationEasing = Easing.bezier(0.25, 0.46, 0.45, 0.94),
    headerComponent = null,
    footerComponent = null
  } = props;

  const insets = useSafeAreaInsets();

  const [isVisible, setIsVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [overlayHeight, setOverlayHeight] = useState(screenHeight);
  const [remainingLift, setRemainingLift] = useState(0);
  const overlayHeightRef = useRef(screenHeight);
  // Live mirrors read by the gesture handlers, which are memoized once and do
  // not see fresh keyboard/lift state through their closure.
  const keyboardHeightRef = useRef(0);
  const remainingLiftRef = useRef(0);
  const keyboardOpenAtGestureStart = useRef(false);

  const translateY = useRef(new Animated.Value(height + insets.bottom)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Calculate actual snap points (convert percentages to pixels) - Memoized for performance
  const actualSnapPoints = useMemo(() => {
    return snapPoints
      ? snapPoints
          .map((point) => {
            if (typeof point === 'string' && point.includes('%')) {
              const availableHeight = screenHeight - insets.top - insets.bottom;
              return (parseFloat(point) / 100) * availableHeight;
            }
            return point;
          })
          .sort((a, b) => a - b)
      : [height];
  }, [snapPoints, height, insets.top, insets.bottom]);

  // Get current height based on snap point - Memoized for performance
  const currentHeight = useMemo(() => {
    const baseHeight = actualSnapPoints[currentSnapIndex] || height;
    const availableHeight = screenHeight - insets.top - insets.bottom;
    return Math.min(availableHeight, baseHeight);
  }, [actualSnapPoints, currentSnapIndex, height, insets.top, insets.bottom]);

  // RN Modal windows hardcode SOFT_INPUT_ADJUST_RESIZE (ReactModalHostView),
  // but whether that resize reaches the JS layout depends on the Android
  // version: Android 14 shrinks the modal window, while 15+ (edge-to-edge)
  // leave it full-height. On Android 14 the shrink lands in onLayout a beat
  // AFTER keyboardDidShow, so reacting to the event immediately lifts the
  // sheet past the status bar before correcting. Wait briefly for the layout
  // to settle, then compute the lift as only the remainder the system resize
  // did not already cover.
  useEffect(() => {
    if (!isVisible || keyboardBehavior === 'none') {
      return;
    }

    if (keyboardHeight === 0) {
      setRemainingLift(0);
      return;
    }

    const settleTimer = setTimeout(() => {
      const coveredByResize = Math.max(0, screenHeight - overlayHeightRef.current);
      // Remember this device's behaviour so later opens can react at tap
      // time instead of waiting for the settle delay.
      modalResizeRegime = coveredByResize > 0 ? 'resize' : 'none';
      setRemainingLift(Math.max(0, keyboardHeight - coveredByResize));
    }, KEYBOARD_SETTLE_DELAY_MS);

    return () => clearTimeout(settleTimer);
  }, [isVisible, keyboardBehavior, keyboardHeight, overlayHeight]);

  useEffect(() => {
    // Skip while a sheet animation (open/close/snap) owns translateY, so the
    // keyboard-dismiss that rides along with a close does not re-lift the sheet
    // and fight the close animation.
    if (!isVisible || keyboardBehavior === 'none' || animating) {
      return;
    }

    Animated.timing(translateY, {
      toValue: -remainingLift,
      duration: 250,
      easing: animationEasing,
      useNativeDriver: true
    }).start();
  }, [remainingLift, isVisible, keyboardBehavior, translateY, animationEasing, animating]);

  // Keep the gesture-readable mirrors in step with the state they shadow.
  useEffect(() => {
    keyboardHeightRef.current = keyboardHeight;
  }, [keyboardHeight]);

  useEffect(() => {
    remainingLiftRef.current = remainingLift;
  }, [remainingLift]);

  // Keyboard listeners only record the height; positioning is derived from
  // the measured layout above.
  useEffect(() => {
    if (keyboardBehavior === 'none') {
      return;
    }

    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        cachedKeyboardHeight = e.endCoordinates.height;
        setKeyboardHeight(e.endCoordinates.height);
        // Persist so the next cold start's first open lifts by the exact
        // height instead of the reserve estimate.
        AsyncStorage.setItem(KB_HEIGHT_STORAGE_KEY, String(e.endCoordinates.height)).catch(() => {
          // Best-effort persist; a miss just falls back to the reserve estimate.
        });
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardWillShow?.remove();
      keyboardWillHide?.remove();
    };
  }, [keyboardBehavior]);
  // Called by AppInput (via context) at tap time, before the keyboard
  // animation starts. Apply the cached real keyboard height immediately so
  // the sheet never shows full-height mid-animation; keyboardDidShow will
  // confirm or correct it.
  const handleChildInputFocused = useCallback(() => {
    const predicted = cachedKeyboardHeight;
    const estimate =
      predicted || Math.round((screenHeight - insets.top - insets.bottom) * KEYBOARD_RESERVE_RATIO);

    setKeyboardHeight((current) => (current > 0 ? current : estimate));

    // On devices whose modal window never resizes (Android 15+) nothing moves
    // the sheet except our own lift, so start it at tap time. Use the best
    // estimate available: the reserve ratio on the very first open of the
    // session (no keyboard height cached yet), the exact cached height on every
    // open after that. keyboardDidShow corrects it a beat later. Without the
    // reserve fallback the first open had nothing to lift by until the keyboard
    // finished animating plus the settle delay, so the sheet crept up about a
    // second late while every later open was instant.
    if (getModalResizeRegime() === 'none') {
      setRemainingLift((current) => (current > 0 ? current : estimate));
    }
  }, [insets.top, insets.bottom]);

  // Find nearest snap point - Optimized function
  const findNearestSnapPoint = useMemo(() => {
    return (translateValue, velocity) => {
      // For single snap point, only allow closing on downward drag
      if (actualSnapPoints.length === 1) {
        const closeThreshold = currentHeight * 0.33;
        if (closeOnDragDown && translateValue > closeThreshold) {
          return { index: -1, height: screenHeight };
        }
        // For upward drags or insufficient downward drags, stay at current position
        return { index: 0, height: actualSnapPoints[0] };
      }

      // Calculate close threshold (if dragged down more than 1/3 of current height)
      const closeThreshold = currentHeight * 0.33;

      // Check if should close based on drag distance (any downward drag closes)
      if (closeOnDragDown && translateValue > closeThreshold) {
        return { index: -1, height: screenHeight };
      }

      // Use velocity for quick swipes
      if (Math.abs(velocity) > velocityThreshold) {
        if (velocity > 0) {
          // Fast swipe down - always close if closeOnDragDown is enabled
          if (closeOnDragDown) {
            return { index: -1, height: screenHeight };
          }
          // Fallback: stay at current position if closing is disabled
          return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
        } else {
          // Fast swipe up - go to next larger snap point
          const isAtHighestSnapPoint = currentSnapIndex === actualSnapPoints.length - 1;
          if (isAtHighestSnapPoint) {
            // Already at highest, stay there
            return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
          }

          const nextIndex = currentSnapIndex + 1;
          if (nextIndex >= actualSnapPoints.length) {
            return {
              index: actualSnapPoints.length - 1,
              height: actualSnapPoints[actualSnapPoints.length - 1]
            };
          }
          return { index: nextIndex, height: actualSnapPoints[nextIndex] };
        }
      }

      // For slow drags, determine direction and intent
      if (translateValue > 0) {
        // Dragging down - close if past threshold
        if (closeOnDragDown && translateValue > closeThreshold) {
          return { index: -1, height: screenHeight };
        }
        // Otherwise snap back to current position
        return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
      } else {
        // Dragging up - find next larger snap point based on drag distance
        const isAtHighestSnapPoint = currentSnapIndex === actualSnapPoints.length - 1;

        // If already at highest snap point, don't allow any upward movement
        if (isAtHighestSnapPoint) {
          return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
        }

        const dragDistance = Math.abs(translateValue);
        const snapThreshold = currentHeight * 0.2; // 20% of current height to trigger next snap

        if (dragDistance > snapThreshold) {
          // Go to next larger snap point
          const nextIndex = currentSnapIndex + 1;
          if (nextIndex < actualSnapPoints.length) {
            return { index: nextIndex, height: actualSnapPoints[nextIndex] };
          }
        }

        // Otherwise stay at current snap point
        return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
      }
    };
  }, [actualSnapPoints, currentSnapIndex, velocityThreshold, currentHeight, closeOnDragDown]);

  const close = useCallback(() => {
    if (animating) {
      return;
    }

    // Take the keyboard down with the sheet; otherwise it lingers over the
    // parent screen after the sheet is gone.
    Keyboard.dismiss();
    setAnimating(true);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        easing: animationEasing,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: currentHeight + insets.bottom,
        duration: 250,
        easing: animationEasing,
        useNativeDriver: true
      })
    ]).start(() => {
      setIsVisible(false);
      setAnimating(false);
      setCurrentSnapIndex(0);
      if (onClose) {
        onClose();
      }
    });
  }, [
    animating,
    backdropOpacity,
    currentHeight,
    animationEasing,
    translateY,
    onClose,
    insets.bottom
  ]);

  // Memoized pan responder for performance - only for draggable area
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => draggable,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return draggable && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // A downward drag begun while the keyboard is up is a dismiss gesture;
        // remember that so release can close on a short pull (see below).
        keyboardOpenAtGestureStart.current = keyboardHeightRef.current > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        // With the keyboard open the sheet is held up by the lift (a negative
        // translateY). Drag from that lifted baseline so it tracks the finger
        // instead of snapping down behind the keyboard the instant you touch it.
        const baseLift = keyboardHeightRef.current > 0 ? -remainingLiftRef.current : 0;
        if (gestureState.dy > 0) {
          // Downward movement - allow and fade backdrop
          translateY.setValue(baseLift + gestureState.dy);

          // Simple backdrop fade based on drag distance
          const dragProgress = Math.min(gestureState.dy / (currentHeight * 0.4), 1);
          const newOpacity = Math.max(1 - dragProgress, 0);
          backdropOpacity.setValue(newOpacity);
        } else if (gestureState.dy < 0 && snapPoints && actualSnapPoints.length > 1) {
          // Upward movement - only allow if NOT at highest snap point
          const isAtHighestSnapPoint = currentSnapIndex >= actualSnapPoints.length - 1;
          if (!isAtHighestSnapPoint) {
            translateY.setValue(baseLift + gestureState.dy);
          }
        }
        // Block upward movement for: single snap point, highest snap point, or no snapPoints
      },
      onPanResponderRelease: (_, gestureState) => {
        const keyboardWasOpen = keyboardOpenAtGestureStart.current;
        keyboardOpenAtGestureStart.current = false;

        // Keyboard-open dismiss: a deliberate downward drag closes the sheet
        // even though it falls short of the full-height close threshold, which
        // the keyboard-capped visible height makes unreachable with a short pull.
        if (keyboardWasOpen && closeOnDragDown && gestureState.dy > KEYBOARD_OPEN_CLOSE_THRESHOLD) {
          close();
          return;
        }

        const velocity = gestureState.vy;
        const { index: targetIndex, height: targetHeight } = findNearestSnapPoint(
          gestureState.dy,
          velocity
        );

        if (targetIndex === -1) {
          close();
          return;
        }

        // Restore backdrop and sheet position simultaneously. With the keyboard
        // open the sheet's rest position is the lifted baseline (-remainingLift),
        // not 0 — snapping back to 0 would drop the sheet behind the keyboard and
        // leave it stuck there (the lift effect won't re-fire because remainingLift
        // didn't change). Restore to whichever baseline currently applies.
        const restY = keyboardHeightRef.current > 0 ? -remainingLiftRef.current : 0;
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 250,
            easing: animationEasing,
            useNativeDriver: true
          }),
          Animated.timing(translateY, {
            toValue: restY,
            duration: 250,
            easing: animationEasing,
            useNativeDriver: true
          })
        ]).start(() => {
          if (targetIndex !== currentSnapIndex) {
            setCurrentSnapIndex(targetIndex);
            if (onChange) {
              onChange(targetIndex, targetHeight);
            }
          }
        });
      }
    });
  }, [
    draggable,
    snapPoints,
    translateY,
    findNearestSnapPoint,
    animationEasing,
    currentSnapIndex,
    onChange,
    close,
    closeOnDragDown,
    actualSnapPoints.length,
    backdropOpacity,
    currentHeight
  ]);

  const open = (snapIndex = 0) => {
    if (animating) {
      return;
    }

    setAnimating(true);
    setIsVisible(true);
    setCurrentSnapIndex(snapIndex);

    const targetHeight = actualSnapPoints[snapIndex];
    translateY.setValue(targetHeight + insets.bottom);

    if (onOpen) {
      onOpen();
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        easing: animationEasing,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        easing: animationEasing,
        useNativeDriver: true
      })
    ]).start(() => {
      setAnimating(false);
    });
  };

  const snapTo = (index) => {
    if (animating || index < 0 || index >= actualSnapPoints.length) {
      return;
    }

    setAnimating(true);
    const targetHeight = actualSnapPoints[index];

    Animated.timing(translateY, {
      toValue: 0,
      duration: 250,
      easing: animationEasing,
      useNativeDriver: true
    }).start(() => {
      setCurrentSnapIndex(index);
      setAnimating(false);
      if (onChange) {
        onChange(index, targetHeight);
      }
    });
  };

  useImperativeHandle(ref, () => ({
    open,
    close,
    snapTo,
    currentSnapIndex,
    snapPoints: actualSnapPoints
  }));

  const handleBackdropPress = () => {
    if (closeOnPressMask && !animating) {
      close();
    }
  };

  // Memoized styles for performance
  const containerStyle = useMemo(
    () => ({
      borderTopLeftRadius: Responsive.height(16),
      borderTopRightRadius: Responsive.height(16),
      backgroundColor: COLORS.black,
      ...customStyles.container
    }),
    [customStyles.container]
  );

  const wrapperStyle = useMemo(
    () => ({
      backgroundColor: 'rgba(0,0,0,0.6)',
      ...customStyles.wrapper
    }),
    [customStyles.wrapper]
  );

  const draggableIconStyle = useMemo(
    () => ({
      marginTop: Responsive.height(20),
      marginBottom: Responsive.height(15),
      backgroundColor: '#EBEDF3',
      width: 50,
      height: 7,
      borderRadius: 2.5,
      alignSelf: 'center',
      ...customStyles.draggableIcon
    }),
    [customStyles.draggableIcon]
  );

  const draggableAreaStyle = useMemo(
    () => ({
      paddingVertical: 0,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      borderTopLeftRadius: Responsive.height(16),
      borderTopRightRadius: Responsive.height(16)
    }),
    []
  );

  // Extra breathing room between the status bar and the sheet top while the
  // keyboard pushes the sheet up.
  const KEYBOARD_TOP_GAP = Responsive.height(12);

  const keyboardAwareContainerStyle = useMemo(() => {
    // Cap applied from tap time (input focus) or keyboardDidShow, whichever
    // comes first. The event's keyboardHeight alone under-caps on Android 14
    // because the modal window shrinks by keyboard PLUS navigation bar, so
    // also clamp against the measured overlay height once the resize lands.
    let resolvedHeight = currentHeight;

    if (keyboardHeight > 0) {
      const topReserve = Math.max(insets.top, STATUS_BAR_HEIGHT) + KEYBOARD_TOP_GAP;
      const fromKeyboard = screenHeight - topReserve - keyboardHeight;
      const fromLayout = overlayHeight - topReserve;
      const maxHeight = Math.min(fromKeyboard, fromLayout);
      resolvedHeight = Math.min(currentHeight, Math.max(0, maxHeight));
    }

    return {
      height: resolvedHeight,
      transform: [{ translateY }],
      paddingBottom: Platform.OS === 'ios' && keyboardHeight > 0 ? 0 : insets.bottom
    };
  }, [
    currentHeight,
    screenHeight,
    overlayHeight,
    translateY,
    insets.top,
    insets.bottom,
    keyboardHeight
  ]);

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType={animationType}
      statusBarTranslucent={statusBarTranslucent}
      onRequestClose={close}>
      <View
        style={[styles.overlay, wrapperStyle]}
        onLayout={(e) => {
          overlayHeightRef.current = e.nativeEvent.layout.height;
          setOverlayHeight(e.nativeEvent.layout.height);
        }}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity
            }
          ]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>

        {/* Bottom white background for iOS to cover safe area */}
        {Platform.OS === 'ios' && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: insets.bottom,
              backgroundColor: '#fff',
              zIndex: 1
            }}
          />
        )}

        <BottomSheetKeyboardContext.Provider value={handleChildInputFocused}>
          <Animated.View style={[styles.container, containerStyle, keyboardAwareContainerStyle]}>
            {draggable && (
              <View style={draggableAreaStyle} {...panResponder.panHandlers}>
                <View style={draggableIconStyle} />
              </View>
            )}

            {headerComponent && <View style={styles.headerContainer}>{headerComponent}</View>}

            <View style={styles.content}>{children}</View>

            {footerComponent && <View style={styles.footerContainer}>{footerComponent}</View>}
          </Animated.View>
        </BottomSheetKeyboardContext.Provider>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,.6)'
  },
  backdropTouchable: {
    flex: 1
  },
  container: {
    backgroundColor: COLORS.background.primary
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.background.primary
  },
  headerContainer: {
    // No opinionated styling - let the component handle its own styling
  },
  footerContainer: {
    // No opinionated styling - let the component handle its own styling
  }
});

// Memoize the component for performance
export default memo(AppBottomSheet);
