import { useFormik } from 'formik';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppButton, AppInput, AppModal } from '../../../../components/base';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import useServerErrors from '../../../../hooks/useServerErrors';
import { getLoggedInUserDetailsAction, getUserDetailsAction, updateUserAction } from '../../../../redux/action/common/UnitAdminAction';
import { resetCreateUpdateUser } from '../../../../redux/slices/common/UnitAdminSlice';
import { emailRegex } from '../../../../utils/Regex';

const EditProfile = () => {
  const { user } = useSelector(state => state.Account);
  const role = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0].slug : user?.role || '';
  const isEnterpriseAdmin = role === 'enterprise_admin';
  const isEditable = role === 'enterprise_admin' || role === 'unit_admin';
  const { userDetails, updateUser, updateUserLoading, updateUserError } = useSelector(state => state.UnitAdmin);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const isOperationsManager = role === 'operations_manager';
  const isAssessor = role === 'assessor';
  const assignedStates = (Array.isArray(userDetails?.assignedStates) && userDetails.assignedStates) || (Array.isArray(user?.assignedStates) && user.assignedStates) || [];
  const profileAddress = userDetails?.address ?? user?.address ?? '';
  const profileCity = userDetails?.city ?? user?.city ?? '';
  const profileDistrict = userDetails?.district ?? user?.district ?? '';
  const profileState = userDetails?.state ?? user?.state ?? '';
  const profilePincode = userDetails?.pincode ?? user?.pincode ?? '';

  // Derive modal visibility from updateUser state
  const showUpdateSuccessModal = !!updateUser;
  const [_apiErrorMessage, setApiErrorMessage] = useState('');
  const handleSaveAndNext = values => {
    if (!isEditable) {
      return;
    }
    dispatch(updateUserAction({ id: user?.id, ...values }));
  };

  useEffect(() => {
    // Fetch user details when profile updates
    dispatch(getUserDetailsAction(user.id));
    dispatch(getLoggedInUserDetailsAction(user.id));
  }, [updateUser]);

  useEffect(() => {
    if (updateUser) {
      // Navigate after showing success modal briefly
      const timer = setTimeout(() => {
        dispatch(resetCreateUpdateUser());
        navigate('/');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [updateUser, navigate, dispatch]);

  const formik = useFormik({
    initialValues: {
      firstName: userDetails?.firstName || user?.firstName || '',
      lastName: userDetails?.lastName || user?.lastName || '',
      emailId: userDetails?.email || user?.email || '',
      mobileNumber: userDetails?.mobileNumber || user?.mobileNumber || '',
      samarId: userDetails?.samarId || user?.samarId || '',
      organization: userDetails?.organization?.name || user?.organization?.name || '',
    },
    validationSchema: Yup.object({
      firstName: Yup.string().max(50, 'First name cannot exceed 50 characters').required('First name is required'),
      lastName: Yup.string().max(50, 'Last name cannot exceed 50 characters').required('Last name is required'),
      emailId: Yup.string().max(320, 'Email cannot exceed 320 characters').email('Enter a valid email address').matches(emailRegex, 'Enter a valid email address').required('Email is required'),
      mobileNumber: Yup.string()
        .matches(/^\d+$/, 'Mobile number must contain only digits')
        .min(10, 'Mobile number must be 10 digits')
        .max(10, 'Mobile number must be 10 digits')
        .required('Mobile number is required'),
      samarId: Yup.string().required('SAMAR ID is required'),
      organization: Yup.string().required('Organization is required'),
    }),
    onSubmit: handleSaveAndNext,
    enableReinitialize: true,
  });

  const displayFirstName = role === 'system_admin' ? 'System' : isEnterpriseAdmin ? (formik.values.firstName || '').toUpperCase() : formik.values.firstName;
  const displayLastName = role === 'system_admin' ? 'Admin' : isEnterpriseAdmin ? (formik.values.lastName || '').toUpperCase() : formik.values.lastName;
  const displayOrganization = isEnterpriseAdmin ? (formik?.values?.organization || '').toUpperCase() : formik?.values?.organization || '';

  // Map server field names to formik field names
  const fieldMapping = {
    FirstName: 'firstName',
    LastName: 'lastName',
    Email: 'emailId',
    EmailId: 'emailId',
    MobileNumber: 'mobileNumber',
    SamarId: 'samarId',
    Organization: 'organization',
  };

  // Use server errors hook to map field-level errors
  useServerErrors({
    serverError: updateUserError,
    setFieldError: formik.setFieldError,
    setFieldTouched: formik.setFieldTouched,
    fieldMapping,
    onGeneralError: message => {
      setApiErrorMessage(message);
      toastError(message);
    },
    resetError: resetCreateUpdateUser,
    dispatch,
  });

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="profile-header-section">
              <h1 className="fs-20 fw-600 heading-color">{isEditable ? 'Edit Profile' : 'View Profile'}</h1>
            </div>
            <div className="main-content-section">
              <form onSubmit={formik.handleSubmit} autoComplete="off">
                <div className="row gap-vertical-20">
                  <div className="col-12 col-md-4">
                    <AppInput
                      name="firstName"
                      label="First Name"
                      placeholder="Enter First Name"
                      alphaOnly={true}
                      value={displayFirstName}
                      onChange={
                        isEditable
                          ? e => {
                              const value = e.target.value;
                              formik.setFieldValue('firstName', isEnterpriseAdmin ? value.toUpperCase() : value);
                            }
                          : undefined
                      }
                      disabled={!isEditable}
                      isRequired={true}
                      error={formik.touched.firstName && formik.errors.firstName}
                      maxLength={50}
                      onBlur={formik.handleBlur}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <AppInput
                      name="lastName"
                      label="Last Name"
                      alphaOnly={true}
                      placeholder="Enter Last Name"
                      value={displayLastName}
                      onChange={
                        isEditable
                          ? e => {
                              const value = e.target.value;
                              formik.setFieldValue('lastName', isEnterpriseAdmin ? value.toUpperCase() : value);
                            }
                          : undefined
                      }
                      disabled={!isEditable}
                      isRequired={true}
                      maxLength={50}
                      error={formik.touched.lastName && formik.errors.lastName}
                      onBlur={formik.handleBlur}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <AppInput
                      name="emailId"
                      label="Email"
                      placeholder="Enter Email"
                      maxLength={320}
                      disabled={true}
                      InputProps={{ readOnly: true }}
                      value={formik.values.emailId}
                      onChange={isEditable ? formik.handleChange : undefined}
                      isRequired={true}
                      error={formik.touched.emailId && formik.errors.emailId}
                      onBlur={formik.handleBlur}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <AppInput
                      name="mobileNumber"
                      label="Mobile Number"
                      placeholder="Enter Mobile Number"
                      value={formik.values.mobileNumber}
                      onChange={isEditable ? e => formik.setFieldValue('mobileNumber', e.target.value) : undefined}
                      disabled={!isEditable}
                      phoneNumberFormat={true}
                      isRequired={true}
                      inputMode="numeric"
                      maxLength={11}
                      error={formik.touched.mobileNumber && formik.errors.mobileNumber}
                      onBlur={formik.handleBlur}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <AppInput
                      name="samarId"
                      label="SAMAR ID"
                      disabled={true}
                      InputProps={{ readOnly: true }}
                      maxLength={100}
                      value={formik.values.samarId}
                      onChange={isEditable ? formik.handleChange : undefined}
                      isRequired={true}
                      error={formik.touched.samarId && formik.errors.samarId}
                      onBlur={formik.handleBlur}
                    />
                  </div>
                  {isEditable && (
                    <div className="col-12 col-md-4">
                      <AppInput
                        name="organization"
                        label="Organization"
                        disabled={true}
                        InputProps={{ readOnly: true }}
                        placeholder="Enter Organization"
                        maxLength={100}
                        value={displayOrganization}
                        onChange={isEditable ? formik.handleChange : undefined}
                        isRequired={true}
                        error={formik.touched.organization && formik.errors.organization}
                        onBlur={formik.handleBlur}
                      />
                    </div>
                  )}
                  {isOperationsManager && (
                    <div className="col-12">
                      <AppInput
                        name="assignedStates"
                        label="Assigned States"
                        disabled={true}
                        InputProps={{ readOnly: true }}
                        multiline
                        value={assignedStates.length ? assignedStates.join(', ') : 'No states assigned'}
                        subLabel="You can view and manage assessments only for these states."
                      />
                    </div>
                  )}
                  {isAssessor && (
                    <>
                      <div className="col-12">
                        <AppInput name="address" label="Address" disabled={true} InputProps={{ readOnly: true }} multiline value={profileAddress || '-'} />
                      </div>
                      <div className="col-12 col-md-4">
                        <AppInput name="city" label="City" disabled={true} InputProps={{ readOnly: true }} value={profileCity || '-'} />
                      </div>
                      <div className="col-12 col-md-4">
                        <AppInput name="district" label="District" disabled={true} InputProps={{ readOnly: true }} value={profileDistrict || '-'} />
                      </div>
                      <div className="col-12 col-md-4">
                        <AppInput name="state" label="State" disabled={true} InputProps={{ readOnly: true }} value={profileState || '-'} />
                      </div>
                      <div className="col-12 col-md-4">
                        <AppInput name="pincode" label="Pincode" disabled={true} InputProps={{ readOnly: true }} value={profilePincode || '-'} />
                      </div>
                    </>
                  )}
                </div>
                <div className="gap-8 d-flex margin-top-24">
                  {isEditable && <AppButton title="Save" type="submit" loading={updateUserLoading} disabled={updateUserLoading} />}
                  <AppButton variant="tertiary" title="Cancel" type="button" onClick={() => navigate('/')}></AppButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={showUpdateSuccessModal} image={Icons.successCircle} header={'Profile updated successfully'} subHeader={''} />
    </Layout>
  );
};

export default EditProfile;
