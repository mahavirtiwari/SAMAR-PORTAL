import { CircularProgress, FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppButton, AppInput, AppModal, AppTdsToolTip } from '../../../../../components/base';
import { toastError } from '../../../../../components/base/toast';
import { Layout } from '../../../../../components/layout';
import Icons from '../../../../../constants/Icons';
import { initiatePaymentAction as enterpriseInitiatePaymentAction } from '../../../../../redux/action/enterpriseAdmin/payment/PaymentAction';
import { initiatePaymentAction as unitInitiatePaymentAction } from '../../../../../redux/action/unitAdmin/payment/PaymentAction';
import { resetInitiatePayment as resetEnterpriseInitiatePayment } from '../../../../../redux/slices/enterpriseAdmin/payment/PaymentSlice';
import { resetInitiatePayment as resetUnitInitiatePayment } from '../../../../../redux/slices/unitAdmin/payment/PaymentSlice';
import Api from '../../../../../services/api';
import { formatCurrency } from '../../../../../utils/formatters';
import { Logger } from '../../../../../utils/logger';
import { gstNumberRegex } from '../../../../../utils/Regex';
import { hasRole } from '../../../../../utils/roleUtils';

const MakePayment = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const { user } = useSelector(state => state.Account);
  const isUnitAdmin = hasRole(user, 'unit_admin');
  const initiatePaymentAction = isUnitAdmin ? unitInitiatePaymentAction : enterpriseInitiatePaymentAction;
  const resetInitiatePayment = isUnitAdmin ? resetUnitInitiatePayment : resetEnterpriseInitiatePayment;

  // Get application data from navigation state or URL params
  const applicationData = location.state?.applicationData || {};
  const applicationId = location.state?.applicationId || applicationData?.id;

  // Initialize GSTIN from application data if available
  const [gstin, setGstin] = useState(applicationData?.gstNumber || '');
  const [tdsDeductible, setTdsDeductible] = useState('no');
  const [tdsPercentage, setTdsPercentage] = useState('2');
  const [tan, setTan] = useState('');
  const [successModal, setSuccessModal] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const gstinRef = useRef(null);
  const tanRef = useRef(null);
  const showToast = (variant, title, subTitle) => {
    if (variant === 'error') {
      toastError(subTitle, { title });
    }
  };

  // The fee is quoted by the server, not derived here, so the figure shown is the
  // figure charged. Re-quoted whenever the TDS election changes.
  const [fee, setFee] = useState(null);
  const [feeLoading, setFeeLoading] = useState(true);
  const [feeError, setFeeError] = useState(null);

  useEffect(() => {
    if (!applicationId) {
      setFeeLoading(false);
      return;
    }

    let cancelled = false;
    const isTdsElected = tdsDeductible === 'yes';

    setFeeLoading(true);
    Api.Payment.getApplicationFee(applicationId, {
      tdsDeductible: isTdsElected,
      tdsPercentage: Number(tdsPercentage),
    })
      .then(response => {
        if (cancelled) {
          return;
        }
        setFee(response?.data ?? null);
        setFeeError(null);
      })
      .catch(error => {
        if (cancelled) {
          return;
        }
        Logger.error('Failed to quote application fee:', error?.message);
        setFee(null);
        setFeeError(error?.response?.data?.message || 'Unable to retrieve the fee for this application.');
      })
      .finally(() => {
        if (!cancelled) {
          setFeeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, tdsDeductible, tdsPercentage]);

  // Enterprise and unit admin keep separate payment slices; pick the active one.
  const enterprisePayment = useSelector(state => state.EnterpriseAdminPayment);
  const unitPayment = useSelector(state => state.UnitAdminPayment);
  const { initiatePayment, initiatePaymentLoading, initiatePaymentError } = isUnitAdmin ? unitPayment : enterprisePayment;

  const toNumber = val => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  const baseCertificationFee = toNumber(fee?.baseCertificationFee);
  const foodAccommodation = toNumber(fee?.foodAccommodation);
  const amountPayable = toNumber(fee?.amountPayable);
  const gstAmount = toNumber(fee?.gstAmount);
  const tdsAmount = toNumber(fee?.tdsAmount);
  const totalAmount = toNumber(fee?.totalAmount);
  const gstRate = toNumber(fee?.gstPercentage) / 100;
  const selectedTdsRate = toNumber(tdsPercentage) / 100;

  // Whether the applicant may elect a TDS deduction at all.
  const isTdsEnabled = fee?.tdsAvailable === true;

  // Handle payment initiation response - redirect to ICICI gateway
  useEffect(() => {
    if (!initiatePayment || initiatePaymentLoading) {
      return;
    }
    const paymentUrl = initiatePayment.gatewayData?.paymentUrl;
    if (paymentUrl) {
      // Redirect to ICICI payment gateway
      Logger.info('Redirecting to payment gateway:', paymentUrl);
      window.location.href = paymentUrl;
    } else {
      // No payment URL received - this is an error condition
      Logger.error('Payment initiated but no gateway URL received:', initiatePayment);
      showToast('error', 'Payment failed', 'No payment gateway URL received. Please try again.');
    }
  }, [initiatePayment, initiatePaymentLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(resetInitiatePayment());
    };
  }, [dispatch]);

  // Validate GST number format
  const validateGstin = value => {
    if (!value) {
      return 'GSTIN is required';
    }
    const upperValue = value.toUpperCase();
    if (!gstNumberRegex.test(upperValue)) {
      return 'GSTIN must be valid (e.g., 22AAAAA0000A1Z5)';
    }
    return null;
  };

  // TAN formatting & validation
  const formatTan = val => {
    if (val === null || val === undefined) {
      return '';
    }
    // Uppercase, remove spaces and non-alphanumeric, limit to 10 chars
    return String(val)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
  };

  const validateTan = value => {
    if (!value) {
      return 'TAN is required';
    }
    const tanPattern = /^[A-Z]{4}\d{5}[A-Z]$/;
    if (!tanPattern.test(value)) {
      return 'TAN must be valid (e.g., MUMN12345P)';
    }
    return null;
  };

  const handleMakePayment = async () => {
    // Validate required fields
    const gstinError = validateGstin(gstin);
    if (gstinError) {
      setValidationError({ field: 'gstin', message: gstinError });
      if (gstinRef.current) {
        gstinRef.current.focus();
      }
      return;
    }

    if (isTdsEnabled && tdsDeductible === 'yes' && !tan) {
      setValidationError({ field: 'tan', message: 'TAN is required' });
      if (tanRef.current) {
        tanRef.current.focus();
      }
      return;
    }

    // If TDS is deductible, ensure TAN is valid before proceeding
    if (isTdsEnabled && tdsDeductible === 'yes') {
      const tanError = validateTan(tan);
      if (tanError) {
        setValidationError({ field: 'tan', message: tanError });
        if (tanRef.current) {
          tanRef.current.focus();
        }
        return;
      }
    }

    if (!applicationId) {
      showToast('error', 'Application missing', 'Application ID is missing. Please go back and try again.');
      return;
    }

    if (!fee) {
      showToast('error', 'Fee unavailable', feeError || 'Please try again later.');
      return;
    }

    // The server resolves the amount from the fee configuration, so only the TDS
    // election travels with the request — no amount is sent.
    const isTdsElected = isTdsEnabled && tdsDeductible === 'yes';

    const paymentData = {
      applicationId: applicationId,
      description: `SAMAR Certification Fee for Application ${applicationData?.referenceNumber || applicationId}`,
      gateway: 'icici_eazypay',
      paymentType: 'application_fee',
      gstin: gstin,
      tan: isTdsElected ? tan : null,
      tdsDeductible: isTdsElected,
      tdsPercentage: isTdsElected ? toNumber(tdsPercentage) : null,
    };

    Logger.info('Initiating payment with data:', paymentData);

    // Dispatch payment initiation action
    dispatch(initiatePaymentAction(paymentData));
  };

  const isLoading = feeLoading;

  return (
    <Layout
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <img src={Icons.back} alt="back" className="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Application Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">My Applications</li>
                <div className="dot-separator" />
                <li>Application Details</li>
                <div className="dot-separator" />
                <li>Make Payment</li>
              </ul>
            </div>
          </div>
        </div>
      }>
      <div className="main-content-inner">
        <div className="container">
          <div className="support-container">
            <div className="row">
              {/* Left Column - Form */}
              <div className="col-md-6 support-form-section">
                <h1 className="fs-16 fw-600 heading-color margin-bottom-16">Application Information</h1>

                <ul className="enterpriseInfoUl">
                  <li>
                    <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Application Reference No.:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationData?.referenceNumber || applicationData?.applicationNumber || 'N/A'}</p>
                  </li>
                  <li>
                    <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Unit Name:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationData?.unitName}</p>
                  </li>
                  <li>
                    <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Enterprise Name:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationData?.organizationName}</p>
                  </li>
                  <li>
                    <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Sector:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12" style={{ textTransform: 'capitalize' }}>
                      {applicationData?.sector || 'N/A'}
                    </p>
                  </li>
                  <li>
                    <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Enterprise Size:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12 text-capitalize" style={{ textTransform: 'capitalize' }}>
                      {applicationData?.enterpriseClassification === 'startup' ? 'Start-Up' : applicationData?.enterpriseClassification || 'N/A'}
                    </p>
                  </li>
                  <li>
                    <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Address:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationData?.address || applicationData?.enterpriseAddress || 'N/A'}</p>
                  </li>
                  <li>
                    <p className="enterpriseInfoUlWidth fs-12 fw-400 mb-0 text-3-color">Phone Number:</p>
                    <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{applicationData?.phone || applicationData?.contactNumber || 'N/A'}</p>
                  </li>
                </ul>
                <h1 className="fs-16 fw-600 heading-color margin-bottom-16 margin-top-24 top-seperator">Tax Information</h1>

                <div className="col-md-12">
                  <AppInput
                    placeholder="Enter GSTIN (e.g. 22AAAAA0000A1Z5)"
                    label="GSTIN"
                    isRequired={true}
                    value={gstin}
                    inputRef={gstinRef}
                    error={validationError?.field === 'gstin'}
                    helperText={validationError?.field === 'gstin' ? validationError.message : ''}
                    onChange={e => {
                      const value = e.target.value.toUpperCase();
                      setGstin(value);
                      if (validationError?.field === 'gstin') {
                        // Clear error if value is now valid
                        if (!validateGstin(value)) {
                          setValidationError(null);
                        } else {
                          setValidationError({ field: 'gstin', message: validateGstin(value) });
                        }
                      }
                    }}
                    onBlur={() => {
                      // Validate on blur
                      const error = validateGstin(gstin);
                      if (error) {
                        setValidationError({ field: 'gstin', message: error });
                      }
                    }}
                    inputProps={{ maxLength: 15, style: { textTransform: 'uppercase' } }}
                  />
                </div>

                {isTdsEnabled && (
                  <div className="row align-items-end margin-top-16">
                    <div className="col-md-6">
                      <FormControl component="fieldset" sx={{ width: '100%' }}>
                        <div>
                          <span className="label mb-0" style={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                            Is TDS Deductible? <span className="asterics">*</span>
                          </span>
                          <RadioGroup value={tdsDeductible} onChange={e => setTdsDeductible(e.target.value)} sx={{ flexDirection: 'row', gap: 2, flexWrap: 'nowrap' }}>
                            <FormControlLabel
                              value="yes"
                              control={
                                <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                              }
                              label="Yes"
                              sx={{
                                marginRight: 2,
                                '& .MuiFormControlLabel-label': {
                                  fontSize: '14px',
                                },
                              }}
                            />
                            <FormControlLabel
                              value="no"
                              control={
                                <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                              }
                              label="No"
                              sx={{
                                '& .MuiFormControlLabel-label': {
                                  fontSize: '14px',
                                },
                              }}
                            />
                          </RadioGroup>
                        </div>
                      </FormControl>
                    </div>
                    {tdsDeductible === 'yes' && (
                      <div className="d-flex justify-content-between margin-top-16">
                        <div>
                          <FormControl component="fieldset" sx={{ width: '100%' }}>
                            <div>
                              <div className="d-flex gap-1">
                                <span className="label mb-0" style={{ minWidth: 40 }}>
                                  TDS Percentage?<span className="asterics">*</span>
                                </span>
                                <AppTdsToolTip>
                                  <img src={Icons.infoGrey} className="icon-14" />
                                </AppTdsToolTip>
                              </div>
                              <RadioGroup value={tdsPercentage} onChange={e => setTdsPercentage(e.target.value)} sx={{ flexDirection: 'row', gap: 2 }}>
                                <FormControlLabel
                                  value="2"
                                  control={
                                    <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                                  }
                                  label="2%"
                                  sx={{ marginRight: 3 }}
                                />
                                <FormControlLabel
                                  value="10"
                                  control={
                                    <Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />
                                  }
                                  label="10%"
                                />
                              </RadioGroup>
                            </div>
                          </FormControl>
                        </div>
                        <div>
                          <AppInput
                            placeholder="Enter TAN (e.g. MUMN12345P)"
                            label="TAN"
                            isRequired={true}
                            value={tan}
                            className={'width-240'}
                            inputRef={tanRef}
                            error={validationError?.field === 'tan'}
                            helperText={validationError?.field === 'tan' ? validationError.message : ''}
                            onChange={e => {
                              const formatted = formatTan(e.target.value);
                              setTan(formatted);
                              if (validationError?.field === 'tan') {
                                // Clear error if now valid
                                if (!validateTan(formatted)) {
                                  setValidationError(null);
                                } else {
                                  setValidationError({ field: 'tan', message: validateTan(formatted) });
                                }
                              }
                            }}
                            onBlur={() => {
                              const err = validateTan(tan);
                              if (err) {
                                setValidationError({ field: 'tan', message: err });
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Error message */}
                {initiatePaymentError && (
                  <div className="margin-top-16">
                    <p className="fs-12 fw-500 text-danger mb-0">{typeof initiatePaymentError === 'string' ? initiatePaymentError : initiatePaymentError?.message || 'Payment initiation failed'}</p>
                  </div>
                )}

                {!isLoading && !fee && (
                  <div className="margin-top-16">
                    <p className="fs-12 fw-500 text-warning mb-0">{feeError || 'The fee for this application could not be retrieved. Please contact support.'}</p>
                  </div>
                )}
              </div>

              {/* Right Column - Payment Info */}
              <div className="col-md-6 contact-info-section">
                <h2 className="fs-16 fw-600 heading-color margin-bottom-16">Booking Information</h2>
                <h5 className="fs-14 fw-500 text-3-color margin-bottom-8">
                  Order <span className="fw-600 info-primary-color">#{applicationData?.referenceNumber || applicationData?.orderNumber || 'QCI-' + applicationId}</span>
                </h5>
                <h5 className="fs-14 fw-500 text-3-color mb-0">
                  Pay To <span className="fw-600 heading-color">Quality Council of India</span>
                </h5>
                <div className="payment-container">
                  {isLoading ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
                      <CircularProgress size={32} />
                    </div>
                  ) : (
                    <ul className="enterpriseInfoUl gap-10 w-100">
                      <li className="rowBetween">
                        <p className="enterpriseInfoUlWidth fs-14 fw-400 mb-0 text-2-color">Base Certification Fee</p>
                        <p className="fs-14 fw-500 mb-0 text-1-color margin-left-12">{formatCurrency(baseCertificationFee)}</p>
                      </li>
                      <li className="list-dashed-seperator rowBetween">
                        <p className="enterpriseInfoUlWidth fs-14 fw-400 mb-0 text-2-color">Logistics Fee</p>
                        <p className="fs-14 fw-500 mb-0 text-1-color margin-left-12">{formatCurrency(foodAccommodation)}</p>
                      </li>
                      <li className="list-dashed-seperator rowBetween">
                        <p className="enterpriseInfoUlWidth fs-14 fw-500 mb-0 text-1-color">Total</p>
                        <p className="fs-14 fw-600 mb-0 text-1-color margin-left-12">{formatCurrency(amountPayable)}</p>
                      </li>
                      <li className="rowBetween">
                        <p className="enterpriseInfoUlWidth fs-14 fw-400 mb-0 text-2-color">GST ({(gstRate * 100).toFixed(0)}%)</p>
                        <p className="fs-14 fw-500 mb-0 text-1-color margin-left-12">{formatCurrency(gstAmount)}</p>
                      </li>
                      {isTdsEnabled && tdsDeductible === 'yes' && (
                        <li className="list-seperator rowBetween">
                          <p className="enterpriseInfoUlWidth fs-14 fw-400 mb-0 text-2-color">TDS ({(selectedTdsRate * 100).toFixed(0)}%)</p>
                          <p className="fs-14 fw-500 mb-0 text-1-color margin-left-12">- {formatCurrency(tdsAmount)}</p>
                        </li>
                      )}
                      <li className="rowBetween">
                        <p className="enterpriseInfoUlWidth fs-14 fw-600 mb-0 heading-color">Total Amount to be Paid</p>
                        <p className="fs-18 fw-600 mb-0 heading-color margin-left-12">{formatCurrency(totalAmount)}</p>
                      </li>
                    </ul>
                  )}
                  <div className="margin-top-24">
                    <AppButton
                      variant="primary"
                      title="Make Payment"
                      minWidth={'100%'}
                      onClick={handleMakePayment}
                      loading={initiatePaymentLoading}
                      disabled={initiatePaymentLoading || isLoading || !fee || (isTdsEnabled && tdsDeductible === 'yes' && Boolean(validateTan(tan)))}
                    />
                  </div>
                  <AppModal
                    modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
                    show={successModal}
                    image={Icons.successCircle}
                    header={'Payment updated successfully'}
                    subHeader={''}
                    onClose={() => setSuccessModal(false)}
                  />
                  <p className="fs-10 fw-400 text-3-color text-center margin-top-12 mb-0">You will be redirected to ICICI Bank secure payment gateway</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MakePayment;
