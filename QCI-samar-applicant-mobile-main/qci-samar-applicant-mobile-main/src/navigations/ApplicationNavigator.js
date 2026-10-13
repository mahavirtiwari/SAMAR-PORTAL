import { NavigationContainer } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import { useDispatch, useSelector } from 'react-redux';
import { commonStyles, layout } from '../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../assets/theme/Theme';
import {
  checkLoginStatus,
  logoutAction,
  refreshToken as refreshTokenAction,
} from '../redux/action/accountAction';
import { drainOutbox } from '../services/offline/syncEngine';
import { getToken } from '../services/storage/authStore';
import {
  checkInternetConnection,
  subscribeToNetworkChanges,
} from '../utils/checkInternetConnection';
import { Logger } from '../utils/logger';
import PublicNavigator from './PublicNavigator';
import UserNavigator from './UserNavigator';

const ApplicationNavigator = () => {
  const [loading, setLoading] = useState(true);
  const { isLoggedIn, isUnderMaintenance, maintenanceMessage } = useSelector(
    state => state.account,
  );
  const dispatch = useDispatch();
  const appStateRef = useRef(AppState.currentState);
  const wasOnlineRef = useRef(true);

  // Auto-sync the offline outbox the moment connectivity returns, so captures
  // made offline don't sit unsynced until the user remembers to tap Sync. The
  // drain's own in-process lock makes this safe alongside a manual sync.
  useEffect(() => {
    if (!isLoggedIn) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const online = await checkInternetConnection();
      if (!cancelled) {
        wasOnlineRef.current = online;
      }
    })();
    const unsubscribe = subscribeToNetworkChanges(online => {
      if (online && !wasOnlineRef.current) {
        drainOutbox().catch(error => Logger.warn('Auto-sync on reconnect failed:', error?.message));
      }
      wasOnlineRef.current = online;
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await dispatch(checkLoginStatus());
      } catch (error) {
        Logger.error('Error initializing app:', error);
      } finally {
        setLoading(false);
      }
    };
    initializeApp();
  }, []);

  // Keep the native splash up until the auth/bootstrap check resolves and the
  // first real screen (login/home/maintenance) has painted, so there's no blank
  // white screen or spinner between splash and the first screen. Two rAFs ensure
  // the committed screen actually painted before the splash is removed.
  useEffect(() => {
    if (loading) {
      return undefined;
    }
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => BootSplash.hide({ fade: true })),
    );
    return () => cancelAnimationFrame(raf);
  }, [loading]);

  // Handle app returning from background - validate token
  const handleAppStateChange = useCallback(
    async nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isLoggedIn
      ) {
        Logger.info('App returned to foreground, checking token validity');
        // Push any offline captures queued while backgrounded / offline.
        drainOutbox().catch(error =>
          Logger.warn('Auto-sync on foreground failed:', error?.message),
        );
        try {
          const accessToken = await getToken('accessToken');

          if (!accessToken?.token) {
            Logger.warn('No access token found on app resume, logging out');
            await dispatch(logoutAction());
            return;
          }

          const now = Date.now();
          const tokenExpiry = accessToken.expiry ? Date.parse(accessToken.expiry) : null;

          if (tokenExpiry && tokenExpiry <= now) {
            Logger.info('Access token expired while app was in background, attempting refresh');
            const refreshTokenData = await getToken('refreshToken');

            if (!refreshTokenData?.token) {
              Logger.warn('No refresh token available on app resume, logging out');
              await dispatch(logoutAction());
              return;
            }

            const refreshExpiry = refreshTokenData.expiry
              ? Date.parse(refreshTokenData.expiry)
              : null;
            if (refreshExpiry && refreshExpiry <= now) {
              Logger.warn('Refresh token expired while app was in background, logging out');
              await dispatch(logoutAction());
              return;
            }

            // Refresh token still valid - try to refresh
            const result = await dispatch(refreshTokenAction());
            if (result.error) {
              Logger.error('Token refresh on app resume failed:', result.error);
              await dispatch(logoutAction());
            } else {
              Logger.info('Token refreshed successfully on app resume');
            }
          }
        } catch (error) {
          Logger.error('Error checking token on app resume:', error);
        }
      }
      appStateRef.current = nextAppState;
    },
    [dispatch, isLoggedIn],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleAppStateChange]);

  if (loading) {
    return (
      <View style={[commonStyles.fill, layout.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Show maintenance message when the system is under maintenance
  if (isUnderMaintenance) {
    return (
      <View style={[commonStyles.fill, layout.center, { padding: 24 }]}>
        <Text
          style={[
            commonStyles.FontFamily_SemiBold600,
            layout.textCenter,
            { color: COLORS.text.heading, fontSize: FONT_SIZE.fs16 },
          ]}>
          {maintenanceMessage || 'System is currently under maintenance. Please try again later.'}
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isLoggedIn ? <UserNavigator /> : <PublicNavigator />}
    </NavigationContainer>
  );
};

export default ApplicationNavigator;
