import { format, isValid } from 'date-fns';
import { Formik } from 'formik';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Image,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { useDispatch, useSelector } from 'react-redux';
import * as yup from 'yup';
import { Responsive } from '../../assets/theme/Layout';
import { commonStyles, layout } from '../../assets/theme/Styles';
import { COLORS, FONT_SIZE } from '../../assets/theme/Theme';
import AppButton from '../../components/base/AppButton';
import AppInput from '../../components/base/textInput/AppInput';
import AppPasswordInput from '../../components/base/textInput/AppPasswordInput';
import { AppCommonModal, OtpVerificationModal } from '../../components/modals';
import AppScrollView from '../../components/shared/AppScrollView';
import ApplicationLoader from '../../components/shared/Loader';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import {
  checkActiveSessionAction,
  loginUserAction,
  resendLoginOtpAction,
  verifyLoginOtpAction
} from '../../redux/action/accountAction';
import { resetLoginData, resetLoginError, resetOtpState } from '../../redux/slices/accountSlice';
import { Logger, responsiveHeight, responsiveWidth } from '../../utils';
import { getDeviceId } from '../../utils/deviceId';
import { checkFreeDiskSpace, formatBytes, MIN_FREE_DISK_BYTES } from '../../utils/diskSpace';
import { mapAuthError } from '../../utils/errorMessages';

// react-native-device-info v9+ exposes a synchronous, user-assigned device
// name (e.g. "John's iPhone"); fall back to the model when it's unavailable
// or returns the generic "unknown" placeholder.
const getDeviceName = () => {
  try {
    const name = DeviceInfo.getDeviceNameSync();
    if (name && name.toLowerCase() !== 'unknown') {
      return name;
    }
  } catch (error) {
    Logger.warn('Failed to read device name:', error?.message || error);
  }
  return DeviceInfo.getModel();
};

const buildDeviceConflictMessage = (device) => {
  const label = device?.deviceName || device?.deviceType || 'another device';
  let lastActiveClause = '';
  if (device?.lastActivityAt) {
    const lastActive = new Date(device.lastActivityAt);
    if (isValid(lastActive)) {
      lastActiveClause = `, last active ${format(lastActive, 'd MMM, yyyy hh:mm a')}`;
    }
  }
  return `You're already logged in on another device (${label}${lastActiveClause}). Continuing will end that session and any unsaved work there may be lost.`;
};

