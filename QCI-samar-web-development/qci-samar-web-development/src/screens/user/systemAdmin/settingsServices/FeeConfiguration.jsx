import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useFormik } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import { AppButton, AppInput, AppModal, FullScreenLoader } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { createFeeConfigurationAction, getFeeConfigurationsAction, updateFeeConfigurationAction } from '../../../../redux/action/common/FeeConfigAction';
import { calculatePreviewPayable } from '../../../../utils/feePreview';
import { Logger } from '../../../../utils/logger';

const validationSchema = Yup.object({
  // Start-Up section validations
  baseCertificationFee: Yup.string()
    .required('Base certification fee is required')
    .test('is-valid-number', 'Enter a valid number greater than 0', value => {
      const num = Number(value);
      return !isNaN(num) && num > 0;
    }),
  foodAndTravel: Yup.string()
    .required('Logistics fee is required')
    .test('is-valid-number', 'Enter a valid number (0 or greater)', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0;
    }),
  gstPercentage: Yup.string()
    .required('GST percentage is required')
    .test('is-valid-percentage', 'Enter a valid percentage between 0 and 100', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0 && num <= 100;
    }),

  // Micro section validations
  microBaseCertificationFee: Yup.string()
    .required('Base certification fee is required')
    .test('is-valid-number', 'Enter a valid number greater than 0', value => {
      const num = Number(value);
      return !isNaN(num) && num > 0;
    }),
  microFoodAndTravel: Yup.string()
    .required('Logistics fee is required')
    .test('is-valid-number', 'Enter a valid number (0 or greater)', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0;
    }),
  microGstPercentage: Yup.string()
    .required('GST percentage is required')
    .test('is-valid-percentage', 'Enter a valid percentage between 0 and 100', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0 && num <= 100;
    }),

  // Small section validations
  smallBaseCertificationFee: Yup.string()
    .required('Base certification fee is required')
    .test('is-valid-number', 'Enter a valid number greater than 0', value => {
      const num = Number(value);
      return !isNaN(num) && num > 0;
    }),
  smallFoodAndTravel: Yup.string()
    .required('Logistics fee is required')
    .test('is-valid-number', 'Enter a valid number (0 or greater)', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0;
    }),
  smallGstPercentage: Yup.string()
    .required('GST percentage is required')
    .test('is-valid-percentage', 'Enter a valid percentage between 0 and 100', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0 && num <= 100;
    }),

  // Medium section validations
  mediumBaseCertificationFee: Yup.string()
    .required('Base certification fee is required')
    .test('is-valid-number', 'Enter a valid number greater than 0', value => {
      const num = Number(value);
      return !isNaN(num) && num > 0;
    }),
  mediumFoodAndTravel: Yup.string()
    .required('Logistics fee is required')
    .test('is-valid-number', 'Enter a valid number (0 or greater)', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0;
    }),
  mediumGstPercentage: Yup.string()
    .required('GST percentage is required')
    .test('is-valid-percentage', 'Enter a valid percentage between 0 and 100', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0 && num <= 100;
    }),

  // Large section validations
  largeBaseCertificationFee: Yup.string()
    .required('Base certification fee is required')
    .test('is-valid-number', 'Enter a valid number greater than 0', value => {
      const num = Number(value);
      return !isNaN(num) && num > 0;
    }),
  largeFoodAndTravel: Yup.string()
    .required('Logistics fee is required')
    .test('is-valid-number', 'Enter a valid number (0 or greater)', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0;
    }),
  largeGstPercentage: Yup.string()
    .required('GST percentage is required')
    .test('is-valid-percentage', 'Enter a valid percentage between 0 and 100', value => {
      const num = Number(value);
      return !isNaN(num) && num >= 0 && num <= 100;
    }),
});

