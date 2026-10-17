import { Form, Formik } from 'formik';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppCaptcha, AppModal } from '../../components/base';
import AppButton from '../../components/base/AppButton';
import BrandLogo from '../../components/base/BrandLogo';
import LoginQuickLinks from '../../components/base/LoginQuickLinks';
import AppInput from '../../components/base/textInput/AppInput';
import { toastError, toastSuccess } from '../../components/base/toast';
import { InstructionModal, OTPVerificationModal } from '../../components/modals';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import useBranding from '../../hooks/useBranding';
import { checkActiveSessionAction, loginUserAction, loginVerifyOTPUserAction, resendLoginOtpAction } from '../../redux/action/common/AccountAction';
import { Logger } from '../../utils/logger';

// Public/auth routes that must never be used as a post-login destination —
// falling back to the role dashboard instead of bouncing back to login.
const PUBLIC_PATHS = new Set(['/', '/register', '/new-password', '/forgot-password', '/password-reset-link', '/maintenance']);

// Helper function to get user-friendly error message
const getErrorMessage = error => {
  // Map technical errors to user-friendly messages
  const errorMap = {
    'Invalid credentials': 'The SAMAR ID or password you entered is incorrect. Please try again.',
    'Invalid credentials.': 'The SAMAR ID or password you entered is incorrect. Please try again.',
    'User not found': 'No account found with this SAMAR ID. Please check your SAMAR ID or sign up.',
    'Account locked': 'Your account has been temporarily locked. Please try again later or contact support.',
    'Email not verified': 'Please verify your email address before logging in.',
    'Too many attempts': 'Too many login attempts. Please wait a few minutes and try again.',
  };

  // Credential and lockout failures now arrive as the top-level `message`
  // (AuthenticationFailedException). `errors.debug` is only ever populated when
  // APP_DEBUG is on, so nothing user-facing may depend on it.
  const candidates = [error?.samarId?.[0], error?.message];
  const mapped = candidates.find(candidate => candidate && errorMap[candidate]);
  if (mapped) {
    return errorMap[mapped];
  }

  return error?.samarId?.[0] || error?.message || 'Unable to log in. Please try again or contact support.';
};

