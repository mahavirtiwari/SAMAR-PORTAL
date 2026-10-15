import { Form, Formik } from 'formik';
import { useCallback, useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppCaptcha, AppModal } from '../../components/base';
import AppButton from '../../components/base/AppButton';
import AppInput from '../../components/base/textInput/AppInput';
import { toastError } from '../../components/base/toast';
import { PublicHeader } from '../../components/layout';
import Icons from '../../constants/Icons';
import { forgotPasswordStartAction } from '../../redux/action/common/AccountAction';
import { resetForgotPasswordData } from '../../redux/slices/common/AccountSlice';
import { Logger } from '../../utils/logger';

const ForgotPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // What the reset was started with: { samarId } or { email }.
  const [identifier, setIdentifier] = useState(null);
  const [errorModal, setErrorModal] = useState(false);

  // Kept outside Formik: the challenge id is part of the payload, not a field
  // the user edits. Each challenge is single-use, so a failed attempt reloads it.
  const [captchaId, setCaptchaId] = useState('');
  const [captchaReloadToken, setCaptchaReloadToken] = useState(0);
  const [captchaServerError, setCaptchaServerError] = useState('');
  const refreshCaptcha = useCallback(() => setCaptchaReloadToken(token => token + 1), []);

  const initialValues = { samarId: '', captcha: '' };
  const { forgotPasswordData, forgotPasswordLoading, forgotPasswordError } = useSelector(state => state.Account);

  // Derive error message from Redux state instead of copying to local state
  const apiErrors = forgotPasswordError?.samarId?.[0] || forgotPasswordError?.email?.[0] || forgotPasswordError?.message || '';

  // SAMAR ID format: SAMAR-DDMMYY-ID (e.g., SAMAR-080125-123)
  const samarIdRegex = /^SAMAR-\d{6}-\d+$/i;

  // Either a SAMAR ID or the email registered on the account(s).
  const isEmail = value => (value || '').includes('@');
  const validationSchema = Yup.object({
    samarId: Yup.string()
      .trim()
      .max(320, 'This cannot exceed 320 characters')
      .required('SAMAR ID or registered email is required')
      .test('samar-id-or-email', 'Enter a valid SAMAR ID (e.g., SAMAR-080125-123) or email address', value =>
        isEmail(value) ? Yup.string().email().isValidSync(value) : samarIdRegex.test(value || ''),
      ),
    captcha: Yup.string().required('Enter the security code'),
  });

  useEffect(() => {
    if (forgotPasswordData?.status === 200 && identifier) {
      // The next screen resends to, and resets by, the same SAMAR ID or email.
      navigate('/new-password', { state: identifier });
      dispatch(resetForgotPasswordData());
    }
  }, [forgotPasswordData, identifier, navigate, dispatch]);

  useEffect(() => {
    if (forgotPasswordError) {
      Logger.error('Forgot Password failed:', forgotPasswordError);
      const captchaError = forgotPasswordError?.captcha?.[0];
      if (captchaError) {
        setCaptchaServerError(captchaError);
      } else if (apiErrors) {
        toastError(apiErrors);
      }
      refreshCaptcha();
    }
  }, [forgotPasswordError]);

  const handleSubmit = values => {
    const value = values.samarId.trim();
    const target = isEmail(value) ? { email: value } : { samarId: value.toUpperCase() };
    setIdentifier(target);
    setCaptchaServerError('');
    dispatch(forgotPasswordStartAction({ ...target, captchaId, captcha: values.captcha }));
  };

  return (
    <section className="forgotPasswordSection">
      <PublicHeader />
      <Container>
        <Row className="justify-content-center align-items-center forgotPasswordContainer">
          <Col xs={12} sm={10} md={8} lg={6}>
            <div className="forgotPasswordCard text-center">
              <img src={Icons.lockCircle} alt="lock" className="icon-130" />
              <div className="margin-top-40">
                <h2 className="fs-24 fw-600 heading-color mb-0">Forgot Password?</h2>
                <p className="fs-14 fw-500 mb-0 text-2-color margin-top-8">We will help you reset your password securely.</p>
                <p className="fs-14 fw-500 mb-0 text-2-color">Enter your SAMAR ID or the email registered with your account.</p>
                <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
                  {({ values, errors, touched, handleChange, handleBlur }) => (
                    <Form>
                      <div className="margin-top-30 text-start">
                        <AppInput
                          labelAbove
                          name="samarId"
                          value={values.samarId}
                          onChange={handleChange}
                          stripWhitespace={true}
                          onBlur={handleBlur}
                          maxLength={320}
                          label="SAMAR ID or registered email"
                          placeholder="SAMAR-080125-123 or name@example.com"
                          error={touched.samarId && errors.samarId ? errors.samarId : ''}
                          isRequired
                          autoComplete="off"
                        />
                      </div>
                      <div className="margin-top-20 text-start">
                        <AppCaptcha
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
                      <div className="margin-top-50">
                        <AppButton title="Send OTP" size="large" customClass="w-100" type="submit" disabled={forgotPasswordLoading} loading={forgotPasswordLoading} />
                        <div className="d-flex align-items-center justify-content-center gap-10 margin-top-24">
                          <p className="fs-14 fw-500 text-1-color mb-0">Remember Password?</p>
                          <span
                            className="fs-14 fw-600 primary-color mb-0 cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate('/')}
                            onKeyPress={e => {
                              if (e.key === 'Enter') {
                                navigate('/');
                              }
                            }}>
                            Back to Login
                          </span>
                        </div>
                      </div>
                    </Form>
                  )}
                </Formik>
              </div>
            </div>
          </Col>
        </Row>
        {/* <OTPVerificationModal show={otpVerificationModal} handleClose={() => setOtpVerificationModal(false)} onVerify={handleVerifyOtp} onResend={handleResendOtp} maxLength={6} /> */}
      </Container>
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.redConfirmIcon}
        show={errorModal}
        handleClose={() => setErrorModal(false)}
        header={'Unable to Reset Password'}
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

export default ForgotPassword;
