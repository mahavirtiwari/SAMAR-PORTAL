import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Dimensions,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const AppScrollView = forwardRef(
  (
    {
      // Keyboard aware props
      enableKeyboardAware = true,
      enableOnAndroid = true,
      enableAutomaticScroll = true,
      extraScrollHeight = 80,
      extraHeight = 0,
      enableAndroidKeyboardPadding = true,
      keyboardOpeningTime = 250,
      resetScrollToCoords = { x: 0, y: 0 },
      enableResetScrollToCoords = true,
      viewIsInsideTabBar = false,

      // ScrollView props
      style,
      contentContainerStyle,
      showsVerticalScrollIndicator = false,
      showsHorizontalScrollIndicator = false,
      keyboardShouldPersistTaps = 'handled',
      scrollEnabled = true,
      horizontal = false,
      nestedScrollEnabled = false,
      refreshControl,
      bounces = true,
      bouncesZoom = true,
      alwaysBounceVertical = false,
      alwaysBounceHorizontal = false,
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      onContentSizeChange,
      scrollEventThrottle = 16,
      testID,

      // SafeArea / Avoiding
      safeAreaEdges = [],
      useKeyboardAvoidingView = false,
      keyboardVerticalOffset = 0,

      // Children
      children,
      ...otherProps
    },
    ref
  ) => {
    const scrollViewRef = useRef(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const keyboardAnimationDuration = useRef(keyboardOpeningTime);
    const scrollPosition = useRef({ x: 0, y: 0 });

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      scrollTo: (options) => scrollViewRef.current?.scrollTo(options),
      scrollToEnd: (animated = true) => scrollViewRef.current?.scrollToEnd({ animated }),
      scrollToPosition: (x, y, animated = true) =>
        scrollViewRef.current?.scrollTo({ x, y, animated }),
      getScrollResponder: () =>
        scrollViewRef.current?.getScrollResponder?.() || scrollViewRef.current,
      getScrollRef: () => scrollViewRef.current,
      flashScrollIndicators: () => scrollViewRef.current?.flashScrollIndicators(),
      // New: scroll to a specific input/component by ref
      scrollToInput: (inputRef, offset = 0) => {
        if (!inputRef?.current) {
          return;
        }
        setTimeout(() => {
          const scrollViewHandle = findNodeHandle(scrollViewRef.current);
          const inputHandle = findNodeHandle(inputRef.current);
          if (!scrollViewHandle || !inputHandle) {
            return;
          }
          UIManager.measureLayout(
            inputHandle,
            scrollViewHandle,
            () => undefined,
            (x, y, w, h) => {
              scrollViewRef.current.scrollTo({
                x: 0,
                y: y + scrollPosition.current.y + offset,
                animated: true
              });
            }
          );
        }, 100);
      }
    }));

    // Core function: scroll focused input into view
    const scrollToFocusedInput = useCallback(
      (reactNode, offset = 0) => {
        if (!scrollViewRef.current || !reactNode) {
          return;
        }

        setTimeout(() => {
          const scrollViewHandle = findNodeHandle(scrollViewRef.current);
          if (!scrollViewHandle) {
            return;
          }

          UIManager.measureLayout(
            findNodeHandle(reactNode),
            scrollViewHandle,
            () => undefined,
            (x, y, w, h) => {
              const keyboardY = SCREEN_HEIGHT - keyboardHeight;
              const nodeBottom = y + h;
              const scrollNeeded = nodeBottom - keyboardY + extraScrollHeight + offset;

              if (scrollNeeded > 0) {
                scrollViewRef.current.scrollTo({
                  x: 0,
                  y: scrollPosition.current.y + scrollNeeded,
                  animated: true
                });
              }
            }
          );
        }, keyboardAnimationDuration.current);
      },
      [keyboardHeight, extraScrollHeight]
    );

    // Handle keyboard events
    useEffect(() => {
      if (!enableKeyboardAware) {
        return;
      }
      if (Platform.OS === 'android' && !enableOnAndroid) {
        return;
      }

      const onKeyboardShow = (e) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
        keyboardAnimationDuration.current = e.duration || keyboardOpeningTime;

        if (enableAutomaticScroll) {
          const input = TextInput.State.currentlyFocusedInput();
          if (input) {
            scrollToFocusedInput(input);
          }
        }
      };

      const onKeyboardHide = () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);

        // Removed automatic scroll reset when keyboard closes
        // if (enableResetScrollToCoords && resetScrollToCoords) {
        //   scrollViewRef.current?.scrollTo({ ...resetScrollToCoords, animated: true });
        // }
      };

      const showSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        onKeyboardShow
      );
      const hideSub = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        onKeyboardHide
      );

      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [
      enableKeyboardAware,
      enableOnAndroid,
      enableAutomaticScroll,
      keyboardOpeningTime,
      resetScrollToCoords,
      enableResetScrollToCoords,
      scrollToFocusedInput
    ]);

    // Scroll position tracking
    const handleScroll = useCallback(
      (event) => {
        const { x, y } = event.nativeEvent.contentOffset;
        scrollPosition.current = { x, y };
        onScroll?.(event);
      },
      [onScroll]
    );

    const handleContentSizeChange = useCallback(
      (w, h) => {
        onContentSizeChange?.(w, h);
      },
      [onContentSizeChange]
    );
    // Build ScrollView
    const ScrollComponent = (
      <ScrollView
        ref={scrollViewRef}
        style={style}
        contentContainerStyle={[
          styles.defaultContentContainer,
          contentContainerStyle,
          Platform.OS === 'android' &&
          isKeyboardVisible &&
          Platform.Version >= 35 &&
          enableAndroidKeyboardPadding
            ? { paddingBottom: keyboardHeight + extraHeight }
            : {},
          viewIsInsideTabBar ? { paddingBottom: 49 } : {} // default tab bar height
        ]}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollEnabled={scrollEnabled}
        bounces={bounces}
        bouncesZoom={bouncesZoom}
        alwaysBounceVertical={alwaysBounceVertical}
        alwaysBounceHorizontal={alwaysBounceHorizontal}
        refreshControl={refreshControl}
        onScroll={handleScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={scrollEventThrottle}
        testID={testID}
        nestedScrollEnabled={nestedScrollEnabled}
        horizontal={horizontal}
        automaticallyAdjustContentInsets={false}
        {...otherProps}>
        {children}
      </ScrollView>
    );

    const renderWithAvoiding = () => {
      if (Platform.OS === 'ios') {
        return (
          <KeyboardAvoidingView
            behavior="height"
            keyboardVerticalOffset={keyboardVerticalOffset}
            style={styles.flex}>
            {ScrollComponent}
          </KeyboardAvoidingView>
        );
      }
      return ScrollComponent;
    };

    if (safeAreaEdges.length > 0) {
      return (
        <SafeAreaView edges={safeAreaEdges} style={styles.flex}>
          {renderWithAvoiding()}
        </SafeAreaView>
      );
    }

    return renderWithAvoiding();
  }
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  defaultContentContainer: { flexGrow: 1 }
});

AppScrollView.displayName = 'AppScrollView';
export default AppScrollView;
