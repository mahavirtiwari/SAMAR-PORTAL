import { useFormik } from 'formik';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Col, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppButton, AppDropdown, AppInput, AppModal } from '../../../../components/base';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { usePincodeAutofill } from '../../../../hooks';
import useServerErrors from '../../../../hooks/useServerErrors';
import { getStateAction } from '../../../../redux/action/master/MasterAction';
import { getAllOrganizationsAction, updateOrganizationAction } from '../../../../redux/action/organizations/OrganizationAction';
import { resetUpdated } from '../../../../redux/slices/organizations/OrganizationSlice';
import { emailRegex, panNumberRegex } from '../../../../utils/Regex';

// Yup validation schema
const validationSchema = Yup.object({
  name: Yup.string().max(150, 'Enterprise name cannot exceed 150 characters').required('Enterprise name is required'),
  registeredOfficeAddress: Yup.string().max(250, 'Registered office address cannot exceed 250 characters').required('Registered office address is required'),
  registeredPincode: Yup.string()
    .required('PIN code is required')
    .matches(/^\d{6}$/, 'PIN code must be 6 digits'),
  registeredState: Yup.string().required('State is required'),
  registeredDistrict: Yup.string().required('District is required'),
  mobileNumber: Yup.string().max(10, 'Mobile number must be 10 digits').required('Mobile number is required'),
  landlineNumber: Yup.string().matches(/^[0-9]{12}$/, { message: 'Landline number must be 12 digits', excludeEmptyString: true }),
  email: Yup.string().max(320, 'Email cannot exceed 320 characters').matches(emailRegex, 'Enter a valid email address').required('Email is required'),
  alternateEmail: Yup.string()
    .max(320, 'Email cannot exceed 320 characters')
    .matches(emailRegex, 'Enter a valid email address')
    .test('different-from-email', 'Alternate email must be different from primary email', function (value) {
      const primary = this.parent?.email;
      if (!value || !primary) {
        return true;
      }
      return String(value).trim().toLowerCase() !== String(primary).trim().toLowerCase();
    }),
  pan: Yup.string().required('PAN is required').matches(panNumberRegex, 'PAN must be valid (e.g., ABCDE1234F)'),
  ownerName: Yup.string()
    .max(50, 'Owner name cannot exceed 50 characters')
    .matches(/^[A-Za-z ]+$/, 'Owner name must contain only alphabets')
    .required('Owner name is required'),
  ownerDesignation: Yup.string()
    .max(50, 'Designation cannot exceed 50 characters')
    .matches(/^[A-Za-z ]+$/, 'Designation must contain only alphabets')
    .required('Designation is required'),
  ownerEmail: Yup.string().max(320, 'Email cannot exceed 320 characters').matches(emailRegex, 'Enter a valid email address').required('Owner email is required'),
  ownerMobile: Yup.string()
    .matches(/^\d{10}$/, 'Mobile number must be 10 digits')
    .required('Owner mobile number is required'),
});

