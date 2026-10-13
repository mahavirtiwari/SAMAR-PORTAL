import { useFormik } from 'formik';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppButton, AppDatePicker, AppDropdown, AppInput } from '../../../components/base';
import { Layout } from '../../../components/layout';
import AppModal from '../../../components/modals/AppModal';
import Icons from '../../../constants/Icons';
import { usePincodeAutofill } from '../../../hooks';
import { getAllUsersAction } from '../../../redux/action/common/UnitAdminAction';
import { createUnitAction, getAllUnitsAction } from '../../../redux/action/enterpriseAdmin/unit/UnitAction';
import { getStateAction } from '../../../redux/action/master/MasterAction';
import { getAllOrganizationsAction } from '../../../redux/action/organizations/OrganizationAction';
import { resetCreateUnit } from '../../../redux/slices/enterpriseAdmin/Unit/UnitSlice';
import { emailRegex } from '../../../utils/Regex';

const AddNewUnit = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isSameAsRegistered, setIsSameAsRegistered] = useState(false);
  const { user } = useSelector(state => state.Account);
  const { createUnitLoading, createUnit } = useSelector(state => state.Unit);
  const { userList, createUserLoading } = useSelector(state => state.UnitAdmin);
  const { organizations } = useSelector(state => state.Organization);
  const { getState: statesList } = useSelector(state => state.Master);
  const stateOptions = Array.isArray(statesList) ? statesList.map(state => ({ value: state.name || state, label: state.name || state })) : [];
  const [successfulModal, setSuccessfulModal] = useState(false);
  const [discardModal, setDiscardModal] = useState(false);
  const [activeTab, setActiveTab] = useState('manufacturing');

  useEffect(() => {
    const filtersData = {
      search: '',
      role: 'unit_admin',
      status: '',
      isActive: true,
      organizationId: user?.organization?.id,
      perPage: null,
      page: null,
    };
    dispatch(getAllUsersAction(filtersData)); // 500ms debounce
  }, [dispatch, user, createUserLoading]);

  useEffect(() => {
    dispatch(getAllOrganizationsAction(user?.organization?.id));
  }, [dispatch, user]);

  useEffect(() => {
    dispatch(getStateAction({ all: true }));
  }, [dispatch]);

  const getInitialValues = () => {
    const baseValues = {
      unitName: '',
      address: '',
      pinCode: '',
      district: '',
      state: '',
      landlineNumber: '',
      registeredMobileNumber: '',
      emailId: '',
      alternativeEmailId: '',
      commencementDate: '',
      contactPersonName: '',
      designation: '',
      contactPersonMobile: '',
      contactPersonEmail: '',
    };

    if (isSameAsRegistered && organizations) {
      const organization = organizations?.organization; // Assuming first organization or find by user.organization.id
      return {
        ...baseValues,
        address: organization.registeredAddress || '',
        pinCode: organization.registeredPincode || '',
        district: organization.registeredDistrict || '',
        state: organization.registeredState || '',
      };
    }

    return baseValues;
  };

  const initialValues = getInitialValues();

  const validationSchema = Yup.object({
    unitName: Yup.string().max(150, 'Unit name cannot exceed 150 characters').required('Unit name is required'),
    address: Yup.string().max(250, 'Address cannot exceed 250 characters').required('Address is required'),
    pinCode: Yup.string()
      .required('PIN code is required')
      .matches(/^\d{6}$/, 'PIN code must be 6 digits'),

    registeredMobileNumber: Yup.string()
      .required('Mobile number is required')
      .matches(/^\d{10}$/, 'Mobile number must be 10 digits'),
    // emailId: Yup.string().max(320, 'Email cannot exceed 320 characters').email('Invalid email format').matches(emailRegex, 'Invalid email').required('Please enter an email address'),
    commencementDate: Yup.string().required('Select a commencement date'),
    contactPersonName: Yup.string().required('Contact person name is required'),
    designation: Yup.string().required('Designation is required'),
    contactPersonMobile: Yup.string()
      .required('Mobile number is required')
      .matches(/^\d{10}$/, 'Mobile number must be 10 digits'),
    contactPersonEmail: Yup.string().required('Contact email is required').email('Enter a valid email address'),
    alternativeEmailId: Yup.string().max(320, 'Email cannot exceed 320 characters').matches(emailRegex, 'Enter a valid email address'),
    landlineNumber: Yup.string().max(12, 'Landline number cannot exceed 12 characters'),
  });

  const handleSave = async values => {
    const payload = {
      name: values.unitName,
      email: values.emailId,
      alternateEmail: values.alternativeEmailId,
      mobileNumber: values.registeredMobileNumber,
      landlineNumber: values.landlineNumber,
      contactPersonName: values.contactPersonName,
      contactPersonDesignation: values.designation,
      contactPersonEmail: values.contactPersonEmail,
      contactPersonMobileNumber: values.contactPersonMobile,
      address: values.address,
      state: values.state,
      district: values.district,
      pincode: values.pinCode,
      unitType: activeTab,
      commencementDate: values.commencementDate,
    };

    const result = await dispatch(createUnitAction(payload));
    if (!result.error) {
      setSuccessfulModal(true);
    }
  };

  useEffect(() => {
    if (createUnit) {
      const filtersData = {
        search: '',
        role: 'unitAdmin',
        status: '',
        isActive: true,
        organizationId: user.organization.id,
        perPage: 15,
        page: 1,
      };
      dispatch(getAllUnitsAction(filtersData));
      navigate('/manage-units');
    }
    dispatch(resetCreateUnit());
  }, [createUnit, navigate, dispatch, user.organization.id]);

  const handleCancel = () => setDiscardModal(true);
  const handleDiscardConfirm = () => navigate('/manage-units');
  const handleDiscardCancel = () => setDiscardModal(false);
  const existingUnitAdminOptions = userList?.data?.map(user => {
    return { value: user.email, label: user.email };
  });

  const formik = useFormik({
    initialValues: initialValues,
    validationSchema: validationSchema,
    enableReinitialize: true,
    onSubmit: handleSave,
  });
  const { notFound: pincodeNotFound, markApplied: markPincodeApplied } = usePincodeAutofill({
    pinCode: formik.values.pinCode,
    lookupKey: 'addUnit',
    district: formik.values.district,
    state: formik.values.state,
    onResolve: match => {
      formik.setFieldValue('district', match.district);
      formik.setFieldValue('state', match.state);
    },
    onMiss: () => {
      formik.setFieldValue('district', '');
      formik.setFieldValue('state', '');
    },
  });

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="header-section">
              <h1 className="heading-createApp">Add New Unit</h1>
              <div className="heading-seperator"></div>
              <ul className="breadCrumbHeader">
                <li>Manage Units</li>
                <div className="dot-separator" />
                <li>Add New Unit</li>
              </ul>
            </div>
            <div className="main-content-section">
              <div className="margin-bottom-30 bottom-seperator">
                <span className="label">
                  Unit Type
                  <span className="asterics">*</span>
                </span>
                {/* Bootstrap Tab Navigation */}
                <ul className="nav nav-tabs custom-unit-tabs" id="unitTabs" role="tablist">
                  <li className="nav-item col-6" role="presentation">
                    <button
                      className={`nav-link unit-type-tab manufacturing-tab ${activeTab === 'manufacturing' ? 'active' : ''}`}
                      id="manufacturing-tab"
                      data-bs-toggle="tab"
                      data-bs-target="#manufacturing"
                      type="button"
                      role="tab"
                      aria-controls="manufacturing"
                      aria-selected={activeTab === 'manufacturing'}
                      onClick={() => setActiveTab('manufacturing')}>
                      <div className="unit-type-container-tab">
                        <div className="tabIcon">
                          <span className="unit-type">Manufacturing</span>
                        </div>
                      </div>
                    </button>
                  </li>
                  <li className="nav-item col-6" role="presentation">
                    <button
                      className={`nav-link unit-type-tab services-tab ${activeTab === 'services' ? 'active' : ''}`}
                      id="services-tab"
                      data-bs-toggle="tab"
                      data-bs-target="#services"
                      type="button"
                      role="tab"
                      aria-controls="services"
                      aria-selected={activeTab === 'services'}
                      onClick={() => setActiveTab('services')}>
                      <div className="unit-type-container-tab">
                        <div className="tabIcon">
                          <span className="unit-type">Services</span>
                        </div>
                      </div>
                    </button>
                  </li>
                </ul>
              </div>
              <h5 className="section-title">Unit Information</h5>
              <form onSubmit={formik.handleSubmit}>
                {/* Use formik.values, formik.errors, formik.touched, formik.handleChange, formik.handleBlur, formik.setFieldValue, formik.setValues */}
                <div className="form-check">
                  <div
                    className="custom-checkbox d-flex align-items-center"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      const newValue = !isSameAsRegistered;
                      setIsSameAsRegistered(newValue);
                      if (newValue && organizations && organizations.length > 0) {
                        const organization = organizations[0];
                        formik.setValues({
                          ...formik.values,
                          address: organization.address || '',
                          pinCode: organization.pincode || '',
                          district: organization.district || '',
                          state: organization.state || '',
                          landlineNumber: organization.landlineNumber || '',
                          registeredMobileNumber: organization.mobileNumber || '',
                        });
                        markPincodeApplied(organization.pincode || '');
                      } else if (!newValue) {
                        formik.setValues({
                          ...formik.values,
                          address: '',
                          pinCode: '',
                          district: '',
                          state: '',
                          landlineNumber: '',
                          registeredMobileNumber: '',
                        });
                      }
                    }}>
                    {isSameAsRegistered ? <img src={Icons.squareTick} alt="checkbox" className="icon-22" /> : <img src={Icons.squareUncheck} alt="checkbox" className="icon-22" />}
                    <label className="form-check-label mb-0" style={{ cursor: 'pointer' }}>
                      Same as Enterprise Address
                    </label>
                  </div>
                </div>
                <div className="form-section bottom-seperator">
                  <div className="row margintop-30">
                    <div className="col-md-12">
                      <AppInput
                        label="Unit Name"
                        placeholder="Enter Unit Name"
                        value={formik.values.unitName}
                        onChange={formik.handleChange('unitName')}
                        onBlur={formik.handleBlur('unitName')}
                        isRequired={true}
                        error={formik.touched.unitName && formik.errors.unitName}
                      />
                      <div className="margintop-30">
                        <AppInput
                          label="Address"
                          placeholder="Enter Address"
                          value={formik.values.address}
                          onChange={formik.handleChange('address')}
                          onBlur={formik.handleBlur('address')}
                          isRequired={true}
                          error={formik.touched.address && formik.errors.address}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="row margintop-30">
                    <div className="col-md-4">
                      <AppInput
                        label="PIN Code"
                        placeholder="Enter PIN code"
                        value={formik.values.pinCode}
                        onChange={e => {
                          let value = e.target.value;
                          // Remove all non-digit characters
                          const digits = value.replace(/\D/g, '');
                          // Limit to 6 digits
                          const pinCode = digits.slice(0, 6);
                          formik.setFieldValue('pinCode', pinCode);
                        }}
                        onBlur={formik.handleBlur('pinCode')}
                        isRequired={true}
                        error={(formik.touched.pinCode && formik.errors.pinCode) || (pincodeNotFound ? 'PIN code not found. Please enter District and State manually.' : '')}
                      />
                    </div>
                    <div className="col-md-4">
                      <AppInput
                        label="District"
                        focused={formik.values.district}
                        value={formik.values.district || ''}
                        onChange={formik.handleChange('district')}
                        onBlur={formik.handleBlur('district')}
                        placeholder="Select District"
                        isRequired={true}
                        // error={formik.touched.district && formik.errors.district}
                      />
                    </div>
                    <div className="col-md-4">
                      <AppDropdown
                        label="State"
                        name="state"
                        value={formik.values.state || ''}
                        onChange={e => formik.setFieldValue('state', e.target.value)}
                        onBlur={formik.handleBlur('state')}
                        options={stateOptions}
                        placeholder="Select State"
                        isRequired={true}
                        error={formik.touched.state && formik.errors.state}
                      />
                    </div>
                  </div>
                  <div className="row margintop-30" style={{ rowGap: '30px' }}>
                    <div className="col-md-6">
                      <AppInput
                        label="Mobile Number"
                        placeholder="Enter Mobile Number"
                        value={formik.values.registeredMobileNumber}
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
                          formik.setFieldValue('registeredMobileNumber', mobile);
                        }}
                        onBlur={formik.handleBlur('registeredMobileNumber')}
                        isRequired={true}
                        inputMode="numeric"
                        maxLength={10}
                        error={formik.touched.registeredMobileNumber && formik.errors.registeredMobileNumber}
                      />
                    </div>
                    <div className="col-md-6">
                      <AppInput
                        label="Landline Number"
                        placeholder="Enter Landline Number"
                        value={formik.values.landlineNumber}
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
                          formik.setFieldValue('landlineNumber', mobile);
                        }}
                        onBlur={formik.handleBlur('landlineNumber')}
                        error={formik.touched.landlineNumber && formik.errors.landlineNumber}
                      />
                    </div>
                    <div className="col-md-6">
                      <AppDropdown
                        options={existingUnitAdminOptions}
                        label="Email"
                        placeholder="Select Unit Email"
                        value={formik.values.emailId}
                        onChange={e => formik.setFieldValue('emailId', e.target.value)}
                        error={formik.touched.emailId && formik.errors.emailId}
                      />
                    </div>
                    <div className="col-md-6">
                      <AppInput
                        label="Alternate Email"
                        placeholder="Enter Alternate Email"
                        value={formik.values.alternativeEmailId}
                        onChange={formik.handleChange('alternativeEmailId')}
                        onBlur={formik.handleBlur('alternativeEmailId')}
                        error={formik.touched.alternativeEmailId && formik.errors.alternativeEmailId}
                      />
                    </div>
                    <div className="col-md-6">
                      <AppDatePicker
                        label="Date of Commencement of Unit"
                        additionalInfoLabel="Applied for"
                        value={formik.values.commencementDate}
                        onChange={date => formik.setFieldValue('commencementDate', date)}
                        placeholder="Select date"
                        isRequired={true}
                        error={formik.touched.commencementDate && formik.errors.commencementDate}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-section bottom-seperator">
                  <h5 className="section-title">Contact Person Information</h5>
                  <div className="row" style={{ rowGap: '30px' }}>
                    <div className="col-md-6">
                      <AppInput
                        label="Contact Person Name"
                        placeholder="Enter Contact Person Name"
                        value={formik.values.contactPersonName}
                        onChange={formik.handleChange('contactPersonName')}
                        onBlur={formik.handleBlur('contactPersonName')}
                        isRequired={true}
                        error={formik.touched.contactPersonName && formik.errors.contactPersonName}
                      />
                    </div>
                    <div className="col-md-6">
                      <AppInput
                        label="Designation"
                        placeholder="Enter Designation"
                        value={formik.values.designation}
                        onChange={formik.handleChange('designation')}
                        onBlur={formik.handleBlur('designation')}
                        isRequired={true}
                        error={formik.touched.designation && formik.errors.designation}
                      />
                    </div>
                    <div className="col-md-6">
                      <AppInput
                        label="Mobile Number"
                        placeholder="Enter Mobile Number"
                        value={formik.values.contactPersonMobile}
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
                          formik.setFieldValue('contactPersonMobile', mobile);
                        }}
                        onBlur={formik.handleBlur('contactPersonMobile')}
                        isRequired={true}
                        inputMode="numeric"
                        maxLength={10}
                        error={formik.touched.contactPersonMobile && formik.errors.contactPersonMobile}
                      />
                    </div>
                    <div className="col-md-6">
                      <AppInput
                        label="Email"
                        placeholder="Enter Email"
                        value={formik.values.contactPersonEmail}
                        onChange={formik.handleChange('contactPersonEmail')}
                        onBlur={formik.handleBlur('contactPersonEmail')}
                        isRequired={true}
                        error={formik.touched.contactPersonEmail && formik.errors.contactPersonEmail}
                      />
                    </div>
                  </div>
                </div>
                <div className="right-button-section">
                  <AppButton variant="tertiary" title="Cancel" onClick={handleCancel}></AppButton>
                  <AppButton disabled={createUnitLoading} loading={createUnitLoading} title="Save Unit" type="submit"></AppButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={successfulModal}
        image={Icons.successCircle}
        header={'Unit added successfully'}
        subHeader={''}
        singleButton={true}
        buttonClassName={'w-100 primary medium'}
        buttonOnClick={() => navigate('/')}
        singleButtonLabel={'OK'}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--warning-light)' }}
        show={discardModal}
        image={Icons.warningIcon}
        header={'Discard Unit?'}
        subHeader={'The details you entered will be lost.'}
        twoButtons={true}
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary medium'}
        leftButtonOnClick={handleDiscardCancel}
        rightButton={'Discard'}
        rightButtonClassName={'w-100 primary medium'}
        rightButtonOnClick={handleDiscardConfirm}
      />
    </Layout>
  );
};

export default AddNewUnit;
