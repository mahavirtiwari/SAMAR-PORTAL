import LottieView from 'lottie-react-native';
import { StyleSheet, View } from 'react-native';

// Inline (declaratively rendered) counterpart to ApplicationLoader. The global
// ApplicationLoader is shown imperatively from a useEffect, which runs after the
// first paint — too late to cover the initial empty frame. Rendering the same
// Lottie in JSX shows it on the very first frame, so the empty state never flashes.
const ScreenLoader = () => (
  <View style={styles.container}>
    <LottieView
      renderMode="AUTOMATIC"
      cacheStrategy="strong"
      source={require('./Loader.json')}
      loop={true}
      autoPlay={true}
      style={styles.loading}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loading: {
    width: 100,
    height: 100
  }
});

export default ScreenLoader;