const Login = () => {
  const [showManualModal, setShowManualModal] = useState(false);
  const handleCloseManualModal = () => setShowManualModal(false);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loginPicture = useBranding().login_picture?.image;
  const location = useLocation();
  // Snapshot the URL the user actually requested (a logged-out deep link renders
  // Login in place without changing the address bar), so we can return them there
  // after login instead of the fixed dashboard. Captured once at mount.
  const [postLoginTarget] = useState(() => {
    const intended = `${location.pathname}${location.search}`;
    return PUBLIC_PATHS.has(location.pathname) ? '/' : intended;
  });
  const [showPassword, setShowPassword] = useState(false);
  const [otpVerificationModal, setOtpVerificationModal] = useState(false);
  const [otp, setOtp] = useState('');

  const [_apiErrors, setApiErrors] = useState('');
  const [deviceConflictModal, setDeviceConflictModal] = useState(false);
  const [conflictDevice, setConflictDevice] = useState(null);
  const [pendingCredentials, setPendingCredentials] = useState(null);
  const { loginLoading, loginData, loginVerifyLoading, loginVerifyError, isUserLoggedIn, user } = useSelector(state => state.Account);
  const handleTogglePassword = () => {
    setShowPassword(prev => !prev);
  };
  // The captcha id belongs to the request payload, not the form fields the user
  // edits, so it lives outside Formik. Bumping reloadToken draws a fresh
  // challenge — required after any failed attempt, since each one is single-use.
  const [captchaId, setCaptchaId] = useState('');
  const [captchaReloadToken, setCaptchaReloadToken] = useState(0);
  const [captchaServerError, setCaptchaServerError] = useState('');
  const refreshCaptcha = useCallback(() => setCaptchaReloadToken(token => token + 1), []);
  const formikRef = useRef(null);
  // Every failed attempt spends the current challenge. Clear the typed value and
  // draw a fresh one together, so the next submit is never judged against a
  // stale captcha id — the single reset used by every failure path.
  const resetCaptchaChallenge = useCallback(() => {
    formikRef.current?.setFieldValue('captcha', '');
    refreshCaptcha();
  }, [refreshCaptcha]);

  // A failed auth attempt is either a captcha failure (shown inline under the
  // field) or a credential/other failure (toasted). Every path spends the
  // current challenge, so it always resets.
  const handleAuthError = error => {
    const captchaError = error?.errors?.captcha?.[0];
    if (captchaError) {
      setCaptchaServerError(captchaError);
    } else {
      const message = getErrorMessage(error);
      setApiErrors(message);
      toastError(message);
    }
    resetCaptchaChallenge();
  };

  const initialValues = {
    samarId: '',
    password: '',
    captcha: '',
  };

  // SAMAR ID format: SAMAR-DDMMYY-ID (e.g., SAMAR-080125-123)
  const samarIdRegex = /^SAMAR-\d{6}-\d+$/i;

  // Off when the System Admin has switched the security code off.

  const [captchaEnabled, setCaptchaEnabled] = useState(true);

  const validationSchema = Yup.object({
    samarId: Yup.string().max(320, 'SAMAR ID cannot exceed 320 characters').required('SAMAR ID is required').matches(samarIdRegex, 'SAMAR ID must be valid (e.g., SAMAR-080125-123)'),
    password: Yup.string()
      .min(7, 'Password must be at least 7 characters')
      .max(20, 'Password cannot exceed 20 characters')

      .required('Password is required'),
    captcha: captchaEnabled ? Yup.string().required('Enter the security code') : Yup.string(),
  });

  useEffect(() => {
    try {
      const message = sessionStorage.getItem('session_terminated_message') || sessionStorage.getItem('logout_reason');
      if (message) {
        toastError(message, { title: 'Signed out' });
      }
      sessionStorage.removeItem('session_terminated_message');
      sessionStorage.removeItem('logout_reason');
    } catch {
      // sessionStorage may not be available
    }
  }, []);

  useEffect(() => {
    if (loginVerifyError) {
      toastError(loginVerifyError?.message);
    }
  }, [loginVerifyError]);
  const handleVerifyOtp = async () => {
    try {
      await dispatch(loginVerifyOTPUserAction({ sessionToken: loginData?.sessionToken, otp })).unwrap();
      navigate(postLoginTarget, { replace: true });
    } catch (error) {
      Logger.error('Verify OTP failed:', error);
      // Clear OTP on failed verification so user can enter a new one
      setOtp('');
    }
  };

  // Resend OTP handler: dispatches resendLoginOtpAction with the active session token
  const handleResendOtp = async () => {
    try {
      await dispatch(resendLoginOtpAction({ sessionToken: loginData?.sessionToken })).unwrap();
      Logger.info('Resend OTP succeeded');
      toastSuccess('A new OTP has been sent to your registered email.', { title: 'OTP sent' });
    } catch (error) {
      Logger.error('Resend OTP failed:', error);
      const message = getErrorMessage(error?.message) || 'Failed to resend OTP. Please try again.';
      setApiErrors(message);
      toastError(message);
    }
  };

  const doLogin = async creds => {
    await dispatch(loginUserAction({ samarId: creds.samarId, password: creds.password })).unwrap();
  };

  const handleSubmit = async values => {
    const creds = { samarId: values.samarId, password: values.password };
    Logger.info('Login attempt:', values.samarId);
    try {
      setLoading(true);
      setCaptchaServerError('');
      const result = await dispatch(checkActiveSessionAction({ ...creds, captchaId, captcha: values.captcha })).unwrap();
      if (result?.hasActiveSession) {
        setPendingCredentials(creds);
        setConflictDevice(result.device);
        setDeviceConflictModal(true);
        return;
      }
      await doLogin(creds);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeviceConflict = async () => {
    setDeviceConflictModal(false);
    if (!pendingCredentials) {
      return;
    }
    try {
      await doLogin(pendingCredentials);
    } catch (error) {
      handleAuthError(error);
    }
  };

  const cancelDeviceConflict = () => {
    setDeviceConflictModal(false);
    setPendingCredentials(null);
    setConflictDevice(null);
  };

  const conflictDeviceLabel = conflictDevice ? `${conflictDevice.deviceType || 'another device'}${conflictDevice.deviceName ? ` (${conflictDevice.deviceName})` : ''}` : 'another device';

  useEffect(() => {
    if (loginData?.requiresOtp) {
      setOtpVerificationModal(true);
    } else if (loginData) {
      navigate(postLoginTarget, { replace: true });
    }
  }, [loginData, isUserLoggedIn]);

  return (
    // login-onepage: fits the whole page in one screen on desktop (responsive.css).
    <section className="login login-onepage">
      <Container fluid>
        <Row>
          <Col xl={5} lg={6} className="d-none d-lg-block position-relative">
            <div className="login-bg-container">
              {/* Settings → Branding & Logos → Login Page Picture; an uploaded one is cropped to the circle. */}
              <img src={loginPicture || Images.loginBg} alt="" className={`login-bg${loginPicture ? ' login-bg--custom' : ''}`} />
            </div>
            <LoginQuickLinks />
          </Col>
          <Col xl={7} lg={6} xs={12}>
            <div className="publicMainContainer">
              <BrandLogo brandKey="drdo_logo" fallback={Images.defenceResearch} alt="Defence Research" className="logo50" />
              <BrandLogo brandKey="qci_logo" fallback={Images.qualityCouncil} alt="Quality Council" className="logo50" />
            </div>
            <div className="publicFormMainContainer position-relative">
              <div className="publicFormTopMainContainer">
                <BrandLogo brandKey="samar_logo" fallback={Images.samarLogo} alt="logo" className="samarLogo" />
                <h2 className="fs-24 fw-500 margin-top-40 mb-2">
                  Welcome to <span style={{ color: 'var(--info-dark)' }}>SAMAR</span>
                </h2>
                <p className="fs-14 fw-500 mb-0">Login with registered credentials to continue</p>
                <Formik innerRef={formikRef} initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
                  {({ values, errors, touched, handleChange, handleBlur }) => (
                    <Form className="w-100">
                      <div className="margin-top-32">
                        <AppInput
                          labelAbove
                          name="samarId"
                          value={values.samarId}
                          upperCase={true}
                          // stripWhitespace={true}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Enter your SAMAR ID"
                          label="SAMAR ID"
                          isRequired
                          error={touched.samarId && errors.samarId ? errors.samarId : ''}
                          maxLength={320}
                          autoComplete="off"
                        />
                      </div>
                      <div className="margin-top-20">
                        <AppInput
                          labelAbove
                          name="password"
                          value={values.password}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Enter Password"
                          label="Password"
                          isRequired
                          type={showPassword ? 'text' : 'password'}
                          rightIcon={showPassword ? Icons.eye : Icons.eyeSlash}
                          onRightIconClick={handleTogglePassword}
                          error={touched.password && errors.password ? errors.password : ''}
                          maxLength={20}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="margin-top-20">
                        <AppCaptcha
                          onEnabledChange={setCaptchaEnabled}
                          value={values.captcha}
                          onChange={e => {
                            setCaptchaServerError('');
                            handleChange(e);
                          }}
                          onBlur={handleBlur}
                          error={captchaServerError || (touched.captcha && errors.captcha ? errors.captcha : '')}
                          onCaptchaIdChange={setCaptchaId}
                          reloadToken={captchaReloadToken}
                        />
                      </div>
                      <div className="d-flex justify-content-end">
                        <Link to="/forgot-password" className="text-decoration-none">
                          <p className="fs-14 fw-600 margin-top-6 mb-0 primary-color">Forgot Password?</p>
                        </Link>
                      </div>

                      <div className="margin-top-40">
                        <AppButton title="Login" customClass="w-100" size="large" type="submit" disabled={loginLoading} loading={loading || loginLoading} />
                      </div>
                    </Form>
                  )}
                </Formik>
                {/* Highlighted entry point for first-time users (opens the registration instructions). */}
                <section className="new-user-panel margin-top-24" aria-labelledby="new-user-title">
                  <div>
                    <h3 id="new-user-title" className="new-user-title">
                      New user?
                    </h3>
                    <p className="new-user-text">First time here? Register your enterprise to apply for SAMAR certification.</p>
                  </div>
                  <button type="button" className="new-user-button" onClick={() => setShowManualModal(true)}>
                    Register now
                  </button>
                </section>
                {/* Below lg the picture column is hidden; keep the quick links reachable. */}
                <LoginQuickLinks compact className="d-lg-none margin-top-16" />
              </div>
              <div className="publicFormBottomMainContainer">
                <p className="fs-12 fw-500 text-2-color mb-0">
                  Copyright © 2026, <span className="text-1-color">DRDO, Ministry of Defence, Government of India</span>
                </p>
                <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" className="fs-12 fw-600 primary-color text-decoration-none margin-top-6 d-inline-block">
                  Privacy Policy
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </Link>
              </div>
            </div>
          </Col>
        </Row>
        <InstructionModal open={showManualModal} handleCloseManualModal={handleCloseManualModal} />
        <OTPVerificationModal
          show={otpVerificationModal}
          handleClose={() => setOtpVerificationModal(false)}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
          otp={otp}
          setOtp={setOtp}
          data={user}
          loading={loginVerifyLoading}
        />

        <AppModal
          modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
          image={Icons.redConfirmIcon}
          show={deviceConflictModal}
          handleClose={cancelDeviceConflict}
          header={'Already logged in elsewhere'}
          subHeader={`Your account is currently signed in on ${conflictDeviceLabel}. Continuing will log you out from that device.`}
          twoButtons
          leftButton={'Cancel'}
          leftButtonClassName={'w-100 secondary'}
          leftButtonOnClick={cancelDeviceConflict}
          rightButton={'Continue'}
          rightButtonClassName={'w-100 danger-primary'}
          rightButtonLoading={loginLoading}
          rightButtonOnClick={confirmDeviceConflict}
        />
      </Container>
    </section>
  );
};
export default Login;
