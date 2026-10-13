import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { getAllUsersAction, updateUserAction } from '../../redux/action/common/UnitAdminAction';
import { getStateAction } from '../../redux/action/master/MasterAction';
import { resetCreateUpdateUser } from '../../redux/slices/common/UnitAdminSlice';
import { emailRegex } from '../../utils/Regex';
import { AppButton, AppInput, AppModal, AppMultiSelectDropdown } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  firstName: Yup.string().trim().max(50, 'First name cannot exceed 50 characters').required('First name is required'),
  lastName: Yup.string().trim().max(50, 'Last name cannot exceed 50 characters').required('Last name is required'),
  email: Yup.string().max(320, 'Email cannot exceed 320 characters').matches(emailRegex, 'Enter a valid email address').required('Email is required'),
  assignedStates: Yup.array().of(Yup.string()).min(1, 'Select at least one state').required('Select at least one state'),
  mobileNumber: Yup.string()
    .required('Mobile number is required')
    .matches(/^\d{10}$/, 'Mobile number must be 10 digits'),
});

const EditOperationsManagerModal = ({ open, handleClose, data, organizationId, onGeneralError }) => {
  const dispatch = useDispatch();
  const { updateUserError } = useSelector(state => state.UnitAdmin);
  const { getState: states } = useSelector(state => state.Master);

  // Fetch states when modal opens
  useEffect(() => {
    if (open) {
      dispatch(getStateAction({ all: true }));
    }
  }, [open, dispatch]);

  const statesArray = Array.isArray(states) ? states : states?.data || [];

  const initialValues = useMemo(
    () => ({
      firstName: data?.firstName || '',
      lastName: data?.lastName || '',
      email: data?.email || '',
      mobileNumber: data?.mobileNumber || '',
      assignedStates: Array.isArray(data?.assignedStates)
        ? data.assignedStates.map(name => {
            const found = statesArray.find(s => s.name === name);
            return found ? String(found.id) : name;
          })
        : [],
    }),
    [data, statesArray],
  );

  const handleSubmit = async values => {
    const selectedStateNames = values.assignedStates.map(stateId => {
      const found = statesArray.find(s => String(s.id) === String(stateId));
      return found ? found.name : stateId;
    });
    const payload = {
      ...values,
      assignedStates: selectedStateNames,
    };
    await dispatch(updateUserAction({ id: data?.id, ...payload })).unwrap();
  };

  const handleSuccess = () => {
    dispatch(getAllUsersAction({ role: 'operations_manager', organizationId, page: 1, perPage: 15 }));
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
    serverError: updateUserError,
    successDuration: 3000,
  });

  const modalContent = (
    <div className="row gap-vertical-24">
      <div className="col-md-6">
        <AppInput
          label="First Name"
          name="firstName"
          placeholder="Enter First Name"
          maxLength={50}
          alphaOnly={true}
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
          InputProps={{ readOnly: true }}
          disabled={true}
          focused={formik.values.email}
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
      <div className="col-md-12">
        <AppMultiSelectDropdown
          label="Assigned States"
          name="assignedStates"
          placeholder="Select States"
          selectAllOption={true}
          value={formik.values.assignedStates}
          onChange={selected => formik.setFieldValue('assignedStates', selected)}
          options={statesArray.map(unit => ({ value: String(unit.id), label: unit.name }))}
          isRequired={true}
          chipMode={true}
          error={getFieldError('assignedStates')}
          subLabel={'The operations manager will be able to view and manage assessments for the selected states.'}
        />
      </div>
    </div>
  );

  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" {...cancelButtonProps} />
      <AppButton title="Save" size="medium" {...submitButtonProps} />
    </>
  );

  if (showSuccess) {
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Operations manager updated successfully'} subHeader={''} />;
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Edit Operations Manager</>}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default EditOperationsManagerModal;
