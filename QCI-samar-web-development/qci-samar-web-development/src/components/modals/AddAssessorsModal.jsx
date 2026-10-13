import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import { FETCH_ALL_PAGE_SIZE, MODAL_LIST_PAGE_SIZE, PIN_CODE_LENGTH } from '../../constants/appConstants';
import Icons from '../../constants/Icons';
import { usePincodeAutofill } from '../../hooks';
import useFormModal from '../../hooks/useFormModal';
import { createUserAction, getAllUsersAction } from '../../redux/action/common/UnitAdminAction';
import { getStateAction, listAssessorDomainsAction } from '../../redux/action/master/MasterAction';
import { resetCreateUpdateUser } from '../../redux/slices/common/UnitAdminSlice';
import { resetPinCode } from '../../redux/slices/master/MasterSlice';
import { emailRegex } from '../../utils/Regex';
import { AppButton, AppDropdown, AppInput, AppModal, AppMultiSelectDropdown } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object({
  firstName: Yup.string().trim().max(50, 'First name cannot exceed 50 characters').required('First name is required'),
  lastName: Yup.string().trim().max(50, 'Last name cannot exceed 50 characters').required('Last name is required'),
  domainIds: Yup.array().min(1, 'Select at least one domain').required('Select at least one domain'),
  email: Yup.string().max(320, 'Email cannot exceed 320 characters').matches(emailRegex, 'Enter a valid email address').required('Email is required'),
  address: Yup.string().trim().max(500, 'Address cannot exceed 500 characters').required('Address is required'),
  pincode: Yup.string()
    .matches(/^\d{6}$/, 'PIN code must be 6 digits')
    .required('PIN code is required'),
  state: Yup.string().required('State is required'),
  district: Yup.string().required('District is required'),
  mobileNumber: Yup.string()
    .matches(/^\d{10}$/, 'Mobile number must be 10 digits')
    .required('Mobile number is required'),
  assignedStates: Yup.array().of(Yup.string()).min(1, 'Select at least one state').required('Select at least one state'),
});

const AddAssessorsModal = ({ open, handleClose, onGeneralError }) => {
  const dispatch = useDispatch();

  const { user } = useSelector(state => state.Account);
  const { pinCodeLoadingByKey, assessorDomains, getState: states } = useSelector(state => state.Master);
  const pinCodeLoading = pinCodeLoadingByKey?.['addAssessor'] || false;
  const { createUserError } = useSelector(state => state.UnitAdmin);

  const statesArray = Array.isArray(states) ? states : states?.data || [];

  const initialValues = useMemo(
    () => ({
      firstName: '',
      lastName: '',
      domainIds: [],
      address: '',
      email: '',
      mobileNumber: '',
      pincode: '',
      state: '',
      district: '',
      status: 'Active',
      assignedStates: [],
    }),
    [],
  );

  const handleSubmit = async values => {
    const { domainIds, assignedStates: selectedStateIds, ...rest } = values;

    const selectedStateNames = selectedStateIds.map(stateId => {
      const found = statesArray.find(s => String(s.id) === String(stateId));
      return found ? found.name : stateId;
    });

    const payload = {
      ...rest,
      organizationId: user?.organization?.id,
      isActive: true,
      status: 'invited',
      assessorDomains: domainIds || [],
      assignedStates: selectedStateNames,
      roles: [
        {
          slug: 'assessor',
          organizationId: user?.organization?.id,
        },
      ],
    };
    await dispatch(createUserAction(payload)).unwrap();
  };

  const handleSuccess = () => {
    dispatch(getAllUsersAction({ role: 'assessor', organizationId: user?.organization?.id, page: 1, perPage: MODAL_LIST_PAGE_SIZE }));
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

  const { notFound: pincodeNotFound } = usePincodeAutofill({
    pinCode: formik.values.pincode,
    lookupKey: 'addAssessor',
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

  // Reset form and pincode when modal opens
  useEffect(() => {
    if (open) {
      dispatch(resetPinCode());
      // Fetch assessor domains and states
      dispatch(listAssessorDomainsAction({ isActive: true, page: 1, perPage: FETCH_ALL_PAGE_SIZE }));
      dispatch(getStateAction({ all: true }));
    }
  }, [open, dispatch]);

  const modalContent = (
    <div>
      <div className="modal-form-labels margin-bottom-16">Basic Details</div>
      <div className="row gap-vertical-24 bottom-seperator margin-bottom-30">
        <div className="col-md-6">
          <AppInput
            label="First Name"
            name="firstName"
            placeholder="Enter First Name"
            maxLength={50}
            value={formik.values.firstName}
            onChange={formik.handleChange}
            alphaOnly={true}
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
      <div className="modal-form-labels margin-bottom-16">Address</div>
      <div className="row gap-vertical-24 bottom-seperator margin-bottom-30">
        <div className="col-md-12">
          <AppInput
            label="Address"
            name="address"
            placeholder="Enter Address"
            rows={2}
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
            value={formik.values.pincode}
            rightIcon={pinCodeLoading ? Icons.loader : null}
            inputMode="numeric"
            maxLength={6}
            onChange={e => {
              let value = e.target.value.replace(/\D/g, '');
              value = value.slice(0, PIN_CODE_LENGTH);
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
            name="assignedStates"
            selectAllOption={true}
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
      <AppButton title="Add" size="medium" {...submitButtonProps} />
    </>
  );

  if (showSuccess) {
    return (
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={true}
        image={Icons.successCircle}
        header={'Assessor added successfully'}
        subHeader={'The assessor has been added and notified via email.'}
      />
    );
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Add Assessor</>}
      modalFooter={modalFooter}
      modalContent={modalContent}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AddAssessorsModal;
