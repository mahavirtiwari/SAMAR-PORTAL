import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { useEffect } from 'react';
import {
  Appearance,
  AppState,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import BootSplash from 'react-native-bootsplash';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import AppSettings from './appsettings';
import { COLORS } from './src/assets/theme/Theme';
import { ErrorBoundary, Loader } from './src/components/shared';
import ApplicationLoader from './src/components/shared/Loader';
import ApplicationNavigator from './src/navigation/ApplicationNavigator';
import { resetAccountLatchesOnStartup } from './src/redux/action/accountAction';
import store from './src/redux/store';
import { injectStore, resetRefreshLatchOnStartup } from './src/services/api/clients/userClient';
import { setupDatabase } from './src/services/database/setupDatabase';
import { drainOutbox, resetDrainLatch } from './src/services/offline/syncEngine';
import { removeToken } from './src/services/storage/authStore';
import {
  checkInternetConnection,
  initConnectivity,
  subscribeToNetworkChanges
} from './src/utils/checkInternetConnection';
import { installGlobalErrorHandler } from './src/utils/globalErrorHandler';
import { Logger } from './src/utils/logger';
import { VersionCheck } from './src/utils/versionCheck';
import { useVersionCheck } from './src/utils/versionUtils';

installGlobalErrorHandler();

// Warm the NetInfo listener at module load, before any component effect runs.
// React fires effects bottom-up, so ApplicationNavigator's launch check and the
// Home screen's first fetches would otherwise run while connectivity is still
// unknown, and the offline gate reads unknown as online: an offline cold start
// then waits out a real request timeout before falling back to local data.
initConnectivity();

// Android can keep the process alive when the app is swiped from recents and then
// re-mount into the same JavaScript context, so a logout, refresh or drain that
// never settled leaves its module-level latch set for the next launch: the app
// joins a promise that will never resolve and sits on the spinner with no network
// activity at all, until a force-stop. [BUG-08890]
//
// This has to run in App()'s render body, not in an effect. React fires effects
// bottom-up, so ApplicationNavigator's effect — which calls checkLoginStatus, the
// very consumer of the logout latch — runs BEFORE any effect of its ancestors.
// Clearing the latches from an ancestor's effect would therefore happen after the
// consumer had already joined the stale promise, and nulling the variable does not
// unstick a caller already awaiting the old object.
//
// The module-level flag is load-bearing, not belt-and-braces: App() re-renders
// whenever useVersionCheck's state settles, and clearing the drain latch mid-flight
// is exactly the race BUG-08791 fixed. Once per process, before anything mounts.
let startupLatchesReset = false;

const resetStartupLatchesOnce = () => {
  if (startupLatchesReset) {
    return;
  }
  startupLatchesReset = true;
  resetAccountLatchesOnStartup();
  resetRefreshLatchOnStartup();
  resetDrainLatch();
};

const MainApp = () => {
  useEffect(() => {
    // Force light mode
    Appearance.setColorScheme('light');

    const unsubscribe = subscribeToNetworkChanges((isConnected) => {
      // Connectivity-resumed → push any queued captures up to the server.
      if (isConnected) {
        drainOutbox().catch(() => undefined);
      }
    });

    // Regular background push. Inline sync at capture time covers the happy
    // path, but a slow network, a transient failure, or a handler with no
    // inline attempt leaves rows queued — and connectivity-change/manual Save
    // were the only other drains, so a device that stays online never flushed
    // them. Tick the drain while online so syncing actually happens regularly.
    // drainOutbox's own in-process lock makes this safe alongside every other
    // trigger; it no-ops when the outbox is empty.
    const drainIfOnline = async () => {
      try {
        if (await checkInternetConnection()) {
          drainOutbox().catch(() => undefined);
        }
      } catch {
        // best-effort background sync
      }
    };
    const interval = setInterval(drainIfOnline, 20000);

    // Returning to the foreground should flush immediately, not wait a tick.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        drainIfOnline();
      }
    });

    return () => {
      unsubscribe();
      clearInterval(interval);
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        Logger.info('Initializing application...');
        await Logger.initializeGlobalContext();

        // iOS keychain keeps tokens across app reinstalls, so clear them on first launch
        if (Platform.OS === 'ios') {
          try {
            const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunchedBefore');
            if (!hasLaunchedBefore) {
              Logger.info('First launch detected on iOS, clearing stale keychain tokens...');
              await removeToken('accessToken');
              await removeToken('refreshToken');
              await removeToken('token'); // Clean up legacy key name
              await AsyncStorage.setItem('hasLaunchedBefore', 'true');
              Logger.info('Stale keychain tokens cleared successfully');
            }
          } catch (error) {
            Logger.error('Failed to clear tokens on first launch:', error);
          }
        }

        // One-time migration: clean up legacy 'token' key (renamed to 'accessToken')
        try {
          const tokenKeyMigrated = await AsyncStorage.getItem('tokenKeyMigrated');
          if (!tokenKeyMigrated) {
            await removeToken('token');
            await AsyncStorage.setItem('tokenKeyMigrated', 'true');
            Logger.info('Legacy token key cleaned up');
          }
        } catch (error) {
          Logger.error('Token key migration failed:', error);
        }

        await setupDatabase();
        Logger.info('Database initialized successfully');
        // App start drain — if the user killed the app mid-offline-session,
        // anything still queued should attempt upload now.
        drainOutbox().catch(() => undefined);
      } catch (error) {
        Logger.error('Error during app initialization:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={{
          flex: 1,
          // Android draws behind the system navigation bar; a black root
          // makes the bar area itself read as black.
          backgroundColor: Platform.OS === 'android' ? COLORS.black : undefined
        }}
        edges={Platform.OS === 'ios' ? [] : ['bottom']}>
        <ErrorBoundary>
          <NavigationContainer
            // Safety valve for the keyed loader: an owner that is torn down
            // without releasing (a screen unmounted mid-request, a hard reset)
            // would otherwise hold the opaque overlay for the rest of the
            // session. Every completed navigation clears any stale holder;
            // a genuinely busy screen re-acquires on its next render.
            onStateChange={() => ApplicationLoader.reset()}>
            <FlashMessage position="center" />
            <ApplicationNavigator />
          </NavigationContainer>
        </ErrorBoundary>
        <Loader ref={(ref) => ApplicationLoader.setRef(ref)} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const UpdateRequiredScreen = ({ updateUrl }) => (
  <View style={updateStyles.container}>
    <Text style={updateStyles.title}>Update Required</Text>
    <Text style={updateStyles.body}>
      A newer version of {AppSettings.APP_NAME} is available. Please update to continue.
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
    backgroundColor: '#FFFFFF'
  },
  title: { fontSize: 18, fontWeight: '600', color: '#181C32', marginBottom: 8 },
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
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' }
});

function App() {
  injectStore(store);
  resetStartupLatchesOnce();

  Logger.info('App: Initializing application');

  // Store version check. Only runs in Production (the store build) — a
  // dev/staging build has no listing to compare against. Blocking rather than
  // advisory: this is the only way to move users off a build, and D-007's
  // production re-release depends on it.
  const { isChecking, isUpdateRequired, updateUrl } = useVersionCheck();

  // The update screen never mounts the navigator, which owns the normal hide,
  // so it has to release the splash itself.
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <MainApp />
      </GestureHandlerRootView>
    </Provider>
  );
}

export default App;
