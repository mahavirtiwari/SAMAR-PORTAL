import PropTypes from 'prop-types';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AppErrorBoundary from '../components/base/AppErrorBoundary';
import FullScreenLoader from '../components/base/FullScreenLoader';
import Page from '../components/base/Page';
import { IdleTimeoutWarning } from '../components/modals';
import useIdleTimer from '../hooks/useIdleTimer';
import { checkLoginStatus, logoutUserAction, refreshTokenAction } from '../redux/action/common/AccountAction';
import { checkSystemStatusAction } from '../redux/action/common/SystemStatusAction';
import { getLoggedInUserDetailsAction } from '../redux/action/common/UnitAdminAction';
import { CertifiedEnterprise, Maintenance, PrivacyPolicy } from '../screens';
import { Logger } from '../utils/logger';
import { checkAppVersion } from '../utils/versionCheck';
import PublicNavigator from './PublicNavigator';
import UserNavigator from './UserNavigator';

const INIT_TIMEOUT_MS = 15000; // Never hang on loader longer than 15 seconds

// Rendered inside the Suspense boundary; commits only after the first lazy route chunk
// resolves, which is exactly when the splash should hand off to real content.
const BootReady = ({ onReady }) => {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
};

BootReady.propTypes = {
  onReady: PropTypes.func.isRequired,
};

const ApplicationNavigator = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isUserLoggedIn, logoutLoading, user } = useSelector(state => state.Account);
  const { maintenanceMode } = useSelector(state => state.SystemStatus);
  const [initializing, setInitializing] = useState(true);
  // False until the first real screen has mounted. While false, the static splash
  // (index.html #app-loader) is the only loader on screen — the Suspense fallback stays
  // null so it can't stack a second logo over the splash during the first chunk download.
  const [booted, setBooted] = useState(false);

  const userRole = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0].slug : null;
  const isSystemAdmin = userRole === 'system_admin';
  const inMaintenance = maintenanceMode && !isSystemAdmin;

  const handleIdleLogout = useCallback(async () => {
    try {
      await dispatch(logoutUserAction());
      navigate('/');
    } catch (error) {
      Logger.error('Idle logout failed:', error);
    }
  }, [dispatch, navigate]);

  const { remainingSeconds, isWarning, resetTimer } = useIdleTimer({
    onLogout: handleIdleLogout,
    enabled: isUserLoggedIn === true,
  });

  const handleStayLoggedIn = useCallback(async () => {
    // Refresh the token on backend to extend the session
    try {
      const result = await dispatch(refreshTokenAction());
      if (result.error) {
        Logger.error('Token refresh on stay logged in failed:', result.error);
        await dispatch(logoutUserAction());
        navigate('/');
        return;
      }
      Logger.info('Session extended via token refresh');
    } catch (error) {
      Logger.error('Stay logged in refresh error:', error);
    }
    resetTimer();
  }, [resetTimer, dispatch, navigate]);

  // Check login status on app start and pre-fetch user details before removing loader
  const initializeApp = useCallback(async () => {
    try {
      // Run version check, login check, and public system-status check in parallel
      const [shouldContinue, loginResult, statusResult] = await Promise.all([checkAppVersion(), dispatch(checkLoginStatus()), dispatch(checkSystemStatusAction())]);

      if (!shouldContinue) {
        return;
      } // Page is reloading for new version

      Logger.info('Login status checked:', loginResult);

      // Pre-fetch user details so Header doesn't show "undefined" on refresh.
      // Skip during maintenance for non-admins — the request would just 503 and the
      // Maintenance screen renders anyway.
      const loggedInUser = loginResult?.payload?.user;
      const loggedInRole = Array.isArray(loggedInUser?.roles) && loggedInUser.roles.length > 0 ? loggedInUser.roles[0].slug : null;
      const maintenanceForUser = statusResult?.payload?.maintenanceMode && loggedInRole !== 'system_admin';
      if (loginResult?.payload?.isLoggedIn && loggedInUser?.id && !maintenanceForUser) {
        await dispatch(getLoggedInUserDetailsAction(loggedInUser.id));
      }
    } catch (error) {
      Logger.error('Error initializing app:', error);
    } finally {
      setInitializing(false);
    }
  }, [dispatch]);

  // Fires once the first routed screen has actually mounted (see BootReady, rendered inside
  // Suspense — it only commits after the lazy chunk resolves). Tear down the static splash
  // then, so the boot is one continuous logo: splash → first screen, with no loader in between.
  const handleBootReady = useCallback(() => {
    document.getElementById('app-loader')?.remove();
    setBooted(true);
  }, []);

  useEffect(() => {
    initializeApp();

    // Safety net: never stay stuck on the loader
    const timeout = setTimeout(() => {
      setInitializing(prev => {
        if (prev) {
          Logger.warn('Initialization timed out — forcing app to render');
        }
        return false;
      });
    }, INIT_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [initializeApp]);

  // Show loading while checking authentication. The static splash (index.html #app-loader)
  // is still covering the screen at this point, so render nothing rather than mount a
  // second, size-mismatched logo over it.
  if (initializing) {
    return null;
  }

  // Logged-in non-admins are gated to the Maintenance screen; unauthenticated visitors keep
  // the login flow so a system_admin can still sign in and bypass maintenance.
  let mainElement;
  if (!isUserLoggedIn) {
    mainElement = <PublicNavigator />;
  } else if (inMaintenance) {
    mainElement = (
      <Page title="System Maintenance">
        <Maintenance />
      </Page>
    );
  } else {
    mainElement = <UserNavigator />;
  }

  return (
    <>
      {/* Outside Suspense so it also catches a lazy chunk that fails to load, not just render errors. */}
      <AppErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={booted ? <FullScreenLoader loading={true} /> : null}>
          <BootReady onReady={handleBootReady} />
          <Routes>
            {/* Universal public route — renders regardless of auth state so QR-code verify links work for everyone. */}
            <Route
              path="/certified-enterprises"
              element={
                <Page title="Verify Certificate">
                  <CertifiedEnterprise />
                </Page>
              }
            />
            {/* Universal public route — the URL declared to the Play Store and App Store
                listings, so it must resolve for a signed-out visitor and a store reviewer. */}
            <Route
              path="/privacy-policy"
              element={
                <Page title="Privacy Policy">
                  <PrivacyPolicy />
                </Page>
              }
            />
            <Route path="/*" element={mainElement} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
      <IdleTimeoutWarning show={isWarning} remainingSeconds={remainingSeconds} onStayLoggedIn={handleStayLoggedIn} onLogout={handleIdleLogout} logoutLoading={logoutLoading} />
    </>
  );
};

export default ApplicationNavigator;
