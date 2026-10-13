import LottieView from 'lottie-react-native';
import { Component } from 'react';
import { StyleSheet, View } from 'react-native';

// The overlay is held by OWNERS, not by a boolean and not by a bare counter.
//
// A boolean was the original design and it hides too early: two screens or two
// requests in flight, the first to finish calls hide(), and the overlay goes
// while the second is still working.
//
// A bare counter fixes that and introduces something worse. Callers here are
// level-triggered — `if (busy) show() else hide()` inside an effect — so a
// single caller can call show() many times as its dependencies change, without
// a matching hide each time. Under counting the tally climbs and never returns
// to zero, which strands an opaque full-screen overlay over a working app.
//
// Keying by owner gives the fix without the failure mode: an owner holds the
// overlay or it does not, re-acquiring is idempotent, and the overlay lifts
// once the last owner lets go. Callers that pass no key share the 'default'
// owner and behave exactly as they did before.
const DEFAULT_OWNER = 'default';

class ApplicationLoader extends Component {
  constructor(props) {
    super(props);
    this.state = {
      owners: []
    };
  }

  static setRef(ref = {}) {
    ApplicationLoader._ref = ref;
  }

  static getRef() {
    return ApplicationLoader._ref;
  }

  static clearRef() {
    ApplicationLoader._ref = null;
  }

  show(owner = DEFAULT_OWNER) {
    this.setState((state) =>
      state.owners.includes(owner) ? null : { owners: [...state.owners, owner] }
    );
  }

  hide(owner = DEFAULT_OWNER) {
    this.setState((state) => ({ owners: state.owners.filter((held) => held !== owner) }));
  }

  // Escape hatch for the cases an owner cannot release itself — a screen torn
  // down mid-request, a hard navigation reset. Without this a lost release
  // would hold the overlay for the rest of the session.
  reset() {
    this.setState({ owners: [] });
  }

  static show(owner) {
    this._ref?.show(owner);
  }

  static hide(owner) {
    this._ref?.hide(owner);
  }

  static reset() {
    this._ref?.reset();
  }

  render() {
    if (this.state.owners.length === 0) {
      return null;
    }
    return (
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
  }
}

ApplicationLoader._ref = null; // Move static field initialization outside the class

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9998,
    // Fully opaque so the screen behind is hidden during loading — a white
    // screen only, not the UI bleeding through a translucent overlay.
    backgroundColor: '#FFFFFF'
  },
  loading: {
    zIndex: 9999,
    width: 100,
    height: 100
  }
});
export default ApplicationLoader;
