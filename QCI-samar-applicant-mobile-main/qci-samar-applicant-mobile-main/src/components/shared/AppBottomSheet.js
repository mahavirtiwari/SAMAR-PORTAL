/**
 * AppBottomSheet - Enhanced Bottom Sheet Component
 *
 * Snap points, keyboard handling, velocity-based gestures, sticky
 * header/footer, and smooth native-driver animations. Backed by RN's
 * PanResponder + safe-area-context (no extra native deps).
 *
 * Imperative API (via ref):
 *   sheetRef.current.open(snapIndex);
 *   sheetRef.current.snapTo(index);
 *   sheetRef.current.close();
 */

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Responsive } from '../../assets/theme/Layout';
import { COLORS } from '../../assets/theme/Theme';

const { height: screenHeight } = Dimensions.get('screen');

const getAndroidVersion = () => {
  if (Platform.OS !== 'android') {
    return null;
  }
  return Platform.Version;
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
    footerComponent = null,
  } = props;

  const insets = useSafeAreaInsets();

  const [isVisible, setIsVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const translateY = useRef(new Animated.Value(height + insets.bottom)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const actualSnapPoints = useMemo(() => {
    return snapPoints
      ? snapPoints
          .map(point => {
            if (typeof point === 'string' && point.includes('%')) {
              const availableHeight = screenHeight - insets.top - insets.bottom;
              return (parseFloat(point) / 100) * availableHeight;
            }
            return point;
          })
          .sort((a, b) => a - b)
      : [height];
  }, [snapPoints, height, insets.top, insets.bottom]);

  const currentHeight = useMemo(() => {
    const baseHeight = actualSnapPoints[currentSnapIndex] || height;
    const availableHeight = screenHeight - insets.top - insets.bottom;
    return Math.min(availableHeight, baseHeight);
  }, [actualSnapPoints, currentSnapIndex, height, insets.top, insets.bottom]);

  useEffect(() => {
    if (keyboardBehavior === 'none') {
      return;
    }

    const androidVersion = getAndroidVersion();
    const isAndroid15OrHigher = androidVersion && androidVersion >= 35;

    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => {
        setKeyboardHeight(e.endCoordinates.height);

        if (keyboardBehavior === 'interactive') {
          if (Platform.OS === 'android' && isAndroid15OrHigher) {
            Animated.timing(translateY, {
              toValue: -e.endCoordinates.height,
              duration: 250,
              easing: animationEasing,
              useNativeDriver: true,
            }).start();
          } else if (Platform.OS === 'ios') {
            Animated.timing(translateY, {
              toValue: -e.endCoordinates.height,
              duration: 250,
              easing: animationEasing,
              useNativeDriver: true,
            }).start();
          }
        }
      },
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);

        if (keyboardBehavior === 'interactive') {
          if (Platform.OS === 'android' && isAndroid15OrHigher) {
            Animated.timing(translateY, {
              toValue: 0,
              duration: 250,
              easing: animationEasing,
              useNativeDriver: true,
            }).start();
          } else if (Platform.OS === 'ios') {
            Animated.timing(translateY, {
              toValue: 0,
              duration: 250,
              easing: animationEasing,
              useNativeDriver: true,
            }).start();
          }
        }
      },
    );

    return () => {
      keyboardWillShow?.remove();
      keyboardWillHide?.remove();
    };
  }, [keyboardBehavior, translateY, animationEasing]);

  const findNearestSnapPoint = useMemo(() => {
    return (translateValue, velocity) => {
      if (actualSnapPoints.length === 1) {
        const closeThreshold = currentHeight * 0.33;
        if (closeOnDragDown && translateValue > closeThreshold) {
          return { index: -1, height: screenHeight };
        }
        return { index: 0, height: actualSnapPoints[0] };
      }

      const closeThreshold = currentHeight * 0.33;

      if (closeOnDragDown && translateValue > closeThreshold) {
        return { index: -1, height: screenHeight };
      }

      if (Math.abs(velocity) > velocityThreshold) {
        if (velocity > 0) {
          if (closeOnDragDown) {
            return { index: -1, height: screenHeight };
          }
          return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
        } else {
          const isAtHighestSnapPoint = currentSnapIndex === actualSnapPoints.length - 1;
          if (isAtHighestSnapPoint) {
            return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
          }

          const nextIndex = currentSnapIndex + 1;
          if (nextIndex >= actualSnapPoints.length) {
            return {
              index: actualSnapPoints.length - 1,
              height: actualSnapPoints[actualSnapPoints.length - 1],
            };
          }
          return { index: nextIndex, height: actualSnapPoints[nextIndex] };
        }
      }

      if (translateValue > 0) {
        if (closeOnDragDown && translateValue > closeThreshold) {
          return { index: -1, height: screenHeight };
        }
        return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
      } else {
        const isAtHighestSnapPoint = currentSnapIndex === actualSnapPoints.length - 1;

        if (isAtHighestSnapPoint) {
          return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
        }

        const dragDistance = Math.abs(translateValue);
        const snapThreshold = currentHeight * 0.2;

        if (dragDistance > snapThreshold) {
          const nextIndex = currentSnapIndex + 1;
          if (nextIndex < actualSnapPoints.length) {
            return { index: nextIndex, height: actualSnapPoints[nextIndex] };
          }
        }

        return { index: currentSnapIndex, height: actualSnapPoints[currentSnapIndex] };
      }
    };
  }, [actualSnapPoints, currentSnapIndex, velocityThreshold, currentHeight, closeOnDragDown]);

  const close = useCallback(() => {
    if (animating) {
      return;
    }

    setAnimating(true);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        easing: animationEasing,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: currentHeight + insets.bottom,
        duration: 250,
        easing: animationEasing,
        useNativeDriver: true,
      }),
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
    insets.bottom,
  ]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => draggable,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return draggable && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);

          const dragProgress = Math.min(gestureState.dy / (currentHeight * 0.4), 1);
          const newOpacity = Math.max(1 - dragProgress, 0);
          backdropOpacity.setValue(newOpacity);
        } else if (gestureState.dy < 0 && snapPoints && actualSnapPoints.length > 1) {
          const isAtHighestSnapPoint = currentSnapIndex >= actualSnapPoints.length - 1;
          if (!isAtHighestSnapPoint) {
            translateY.setValue(gestureState.dy);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const velocity = gestureState.vy;
        const { index: targetIndex, height: targetHeight } = findNearestSnapPoint(
          gestureState.dy,
          velocity,
        );

        if (targetIndex === -1) {
          close();
          return;
        }

        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 250,
            easing: animationEasing,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 250,
            easing: animationEasing,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (targetIndex !== currentSnapIndex) {
            setCurrentSnapIndex(targetIndex);
            if (onChange) {
              onChange(targetIndex, targetHeight);
            }
          }
        });
      },
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
    actualSnapPoints.length,
    backdropOpacity,
    currentHeight,
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
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        easing: animationEasing,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnimating(false);
    });
  };

  const snapTo = index => {
    if (animating || index < 0 || index >= actualSnapPoints.length) {
      return;
    }

    setAnimating(true);
    const targetHeight = actualSnapPoints[index];

    Animated.timing(translateY, {
      toValue: 0,
      duration: 250,
      easing: animationEasing,
      useNativeDriver: true,
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
    snapPoints: actualSnapPoints,
  }));

  const handleBackdropPress = () => {
    if (closeOnPressMask && !animating) {
      close();
    }
  };

  const containerStyle = useMemo(
    () => ({
      borderTopLeftRadius: Responsive.height(16),
      borderTopRightRadius: Responsive.height(16),
      backgroundColor: COLORS.background.primary,
      ...customStyles.container,
    }),
    [customStyles.container],
  );

  const wrapperStyle = useMemo(
    () => ({
      backgroundColor: 'rgba(0,0,0,0.6)',
      ...customStyles.wrapper,
    }),
    [customStyles.wrapper],
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
      ...customStyles.draggableIcon,
    }),
    [customStyles.draggableIcon],
  );

  const draggableAreaStyle = useMemo(
    () => ({
      paddingVertical: 0,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      borderTopLeftRadius: Responsive.height(16),
      borderTopRightRadius: Responsive.height(16),
    }),
    [],
  );

  const keyboardAwareContainerStyle = useMemo(
    () => ({
      height: currentHeight,
      transform: [{ translateY }],
      paddingBottom: Platform.OS === 'ios' && keyboardHeight > 0 ? 0 : insets.bottom,
    }),
    [currentHeight, translateY, insets.bottom, keyboardHeight],
  );

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType={animationType}
      statusBarTranslucent={statusBarTranslucent}
      presentationStyle="overFullScreen"
      onRequestClose={close}>
      <View style={[styles.overlay, wrapperStyle]}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>
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
              zIndex: 1,
            }}
          />
        )}
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
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,.6)',
  },
  container: {
    backgroundColor: COLORS.background.primary,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  headerContainer: {},
  footerContainer: {},
});

export default memo(AppBottomSheet);
