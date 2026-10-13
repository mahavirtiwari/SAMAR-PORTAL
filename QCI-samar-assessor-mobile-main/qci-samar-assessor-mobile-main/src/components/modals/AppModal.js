import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AppModal = ({ visible, children, onRequestClose, onOpened }) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease)
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease)
        })
      ]).start(() => {
        onOpened?.();
      });
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} onRequestClose={onRequestClose} statusBarTranslucent={true}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.container,
            {
              // Both platforms: no consumer of this modal insets its own footer, and the
              // root safe area view applies no edges on iOS, so without this the footer
              // sits under the navigation bar on Android and the home indicator on iOS.
              // AppBottomSheet does the same on both platforms.
              paddingBottom: insets.bottom,
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim
            }
          ]}>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default AppModal;

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 0,
    padding: 0,
    elevation: 6
  }
});
