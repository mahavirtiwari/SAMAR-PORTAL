import { Component } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Logger } from '../../utils/logger';

/**
 * Catches render-phase crashes below it and shows a retry screen instead of the
 * white screen a release build otherwise shows. The error is recorded as a
 * Crashlytics non-fatal, which is the only way a field crash on an assessor's
 * device reaches us — client logging is off in store builds.
 *
 * Wraps NavigationContainer, so a crash in any screen is caught. Retry re-mounts
 * the tree; state held in Redux survives, screen-local state does not.
 */
class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    Logger.recordError(error, {
      errorType: 'RenderError',
      componentStack: info?.componentStack?.slice(0, 500)
    });
  }

  handleRetry = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected problem. Your saved work is not affected — anything captured
          offline is still queued and will sync.
        </Text>
        <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={this.handleRetry}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF'
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#181C32',
    marginBottom: 8,
    textAlign: 'center'
  },
  body: {
    fontSize: 13,
    color: '#7E8299',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 19
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 6,
    backgroundColor: '#0C3C74'
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  }
});

export default ErrorBoundary;
