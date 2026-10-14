import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { listBoughtOutPartsAction, updateBoughtOutPartAction } from '../../redux/action/master/MasterAction';
import { resetBoughtOutPartCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput } from '../base';
import AppCommonModal from './AppCommonModal';
import AppModal from './AppModal';

const validationSchema = Yup.object().shape({
  partName: Yup.string().trim().max(255, 'Bought out part name cannot exceed 255 characters').required('Bought out part name is required'),
});

const EditBoughtOutPartModal = ({ open, handleClose, data, onGeneralError }) => {
  const dispatch = useDispatch();
  const { updateBoughtOutPartError } = useSelector(state => state.Master);

  const initialValues = useMemo(
    () => ({
      partName: data?.partName || '',
    }),
    [data],
  );

  const handleSubmit = async values => {
    await dispatch(
      updateBoughtOutPartAction({
        id: data?.id,
        ...values,
      }),
    ).unwrap();
    dispatch(resetBoughtOutPartCreateUpdate());
    dispatch(listBoughtOutPartsAction({ perPage: 15, page: 1 }));
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: updateBoughtOutPartError,
    resetError: resetBoughtOutPartCreateUpdate,
    onGeneralError,
    successMessage: 'Manufacturing Bought-Out Part Updated Successfully',
  });

  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  if (showSuccess) {
    return (
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Manufacturing bought out part updated successfully'} subHeader={''} />
    );
  }

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          label="Bought-Out Part"
          name="partName"
          placeholder="Enter bought-out part name"
          maxLength={100}
          value={formik.values.partName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('partName')}
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
      modalHeader={<>Edit Manufacturing Bought-Out Part</>}
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

export default EditBoughtOutPartModal;
