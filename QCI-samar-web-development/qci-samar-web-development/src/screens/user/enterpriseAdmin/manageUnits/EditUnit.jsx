import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { Form, Formik, useFormikContext } from 'formik';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import * as Yup from 'yup';
import { AppButton, AppDatePicker, AppDropdown, AppInput, AppModal } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { usePincodeAutofill } from '../../../../hooks';
import { getAllUsersAction } from '../../../../redux/action/common/UnitAdminAction';
import { getAllUnitsAction, getUnitDetailsAction, updateUnitAction } from '../../../../redux/action/enterpriseAdmin/unit/UnitAction';
import { getStateAction } from '../../../../redux/action/master/MasterAction';
import { resetUpdateUnit } from '../../../../redux/slices/enterpriseAdmin/Unit/UnitSlice';

const UnitPincodeAutofill = ({ onNotFoundChange }) => {
  const { values, setFieldValue } = useFormikContext();
  const { notFound } = usePincodeAutofill({
    pinCode: values.pinCode,
    lookupKey: 'editUnit',
    district: values.district,
    state: values.state,
    onResolve: match => {
      setFieldValue('district', match.district);
      setFieldValue('state', match.state);
    },
    onMiss: () => {
      setFieldValue('district', '');
      setFieldValue('state', '');
    },
  });
  useEffect(() => {
    onNotFoundChange(notFound);
  }, [notFound, onNotFoundChange]);
  return null;
};

