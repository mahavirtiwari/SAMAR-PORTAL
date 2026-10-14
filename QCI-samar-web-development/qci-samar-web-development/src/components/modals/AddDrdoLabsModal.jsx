import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import { MODAL_LIST_PAGE_SIZE } from '../../constants/appConstants';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { createUserAction, getAllUsersAction } from '../../redux/action/common/UnitAdminAction';
import { resetCreateUpdateUser } from '../../redux/slices/common/UnitAdminSlice';
import { emailRegex } from '../../utils/Regex';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  firstName: Yup.string().trim().max(50, 'First name cannot exceed 50 characters').required('First name is required'),
  lastName: Yup.string().trim().max(50, 'Last name cannot exceed 50 characters').required('Last name is required'),
  email: Yup.string().max(320, 'Email cannot exceed 320 characters').matches(emailRegex, 'Enter a valid email address').required('Email is required'),
  mobileNumber: Yup.string()
    .matches(/^\d{10}$/, 'Mobile number must be 10 digits')
    .required('Mobile number is required'),
});

const AddDrdoLabsModal = ({ open, handleClose, organizationId, onGeneralError }) => {
  const dispatch = useDispatch();
  const { createUserError } = useSelector(state => state.UnitAdmin);

  const initialValues = useMemo(
    () => ({
      firstName: '',
      lastName: '',
      email: '',
      mobileNumber: '',
    }),
    [],
  );

  const handleSubmit = async values => {
    await dispatch(
      createUserAction({
        ...values,
        organizationId,
        isActive: true,
        status: 'invited',
        roles: [
          {
            slug: 'drdo_lab',
            organizationId,
          },
        ],
      }),
    ).unwrap();
  };

  const handleSuccess = () => {
    dispatch(getAllUsersAction({ role: 'drdo_lab', organizationId, page: 1, perPage: MODAL_LIST_PAGE_SIZE }));
    dispatch(resetCreateUpdateUser());
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    onSuccess: handleSuccess,
    onGeneralError,
    open,
    onClose: handleClose,
    serverError: createUserError,
    successDuration: 3000,
  });

  const modalContent = (
    <div className="row gap-vertical-24">
      <div className="col-md-6">
        <AppInput
          label="First Name"
          name="firstName"
          maxLength={50}
          alphaOnly={true}
          placeholder="Enter First Name"
          value={formik.values.firstName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('firstName')}
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Last Name"
          name="lastName"
          maxLength={50}
          alphaOnly={true}
          placeholder="Enter Last Name"
          value={formik.values.lastName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('lastName')}
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Email"
          name="email"
          maxLength={320}
          placeholder="Enter Email"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('email')}
          autoComplete="off"
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Mobile Number"
          name="mobileNumber"
          placeholder="Enter Mobile Number"
          value={formik.values.mobileNumber}
          onChange={e => formik.setFieldValue('mobileNumber', e.target.value)}
          onBlur={formik.handleBlur}
          phoneNumberFormat={true}
          isRequired={true}
          inputMode="numeric"
          maxLength={10}
          error={getFieldError('mobileNumber')}
          autoComplete="off"
        />
      </div>
    </div>
  );

  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" {...cancelButtonProps} />
      <AppButton title="Add" size="medium" {...submitButtonProps} />
    </>
  );

  if (showSuccess) {
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'DRDO lab added successfully'} subHeader={''} />;
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>ADD DRDO Lab</>}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AddDrdoLabsModal;
