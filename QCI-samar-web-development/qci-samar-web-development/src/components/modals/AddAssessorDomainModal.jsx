import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import { DOMAIN_MAX_LENGTH } from '../../constants/appConstants';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { createAssessorDomainAction, listAssessorDomainsAction } from '../../redux/action/master/MasterAction';
import { resetAssessorDomainCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  domainName: Yup.string().trim().max(DOMAIN_MAX_LENGTH, `Assessor domain name cannot exceed ${DOMAIN_MAX_LENGTH} characters`).required('Assessor domain name is required'),
});

const AddAssessorDomainModal = ({ open, handleClose, onGeneralError }) => {
  const dispatch = useDispatch();
  const { createAssessorDomainError } = useSelector(state => state.Master);

  const initialValues = useMemo(
    () => ({
      domainName: '',
    }),
    [],
  );

  const handleSubmit = async values => {
    await dispatch(
      createAssessorDomainAction({
        ...values,
        isActive: true,
      }),
    ).unwrap();
  };

  const handleSuccess = () => {
    dispatch(listAssessorDomainsAction({ page: 1, perPage: 15 }));
    dispatch(resetAssessorDomainCreateUpdate());
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    onSuccess: handleSuccess,
    onGeneralError,
    open,
    onClose: handleClose,
    serverError: createAssessorDomainError,
    successDuration: 3000,
  });

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          inputType="textarea"
          label="Domain"
          name="domainName"
          placeholder="Enter Domain Name"
          maxLength={DOMAIN_MAX_LENGTH}
          multiline={true}
          value={formik.values.domainName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('domainName')}
        />
        <div className="d-flex justify-content-end margin-top-4">
          <span className="fs-12 fw-500 text-3-color">
            {(formik.values.domainName || '').length}/{DOMAIN_MAX_LENGTH}
          </span>
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
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Assessor domain added successfully'} subHeader={''} />;
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Add Assessor Domain</>}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '800px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default AddAssessorDomainModal;
