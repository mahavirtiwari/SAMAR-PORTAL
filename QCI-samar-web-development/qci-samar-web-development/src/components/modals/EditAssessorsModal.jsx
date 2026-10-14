import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import { usePincodeAutofill } from '../../hooks';
import useFormModal from '../../hooks/useFormModal';
import { getAllUsersAction, updateUserAction } from '../../redux/action/common/UnitAdminAction';
import { getStateAction, listAssessorDomainsAction } from '../../redux/action/master/MasterAction';
import { resetCreateUpdateUser } from '../../redux/slices/common/UnitAdminSlice';
import { resetPinCode } from '../../redux/slices/master/MasterSlice';
import { emailRegex } from '../../utils/Regex';
import { AppButton, AppDropdown, AppInput, AppModal, AppMultiSelectDropdown } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  firstName: Yup.string().trim().max(50, 'First name cannot exceed 50 characters').required('First name is required'),
  lastName: Yup.string().trim().max(50, 'Last name cannot exceed 50 characters').required('Last name is required'),
  email: Yup.string().max(320, 'Email cannot exceed 320 characters').matches(emailRegex, 'Enter a valid email address').required('Email is required'),
  pincode: Yup.string()
    .matches(/^\d{6}$/, 'PIN code must be 6 digits')
    .required('PIN code is required'),
  mobileNumber: Yup.string()
    .required('Mobile number is required')
    .matches(/^\d{10}$/, 'Mobile number must be 10 digits'),
  domainIds: Yup.array().min(1, 'Select at least one domain').required('Select at least one domain'),
  address: Yup.string().trim().max(500, 'Address cannot exceed 500 characters').required('Address is required'),
  assignedStates: Yup.array().of(Yup.string()).min(1, 'Select at least one state').required('Select at least one state'),
});

const EditAssessorsModal = ({ open, handleClose, data, onGeneralError }) => {
  const dispatch = useDispatch();

  const { user } = useSelector(state => state.Account);
  const { assessorDomains, getState: states } = useSelector(state => state.Master);
  const { updateUserError } = useSelector(state => state.UnitAdmin);

  const statesArray = Array.isArray(states) ? states : states?.data || [];

  const initialValues = useMemo(
    () => ({
      firstName: data?.firstName || '',
      lastName: data?.lastName || '',
      email: data?.email || '',
      mobileNumber: data?.mobileNumber || '',
      address: data?.address || '',
      pincode: data?.pincode || '',
      domainIds: data?.assessorDomains?.map(domain => domain.id) || [],
      state: data?.state || '',
      district: data?.district || '',
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
    const { domainIds, assignedStates: selectedStateIds, ...rest } = values;

    const selectedStateNames = selectedStateIds.map(stateId => {
      const found = statesArray.find(s => String(s.id) === String(stateId));
      return found ? found.name : stateId;
    });

    const payload = {
      ...rest,
      assessorDomains: domainIds || [],
      assignedStates: selectedStateNames,
    };

    await dispatch(updateUserAction({ id: data?.id, ...payload })).unwrap();
  };

  const handleSuccess = () => {
    dispatch(getAllUsersAction({ role: 'assessor', organizationId: user?.organization?.id, page: 1, perPage: 15 }));
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

  const { notFound: pincodeNotFound } = usePincodeAutofill({
    pinCode: formik.values.pincode,
    lookupKey: 'editAssessor',
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

  // Reset form and fetch initial data when modal opens
  useEffect(() => {
    if (open && data) {
      dispatch(resetPinCode());

      // Fetch assessor domains and states
      dispatch(listAssessorDomainsAction({ isActive: true, page: 1, perPage: 1000 }));
      dispatch(getStateAction({ all: true }));
    }
  }, [open, dispatch, data?.state]);

  const modalContent = (
    <div>
      <div className="modal-form-labels margin-bottom-16">Basic Details</div>
      <div className="row gap-vertical-24 bottom-seperator margin-bottom-30">
        <div className="col-md-6">
          <AppInput
            label="First Name"
            name="firstName"
            maxLength={50}
            placeholder="Enter First Name"
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
        <div className="col-md-12">
          <AppMultiSelectDropdown
            subLabel="Select at least one domain to assign to this assessor"
            label="Assigned Domain(s)"
            alphaOnly={true}
            options={assessorDomains?.data?.map(domain => ({ value: domain.id, label: domain.domainName })) || []}
            value={formik.values.domainIds || []}
            onChange={value => formik.setFieldValue('domainIds', value || [])}
            placeholder="Select Domain(s)"
            name="domainIds"
            isRequired={true}
            error={getFieldError('domainIds')}
          />
        </div>
        <div className="col-md-6">
          <AppInput
            label="Email"
            name="email"
            placeholder="Enter Email"
            maxLength={320}
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
      </div>
      <div className="modal-form-labels margin-bottom-16">Address</div>
      <div className="row gap-vertical-24 bottom-seperator margin-bottom-30">
        <div className="col-md-12">
          <AppInput
            inputType="textarea"
            label="Address"
            name="address"
            placeholder="Enter Address"
            maxLength={250}
            customInputClass="feedback-textarea"
            customWidth="w-100"
            multiline={true}
            value={formik.values.address}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            isRequired={true}
            error={getFieldError('address')}
          />
        </div>
        <div className="col-md-4">
          <AppInput
            label="PIN Code"
            name="pincode"
            placeholder="Enter PIN code"
            maxLength={6}
            value={formik.values.pincode}
            onChange={e => {
              let value = e.target.value.replace(/\D/g, '');
              value = value.slice(0, 6);
              formik.setFieldValue('pincode', value);
            }}
            onBlur={formik.handleBlur}
            isRequired={true}
            error={getFieldError('pincode') || (pincodeNotFound ? 'PIN code not found. Please enter District and State manually.' : '')}
          />
        </div>
        <div className="col-md-4">
          <AppInput
            label="District"
            name="district"
            placeholder="Select District"
            focused={formik.values.district}
            value={formik.values.district || ''}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            isRequired={true}
            error={getFieldError('district')}
          />
        </div>
        <div className="col-md-4">
          <AppDropdown
            label="State"
            name="state"
            placeholder="Select State"
            value={formik.values.state || ''}
            onChange={e => formik.setFieldValue('state', e.target.value)}
            onBlur={formik.handleBlur}
            options={statesArray.map(s => ({ value: s.name, label: s.name }))}
            isRequired={true}
            error={getFieldError('state')}
          />
        </div>
      </div>
      <div className="modal-form-labels margin-bottom-16">Assessment Locations</div>
      <div className="row gap-vertical-24">
        <div className="col-md-12">
          <AppMultiSelectDropdown
            label="Assigned States"
            selectAllOption={true}
            name="assignedStates"
            placeholder="Select States"
            value={Array.isArray(formik.values.assignedStates) ? formik.values.assignedStates : []}
            onChange={selected => formik.setFieldValue('assignedStates', selected)}
            options={statesArray.map(unit => ({ value: String(unit.id), label: unit.name }))}
            isRequired={true}
            chipMode={true}
            error={getFieldError('assignedStates')}
            subLabel={'Select the states where the assessor is available to conduct assessments.'}
          />
        </div>
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
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Assessor updated successfully'} subHeader={''} />;
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Edit Assessor</>}
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

export default EditAssessorsModal;
