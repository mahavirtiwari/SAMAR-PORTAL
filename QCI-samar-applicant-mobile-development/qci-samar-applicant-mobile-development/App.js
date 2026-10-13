/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { useEffect } from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import BootSplash from 'react-native-bootsplash';
import FlashMessage from 'react-native-flash-message';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import ErrorBoundary from './src/components/shared/ErrorBoundary';
import ApplicationLoader from './src/components/shared/Loader';
import ApplicationNavigator from './src/navigations/ApplicationNavigator';
import store from './src/redux/store';
import { setupDatabase } from './src/services/database/setupDatabase';
import { initConnectivity } from './src/utils/checkInternetConnection';
import { Logger } from './src/utils/logger';
import { VersionCheck } from './src/utils/versionCheck';
import { useVersionCheck } from './src/utils/versionUtils';

const UpdateRequiredScreen = ({ updateUrl }) => (
  <View style={updateStyles.container}>
    <Text style={updateStyles.title}>Update Required</Text>
    <Text style={updateStyles.body}>
      A newer version of SAMAR Applicant is available. Please update to continue.
    </Text>
    <TouchableOpacity
      style={updateStyles.button}
      activeOpacity={0.8}
      onPress={() => {
        Logger.info('User initiated app update');
        VersionCheck.openUpdateUrl(updateUrl);
      }}>
      <Text style={updateStyles.buttonText}>Update Now</Text>
    </TouchableOpacity>
  </View>
);

const updateStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 18, fontWeight: '600', color: '#181C32', marginBottom: 8 },
  body: {
    fontSize: 13,
    color: '#7E8299',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 19,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 6,
    backgroundColor: '#0C3C74',
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  // Store version check. Only runs in Production (the store build) — a
  // dev/staging build has no listing to compare against. Blocking rather than
  // advisory: this is the only way to move users off a build, and D-007's
  // production re-release depends on it.
  const { isChecking, isUpdateRequired, updateUrl } = useVersionCheck();

  useEffect(() => {
    // Warm the NetInfo listener before any auth request fires so the offline
    // gate reads a real connectivity state — a bare fetch() is stale on the
    // first cold-start call and otherwise blocks the first login after install.
    initConnectivity();
    // Run the outbox migrations at launch. The offline drain awaits
    // migrationsReady, so this must fire before any capture or sync happens.
    setupDatabase().catch(error =>
      Logger.error('Database setup failed at launch:', error?.message || error),
    );
  }, []);

  // The splash must outlive BOTH startup gates — the version check here AND the
  // auth/bootstrap check in ApplicationNavigator — or the user sees a blank white
  // screen (and spinner) for the seconds that bootstrap takes. The normal path
  // hides the splash from ApplicationNavigator once auth resolves; only the
  // update-required path (which never mounts the navigator) hides it here.
  useEffect(() => {
    if (!isChecking && isUpdateRequired) {
      BootSplash.hide({ fade: true });
    }
  }, [isChecking, isUpdateRequired]);

  if (isChecking) {
    return null;
  }

  if (isUpdateRequired) {
    Logger.info('Update required - showing update screen');
    return <UpdateRequiredScreen updateUrl={updateUrl} />;
  }

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }} edges={Platform.OS === 'ios' ? [] : ['bottom']}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          {/* Global blocking loader, mounted before the navigator so its ref is
              available to screens during their mount effects. */}
          <ApplicationLoader ref={ref => ApplicationLoader.setRef(ref)} />
          <ErrorBoundary>
            <ApplicationNavigator />
          </ErrorBoundary>
          {/* App-root flash message host for toasts (showSuccessToast/showCopyToast/etc.) */}
          <FlashMessage position="center" />
        </SafeAreaView>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
