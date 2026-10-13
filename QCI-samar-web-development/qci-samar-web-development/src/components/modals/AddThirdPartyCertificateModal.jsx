import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { createThirdPartyCertAction, listThirdPartyCertsAction } from '../../redux/action/master/MasterAction';
import { resetThirdPartyCertCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  certificationName: Yup.string().trim().max(255, 'Certificate name cannot exceed 255 characters').required('Certificate name is required'),
});

const AddThirdPartyCertificateModal = ({ open, handleClose, onGeneralError }) => {
  const dispatch = useDispatch();
  const { createThirdPartyCertError } = useSelector(state => state.Master);

  const initialValues = useMemo(
    () => ({
      certificationName: '',
    }),
    [],
  );

  const handleSubmit = async values => {
    await dispatch(createThirdPartyCertAction(values)).unwrap();
  };

  const handleSuccess = () => {
    dispatch(listThirdPartyCertsAction({ page: 1, perPage: 15 }));
    dispatch(resetThirdPartyCertCreateUpdate());
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    onSuccess: handleSuccess,
    onGeneralError,
    open,
    onClose: handleClose,
    serverError: createThirdPartyCertError,
    successDuration: 3000,
  });

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          label="Certificate"
          name="certificationName"
          maxLength={100}
          placeholder="Enter Certificate Name"
          value={formik.values.certificationName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('certificationName')}
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
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Third party certificate added successfully'} subHeader={''} />;
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Add Third Party Certificate</>}
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

export default AddThirdPartyCertificateModal;
