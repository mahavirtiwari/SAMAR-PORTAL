import { Form, Formik } from 'formik';
import { useCallback, useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppCaptcha, AppModal } from '../../components/base';
import AppButton from '../../components/base/AppButton';
import BrandLogo from '../../components/base/BrandLogo';
import LoginQuickLinks from '../../components/base/LoginQuickLinks';
import AppInput from '../../components/base/textInput/AppInput';
import { toastError, toastSuccess } from '../../components/base/toast';
import { OTPVerificationModal } from '../../components/modals';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import useBranding from '../../hooks/useBranding';
import { registerAction, resendOtpAction, verifyOtpAction } from '../../redux/action/common/AccountAction';
import { resetRegisterData } from '../../redux/slices/common/AccountSlice';
import { Logger } from '../../utils/logger';
import { emailRegex } from '../../utils/Regex';
import { getFirstServerError, normalizeServerErrors } from '../../utils/serverErrorUtils';

const Register = () => {
  const dispatch = useDispatch();
  // const [showManualModal, setShowManualModal] = useState(true);
  const [otpVerificationModal, setOtpVerificationModal] = useState(false);
  const [registerData, setRegisterData] = useState(null);
  const [otp, setOtp] = useState('');
  const [apiErrors, setApiErrors] = useState({});
  const [successfulModal, setSuccessfulModal] = useState(false);
  const navigate = useNavigate();
  const loginPicture = useBranding().login_picture?.image;

  const { registerStatus, registerError, registerLoading, verifyOtpLoading, verifyOtpError } = useSelector(state => {
    return state.Account;
  });
  useEffect(() => {
    if (verifyOtpError) {
      toastError(verifyOtpError?.message);
    }
  }, [verifyOtpError]);
  // Remove direct setBackendErrors from render to avoid infinite loop
  // const handleCloseManualModal = () => setShowManualModal(false);

  // Handle registerStatus changes in useEffect
  useEffect(() => {
    if (registerStatus) {
      // Capture samarId from registration response for OTP verification/resend
      setRegisterData(prev => ({ ...prev, samarId: registerStatus?.data?.samarId }));
      setOtpVerificationModal(true);
    }
    if (registerError) {
      // Normalize server errors to display below each field
      const normalizedErrors = normalizeServerErrors(registerError);
      // Map server field names to form field names
      const fieldMapping = {
        OrganizationName: 'organizationName',
        FirstName: 'firstName',
        LastName: 'lastName',
        Email: 'email',
        MobileNumber: 'mobileNumber',
      };
      const mappedErrors = {};
      Object.keys(normalizedErrors).forEach(key => {
        const mappedKey = fieldMapping[key] || key.charAt(0).toLowerCase() + key.slice(1);
        if (mappedKey !== '_general') {
          mappedErrors[mappedKey] = normalizedErrors[key];
        }
      });
      setApiErrors(registerError?.message);
      const generalError = normalizedErrors._general || getFirstServerError(registerError);
      Logger.error('Register failed');
      toastError(typeof generalError === 'string' ? generalError : '');
      // The challenge was consumed by the attempt; a retry needs a new one.
      refreshCaptcha();
    }
  }, [registerStatus, registerError]);

  // Kept outside Formik: the challenge id is part of the payload, not a field
  // the user edits. Each challenge is single-use, so a failed attempt reloads it.
  const [captchaId, setCaptchaId] = useState('');
  const [captchaReloadToken, setCaptchaReloadToken] = useState(0);
  const refreshCaptcha = useCallback(() => setCaptchaReloadToken(token => token + 1), []);

  const initialValues = {
    organizationName: '',
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    captcha: '',
  };

  // Off when the System Admin has switched the security code off.

  const [captchaEnabled, setCaptchaEnabled] = useState(true);

  const validationSchema = Yup.object({
    organizationName: Yup.string().trim().max(150, 'Enterprise name cannot exceed 150 characters').required('Enterprise name is required'),
    firstName: Yup.string().trim().max(50, 'First name cannot exceed 50 characters').required('First name is required'),
    lastName: Yup.string().trim().max(50, 'Last name cannot exceed 50 characters').required('Last name is required'),
    email: Yup.string().max(320, 'Email cannot exceed 320 characters').matches(emailRegex, 'Enter a valid email address').required('Email is required'),
    mobileNumber: Yup.string()
      .matches(/^\d+$/, 'Mobile number must contain only digits')
      .min(10, 'Mobile number must be 10 digits')
      .max(10, 'Mobile number must be 10 digits')
      .required('Mobile number is required'),
    captcha: captchaEnabled ? Yup.string().required('Enter the security code') : Yup.string(),
  });

  // Registration handler: maps frontend fields to backend API payload
  const handleRegister = async values => {
    const payload = {
      organizationName: values.organizationName,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      mobileNumber: values.mobileNumber,
    };
    setRegisterData(payload);

    dispatch(registerAction({ ...payload, captchaId, captcha: values.captcha }));
  };
  // OTP verification handler: expects { email, otp }
  const handleVerifyOtp = async () => {
    try {
      Logger.info('Verify OTP attempt:', { email: registerData.email, otp });
      await dispatch(verifyOtpAction({ email: registerData.email, otp, samarId: registerData?.samarId })).unwrap();
      setOtpVerificationModal(false);
      setSuccessfulModal(true);
      dispatch(resetRegisterData());
    } catch (error) {
      Logger.error('Verify OTP failed:', error);
      // Clear OTP on failed verification so user can retry; keep registerStatus so samarId survives the retry
      setOtp('');
    }
  };

  // Resend OTP handler: expects { samarId }
  const handleResendOtp = async () => {
    try {
      Logger.info('Resend OTP attempt:', registerData);
      await dispatch(resendOtpAction({ email: registerData.email, samarId: registerData?.samarId })).unwrap();
      toastSuccess('A new OTP has been sent to your registered email.', { title: 'OTP sent' });
    } catch (error) {
      Logger.error('Resend OTP failed:', error);
      const message = error?.message || 'Failed to resend OTP. Please try again.';
      setApiErrors(message);
      toastError(message);
    }
  };
  return (
    // Same one-screen layout as the login page (responsive.css .login-onepage).
    <section className="login login-onepage">
      <Container fluid>
        <Row>
          <Col xl={5} lg={6} className="d-none d-lg-block position-relative">
            <div className="login-bg-container">
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
                <h2 className="fs-24 fw-500 margin-top-40 mb-2">Enterprise Registration</h2>
                <p className="fs-14 fw-500 mb-0">Create account for your enterprise to apply for SAMAR certification.</p>
                <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleRegister}>
                  {({ values, errors, touched, handleChange, handleBlur, setFieldValue }) => (
                    <Form className="w-100">
                      <Row className="margin-top-32">
                        <Col xs={12} sm={6}>
                          <AppInput
                            labelAbove
                            name="firstName"
                            value={values.firstName}
                            upperCase={true}
                            onChange={e => {
                              const raw = e && e.target ? e.target.value : '';
                              // Allow letters, spaces, apostrophe, hyphen and dot
                              const cleaned = raw.replace(/[^A-Za-z\s'\-.]/g, '').slice(0, 100);
                              setFieldValue('firstName', cleaned);
                            }}
                            onBlur={handleBlur}
                            placeholder="Enter First Name"
                            label="First Name"
                            alphaOnly={true}
                            maxLength={50}
                            isRequired
                            error={touched.firstName && errors.firstName ? errors.firstName : apiErrors.firstName ? apiErrors.firstName : ''}
                          />
                        </Col>
                        <Col xs={12} sm={6}>
                          <AppInput
                            labelAbove
                            name="lastName"
                            value={values.lastName}
                            upperCase={true}
                            alphaOnly={true}
                            onChange={e => {
                              const raw = e && e.target ? e.target.value : '';
                              // Allow letters, spaces, apostrophe, hyphen and dot
                              const cleaned = raw.replace(/[^A-Za-z\s'\-.]/g, '').slice(0, 100);
                              setFieldValue('lastName', cleaned);
                            }}
                            maxLength={50}
                            onBlur={handleBlur}
                            placeholder="Enter Last Name"
                            label="Last Name"
                            isRequired
                            error={touched.lastName && errors.lastName ? errors.lastName : apiErrors.lastName ? apiErrors.lastName : ''}
                          />
                        </Col>
                      </Row>
                      <div className="margin-top-20">
                        <AppInput
                          labelAbove
                          name="organizationName"
                          value={values.organizationName}
                          upperCase={true}
                          maxLength={150}
                          onChange={e => {
                            const raw = e && e.target ? e.target.value : '';
                            // Allow letters, spaces, apostrophe, hyphen and dot
                            const cleaned = raw.replace(/[^A-Za-z\s'\-.]/g, '').slice(0, 100);
                            setFieldValue('organizationName', cleaned);
                          }}
                          onBlur={handleBlur}
                          placeholder="Enter Enterprise Name"
                          label="Enterprise Name"
                          additionalInfoLabel="as per your PAN"
                          isRequired
                          error={touched.organizationName && errors.organizationName ? errors.organizationName : apiErrors.organization_name ? apiErrors.organization_name : ''}
                        />
                      </div>

                      <Row className="margin-top-20">
                        <Col xs={12} sm={6}>
                          <AppInput
                            labelAbove
                            name="email"
                            value={values.email}
                            maxLength={320}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Enter Email"
                            label="Email"
                            isRequired
                            error={touched.email && errors.email ? errors.email : apiErrors.email ? apiErrors.email : ''}
                            autoComplete="off"
                          />
                        </Col>
                        <Col xs={12} sm={6}>
                          <AppInput
                            labelAbove
                            name="mobileNumber"
                            value={values.mobileNumber}
                            onChange={e => setFieldValue('mobileNumber', e.target.value)}
                            phoneNumberFormat={true}
                            onBlur={handleBlur}
                            placeholder="Enter Mobile Number"
                            label="Mobile Number"
                            inputMode="numeric"
                            isRequired
                            error={
                              touched.mobileNumber && errors.mobileNumber
                                ? errors.mobileNumber
                                : apiErrors.phone // <-- FIXED: use 'phone' key for error
                                  ? apiErrors.phone
                                  : ''
                            }
                            autoComplete="off"
                          />
                        </Col>
                      </Row>

                      <div className="margin-top-20">
                        <AppCaptcha
                          onEnabledChange={setCaptchaEnabled}
                          value={values.captcha}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.captcha && errors.captcha ? errors.captcha : ''}
                          onCaptchaIdChange={setCaptchaId}
                          reloadToken={captchaReloadToken}
                        />
                      </div>
                      <div className="margin-top-40">
                        <AppButton title="Submit" customClass="w-100" size="large" type="submit" disabled={registerLoading} loading={registerLoading} />
                      </div>
                    </Form>
                  )}
                </Formik>
                <div className="d-flex align-items-center justify-content-center gap-10 margin-top-24">
                  <p className="fs-14 fw-500 text-1-color mb-0">Already have an account?</p>
                  <Link to="/" className="outline-action-button">
                    Login
                  </Link>
                </div>
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
      </Container>
      <OTPVerificationModal
        show={otpVerificationModal}
        handleClose={() => setOtpVerificationModal(false)}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        otp={otp}
        setOtp={setOtp}
        loading={verifyOtpLoading}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={successfulModal}
        image={Icons.successCircle}
        header={'Thank You for Registering'}
        subHeader={
          'Your SAMAR ID and password have been sent to your Email ID provided during registration. Please check your inbox for your login credentials. If you have not received it, please check your spam/junk folder.'
        }
        singleButton
        singleButtonLabel="Login"
        buttonOnClick={() => {
          navigate('/', { replace: true });
          setSuccessfulModal(false);
        }}
        buttonClassName="w-100 btn-primary"
      />
    </section>
  );
};

export default Register;