const EditUnit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const dispatch = useDispatch();
  const [successfulModal, setSuccessfulModal] = useState(false);
  const [pincodeNotFound, setPincodeNotFound] = useState(false);
  const { getUnitDetail, updateUnit, updateUnitLoading } = useSelector(state => state.Unit);
  const { user } = useSelector(state => state.Account);
  const { userList, createUserLoading } = useSelector(state => state.UnitAdmin);
  const { getState: statesList } = useSelector(state => state.Master);

  useEffect(() => {
    // Fetch unit details using the id and populate the form fields
    if (id) {
      dispatch(getUnitDetailsAction(id));
    }
  }, [id, dispatch]);

  useEffect(() => {
    dispatch(getStateAction({ all: true }));
  }, [dispatch]);

  useEffect(() => {
    dispatch(getAllUsersAction({ search: '', role: 'unit_admin', status: '', isActive: true, organizationId: user?.organization?.id, perPage: null, page: null }));
  }, [dispatch, user, createUserLoading]);

  const unit = getUnitDetail?.unit;

  const handleDiscardConfirm = () => {
    navigate('/');
  };

  // Formik initial values and validation schema
  const initialValues = {
    name: unit?.name || '',
    address: unit?.address || '',
    pinCode: unit?.pincode || '',
    district: unit?.district || '',
    state: unit?.state || '',
    landlineNumber: unit?.landlineNumber || '',
    registeredMobileNumber: unit?.mobileNumber || '',
    email: unit?.email || '',
    alternativeEmailId: unit?.alternativeEmailId || '',
    commencementDate: unit?.commencementDate || null,
    contactPersonName: unit?.contactPersonName || '',
    designation: unit?.contactPersonDesignation || '',
    contactMobileNumber: unit?.contactPersonMobileNumber || '',
    contactEmailId: unit?.contactPersonEmail || '',
    status: unit?.status || 'Active',
  };

  const validationSchema = Yup.object({
    name: Yup.string().required('Unit name is required'),
    address: Yup.string().required('Address is required'),
    landlineNumber: Yup.string().max(12, 'Landline number cannot exceed 12 digits'),

    pinCode: Yup.string()
      .required('PIN code is required')
      .matches(/^\d{6}$/, 'PIN code must be 6 digits'),

    district: Yup.string().required('Select a district'),
    state: Yup.string().required('Select a state'),
    registeredMobileNumber: Yup.string()
      .matches(/^\d{10}$/, 'Mobile number must be 10 digits')
      .required('Mobile number is required'),
    //      emailId: Yup.string().max(320, 'Email cannot exceed 320 characters').email('Invalid email format').matches(emailRegex, 'Invalid email').required('Please enter an email address'),
    commencementDate: Yup.date().nullable().required('Select a commencement date'),
    contactPersonName: Yup.string().required('Contact person name is required'),
    designation: Yup.string().required('Designation is required'),
    contactMobileNumber: Yup.string()
      .matches(/^\d{10}$/, 'Mobile number must be 10 digits')
      .required('Mobile number is required'),
    contactEmailId: Yup.string().email('Enter a valid email address').required('Contact email is required'),
    status: Yup.string().required('Select a status'),
  });

  const stateOptions = Array.isArray(statesList) ? statesList.map(state => ({ value: state.name || state, label: state.name || state })) : [];

  const existingUnitAdminOptions = userList?.data?.map(unitAdmin => ({ value: unitAdmin.email, label: unitAdmin.email }));
  useEffect(() => {
    if (updateUnit) {
      setSuccessfulModal(true);
      const filtersData = {
        search: '',

        status: '',
        isActive: true,
        organizationId: user.organization.id,
        perPage: 15,
        page: 1,
      };
      dispatch(getAllUnitsAction(filtersData));
      dispatch(resetUpdateUnit());
      setTimeout(() => {
        navigate('/');
      }, 3000);
      // setSubmitting(false);
    }
  }, [updateUnit, navigate]);
  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="header-section">
              <h1 className="heading-createApp">Edit Unit</h1>
              <div className="heading-seperator"></div>
              <ul className="breadCrumbHeader">
                <li>Manage Units</li>
                <div className="dot-separator" />
                <li className="text-1-color">Edit Unit</li>
              </ul>
            </div>
            <div className="main-content-section">
              <h5 className="section-title">Unit Information</h5>
              <Formik
                initialValues={initialValues}
                enableReinitialize={true}
                validationSchema={validationSchema}
                onSubmit={values => {
                  dispatch(updateUnitAction({ unitId: id, unitData: values }));
                }}>
                {({ values, errors, touched, handleChange, handleBlur, setFieldValue }) => (
                  <Form>
                    <UnitPincodeAutofill onNotFoundChange={setPincodeNotFound} />
                    <div className="form-section bottom-seperator">
                      <div className="row margintop-30">
                        <div className="col-md-12">
                          <AppInput
                            label="Unit Name"
                            placeholder="Enter Unit Name"
                            name="name"
                            value={values.name}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            isRequired={true}
                            error={touched.name && errors.name}
                          />
                          <div className="margintop-30">
                            <AppInput
                              label="Address"
                              placeholder="Enter Address"
                              name="address"
                              value={values.address}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              isRequired={true}
                              error={touched.address && errors.address}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="row margintop-30">
                        <div className="col-md-4">
                          <AppInput
                            label="PIN Code"
                            placeholder="Enter PIN code"
                            name="pinCode"
                            value={values.pinCode}
                            onChange={e => {
                              let value = e.target.value;
                              // Remove all non-digit characters
                              const digits = value.replace(/\D/g, '');
                              // Limit to 6 digits
                              const pinCode = digits.slice(0, 6);
                              setFieldValue('pinCode', pinCode);
                            }}
                            onBlur={handleBlur}
                            isRequired={true}
                            error={(touched.pinCode && errors.pinCode) || (pincodeNotFound ? 'PIN code not found. Please enter District and State manually.' : '')}
                          />
                        </div>
                        <div className="col-md-4">
                          <AppInput
                            label="District"
                            name="district"
                            value={values.district || ''}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Enter District"
                            isRequired={true}
                            error={touched.district && errors.district}
                          />
                        </div>
                        <div className="col-md-4">
                          <AppDropdown
                            label="State"
                            name="state"
                            value={values.state}
                            onChange={e => setFieldValue('state', e.target.value)}
                            options={stateOptions}
                            placeholder="Select State"
                            isRequired={true}
                            error={touched.state && errors.state}
                          />
                        </div>
                      </div>
                      <div className="row margintop-30" style={{ rowGap: '30px' }}>
                        <div className="col-md-6">
                          <AppInput
                            label="Mobile Number"
                            placeholder="Enter Mobile Number"
                            name="registeredMobileNumber"
                            value={values.registeredMobileNumber}
                            onChange={e => {
                              let value = e.target.value.replace(/\D/g, '');
                              if (value.startsWith('91')) {
                                value = value.slice(2);
                              }
                              value = value.slice(0, 10);
                              setFieldValue('registeredMobileNumber', value);
                            }}
                            onBlur={handleBlur}
                            isRequired={true}
                            inputMode="numeric"
                            maxLength={10}
                            error={touched.registeredMobileNumber && errors.registeredMobileNumber}
                          />
                        </div>
                        <div className="col-md-6">
                          <AppInput
                            label="Landline Number"
                            placeholder="Enter Landline Number"
                            name="landlineNumber"
                            value={values.landlineNumber}
                            onChange={e => {
                              let value = e.target.value;
                              // Remove all non-digit characters
                              const digits = value.replace(/\D/g, '');
                              // Remove leading '91' if user types it after +
                              let mobile = digits;
                              if (mobile.startsWith('91')) {
                                mobile = mobile.slice(2);
                              }
                              // Limit to 10 digits
                              mobile = mobile.slice(0, 10);
                              setFieldValue('landlineNumber', mobile);
                            }}
                            onBlur={handleBlur}
                          />
                        </div>
                        <div className="col-md-6">
                          <AppDropdown
                            options={existingUnitAdminOptions}
                            label="Email"
                            name="email"
                            placeholder="Select Unit Email"
                            value={values.email}
                            onChange={e => setFieldValue('email', e.target.value)}
                            isRequired={true}
                            error={touched.email && errors.email}
                          />
                        </div>
                        <div className="col-md-6">
                          <AppInput
                            label="Alternate Email"
                            placeholder="Enter Alternate Email"
                            name="alternativeEmailId"
                            value={values.alternativeEmailId}
                            onChange={handleChange}
                            onBlur={handleBlur}
                          />
                        </div>
                        <div className="col-md-6">
                          <AppDatePicker
                            label="Date of Commencement of Unit"
                            additionalInfoLabel="Applied for"
                            name="commencementDate"
                            value={values.commencementDate}
                            onChange={date => setFieldValue('commencementDate', date)}
                            placeholder="Select date"
                            isRequired={true}
                            error={touched.commencementDate && errors.commencementDate}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="form-section bottom-seperator padding-bottom-30">
                      <h5 className="section-title">Contact Person Information</h5>
                      <div className="row" style={{ rowGap: '30px' }}>
                        <div className="col-md-6">
                          <AppInput
                            label="Contact Person Name"
                            placeholder="Enter Contact Person Name"
                            name="contactPersonName"
                            value={values.contactPersonName}
                            InputProps={{ readOnly: true }}
                            disabled={true}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            isRequired={true}
                            error={touched.contactPersonName && errors.contactPersonName}
                          />
                        </div>
                        <div className="col-md-6">
                          <AppInput
                            label="Designation"
                            placeholder="Enter Designation"
                            name="designation"
                            value={values.designation}
                            InputProps={{ readOnly: true }}
                            disabled={true}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            isRequired={true}
                            error={touched.designation && errors.designation}
                          />
                        </div>
                        <div className="col-md-6">
                          <AppInput
                            label="Mobile Number"
                            placeholder="Enter Mobile Number"
                            name="contactMobileNumber"
                            value={values.contactMobileNumber}
                            InputProps={{ readOnly: true }}
                            disabled={true}
                            onChange={e => {
                              let value = e.target.value.replace(/\D/g, '');
                              if (value.startsWith('91')) {
                                value = value.slice(2);
                              }
                              value = value.slice(0, 10);
                              setFieldValue('contactMobileNumber', value);
                            }}
                            onBlur={handleBlur}
                            isRequired={true}
                            inputMode="numeric"
                            maxLength={10}
                            error={touched.contactMobileNumber && errors.contactMobileNumber}
                          />
                        </div>
                        <div className="col-md-6">
                          <AppInput
                            label="Email"
                            placeholder="Enter Email"
                            name="contactEmailId"
                            value={values.contactEmailId}
                            InputProps={{ readOnly: true }}
                            disabled={true}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.contactEmailId && errors.contactEmailId}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="form-section bottom-seperator">
                      <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <span className="label mb-0">Status</span>
                          <RadioGroup name="status" value={values.status} onChange={handleChange} sx={{ flexDirection: 'row', gap: 2 }}>
                            <FormControlLabel
                              value="Active"
                              control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
                              label="Active"
                              sx={{
                                marginRight: 3,
                                '& .MuiFormControlLabel-label': {
                                  fontSize: '14px',
                                },
                              }}
                            />
                            <FormControlLabel
                              value="Inactive"
                              control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
                              label="Inactive"
                              sx={{
                                '& .MuiFormControlLabel-label': {
                                  fontSize: '14px',
                                },
                              }}
                            />
                          </RadioGroup>
                        </div>
                        {touched.status && errors.status && <div className="error-text">{errors.status}</div>}
                      </FormControl>
                    </div>
                    <div className="right-button-section">
                      <AppButton variant="tertiary" title="Cancel" onClick={handleDiscardConfirm}></AppButton>
                      <AppButton title="Save Unit" type="submit" disabled={updateUnitLoading} loading={updateUnitLoading}></AppButton>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        </div>
      </div>
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={successfulModal}
        image={Icons.successCircle}
        header={'Unit updated successfully'}
        subHeader={'The unit details have been saved.'}
        singleButton={true}
        buttonClassName={'w-100 primary medium'}
        buttonOnClick={() => navigate('/')}
        singleButtonLabel={'OK'}
      />
    </Layout>
  );
};

export default EditUnit;
