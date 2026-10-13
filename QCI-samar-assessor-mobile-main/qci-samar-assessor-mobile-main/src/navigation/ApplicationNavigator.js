import { createStackNavigator } from '@react-navigation/stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Easing, View } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import { useDispatch, useSelector } from 'react-redux';
import { commonStyles, layout } from '../assets/theme/Styles';
import { COLORS } from '../assets/theme/Theme';
import {
  checkLoginStatus,
  logoutAction,
  refreshToken as refreshTokenAction
} from '../redux/action/accountAction';
import { assumeLoggedIn } from '../redux/slices/accountSlice';
import Maintenance from '../screens/public/Maintenance';
import { getToken } from '../services/storage/authStore';
import { checkInternetConnection } from '../utils/checkInternetConnection';
import { Logger } from '../utils/logger';
import PublicNavigator from './PublicNavigator';
import UserNavigator from './UserNavigator';

const Stack = createStackNavigator();

// Upper bound on the launch check. Generous enough that a slow but working
// network still completes it, short enough that a stall never reads as a hung
// app. [BUG-08890]
const STARTUP_TIMEOUT_MS = 15000;

function ApplicationNavigator() {
  const [selectedScreens, _setSelectedScreen] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isLoggedIn, isUnderMaintenance } = useSelector((state) => state.account);
  const dispatch = useDispatch();
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const initializeApp = async () => {
      let timeoutId = null;
      try {
        // Bounded, so no future stall on this path can hold the app on the
        // spinner; a spinner that never clears is not recoverable.
        //
        // A race does not cancel the loser, so a checkLoginStatus that settles
        // after the timeout still runs its own side effects — it may log the
        // user out from under a screen they have already reached. That is
        // accepted deliberately: it is recoverable and it only happens when the
        // check was pathologically slow, whereas the alternative this replaced
        // was an app that never left the spinner at all.
        // Started alongside the check, never awaited on its own: the keychain
        // read is the check's first step, so if that is what stalled, a bare
        // await here would put the spinner back on the path the bound protects.
        const storedToken = getToken('accessToken').catch(() => null);
        const outcome = await Promise.race([
          dispatch(checkLoginStatus()).then(() => 'settled'),
          new Promise((resolve) => {
            timeoutId = setTimeout(() => resolve('timeout'), STARTUP_TIMEOUT_MS);
          })
        ]);
        // isLoggedIn starts false, so releasing the spinner on the timeout put a
        // user whose token was merely slow to verify on the Login screen, then
        // jumped them to Home seconds later when the check settled. A stored
        // token is the same evidence the offline launch path already accepts:
        // show the signed-in app now and let the check's own answer follow.
        if (outcome === 'timeout') {
          const token = await Promise.race([
            storedToken,
            new Promise((resolve) => setTimeout(() => resolve(null), 1000))
          ]);
          if (token?.token) {
            Logger.warn('Launch check still running past its budget; assuming the stored session');
            dispatch(assumeLoggedIn());
          }
        }
      } catch (error) {
        Logger.error('Error initializing app:', error);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        setLoading(false);
      }
    };
    initializeApp();
  }, []);

  // The native splash outlives the launch check: hiding it earlier showed a
  // white spinner between splash and the first real screen. Two frames, so the
  // committed screen has painted before the splash fades. Permissions are never
  // requested on this path; a native dialog on screen during hide() would leave
  // the splash stuck until the next launch.
  useEffect(() => {
    if (loading) {
      return undefined;
    }
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => BootSplash.hide({ fade: true }))
    );
    return () => cancelAnimationFrame(raf);
  }, [loading]);

  // Handle app returning from background - validate token
  const handleAppStateChange = useCallback(
    async (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isLoggedIn
      ) {
        Logger.info('App returned to foreground, checking token validity');
        try {
          // Don't tear down a valid offline session on resume — refresh/logout both
          // need the network, and the assessor may be mid-shift offline (matches the
          // API client's offline stance). See BUG-06152.
          if (!(await checkInternetConnection())) {
            Logger.info('App resumed offline — skipping token check to preserve session');
            return;
          }

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
              // A refresh that never reached the server leaves the session
              // untouched — keep it and try again on the next request rather
              // than stranding an assessor at the login screen on a site with
              // no signal.
              if (result.payload?.networkFailure) {
                Logger.info(
                  'Token refresh on app resume could not reach the server — keeping session'
                );
                return;
              }
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
    [dispatch, isLoggedIn]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleAppStateChange]);

  const customAnimation = {
    cardStyleInterpolator: ({ current, layouts }) => ({
      cardStyle: {
        transform: [
          {
            translateY: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [layouts.screen.height, 0],
              extrapolate: 'clamp'
            })
          }
        ]
      }
    }),
    transitionSpec: {
      open: {
        animation: 'timing',
        config: { duration: 300, easing: Easing.inOut(Easing.ease) }
      },
      close: {
        animation: 'timing',
        config: { duration: 300, easing: Easing.inOut(Easing.ease) }
      }
    },
    headerShown: false,
    keyboardHidesTabBar: true
  };

  if (loading) {
    return (
      <View style={[commonStyles.fill, layout.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Show maintenance screen when system is under maintenance
  if (isUnderMaintenance) {
    return (
      <Stack.Navigator screenOptions={customAnimation}>
        <Stack.Screen name="Maintenance" component={Maintenance} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={customAnimation}>
      {!isLoggedIn ? (
        <Stack.Screen name="PublicNavigator" component={PublicNavigator} />
      ) : (
        <Stack.Screen
          name="UserNavigator"
          component={UserNavigator}
          initialParams={{ selectedScreens }}
        />
      )}
    </Stack.Navigator>
  );
}

export default ApplicationNavigator;