const Login = () => {
  const dispatch = useDispatch();
  const [showFailModal, setShowFailModal] = useState(false);
  const [errormsg, setErrormsg] = useState('');
  const [diskState, setDiskState] = useState({
    sufficient: false,
    freeBytes: 0,
    minBytes: MIN_FREE_DISK_BYTES,
    checked: false
  });
  const [deviceConflictModalVisible, setDeviceConflictModalVisible] = useState(false);
  const [pendingLoginPayload, setPendingLoginPayload] = useState(null);
  const [conflictDevice, setConflictDevice] = useState(null);

  const runDiskCheck = useCallback(async () => {
    const result = await checkFreeDiskSpace();
    setDiskState({ ...result, checked: true });
  }, []);

  // Open the device's storage management so the user can free space, then
  // re-run the disk check. Android exposes a public storage-settings intent;
  // iOS has no public storage deep-link, so we fall back to the app settings.
  const openStorageSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.INTERNAL_STORAGE_SETTINGS');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      Logger.warn('Failed to open storage settings:', error?.message || error);
      Linking.openSettings().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    runDiskCheck();
  }, [runDiskCheck]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runDiskCheck();
      }
    });
    return () => subscription.remove();
  }, [runDiskCheck]);

  const readyToLogin = diskState.sufficient;
  const {
    loginUserStarts,
    loginUserLoading,
    loginUserError,
    logindata,
    requiresOtp,
    sessionToken,
    otpVerifyLoading,
    otpVerifyError,
    otpResendLoading
  } = useSelector((state) => state.account);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const handleVerifyOtp = useCallback(
    async (code) => {
      const deviceId = await getDeviceId();
      dispatch(verifyLoginOtpAction({ sessionToken, otp: code, deviceId }));
    },
    [dispatch, sessionToken]
  );

  const handleResendOtp = useCallback(() => {
    dispatch(resendLoginOtpAction({ sessionToken }));
  }, [dispatch, sessionToken]);

  const closeOtpModal = useCallback(() => {
    setOtp('');
    dispatch(resetOtpState());
  }, [dispatch]);

  const passwordValidationRules = {
    minLength: 7,
    maxLength: 16,
    hasUppercase: /[A-Z]/,
    hasLowercase: /[a-z]/,
    hasNumber: /\d/,
    hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/
  };
  const loginValidationSchema = yup.object().shape({
    samarId: yup.string().required('SAMAR ID is required'),
    password: yup
      .string()
      .min(
        passwordValidationRules.minLength,
        ({ min }) => `Password must be at least ${min} characters`
      )
      .max(
        passwordValidationRules.maxLength,
        ({ max }) => `Password cannot exceed ${max} characters`
      )
      .required('Password is required')
  });

  useEffect(() => {
    if (loginUserLoading) {
      ApplicationLoader.show('login');
    } else {
      ApplicationLoader.hide('login');
    }

    if (loginUserError) {
      setShowFailModal(true);
      setErrormsg(mapAuthError(loginUserError));
      Logger.error('Login Error:', loginUserError);

      setTimeout(() => {
        setShowFailModal(false);
        dispatch(resetLoginError());
      }, 2000);
    } else if (loginUserStarts) {
      ApplicationLoader.hide('login');

      if (logindata && loginUserStarts?.data) {
        dispatch(resetLoginData());
      }
    }
  }, [loginUserStarts, loginUserError, loginUserLoading]);
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
            onSubmit={async (values) => {
              // Ignore a second submit while a login / session-check is already
              // in flight (double-tap, OTP resend, etc).
              if (loading || loginUserLoading) {
                return;
              }
              if (!diskState.sufficient) {
                Logger.warn(
                  `Login blocked — insufficient disk space: ${formatBytes(diskState.freeBytes)}`
                );
                return;
              }
              const deviceId = await getDeviceId();
              const encryptedValues = {
                ...values,
                password: values.password,
                deviceType: Platform.OS,
                deviceName: getDeviceName(),
                deviceId
              };
              Logger.info('Submitting login form with values:', encryptedValues);

              try {
                setLoading(true);
                const result = await dispatch(
                  checkActiveSessionAction({
                    samarId: encryptedValues.samarId,
                    password: encryptedValues.password,
                    deviceType: encryptedValues.deviceType,
                    deviceId: encryptedValues.deviceId
                  })
                ).unwrap();

                if (result?.hasActiveSession) {
                  setPendingLoginPayload(encryptedValues);
                  setConflictDevice(result.device || null);
                  setDeviceConflictModalVisible(true);
                  setLoading(false);
                  return;
                }
              } catch (error) {
                // Pre-check must never block login on its own failure — fall
                // through to the normal login attempt.
                Logger.warn(
                  'Active session check failed, proceeding with normal login:',
                  error?.message || error
                );
              }

              setLoading(false);
              dispatch(loginUserAction(encryptedValues));
            }}>
            {({ handleSubmit, handleChange, handleBlur, values, errors, touched }) => (
              <View>
                <View style={styles.mainContainer}>
                  <View
                    style={{
                      paddingTop: responsiveHeight(60),
                      paddingHorizontal: responsiveWidth(20)
                    }}>
                    <Text
                      style={[
                        commonStyles.FontFamily_SemiBold600,
                        layout.textCenter,
                        { color: COLORS.text.heading, fontSize: FONT_SIZE.fs24 }
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
                          fontSize: FONT_SIZE.fs12
                        }
                      ]}>
                      Login with registered credentials to continue
                    </Text>
                    <View style={{ paddingTop: responsiveHeight(32) }}>
                      <AppInput
                        asterisk={true}
                        name="samarId"
                        label="SAMAR ID"
                        InputIcon={Icons.sms}
                        placeholderText="Enter your SAMAR ID"
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
                        onChange={handleChange('password')}
                        onBlur={handleBlur('password')}
                        onError={errors.password && touched.password ? errors.password : null}
                        errors={errors.password && touched.password}
                      />
                    </View>
                    {diskState.checked && !diskState.sufficient && (
                      <View style={styles.storageBanner}>
                        <View style={styles.storageHeader}>
                          <Image source={Icons.WarningAlert} style={styles.storageIcon} />
                          <Text style={styles.storageTitle}>Insufficient storage</Text>
                        </View>
                        <Text style={styles.storageBody}>
                          At least {formatBytes(diskState.minBytes)} of space is required to conduct
                          an assessment. You currently have {formatBytes(diskState.freeBytes)} free.
                          Please free up storage and retry.
                        </Text>
                        <TouchableOpacity
                          style={styles.storageButton}
                          activeOpacity={0.6}
                          onPress={openStorageSettings}>
                          <Text style={styles.storageButtonText}>Manage Settings</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={[styles.buttonContainer, { marginTop: responsiveHeight(40) }]}>
                      <AppButton
                        width={'100%'}
                        title="Login"
                        variant="primary"
                        size="large"
                        disabled={loginUserLoading || loading || !readyToLogin}
                        loader={loginUserLoading || loading}
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
              </View>
            )}
          </Formik>
        </View>
      </View>
      <AppCommonModal
        title={'Login Failed'}
        imgsrc={Icons.error}
        showmodal={showFailModal}
        onClose={() => setShowFailModal(false)}
        type="error"
        subTitle={errormsg}
      />
      <AppCommonModal
        showmodal={deviceConflictModalVisible}
        imgsrc={Images.modalPendingImage}
        title="Already Logged In"
        subTitle={buildDeviceConflictMessage(conflictDevice)}
        twoButtonModal={true}
        leftButtonText="Cancel"
        LeftonPress={() => {
          setDeviceConflictModalVisible(false);
          setPendingLoginPayload(null);
          setConflictDevice(null);
        }}
        rightButtonText="Continue"
        onPress={() => {
          setDeviceConflictModalVisible(false);
          if (pendingLoginPayload) {
            dispatch(loginUserAction(pendingLoginPayload));
          }
          setPendingLoginPayload(null);
          setConflictDevice(null);
        }}
        leftButtonColor={COLORS.primary.soft}
        LeftbuttonTextColor={COLORS.primary.main}
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
    marginTop: Responsive.height(20)
  },
  container: {
    backgroundColor: COLORS.background.primary,
    flex: 1
  },
  welcomeBG: {
    height: Responsive.height(369),
    width: '100%'
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Responsive.height(40),
    gap: Responsive.width(6),
    paddingBottom: Responsive.height(40)
  },
  samar: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain'
  },
  government: {
    height: Responsive.height(32),
    width: Responsive.width(21),
    resizeMode: 'contain'
  },
  drdo: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain'
  },
  qci: {
    height: Responsive.height(32),
    width: Responsive.width(32),
    resizeMode: 'contain'
  },
  logoSeparator: {
    width: 1,
    height: Responsive.height(24),
    backgroundColor: COLORS.border.light
  },
  welcomeBannerContainer: { height: Responsive.height(265), width: '100%' },
  mainContainer: { flex: 1, justifyContent: 'space-between' },
  storageBanner: {
    marginTop: Responsive.height(20),
    padding: Responsive.width(14),
    borderRadius: Responsive.width(8),
    backgroundColor: '#FFF6E5',
    borderWidth: 1,
    borderColor: '#F2C94C'
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Responsive.width(8),
    marginBottom: Responsive.height(6)
  },
  storageIcon: {
    width: Responsive.width(18),
    height: Responsive.height(18),
    resizeMode: 'contain'
  },
  storageTitle: {
    fontSize: FONT_SIZE.fs14,
    color: '#E59400',
    ...commonStyles.FontFamily_SemiBold600
  },
  storageBody: {
    fontSize: FONT_SIZE.fs12,
    color: COLORS.text.tertiary,
    lineHeight: Responsive.height(18),
    ...commonStyles.FontFamily_Medium500
  },
  storageButton: {
    marginTop: Responsive.height(12),
    paddingVertical: Responsive.height(12),
    borderRadius: Responsive.width(8),
    backgroundColor: COLORS.primary.main,
    alignItems: 'center',
    justifyContent: 'center'
  },
  storageButtonText: {
    color: COLORS.text.white,
    fontSize: FONT_SIZE.fs14,
    ...commonStyles.FontFamily_SemiBold600
  }
});
