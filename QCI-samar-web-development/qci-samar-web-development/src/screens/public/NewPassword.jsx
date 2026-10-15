import { Form, Formik } from 'formik';
import { OTPInput } from 'input-otp';
import { useCallback, useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppCaptcha, AppModal } from '../../components/base';
import AppButton from '../../components/base/AppButton';
import AppInput from '../../components/base/textInput/AppInput';
import { toastError } from '../../components/base/toast';
import { PublicHeader } from '../../components/layout';
import Icons from '../../constants/Icons';
import { resendPasswordOtpAction, resetPasswordAction } from '../../redux/action/common/AccountAction';
import { resetForgotPasswordData } from '../../redux/slices/common/AccountSlice';
import Api from '../../services/api';
import { Logger } from '../../utils/logger';

const OTP_LENGTH = 6;
const RESEND_INTERVAL = 40;

const NewPassword = () => {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successfulModal, setSuccessfulModal] = useState(false);
  const [errorModal, setErrorModal] = useState(false);
  const [_otp, setOtp] = useState('');
  const [timeLeft, setTimeLeft] = useState(RESEND_INTERVAL);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [_apiErrors, setApiErrors] = useState('');
  const { resetPasswordLoading, resetPasswordError, resetPasswordData } = useSelector(state => state.Account);
  // ForgotPassword passes { samarId } or { email }. A reset started with an
  // email lists that email's accounts once the OTP is confirmed, and the user
  // picks which one to reset (picked automatically when there is only one).
  const startSamarId = location.state?.samarId || '';
  const email = location.state?.email || '';
  const [accounts, setAccounts] = useState(null);
  const [chosenSamarId, setChosenSamarId] = useState('');
  const [checkingOtp, setCheckingOtp] = useState(false);
  const [otpCheckError, setOtpCheckError] = useState('');
  const samarId = email ? chosenSamarId : startSamarId;

  const checkEmailOtp = useCallback(
    async code => {
      setAccounts(null);
      setChosenSamarId('');
      setOtpCheckError('');
      if (!email || code.length !== OTP_LENGTH) {
        return;
      }
      setCheckingOtp(true);
      try {
        const data = await Api.Account.verifyPasswordOtp({ email, otp: code });
        const list = Array.isArray(data?.accounts) ? data.accounts : [];
        setAccounts(list);
        if (list.length === 1) {
          setChosenSamarId(list[0].samarId);
        }
      } catch (error) {
        setOtpCheckError(error?.response?.data?.message || 'The OTP is invalid or has expired.');
      } finally {
        setCheckingOtp(false);
      }
    },
    [email],
  );

  // Kept outside Formik: the challenge id is part of the payload, not a field
  // the user edits. Each challenge is single-use, so a failed attempt reloads it.
  const [captchaId, setCaptchaId] = useState('');
  const [captchaReloadToken, setCaptchaReloadToken] = useState(0);
  const refreshCaptcha = useCallback(() => setCaptchaReloadToken(token => token + 1), []);

  const initialValues = {
    otp: '',
    password: '',
    password_confirmation: '',
    captcha: '',
  };
  const validationSchema = Yup.object({
    otp: Yup.string()
      .required('OTP is required')
      .matches(/^[0-9]+$/, 'OTP must contain only digits')
      .length(OTP_LENGTH, `OTP must be ${OTP_LENGTH} digits`),
    password: Yup.string()
      .min(7, 'Password must be at least 7 characters')
      .max(20, 'Password cannot exceed 20 characters')
      // .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
      // .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
      // .matches(/[0-9]/, 'Password must contain at least one number')
      // .matches(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
      .required('Password is required'),
    password_confirmation: Yup.string()
      .oneOf([Yup.ref('password'), null], 'Passwords must match')
      .required('Confirm password is required'),
    captcha: Yup.string().required('Enter the security code'),
  });

  useEffect(() => {
    if (resetPasswordData?.status === 200) {
      // setSuccessfulModal(true);
      setTimeout(() => {
        setSuccessfulModal(true);
        dispatch(resetForgotPasswordData());
        // navigate('/');
      }, 2000);
    }
    if (resetPasswordError) {
      Logger.error('Reset Password failed:', resetPasswordError);
      setApiErrors(resetPasswordError?.password?.[0] || resetPasswordError.password);
      toastError(resetPasswordError?.message);
      // The challenge was consumed by the attempt; a retry needs a new one.
      refreshCaptcha();
    }
  }, [resetPasswordData, resetPasswordError, successfulModal, navigate, dispatch]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleToggleNewPassword = useCallback(() => {
    setShowNewPassword(prev => !prev);
  }, []);

  const handleToggleConfirmPassword = useCallback(() => {
    setShowConfirmPassword(prev => !prev);
  }, []);

  const _handleOtpChange = useCallback(value => {
    setOtp(value);
  }, []);

  const handlePaste = useCallback(event => {
    event.preventDefault();
  }, []);

  // Modular resend handler with correct dependencies and error handling
  const handleResend = useCallback(() => {
    setTimeLeft(RESEND_INTERVAL);
    Logger.info('Resend OTP requested');
    try {
      dispatch(resendPasswordOtpAction(email ? { email } : { samarId: startSamarId }));
    } catch (error) {
      Logger.error('Resend OTP failed:', error);
      setErrorModal(true);
    }
    // Optionally re-trigger OTP send logic
  }, [dispatch, email, startSamarId]);

  const handleSubmit = async values => {
    if (email && !chosenSamarId) {
      toastError(accounts?.length > 1 ? 'Choose the account whose password you want to reset.' : 'Enter the OTP sent to your email first.');
      return;
    }
    const payload = {
      samarId,
      otp: values.otp,
      password: values.password,
      passwordConfirmation: values.password_confirmation,
      captchaId,
      captcha: values.captcha,
    };
    dispatch(resetPasswordAction(payload));
  };

  return (
    <section className="forgotPasswordSection">
      <PublicHeader />
      <Container>
        <Row className="justify-content-center align-items-center forgotPasswordContainer">
          <Col xs={12} sm={10} md={8} lg={6}>
            <div className="forgotPasswordCard text-center">
              <img src={Icons.keyCircle} alt="lock" className="icon-130" />
              <div className="margin-top-60">
                <h2 className="fs-24 fw-600 heading-color mb-0">New Password</h2>
                <p className="fs-14 fw-500 mb-0 text-2-color margin-top-8 text-center">Enter the verification code sent to your registered email.</p>
                <p className="fs-12 fw-500 mb-0 text-3-color margin-top-6 text-center">If you have not received the OTP, please check your spam folder.</p>
                <div className="margin-top-30">
                  <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
                    {({ values, errors, touched, handleChange, handleBlur, setFieldValue }) => (
                      <Form>
                        <div className="text-center" onPaste={handlePaste}>
                          <OTPInput
                            maxLength={OTP_LENGTH}
                            value={values.otp}
                            onChange={value => {
                              const sanitized = String(value).replace(/[^0-9]/g, '');
                              setFieldValue('otp', sanitized);
                              if (email) {
                                checkEmailOtp(sanitized);
                              }
                            }}
                            containerClassName="otp-container"
                            render={({ slots }) => (
                              <>
                                {slots.map((slot, idx) => (
                                  <div key={idx} className={`otp-each-box transition ${slot.isActive ? 'active' : 'inactive'}`} onClick={slot.onClick} style={{ position: 'relative' }}>
                                    {slot.char}
                                    {slot.isActive && !slot.char && (
                                      <span
                                        className="otp-cursor"
                                        style={{
                                          position: 'absolute',
                                          left: '50%',
                                          top: '50%',
                                          transform: 'translate(-50%, -50%)',
                                          height: '1.5em',
                                          width: '2px',
                                          background: '#1976d2',
                                          animation: 'otp-blink 1s steps(2, start) infinite',
                                          borderRadius: '1px',
                                          display: 'inline-block',
                                        }}
                                      />
                                    )}
                                  </div>
                                ))}
                              </>
                            )}
                          />
                          {touched.otp && errors.otp && <div className="error-text mt-2">{errors.otp}</div>}
                        </div>

                        {email ? (
                          <div className="reset-account-choice text-start margin-top-20">
                            {checkingOtp ? <p className="fs-13 text-3-color mb-0">Checking the code…</p> : null}
                            {otpCheckError ? <div className="error-text">{otpCheckError}</div> : null}
                            {accounts?.length === 1 ? (
                              <p className="fs-14 text-2-color mb-0">
                                Resetting the password for <strong>{accounts[0].samarId}</strong>
                                {accounts[0].role ? ` (${accounts[0].role})` : ''}
                              </p>
                            ) : null}
                            {accounts?.length > 1 ? (
                              <fieldset>
                                <legend className="fs-14 fw-600 heading-color">This email has {accounts.length} accounts. Choose the one to reset:</legend>
                                {accounts.map(account => (
                                  <label key={account.samarId} className={`reset-account-option${chosenSamarId === account.samarId ? ' selected' : ''}`}>
                                    <input type="radio" name="resetAccount" value={account.samarId} checked={chosenSamarId === account.samarId} onChange={() => setChosenSamarId(account.samarId)} />
                                    <span>
                                      <strong>{account.samarId}</strong>
                                      <span className="text-3-color">{[account.name, account.role].filter(Boolean).join(' · ')}</span>
                                    </span>
                                  </label>
                                ))}
                              </fieldset>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="margin-top-30 text-start">
                          <AppInput
                            labelAbove
                            name="password"
                            value={values.password}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Enter New Password"
                            label="New Password"
                            isRequired
                            type={showNewPassword ? 'text' : 'password'}
                            rightIcon={showNewPassword ? Icons.eye : Icons.eyeSlash}
                            onRightIconClick={handleToggleNewPassword}
                            error={touched.password && errors.password ? errors.password : ''}
                            autoComplete="new-password"
                          />
                        </div>
                        <div className="margin-top-20 text-start">
                          <AppInput
                            labelAbove
                            name="password_confirmation"
                            value={values.password_confirmation}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Re-enter your password"
                            label="Confirm Password"
                            isRequired
                            type={showConfirmPassword ? 'text' : 'password'}
                            rightIcon={showConfirmPassword ? Icons.eye : Icons.eyeSlash}
                            onRightIconClick={handleToggleConfirmPassword}
                            error={touched.password_confirmation && errors.password_confirmation ? errors.password_confirmation : ''}
                            autoComplete="new-password"
                          />
                        </div>
                        <div className="margin-top-20 text-start">
                          <AppCaptcha
                            value={values.captcha}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.captcha && errors.captcha ? errors.captcha : ''}
                            onCaptchaIdChange={setCaptchaId}
                            reloadToken={captchaReloadToken}
                          />
                        </div>
                        <div className="margin-top-50">
                          <AppButton title="Submit" size="large" customClass="w-100" type="submit" disabled={resetPasswordLoading} loading={resetPasswordLoading} />
                        </div>
                      </Form>
                    )}
                  </Formik>
                </div>
                <p className="fs-12 fw-500 text-center text-2-color margin-top-24 mb-0">
                  {timeLeft > 0 ? (
                    <>
                      Didn’t receive a code? ({timeLeft}s)
                      <AppButton size="small" variant="link" disabled={timeLeft !== 0} onClick={handleResend} title={'Resend'} />
                    </>
                  ) : (
                    <>
                      Didn’t receive a code?
                      <AppButton size="small" variant="link" disabled={timeLeft !== 0} onClick={handleResend} title={'Resend'} />
                    </>
                  )}
                </p>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={successfulModal}
        image={Icons.successCircle}
        header={'Password reset successfully'}
        subHeader={'Your password has been changed successfully. You can now use your new password to log in to your account.'}
        singleButton={true}
        buttonClassName={'w-100 primary medium'}
        buttonOnClick={() => navigate('/', { replace: true })}
        singleButtonLabel={'Back to Login'}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.redConfirmIcon}
        show={errorModal}
        handleClose={() => setErrorModal(false)}
        header={'Unable to Set New Password'}
        subHeader={'Something went wrong. Please try again or contact support.'}
        // subHeader={loginError?.message}
        singleButton
        singleButtonLabel={'OK'}
        buttonClassName={'w-100 danger-primary'}
        buttonOnClick={() => setErrorModal(false)}
      />
    </section>
  );
};

export default NewPassword;
