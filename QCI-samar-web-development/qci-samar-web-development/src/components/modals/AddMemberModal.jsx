import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { createCommitteeMemberAction } from '../../redux/action/operationsAdmin/CommitteeMemberAction';
import { resetCommitteeMemberState } from '../../redux/slices/operationsAdmin/CommitteeMemberSlice';
import { emailRegex } from '../../utils/Regex';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  firstName: Yup.string().trim().max(255, 'First name cannot exceed 255 characters').required('First name is required'),
  lastName: Yup.string().trim().max(255, 'Last name cannot exceed 255 characters').required('Last name is required'),
  designation: Yup.string().trim().max(255, 'Designation cannot exceed 255 characters').required('Designation is required'),
  organisation: Yup.string().trim().max(255, 'Organisation cannot exceed 255 characters').required('Organisation is required'),
  email: Yup.string().max(320, 'Email cannot exceed 320 characters').matches(emailRegex, 'Enter a valid email address').required('Email is required'),
  mobileNumber: Yup.string()
    .matches(/^\d{10}$/, 'Mobile number must be 10 digits')
    .required('Mobile number is required'),
});

const AddMember = ({ open, handleClose, handleSave, disabled, loading, onGeneralError }) => {
  const dispatch = useDispatch();
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Get loading state and server error from Redux
  const { createLoading, createError } = useSelector(state => state.CommitteeMember || {});

  const isLoading = loading || createLoading;

  const initialValues = useMemo(
    () => ({
      firstName: '',
      lastName: '',
      designation: '',
      organisation: '',
      email: '',
      mobileNumber: '',
    }),
    [],
  );

  const onSubmit = async values => {
    // If custom handleSave is provided, use it
    if (typeof handleSave === 'function') {
      try {
        await handleSave(values);
        setShowSaveModal(true);
      } catch (error) {
        if (typeof onGeneralError === 'function') {
          onGeneralError(error?.message || 'Failed to add member');
        }
        throw error;
      }
      return;
    }

    // Create a new committee member. On failure, unwrap throws and the rejected
    // payload is stored in Redux `createError`, which useFormModal maps onto the
    // matching field — e.g. a duplicate email shows under the Email input box.
    const result = await dispatch(createCommitteeMemberAction({ payload: values })).unwrap();
    if (result) {
      setShowSaveModal(true);
    }
  };

  const { formik, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit,
    open,
    onClose: handleClose,
    onGeneralError,
    serverError: createError,
    resetError: resetCommitteeMemberState,
  });

  // Modal title
  const modalTitle = <>Add Member</>;

  // Modal content
  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-6">
        <AppInput
          label="First Name"
          placeholder="Enter First Name"
          name="firstName"
          alphaOnly={true}
          value={formik.values.firstName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired
          error={getFieldError('firstName')}
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Last Name"
          placeholder="Enter Last Name"
          name="lastName"
          alphaOnly={true}
          value={formik.values.lastName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired
          error={getFieldError('lastName')}
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Designation"
          placeholder="Enter Designation"
          name="designation"
          value={formik.values.designation}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired
          error={getFieldError('designation')}
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Organisation"
          placeholder="Enter Organisation"
          name="organisation"
          value={formik.values.organisation}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired
          error={getFieldError('organisation')}
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Email"
          placeholder="Enter Email"
          name="email"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired
          error={getFieldError('email')}
          autoComplete="off"
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Mobile Number"
          name="mobileNumber"
          maxLength={10}
          placeholder="Enter Mobile Number"
          value={formik.values.mobileNumber}
          onChange={e => formik.setFieldValue('mobileNumber', e.target.value)}
          onBlur={formik.handleBlur}
          phoneNumberFormat={true}
          isRequired={true}
          inputMode="numeric"
          error={getFieldError('mobileNumber')}
          autoComplete="off"
        />
      </div>
    </div>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" {...cancelButtonProps} />
      <AppButton variant="primary" size="medium" title="Save" {...submitButtonProps} disabled={disabled || isLoading} loading={isLoading} />
    </>
  );

  return (
    <>
      <AppCommonModal
        open={open}
        onClose={handleClose}
        modalHeader={modalTitle}
        modalContent={modalContent}
        modalFooter={modalFooter}
        paperSx={{
          width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        image={Icons.successCircle}
        show={showSaveModal}
        handleClose={() => setShowSaveModal(false)}
        header="Member added successfully"
        subHeader="The member has been added and notified via email."
        singleButton
        singleButtonLabel="OK"
        buttonOnClick={() => {
          setShowSaveModal(false); // close success modal
          handleClose(); // close parent Add Member modal
        }}
        buttonClassName="w-100 btn-primary"
      />
    </>
  );
};

export default AddMember;
