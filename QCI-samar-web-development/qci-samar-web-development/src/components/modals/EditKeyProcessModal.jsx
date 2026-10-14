import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { listKeyProcessesAction, updateKeyProcessAction } from '../../redux/action/master/MasterAction';
import { resetKeyProcessCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput } from '../base';
import AppCommonModal from './AppCommonModal';
import AppModal from './AppModal';

const validationSchema = Yup.object().shape({
  processName: Yup.string().trim().max(255, 'Key process name cannot exceed 255 characters').required('Key process name is required'),
});

const EditKeyProcessModal = ({ open, handleClose, data, onGeneralError }) => {
  const dispatch = useDispatch();
  const { updatekeyProcessesError } = useSelector(state => state.Master);

  const initialValues = useMemo(
    () => ({
      processName: data?.processName || '',
    }),
    [data],
  );

  const handleSubmit = async values => {
    await dispatch(
      updateKeyProcessAction({
        id: data?.id,
        ...values,
      }),
    ).unwrap();
    dispatch(resetKeyProcessCreateUpdate());
    dispatch(listKeyProcessesAction({ perPage: 15, page: 1 }));
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: updatekeyProcessesError,
    resetError: resetKeyProcessCreateUpdate,
    onGeneralError,
    successMessage: 'Manufacturing Key Process Updated Successfully',
  });

  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  if (showSuccess) {
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Manufacturing key process updated successfully'} subHeader={''} />;
  }

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          label="Key Process Name"
          name="processName"
          placeholder="Enter Key Process Name"
          value={formik.values.processName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          maxLength={100}
          isRequired={true}
          error={getFieldError('processName')}
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

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Edit Manufacturing Process</>}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '800px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

export default EditKeyProcessModal;
