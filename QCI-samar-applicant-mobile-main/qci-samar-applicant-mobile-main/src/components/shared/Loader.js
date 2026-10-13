import LottieView from 'lottie-react-native';
import { Component } from 'react';
import { StyleSheet, View } from 'react-native';

class ApplicationLoader extends Component {
  constructor(props) {
    super(props);
    this.state = {
      show: false,
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

  _setState(reducer) {
    return new Promise(resolve => this.setState(reducer, () => resolve()));
  }
  show() {
    this._setState({ show: true });
  }

  hide() {
    this._setState({ show: false });
  }
  static show() {
    this._ref.show();
  }
  static hide() {
    this._ref.hide();
  }
  render() {
    const { show } = this.state;
    if (show) {
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
    return null;
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
    backgroundColor: 'rgba(249,249,257,0.9)',
  },
  loading: {
    zIndex: 9999,
    width: 100,
    height: 100,
  },
});
export default ApplicationLoader;
