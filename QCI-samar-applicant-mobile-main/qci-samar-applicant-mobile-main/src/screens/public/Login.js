import { Formik } from 'formik';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as yup from 'yup';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles, layout } from '../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../assets/theme/Theme';
import AppButton from '../../components/base/AppButton';
import AppInput from '../../components/base/textInput/AppInput';
import AppPasswordInput from '../../components/base/textInput/AppPasswordInput';
import AppCommonModal from '../../components/modals/AppCommonModal';
import OtpVerificationModal from '../../components/modals/OtpVerificationModal';
import AppScrollView from '../../components/shared/AppScrollView';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import {
  checkActiveSessionAction,
  loginUserAction,
  resendLoginOtpAction,
  verifyLoginOtpAction,
} from '../../redux/action/accountAction';
import { resetLoginError, resetOtpState } from '../../redux/slices/accountSlice';
import { Logger, responsiveHeight, responsiveWidth } from '../../utils';
import { getDeviceId } from '../../utils/deviceId';

/**
 * Login screen.
 * Layout ported from the QCI Assessor app. Submit dispatches the login thunk;
 * on success the navigator swaps to the user stack via redux `isLoggedIn`.
 */
const passwordValidationRules = {
  minLength: 7,
  maxLength: 16,
};

const formatLastActive = isoString => {
  if (!isoString) {
    return null;
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildDeviceConflictSubtitle = device => {
  const deviceLabel = device?.deviceName || device?.deviceType || 'another device';
  const lastActive = formatLastActive(device?.lastActivityAt);
  const lastActiveClause = lastActive ? `, last active ${lastActive}` : '';
  return `You're already logged in on another device (${deviceLabel}${lastActiveClause}). Continuing will end that session and any unsaved work there may be lost.`;
};

const loginValidationSchema = yup.object().shape({
  samarId: yup.string().required('SAMAR ID is required'),
  password: yup
    .string()
    .min(
      passwordValidationRules.minLength,
      ({ min }) => `Password must be at least ${min} characters`,
    )
    .max(passwordValidationRules.maxLength, ({ max }) => `Password cannot exceed ${max} characters`)
    .required('Password is required'),
});

const Login = () => {
  const dispatch = useDispatch();
  const {
    loginUserLoading,
    loginUserError,
    requiresOtp,
    sessionToken,
    otpVerifyLoading,
    otpVerifyError,
    otpResendLoading,
  } = useSelector(state => state.account);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceConflictModalVisible, setDeviceConflictModalVisible] = useState(false);
  const [conflictDevice, setConflictDevice] = useState(null);
  const [pendingLoginPayload, setPendingLoginPayload] = useState(null);

  const closeLoginErrorModal = useCallback(() => {
    dispatch(resetLoginError());
  }, [dispatch]);

  const closeDeviceConflictModal = useCallback(() => {
    setDeviceConflictModalVisible(false);
    setConflictDevice(null);
    setPendingLoginPayload(null);
  }, []);

  const continueDeviceConflictLogin = useCallback(() => {
    setDeviceConflictModalVisible(false);
    setConflictDevice(null);
    if (pendingLoginPayload) {
      dispatch(loginUserAction(pendingLoginPayload));
    }
    setPendingLoginPayload(null);
  }, [dispatch, pendingLoginPayload]);

  const handleVerifyOtp = useCallback(
    async code => {
      const deviceId = await getDeviceId();
      dispatch(verifyLoginOtpAction({ sessionToken, otp: code, deviceId }));
    },
    [dispatch, sessionToken],
  );

  const handleResendOtp = useCallback(() => {
    dispatch(resendLoginOtpAction({ sessionToken }));
  }, [dispatch, sessionToken]);

  const closeOtpModal = useCallback(() => {
    setOtp('');
    dispatch(resetOtpState());
  }, [dispatch]);

  // Clear any stale login error when the screen mounts.
  useEffect(() => {
    dispatch(resetLoginError());
  }, [dispatch]);

  return (
    <AppScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
      <StatusBar translucent={true} backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.container}>
        <View style={layout.fill}>
          <View style={styles.welcomeBannerContainer}>
            <Image source={Images.loginbg} style={styles.welcomeBG} />
          </View>
          <Formik
            validationSchema={loginValidationSchema}
            initialValues={{ samarId: '', password: '' }}
            onSubmit={async values => {
              // Ignore a second submit while a login / session-check is already
              // in flight (double-tap, OTP resend, etc).
              if (loading || loginUserLoading) {
                return;
              }

              const deviceId = await getDeviceId();
              // API requires camelCase keys; the backend's request middleware
              // rejects snake_case and converts camelCase to snake_case server-side.
              const payload = {
                samarId: values.samarId,
                password: values.password,
                deviceType: Platform.OS,
                deviceName: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
                deviceId,
              };

              try {
                setLoading(true);
                const result = await dispatch(
                  checkActiveSessionAction({
                    samarId: payload.samarId,
                    password: payload.password,
                    deviceType: payload.deviceType,
                    deviceId: payload.deviceId,
                  }),
                ).unwrap();

                if (result?.hasActiveSession) {
                  setPendingLoginPayload(payload);
                  setConflictDevice(result.device || null);
                  setDeviceConflictModalVisible(true);
                  return;
                }
              } catch (checkError) {
                // The pre-login check is a best-effort warning only - never block
                // login because the check itself failed (network error, endpoint
                // down, etc).
                Logger.warn('Active session check failed, proceeding with login:', checkError);
              }
              setLoading(false);
              Logger.info('Submitting login form');
              dispatch(loginUserAction(payload));
            }}>
            {({ handleSubmit, handleChange, handleBlur, values, errors, touched }) => (
              <View style={styles.mainContainer}>
                <View
                  style={{
                    paddingTop: responsiveHeight(60),
                    paddingHorizontal: responsiveWidth(20),
                  }}>
                  <Text
                    style={[
                      commonStyles.FontFamily_SemiBold600,
                      layout.textCenter,
                      { color: COLORS.text.heading, fontSize: FONT_SIZE.fs24 },
                    ]}>
                    Welcome!
                  </Text>
                  <Text
                    style={[
                      commonStyles.FontFamily_Medium500,
                      layout.textCenter,
                      {
                        paddingTop: responsiveHeight(6),
                        color: COLORS.text.tertiary,
                        fontSize: FONT_SIZE.fs12,
                      },
                    ]}>
                    Login with registered credentials to continue
                  </Text>
                  <View style={{ paddingTop: responsiveHeight(32) }}>
                    <AppInput
                      asterisk={true}
                      name="samarId"
                      label="SAMAR ID"
                      InputIcon={Icons.smarId}
                      placeholderText="Enter your SAMAR ID"
                      value={values.samarId}
                      onChange={handleChange('samarId')}
                      keyboardType="default"
                      cap="characters"
                      autoComplete="username"
                      textContentType="username"
                      onBlur={handleBlur('samarId')}
                      onError={errors.samarId && touched.samarId ? errors.samarId : null}
                      errors={errors.samarId && touched.samarId}
                    />
                  </View>
                  <View style={{ paddingTop: responsiveHeight(15) }}>
                    <AppPasswordInput
                      asterisk={true}
                      name="password"
                      label="Password"
                      InputIcon={Icons.lock}
                      placeholderText="Enter Password"
                      autoCapitalize="none"
                      autoComplete="current-password"
                      textContentType="password"
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                      val={values.password}
                      onChange={handleChange('password')}
                      onBlur={handleBlur('password')}
                      onError={errors.password && touched.password ? errors.password : null}
                      errors={errors.password && touched.password}
                    />
                  </View>
                  <View style={[styles.buttonContainer, { marginTop: responsiveHeight(40) }]}>
                    <AppButton
                      width={'100%'}
                      title="Login"
                      variant="primary"
                      size="large"
                      loader={loginUserLoading || loading}
                      disabled={loginUserLoading || loading}
                      onPress={handleSubmit}
                    />
                  </View>
                  <View style={[styles.imageContainer, layout.row]}>
                    <Image source={Images.drdo} style={styles.drdo} />
                    <View style={styles.logoSeparator} />
                    <Image source={Images.government} style={styles.government} />
                    <View style={styles.logoSeparator} />
                    <Image source={Images.qci} style={styles.qci} />
                  </View>
                </View>
              </View>
            )}
          </Formik>
        </View>
      </View>
      <AppCommonModal
        showmodal={!!loginUserError}
        imgsrc={Icons.error}
        title="Login Failed"
        subTitle={loginUserError}
        twoButtonModal={true}
        onebutton={false}
        rightButtonText="OK"
        onPress={closeLoginErrorModal}
        variant="primary"
      />
      <AppCommonModal
        showmodal={deviceConflictModalVisible}
        imgsrc={Images.modalPendingImage}
        leftButtonColor={COLORS.primary.soft}
        LeftbuttonTextColor={COLORS.primary.main}
        title="Already Logged In"
        subTitle={conflictDevice ? buildDeviceConflictSubtitle(conflictDevice) : ''}
        twoButtonModal={true}
        leftButtonText="Cancel"
        LeftonPress={closeDeviceConflictModal}
        rightButtonText="Continue"
        onPress={continueDeviceConflictLogin}
        leftvariant="secondary"
        variant="danger"
      />
      <OtpVerificationModal
        visible={requiresOtp}
        otp={otp}
        setOtp={setOtp}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onClose={closeOtpModal}
        loading={otpVerifyLoading}
        resendLoading={otpResendLoading}
        error={otpVerifyError}
      />
    </AppScrollView>
  );
};

export default Login;

const styles = StyleSheet.create({
  buttonContainer: {
    marginTop: Responsive.height(20),
  },
  container: {
    backgroundColor: COLORS.background.primary,
    flex: 1,
  },
  welcomeBG: {
    height: Responsive.height(369),
    width: '100%',
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Responsive.height(40),
    gap: Responsive.width(10),
    paddingBottom: Responsive.height(40),
  },
  government: {
    height: Responsive.height(32),
    width: Responsive.width(21),
    resizeMode: 'contain',
  },
  drdo: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain',
  },
  logoSeparator: {
    width: 1,
    height: Responsive.height(20),
    backgroundColor: '#EBEDF3',
  },
  qci: {
    height: Responsive.height(32),
    width: Responsive.width(25),
    resizeMode: 'contain',
  },
  samar: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain',
  },
  welcomeBannerContainer: { height: Responsive.height(265), width: '100%' },
  mainContainer: { flex: 1, justifyContent: 'space-between' },
});
