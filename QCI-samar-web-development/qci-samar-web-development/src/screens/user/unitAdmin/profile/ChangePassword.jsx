import { useFormik } from 'formik';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppButton, AppInput, AppModal } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import useServerErrors from '../../../../hooks/useServerErrors';
import { changePasswordAction, logoutUserAction } from '../../../../redux/action/common/AccountAction';
import { resetChangePasswordData } from '../../../../redux/slices/common/AccountSlice';

const ChangePassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { changePasswordData, changePasswordLoading, changePasswordError } = useSelector(state => state.Account);
  const [showChangeSuccessModal, setShowChangeSuccessModal] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState('');

  const handleToggleCurrentPassword = () => {
    setShowCurrentPassword(prev => !prev);
  };
  const handleToggleNewPassword = () => {
    setShowNewPassword(prev => !prev);
  };
  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(prev => !prev);
  };

  const handleSaveAndNext = values => {
    setApiErrorMessage('');
    dispatch(changePasswordAction(values));
  };
  useEffect(() => {
    if (changePasswordData) {
      setShowChangeSuccessModal(true);
      setTimeout(async () => {
        setShowChangeSuccessModal(false);
        await dispatch(logoutUserAction());
        navigate('/');
        dispatch(resetChangePasswordData());
      }, 2000);
    }
    // Note: changePasswordError is now handled by useServerErrors hook
  }, [changePasswordData]);
  const formik = useFormik({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      newPasswordConfirmation: '',
    },
    validationSchema: Yup.object({
      newPassword: Yup.string().min(7, 'Password must be at least 7 characters').max(20, 'Password cannot exceed 20 characters').required('New password is required'),
      newPasswordConfirmation: Yup.string()
        .oneOf([Yup.ref('newPassword'), null], 'Passwords do not match')

        .required('Confirm password is required'),
      currentPassword: Yup.string().required('Current password is required').min(7, 'Password must be at least 7 characters').max(20, 'Password cannot exceed 20 characters'),
    }),
    onSubmit: handleSaveAndNext,
  });

  // Map server field names to formik field names
  const fieldMapping = {
    CurrentPassword: 'currentPassword',
    NewPassword: 'newPassword',
    NewPasswordConfirmation: 'newPasswordConfirmation',
    ConfirmPassword: 'newPasswordConfirmation',
  };

  // Use server errors hook to map field-level errors
  useServerErrors({
    serverError: changePasswordError,
    setFieldError: formik.setFieldError,
    setFieldTouched: formik.setFieldTouched,
    fieldMapping,
    onGeneralError: message => {
      const displayMessage = (message || '').toLowerCase().includes('failed to change password') ? 'Current password is invalid.' : message;
      setApiErrorMessage(displayMessage);
    },
    resetError: resetChangePasswordData,
    dispatch,
  });

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="profile-header-section">
              <h1 className="fs-20 fw-600 heading-color">Change Password</h1>
            </div>
            <form className="main-content-section" onSubmit={formik.handleSubmit}>
              <div className="row">
                <div className="col-12 col-md-4">
                  <AppInput
                    name="currentPassword"
                    value={formik.values.currentPassword}
                    onChange={e => {
                      setApiErrorMessage('');
                      formik.handleChange(e);
                    }}
                    onBlur={formik.handleBlur}
                    placeholder="Enter Password"
                    label="Current Password"
                    isRequired
                    maxLength={20}
                    type={showCurrentPassword ? 'text' : 'password'}
                    passwordIcon={showCurrentPassword ? Icons.eye : Icons.eyeSlash}
                    passwordIconOnClick={handleToggleCurrentPassword}
                    error={formik.touched.currentPassword && formik.errors.currentPassword ? formik.errors.currentPassword : apiErrorMessage}
                  />
                </div>
              </div>
              <div className="row margin-top-20">
                <div className="col-12 col-md-4">
                  <AppInput
                    name="newPassword"
                    value={formik.values.newPassword}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="Enter Password"
                    label="New Password"
                    isRequired
                    maxLength={20}
                    type={showNewPassword ? 'text' : 'password'}
                    passwordIcon={showNewPassword ? Icons.eye : Icons.eyeSlash}
                    passwordIconOnClick={handleToggleNewPassword}
                    error={formik.touched.newPassword && formik.errors.newPassword ? formik.errors.newPassword : ''}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <AppInput
                    name="newPasswordConfirmation"
                    value={formik.values.newPasswordConfirmation}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="Enter Password"
                    label="Confirm Password"
                    isRequired
                    maxLength={20}
                    type={showConfirmPassword ? 'text' : 'password'}
                    passwordIcon={showConfirmPassword ? Icons.eye : Icons.eyeSlash}
                    passwordIconOnClick={handleToggleConfirmPassword}
                    error={formik.touched.newPasswordConfirmation && formik.errors.newPasswordConfirmation ? formik.errors.newPasswordConfirmation : ''}
                  />
                </div>
              </div>
              <div className="gap-8 d-flex margin-top-24">
                <AppButton title="Save" type="submit" disabled={changePasswordLoading} loading={changePasswordLoading}></AppButton>
                <AppButton variant="tertiary" title="Cancel" type="button" onClick={() => navigate('/')}></AppButton>
              </div>
            </form>
          </div>
        </div>
      </div>
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={showChangeSuccessModal} image={Icons.successCircle} header={'Password changed successfully'} subHeader={''} />
    </Layout>
  );
};

export default ChangePassword;