const FeeConfiguration = () => {
  const dispatch = useDispatch();
  const [successfulModal, setSuccessfulModal] = useState(false);
  const [updatedModal, setUpdatedModal] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  const [startupTdsDeductible, setStartupTdsDeductible] = useState('no');
  const [microTdsDeductible, setMicroTdsDeductible] = useState('no');
  const [smallTdsDeductible, setSmallTdsDeductible] = useState('no');
  const [mediumTdsDeductible, setMediumTdsDeductible] = useState('no');
  const [largeTdsDeductible, setLargeTdsDeductible] = useState('no');

  // Access Redux state
  const { createLoading, createError, updateLoading, feeConfigurations, feeConfigurationsLoading } = useSelector(state => state.SystemAdminFeeConfig);

  // Load fee configurations on component mount
  useEffect(() => {
    dispatch(getFeeConfigurationsAction());
  }, [dispatch]);

  Logger.info('Fee configurations from API:', feeConfigurations);

  // Function to populate form values from API data
  const populateFormFromAPI = configs => {
    if (!configs || configs.length === 0) {
      return {};
    }

    const values = {};

    // Filter only service sector configurations
    const serviceConfigs = configs.filter(config => config.sector === 'service');

    serviceConfigs.forEach(config => {
      const { enterpriseSize } = config;

      // Determine prefix based on enterprise size
      let prefix = '';
      if (enterpriseSize === 'micro') {
        prefix = 'micro';
      } else if (enterpriseSize === 'small') {
        prefix = 'small';
      } else if (enterpriseSize === 'medium') {
        prefix = 'medium';
      } else if (enterpriseSize === 'large') {
        prefix = 'large';
      }
      // startup has no prefix

      // Set base certification fee
      const baseCertField = prefix ? `${prefix}BaseCertificationFee` : 'baseCertificationFee';
      values[baseCertField] = config.baseCertificationFee || '';

      // Set food and accommodation fee (mapped to foodAndTravel in form)
      const foodTravelField = prefix ? `${prefix}FoodAndTravel` : 'foodAndTravel';
      values[foodTravelField] = config.foodAndAccommodationFee || '';

      // Set GST percentage
      const gstField = prefix ? `${prefix}GstPercentage` : 'gstPercentage';
      values[gstField] = config.gstPercentage || '';

      // Set TDS toggle state from API
      const tdsValue = config.tdsEnabled ? 'yes' : 'no';
      if (enterpriseSize === 'startup') {
        setStartupTdsDeductible(tdsValue);
      } else if (enterpriseSize === 'micro') {
        setMicroTdsDeductible(tdsValue);
      } else if (enterpriseSize === 'small') {
        setSmallTdsDeductible(tdsValue);
      } else if (enterpriseSize === 'medium') {
        setMediumTdsDeductible(tdsValue);
      } else if (enterpriseSize === 'large') {
        setLargeTdsDeductible(tdsValue);
      }
    });

    return values;
  };

  // Calculate initial values using useMemo to optimize performance
  const initialValues = useMemo(() => {
    const defaultValues = {
      // Start-Up section
      baseCertificationFee: '',
      foodAndTravel: '',
      gstPercentage: '',
      // Micro section
      microBaseCertificationFee: '',
      microFoodAndTravel: '',
      microGstPercentage: '',
      // Small section
      smallBaseCertificationFee: '',
      smallFoodAndTravel: '',
      smallGstPercentage: '',
      // Medium section
      mediumBaseCertificationFee: '',
      mediumFoodAndTravel: '',
      mediumGstPercentage: '',
      // Large section
      largeBaseCertificationFee: '',
      largeFoodAndTravel: '',
      largeGstPercentage: '',
    };

    // If we have API data, populate the form
    if (feeConfigurations && feeConfigurations.length > 0) {
      const populatedValues = populateFormFromAPI(feeConfigurations);
      return { ...defaultValues, ...populatedValues };
    }

    return defaultValues;
  }, [feeConfigurations]);

  const handleFormSubmit = async values => {
    Logger.info('Form submit handler called with values:', values);

    try {
      // Prepare data for each section
      const sections = [
        {
          enterpriseSize: 'startup',
          prefix: '',
        },
        {
          enterpriseSize: 'micro',
          prefix: 'micro',
        },
        {
          enterpriseSize: 'small',
          prefix: 'small',
        },
        {
          enterpriseSize: 'medium',
          prefix: 'medium',
        },
        {
          enterpriseSize: 'large',
          prefix: 'large',
        },
      ];

      // Check if we have existing configurations
      const hasExistingConfigurations = feeConfigurations && feeConfigurations.length > 0;

      // Submit each section sequentially
      for (const section of sections) {
        const { enterpriseSize, prefix } = section;

        // Get field names based on prefix
        const baseCertField = prefix ? `${prefix}BaseCertificationFee` : 'baseCertificationFee';
        const foodTravelField = prefix ? `${prefix}FoodAndTravel` : 'foodAndTravel';
        const gstPercentageField = prefix ? `${prefix}GstPercentage` : 'gstPercentage';

        // Find existing configuration for this enterprise size in service sector
        const existingConfig = hasExistingConfigurations ? feeConfigurations.find(config => config.enterpriseSize === enterpriseSize && config.sector === 'service') : null;

        // Get TDS toggle value for this enterprise size
        const tdsStateMap = { startup: startupTdsDeductible, micro: microTdsDeductible, small: smallTdsDeductible, medium: mediumTdsDeductible, large: largeTdsDeductible };

        // Prepare API payload
        const apiPayload = {
          sector: 'service',
          enterpriseSize,
          baseCertificationFee: Number(values[baseCertField]),
          foodAndAccommodationFee: Number(values[foodTravelField]),
          gstPercentage: values[gstPercentageField] ? Number(values[gstPercentageField]) : null,
          tdsEnabled: tdsStateMap[enterpriseSize] === 'yes',
        };

        let result;
        if (existingConfig && existingConfig.id) {
          result = await dispatch(updateFeeConfigurationAction({ ...apiPayload, id: existingConfig.id }));
        } else {
          // Create new configuration
          result = await dispatch(createFeeConfigurationAction(apiPayload));

          if (createFeeConfigurationAction.rejected.match(result)) {
            throw new Error(result.payload || `Failed to create fee configuration for ${enterpriseSize}`);
          }
        }

        Logger.info(`${enterpriseSize} section ${hasExistingConfigurations ? 'updated' : 'created'} successfully`);
      }

      // Show correct modal based on create or update
      if (hasExistingConfigurations) {
        setUpdatedModal(true);
      } else {
        setSuccessfulModal(true);
      }
    } catch (error) {
      Logger.error('Error submitting fee configurations:', error);
      const errorMessage = createError || error.message || 'Error submitting fee configurations. Please try again.';
      setErrorModal({ show: true, message: errorMessage });
    }
  };
  // Auto-hide save modal after 2 seconds
  useEffect(() => {
    if (successfulModal) {
      const timer = setTimeout(() => {
        setSuccessfulModal(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [successfulModal]);

  // Auto-hide update modal after 2 seconds
  useEffect(() => {
    if (updatedModal) {
      const timer = setTimeout(() => {
        setUpdatedModal(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [updatedModal]);

  // Auto-hide error modal after 2 seconds
  useEffect(() => {
    if (errorModal.show) {
      const timer = setTimeout(() => {
        setErrorModal({ show: false, message: '' });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [errorModal.show]);

  const formik = useFormik({
    initialValues,
    enableReinitialize: true,
    validationSchema,
    onSubmit: handleFormSubmit,
  });

  const handleSubmitClick = async () => {
    Logger.info('Button clicked - validating form');
    try {
      const errors = await formik.validateForm();
      if (errors && Object.keys(errors).length > 0) {
        Logger.info('Formik validation errors:', errors);
        // mark all fields as touched so validation messages show in UI
        const touched = Object.keys(formik.values).reduce((acc, key) => ({ ...acc, [key]: true }), {});
        formik.setTouched(touched);
        return;
      }
      // no validation errors, proceed
      Logger.info('No validation errors - submitting form');
      formik.handleSubmit();
    } catch (err) {
      Logger.error('Error during form validation:', err);
    }
  };

  return (
    <Layout>
      {feeConfigurationsLoading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '500px' }}>
          <FullScreenLoader loading={true} />
        </div>
      ) : (
        <div className="main-content-inner">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="details-card" style={{ padding: 0 }}>
                  <div className="bottom-seperator padding-all-24">
                    <h1 className="page-heading mb-0">Service Fee Configuration</h1>
                  </div>
                  <div className="padding-all-24">
                    <div className="bottom-seperator">
                      <h5 className="section-title">Start-Up</h5>

                      {/* ROW 1 */}
                      {/* ROW 1 */}
                      <div className="row gap-vertical-30">
                        <div className="col-md-4">
                          <AppInput
                            label="Base Certification Fee"
                            placeholder="Enter Base Certification Fee"
                            name="baseCertificationFee"
                            value={formik.values.baseCertificationFee}
                            onChange={e => formik.setFieldValue('baseCertificationFee', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.baseCertificationFee && formik.errors.baseCertificationFee ? formik.errors.baseCertificationFee : ''}
                          />
                        </div>

                        <div className="col-md-4">
                          <AppInput
                            label="Logistics Fee"
                            placeholder="Enter Logistics Fee"
                            name="foodAndTravel"
                            value={formik.values.foodAndTravel}
                            onChange={e => formik.setFieldValue('foodAndTravel', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.foodAndTravel && formik.errors.foodAndTravel ? formik.errors.foodAndTravel : ''}
                          />
                        </div>
                      </div>

                      {/* GST + TDS ROW */}
                      <div className="row margin-top-24">
                        {/* GST COLUMN */}
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                            {/* GST BELOW GST */}
                            <div className="mt-2">
                              <AppInput
                                placeholder="Enter GST percentage"
                                label="GST (%)"
                                name="gstPercentage"
                                value={formik.values.gstPercentage}
                                onChange={e => formik.setFieldValue('gstPercentage', e.target.value)}
                                onBlur={formik.handleBlur}
                                isRequired
                                percentageFormat={true}
                                error={formik.touched.gstPercentage && formik.errors.gstPercentage ? formik.errors.gstPercentage : ''}
                              />
                            </div>
                          </FormControl>
                        </div>
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span className="label mb-0" style={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                                TDS Applicable
                              </span>
                              <RadioGroup value={startupTdsDeductible} onChange={e => setStartupTdsDeductible(e.target.value)} sx={{ flexDirection: 'row', gap: 2, flexWrap: 'nowrap' }}>
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

                        <div className="col-md-4">
                          <AppInput
                            label="Estimated total (incl. GST)"
                            value={calculatePreviewPayable(formik.values.baseCertificationFee, formik.values.foodAndTravel, formik.values.gstPercentage)}
                            disabled
                            subLabel="Before TDS election at payment"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="bottom-seperator margin-top-30">
                      <h5 className="section-title">Micro</h5>

                      {/* ROW 1 */}
                      <div className="row gap-vertical-30">
                        <div className="col-md-4">
                          <AppInput
                            label="Base Certification Fee"
                            placeholder="Enter Base Certification Fee"
                            name="microBaseCertificationFee"
                            value={formik.values.microBaseCertificationFee}
                            onChange={e => formik.setFieldValue('microBaseCertificationFee', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.microBaseCertificationFee && formik.errors.microBaseCertificationFee ? formik.errors.microBaseCertificationFee : ''}
                          />
                        </div>

                        <div className="col-md-4">
                          <AppInput
                            label="Logistics Fee"
                            placeholder="Enter Logistics Fee"
                            name="microFoodAndTravel"
                            value={formik.values.microFoodAndTravel}
                            onChange={e => formik.setFieldValue('microFoodAndTravel', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.microFoodAndTravel && formik.errors.microFoodAndTravel ? formik.errors.microFoodAndTravel : ''}
                          />
                        </div>
                      </div>

                      <div className="row margin-top-24">
                        {/* GST COLUMN */}
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                            {/* GST BELOW GST */}
                            <div className="mt-2">
                              <AppInput
                                placeholder="Enter GST percentage"
                                label="GST (%)"
                                name="microGstPercentage"
                                value={formik.values.microGstPercentage}
                                onChange={e => formik.setFieldValue('microGstPercentage', e.target.value)}
                                onBlur={formik.handleBlur}
                                isRequired
                                percentageFormat={true}
                                error={formik.touched.microGstPercentage && formik.errors.microGstPercentage ? formik.errors.microGstPercentage : ''}
                              />
                            </div>
                          </FormControl>
                        </div>
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span className="label mb-0" style={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                                TDS Applicable
                              </span>
                              <RadioGroup value={microTdsDeductible} onChange={e => setMicroTdsDeductible(e.target.value)} sx={{ flexDirection: 'row', gap: 2, flexWrap: 'nowrap' }}>
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
                        <div className="col-md-4">
                          <AppInput
                            label="Estimated total (incl. GST)"
                            value={calculatePreviewPayable(formik.values.microBaseCertificationFee, formik.values.microFoodAndTravel, formik.values.microGstPercentage)}
                            disabled
                            subLabel="Before TDS election at payment"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="bottom-seperator margin-top-30">
                      <h5 className="section-title">Small</h5>

                      {/* ROW 1 */}
                      <div className="row gap-vertical-30">
                        <div className="col-md-4">
                          <AppInput
                            label="Base Certification Fee"
                            placeholder="Enter Base Certification Fee"
                            name="smallBaseCertificationFee"
                            value={formik.values.smallBaseCertificationFee}
                            onChange={e => formik.setFieldValue('smallBaseCertificationFee', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.smallBaseCertificationFee && formik.errors.smallBaseCertificationFee ? formik.errors.smallBaseCertificationFee : ''}
                          />
                        </div>

                        <div className="col-md-4">
                          <AppInput
                            label="Logistics Fee"
                            placeholder="Enter Logistics Fee"
                            name="smallFoodAndTravel"
                            value={formik.values.smallFoodAndTravel}
                            onChange={e => formik.setFieldValue('smallFoodAndTravel', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.smallFoodAndTravel && formik.errors.smallFoodAndTravel ? formik.errors.smallFoodAndTravel : ''}
                          />
                        </div>
                      </div>

                      {/* GST + TDS ROW */}
                      <div className="row margin-top-24">
                        {/* GST COLUMN */}
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                            {/* GST BELOW GST */}
                            <div className="mt-2">
                              <AppInput
                                placeholder="Enter GST percentage"
                                label="GST (%)"
                                name="smallGstPercentage"
                                value={formik.values.smallGstPercentage}
                                onChange={e => formik.setFieldValue('smallGstPercentage', e.target.value)}
                                onBlur={formik.handleBlur}
                                isRequired
                                percentageFormat={true}
                                error={formik.touched.smallGstPercentage && formik.errors.smallGstPercentage ? formik.errors.smallGstPercentage : ''}
                              />
                            </div>
                          </FormControl>
                        </div>
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span className="label mb-0" style={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                                TDS Applicable
                              </span>
                              <RadioGroup value={smallTdsDeductible} onChange={e => setSmallTdsDeductible(e.target.value)} sx={{ flexDirection: 'row', gap: 2, flexWrap: 'nowrap' }}>
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
                        <div className="col-md-4">
                          <AppInput
                            label="Estimated total (incl. GST)"
                            value={calculatePreviewPayable(formik.values.smallBaseCertificationFee, formik.values.smallFoodAndTravel, formik.values.smallGstPercentage)}
                            disabled
                            subLabel="Before TDS election at payment"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="bottom-seperator margin-top-30">
                      <h5 className="section-title">Medium</h5>

                      {/* ROW 1 */}
                      <div className="row gap-vertical-30">
                        <div className="col-md-4">
                          <AppInput
                            label="Base Certification Fee"
                            placeholder="Enter Base Certification Fee"
                            name="mediumBaseCertificationFee"
                            value={formik.values.mediumBaseCertificationFee}
                            onChange={e => formik.setFieldValue('mediumBaseCertificationFee', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.mediumBaseCertificationFee && formik.errors.mediumBaseCertificationFee ? formik.errors.mediumBaseCertificationFee : ''}
                          />
                        </div>

                        <div className="col-md-4">
                          <AppInput
                            label="Logistics Fee"
                            placeholder="Enter Logistics Fee"
                            name="mediumFoodAndTravel"
                            value={formik.values.mediumFoodAndTravel}
                            onChange={e => formik.setFieldValue('mediumFoodAndTravel', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.mediumFoodAndTravel && formik.errors.mediumFoodAndTravel ? formik.errors.mediumFoodAndTravel : ''}
                          />
                        </div>
                      </div>

                      {/* GST + TDS ROW */}
                      <div className="row margin-top-24">
                        {/* GST COLUMN */}
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                            {/* GST BELOW GST */}
                            <div className="mt-2">
                              <AppInput
                                placeholder="Enter GST percentage"
                                label="GST (%)"
                                name="mediumGstPercentage"
                                value={formik.values.mediumGstPercentage}
                                onChange={e => formik.setFieldValue('mediumGstPercentage', e.target.value)}
                                onBlur={formik.handleBlur}
                                isRequired
                                percentageFormat={true}
                                error={formik.touched.mediumGstPercentage && formik.errors.mediumGstPercentage ? formik.errors.mediumGstPercentage : ''}
                              />
                            </div>
                          </FormControl>
                        </div>
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span className="label mb-0" style={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                                TDS Applicable
                              </span>
                              <RadioGroup value={mediumTdsDeductible} onChange={e => setMediumTdsDeductible(e.target.value)} sx={{ flexDirection: 'row', gap: 2, flexWrap: 'nowrap' }}>
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
                        <div className="col-md-4">
                          <AppInput
                            label="Estimated total (incl. GST)"
                            value={calculatePreviewPayable(formik.values.mediumBaseCertificationFee, formik.values.mediumFoodAndTravel, formik.values.mediumGstPercentage)}
                            disabled
                            subLabel="Before TDS election at payment"
                          />
                        </div>
                      </div>
                      <div className="row margin-top-24"></div>
                    </div>
                    <div className="margin-top-30">
                      <h5 className="section-title">Large</h5>

                      {/* ROW 1 */}
                      <div className="row gap-vertical-30">
                        <div className="col-md-4">
                          <AppInput
                            label="Base Certification Fee"
                            placeholder="Enter Base Certification Fee"
                            name="largeBaseCertificationFee"
                            value={formik.values.largeBaseCertificationFee}
                            onChange={e => formik.setFieldValue('largeBaseCertificationFee', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.largeBaseCertificationFee && formik.errors.largeBaseCertificationFee ? formik.errors.largeBaseCertificationFee : ''}
                          />
                        </div>

                        <div className="col-md-4">
                          <AppInput
                            label="Logistics Fee"
                            placeholder="Enter Logistics Fee"
                            name="largeFoodAndTravel"
                            value={formik.values.largeFoodAndTravel}
                            onChange={e => formik.setFieldValue('largeFoodAndTravel', e.target.value)}
                            feeValidation={true}
                            onBlur={formik.handleBlur}
                            isRequired={true}
                            error={formik.touched.largeFoodAndTravel && formik.errors.largeFoodAndTravel ? formik.errors.largeFoodAndTravel : ''}
                          />
                        </div>
                      </div>

                      {/* GST + TDS ROW */}
                      <div className="row margin-top-24">
                        {/* GST COLUMN */}
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                            {/* GST BELOW GST */}
                            <div className="mt-2">
                              <AppInput
                                placeholder="Enter GST percentage"
                                label="GST (%)"
                                name="largeGstPercentage"
                                value={formik.values.largeGstPercentage}
                                onChange={e => formik.setFieldValue('largeGstPercentage', e.target.value)}
                                onBlur={formik.handleBlur}
                                isRequired
                                percentageFormat={true}
                                error={formik.touched.largeGstPercentage && formik.errors.largeGstPercentage ? formik.errors.largeGstPercentage : ''}
                              />
                            </div>
                          </FormControl>
                        </div>
                        <div className="col-md-4">
                          <FormControl component="fieldset" sx={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span className="label mb-0" style={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                                TDS Applicable
                              </span>
                              <RadioGroup value={largeTdsDeductible} onChange={e => setLargeTdsDeductible(e.target.value)} sx={{ flexDirection: 'row', gap: 2, flexWrap: 'nowrap' }}>
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
                        <div className="col-md-4">
                          <AppInput
                            label="Estimated total (incl. GST)"
                            value={calculatePreviewPayable(formik.values.largeBaseCertificationFee, formik.values.largeFoodAndTravel, formik.values.largeGstPercentage)}
                            disabled
                            subLabel="Before TDS election at payment"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-footer">
                    <AppButton
                      title={feeConfigurations && feeConfigurations.length > 0 ? 'Save Changes' : 'Save'}
                      size="medium"
                      loading={formik.isSubmitting || createLoading || updateLoading}
                      disabled={formik.isSubmitting || createLoading || updateLoading}
                      onClick={handleSubmitClick}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <AppModal
            modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
            show={successfulModal}
            image={Icons.successCircle}
            header={'Service fee configuration saved successfully'}
            subHeader={''}
          />
          <AppModal
            modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
            show={updatedModal}
            image={Icons.successCircle}
            header={'Service fee configuration updated successfully'}
            subHeader={''}
          />
        </div>
      )}
    </Layout>
  );
};

export default FeeConfiguration;