const OrganisationProfile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [successModal, setSuccessModal] = useState(false);
  const { user } = useSelector(state => state.Account);
  const { getState: statesList } = useSelector(state => state.Master);
  const stateOptions = Array.isArray(statesList) ? statesList.map(state => ({ value: state.name || state, label: state.name || state })) : [];
  const PINCODE_KEY = 'orgProfile';

  const { organizations, updatedOrganization, updateError, updateLoading } = useSelector(state => state.Organization);
  // Get current organization data

  const currentOrganization = useMemo(() => {
    if (organizations) {
      return organizations?.organization;
    }
    return null;
  }, [organizations]);

  const initialValues = useMemo(
    () => ({
      name: currentOrganization?.name || '',
      registeredOfficeAddress: currentOrganization?.registeredAddress || '',
      registeredPincode: currentOrganization?.registeredPincode || '',
      registeredAddress: currentOrganization?.registeredAddress || '',
      registeredState: currentOrganization?.registeredState || '',
      registeredDistrict: currentOrganization?.registeredDistrict || '',
      mobileNumber: currentOrganization?.mobileNumber || '',
      landlineNumber: currentOrganization?.landline || '',
      email: currentOrganization?.email || '',
      alternateEmail: currentOrganization?.alternateEmail || '',
      pan: currentOrganization?.pan || '',
      ownerName: currentOrganization?.ownerName || '',
      ownerDesignation: currentOrganization?.ownerDesignation || '',
      ownerEmail: currentOrganization?.ownerEmail || '',
      ownerMobile: currentOrganization?.ownerMobileNumber || '',
    }),
    [currentOrganization],
  );

  const transformFormValuesToApiPayload = useCallback(
    values => ({
      name: values.name,
      email: values.email,
      alternateEmail: values.alternateEmail,
      mobileNumber: values.mobileNumber,
      landlineNumber: values.landlineNumber,
      pan: values.pan,
      registeredAddress: values.registeredOfficeAddress,
      registeredPincode: values.registeredPincode,
      registeredState: values.registeredState,
      registeredDistrict: values.registeredDistrict,
      ownerName: values.ownerName,
      ownerDesignation: values.ownerDesignation,
      ownerEmail: values.ownerEmail,
      ownerMobileNumber: values.ownerMobile,
    }),
    [],
  );
  const handleSubmit = async values => {
    const apiPayload = transformFormValuesToApiPayload(values);

    await dispatch(updateOrganizationAction(apiPayload));
  };

  useEffect(() => {
    if (user?.organization?.id) {
      dispatch(getAllOrganizationsAction({ organizationId: user?.organization?.id }));
    }
  }, [dispatch, user?.organization?.id]);

  useEffect(() => {
    dispatch(getStateAction({ all: true }));
  }, [dispatch]);

  useEffect(() => {
    async function fetchData() {
      if (updatedOrganization) {
        setSuccessModal(true);
        setTimeout(() => {
          setSuccessModal(false);
          dispatch(getAllOrganizationsAction({ organizationId: user.organization.id }));
          // navigate('/');
          dispatch(resetUpdated());
        }, 2000);
      }
      // Note: updateError is now handled by useServerErrors hook
    }
    fetchData();
  }, [updatedOrganization, navigate, dispatch]);

  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    enableReinitialize: true,
  });

  const { notFound: pincodeNotFound } = usePincodeAutofill({
    pinCode: formik.values.registeredPincode,
    lookupKey: PINCODE_KEY,
    district: formik.values.registeredDistrict,
    state: formik.values.registeredState,
    onResolve: match => {
      formik.setFieldValue('registeredDistrict', match.district);
      formik.setFieldValue('registeredState', match.state);
    },
    onMiss: () => {
      formik.setFieldValue('registeredDistrict', '');
      formik.setFieldValue('registeredState', '');
    },
  });

  // Map server field names to formik field names
  const fieldMapping = {
    // Server returns PascalCase, formik uses camelCase
    Name: 'name',
    RegisteredAddress: 'registeredOfficeAddress',
    RegisteredPincode: 'registeredPincode',
    RegisteredState: 'registeredState',
    RegisteredDistrict: 'registeredDistrict',
    MobileNumber: 'mobileNumber',
    LandlineNumber: 'landlineNumber',
    Landline: 'landlineNumber',
    Email: 'email',
    AlternateEmail: 'alternateEmail',
    Pan: 'pan',
    OwnerName: 'ownerName',
    OwnerDesignation: 'ownerDesignation',
    OwnerEmail: 'ownerEmail',
    OwnerMobileNumber: 'ownerMobile',
    OwnerMobile: 'ownerMobile',
  };

  // Use server errors hook to map field-level errors
  useServerErrors({
    serverError: updateError,
    setFieldError: formik.setFieldError,
    setFieldTouched: formik.setFieldTouched,
    fieldMapping,
    onGeneralError: message => {
      toastError(message);
    },
    resetError: resetUpdated,
    dispatch,
  });

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <Row>
            <Col md={12}>
              <div className="organization-card" style={{ margin: 0 }}>
                <h2 className="fs-20 fw-600 heading-color mb-0 text-center">Enterprise Details</h2>
                <p className="fs-14 fw-500 text-2-color nargin-top-4 mb-0 text-center">General Information, PAN Details & Contact Details</p>
                <form onSubmit={formik.handleSubmit}>
                  <h4 className="fs-16 fw-600 text-2-color margin-top-30 text-uppercase mb-0">General Information</h4>
                  <Row>
                    <Col md={12} className="margin-top-30">
                      <AppInput
                        name="name"
                        placeholder="Enter Enterprise Name"
                        label="Enterprise Name"
                        value={formik.values.name}
                        onChange={formik.handleChange}
                        maxLength={150}
                        onBlur={formik.handleBlur}
                        isRequired={true}
                        disabled={true}
                        focused={formik.values.name}
                        InputProps={{ readOnly: true }}
                        error={formik.touched.name && formik.errors.name ? formik.errors.name : ''}
                      />
                    </Col>
                    <Col md={12} className="margin-top-30">
                      <AppInput
                        name="registeredOfficeAddress"
                        placeholder="Enter Registered Office Address"
                        label="Registered Office Address"
                        multiline
                        isRequired
                        value={formik.values.registeredOfficeAddress}
                        maxLength={250}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.registeredOfficeAddress && formik.errors.registeredOfficeAddress ? formik.errors.registeredOfficeAddress : ''}
                      />
                    </Col>
                    <Col md={4} className="margin-top-30">
                      <AppInput
                        name="pinCode"
                        placeholder="Enter PIN code"
                        label="PIN Code"
                        isRequired
                        value={formik.values.registeredPincode}
                        onBlur={formik.handleBlur}
                        maxLength={6}
                        error={(formik.touched.registeredPincode && formik.errors.registeredPincode) || (pincodeNotFound ? 'PIN code not found. Please enter District and State manually.' : '')}
                        onChange={e => {
                          let value = e.target.value;
                          const digits = value.replace(/\D/g, '');
                          const pinCode = digits.slice(0, 6);
                          formik.setFieldValue('registeredPincode', pinCode);
                        }}
                      />
                    </Col>
                    <Col md={4} className="margin-top-30">
                      <AppInput
                        label="District"
                        focused={formik.values.registeredDistrict}
                        value={formik.values.registeredDistrict || ''}
                        onChange={formik.handleChange('registeredDistrict')}
                        onBlur={formik.handleBlur('registeredDistrict')}
                        placeholder="Enter District"
                        isRequired={true}
                        error={formik.touched.registeredDistrict && formik.errors.registeredDistrict}
                      />
                    </Col>
                    <Col md={4} className="margin-top-30">
                      <AppDropdown
                        name="registeredState"
                        label="State"
                        value={formik.values.registeredState || ''}
                        onChange={e => formik.setFieldValue('registeredState', e.target.value)}
                        onBlur={formik.handleBlur('registeredState')}
                        options={stateOptions}
                        placeholder="Select State"
                        isRequired={true}
                        error={formik.touched.registeredState && formik.errors.registeredState}
                      />
                    </Col>

                    <Col md={6} className="margin-top-30">
                      <AppInput
                        name="mobileNumber"
                        placeholder="Enter Mobile Number"
                        label="Mobile Number"
                        value={formik.values.mobileNumber}
                        disabled={true}
                        focused={formik.values.mobileNumber}
                        InputProps={{ readOnly: true }}
                        isRequired={true}
                        onChange={e => formik.setFieldValue('mobileNumber', e.target.value)}
                        phoneNumberFormat={true}
                        onBlur={formik.handleBlur}
                        error={formik.touched.mobileNumber && formik.errors.mobileNumber ? formik.errors.mobileNumber : ''}
                      />
                    </Col>
                    <Col md={6} className="margin-top-30">
                      <AppInput
                        name="landlineNumber"
                        placeholder="Enter Landline Number"
                        label="Landline Number"
                        value={formik.values.landlineNumber}
                        maxLength={12}
                        onChange={e => {
                          formik.setFieldValue('landlineNumber', e.target.value);
                        }}
                        landLineFormat={true}
                        onBlur={formik.handleBlur}
                        error={formik.touched.landlineNumber && formik.errors.landlineNumber ? formik.errors.landlineNumber : ''}
                      />
                    </Col>
                    <Col md={6} className="margin-top-30">
                      <AppInput
                        disabled={true}
                        focused={currentOrganization?.email || formik.values.email}
                        InputProps={{ readOnly: true }}
                        maxLength={320}
                        name="email"
                        placeholder="Enter Email"
                        label="Email"
                        value={formik.values.email}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.email && formik.errors.email ? formik.errors.email : ''}
                        isRequired={true}
                      />
                    </Col>
                    <Col md={6} className="margin-top-30">
                      <AppInput
                        name="alternateEmail"
                        placeholder="Enter Alternate Email Address"
                        label="Alternate Email"
                        maxLength={320}
                        value={formik.values.alternateEmail}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.alternateEmail && formik.errors.alternateEmail ? formik.errors.alternateEmail : ''}
                      />
                    </Col>
                  </Row>
                  <hr className="divider" />
                  <h4 className="fs-16 fw-600 text-2-color text-uppercase">PAN</h4>
                  <Row>
                    <Col md={6} className="margin-top-16">
                      <AppInput
                        name="pan"
                        maxLength={10}
                        placeholder="e.g. AAAAA0000A"
                        label="Enterprise PAN"
                        isRequired
                        upperCase={true}
                        stripWhitespace={true}
                        value={formik.values.pan}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.pan && formik.errors.pan ? formik.errors.pan : ''}
                      />
                    </Col>
                  </Row>
                  <hr className="divider" />
                  <h4 className="fs-16 fw-600 text-2-color text-uppercase">Owner Details</h4>
                  <Row>
                    <Col md={6} className="margin-top-16">
                      <AppInput
                        name="ownerName"
                        placeholder="Enter name"
                        label="Name"
                        isRequired
                        maxLength={50}
                        value={formik.values.ownerName}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.ownerName && formik.errors.ownerName ? formik.errors.ownerName : ''}
                      />
                    </Col>
                    <Col md={6} className="margin-top-16">
                      <AppInput
                        name="ownerDesignation"
                        placeholder="Enter designation"
                        label="Designation"
                        isRequired
                        maxLength={50}
                        value={formik.values.ownerDesignation}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.ownerDesignation && formik.errors.ownerDesignation ? formik.errors.ownerDesignation : ''}
                      />
                    </Col>
                    <Col md={6} className="margin-top-30">
                      <AppInput
                        name="ownerEmail"
                        placeholder="Enter email address"
                        label="Email"
                        isRequired
                        maxLength={320}
                        value={formik.values.ownerEmail}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.ownerEmail && formik.errors.ownerEmail ? formik.errors.ownerEmail : ''}
                      />
                    </Col>
                    <Col md={6} className="margin-top-30">
                      <AppInput
                        name="ownerMobile"
                        placeholder="Enter mobile number"
                        label="Mobile Number"
                        isRequired
                        value={formik.values.ownerMobile}
                        onChange={e => formik.setFieldValue('ownerMobile', e.target.value)}
                        phoneNumberFormat={true}
                        onBlur={formik.handleBlur}
                        error={formik.touched.ownerMobile && formik.errors.ownerMobile ? formik.errors.ownerMobile : ''}
                      />
                    </Col>
                  </Row>
                  <div className="margin-top-50 text-end">
                    <AppButton type="submit" title="Update" loading={updateLoading} disabled={updateLoading} />
                  </div>
                </form>
              </div>
            </Col>
          </Row>
        </div>
        <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={successModal} image={Icons.successCircle} header={'Profile updated successfully'} subHeader={''} />
      </div>
    </Layout>
  );
};

export default OrganisationProfile;
