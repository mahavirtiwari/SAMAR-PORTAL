import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { updateCommitteeMemberAction } from '../../redux/action/operationsAdmin/CommitteeMemberAction';
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
    .matches(/^[0-9]{10}$/, 'Mobile number must be 10 digits')
    .required('Mobile number is required'),
});

const EditMember = ({ open, handleClose, member, onGeneralError }) => {
  const dispatch = useDispatch();
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Get loading state from Redux
  const { updateLoading } = useSelector(state => state.CommitteeMember || {});

  const initialValues = useMemo(
    () => ({
      firstName: member?.firstName || '',
      lastName: member?.lastName || '',
      designation: member?.designation || '',
      organisation: member?.organisation || '',
      email: member?.email || '',
      mobileNumber: member?.mobileNumber || '',
    }),
    [member],
  );

  const onSubmit = async values => {
    try {
      if (!member?.id) {
        if (typeof onGeneralError === 'function') {
          onGeneralError('Member ID is missing');
        }
        return;
      }

      const result = await dispatch(updateCommitteeMemberAction({ memberId: member.id, payload: values })).unwrap();
      if (result) {
        setShowSaveModal(true);
      }
    } catch (error) {
      if (typeof onGeneralError === 'function') {
        onGeneralError(error?.message || 'Failed to update member');
      }
    }
  };

  const { formik, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit,
    open,
    onClose: handleClose,
    onGeneralError,
    serverError: null,
    enableReinitialize: true,
  });

  // Reset form when member changes
  useEffect(() => {
    if (member && open) {
      formik.setValues({
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        designation: member.designation || '',
        organisation: member.organisation || '',
        email: member.email || '',
        mobileNumber: member.mobileNumber || '',
      });
    }
  }, [member, open]);

  // Modal title
  const modalTitle = <>Edit Member</>;

  // Modal content
  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-6">
        <AppInput
          label="First Name"
          placeholder="Enter First Name"
          name="firstName"
          value={formik.values.firstName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired
          alphaOnly={true}
          error={getFieldError('firstName')}
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Last Name"
          placeholder="Enter Last Name"
          name="lastName"
          value={formik.values.lastName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired
          alphaOnly={true}
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
          placeholder="Enter Mobile Number"
          name="mobileNumber"
          value={formik.values.mobileNumber}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired
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
      <AppButton variant="primary" size="medium" title="Save" {...submitButtonProps} loading={updateLoading} />
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
          width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        image={Icons.successCircle}
        show={showSaveModal}
        handleClose={() => setShowSaveModal(false)}
        header="Member updated successfully"
        subHeader=""
        singleButton
        singleButtonLabel="OK"
        buttonOnClick={() => {
          setShowSaveModal(false);
          handleClose();
        }}
        buttonClassName="w-100 btn-primary"
      />
    </>
  );
};

export default EditMember;
