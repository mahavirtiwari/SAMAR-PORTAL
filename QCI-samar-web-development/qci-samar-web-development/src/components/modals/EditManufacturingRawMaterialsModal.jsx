import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { listRawMaterialsAction, updateRawMaterialAction } from '../../redux/action/master/MasterAction';
import { resetRawMaterialCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput } from '../base';
import AppCommonModal from './AppCommonModal';
import AppModal from './AppModal';

const validationSchema = Yup.object().shape({
  materialName: Yup.string().trim().max(255, 'Key raw material name cannot exceed 255 characters').required('Key raw material name is required'),
});

const EditManufacturingRawMaterialsModal = ({ open, handleClose, data, onGeneralError }) => {
  const dispatch = useDispatch();
  const { updateRawMaterialError } = useSelector(state => state.Master);

  const initialValues = useMemo(
    () => ({
      materialName: data?.materialName || '',
    }),
    [data],
  );

  const handleSubmit = async values => {
    await dispatch(
      updateRawMaterialAction({
        id: data?.id,
        ...values,
      }),
    ).unwrap();
    dispatch(resetRawMaterialCreateUpdate());
    dispatch(listRawMaterialsAction({ perPage: 15, page: 1 }));
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: updateRawMaterialError,
    resetError: resetRawMaterialCreateUpdate,
    onGeneralError,
    successMessage: 'Manufacturing Key Raw Material Updated Successfully',
  });

  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  if (showSuccess) {
    return (
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Manufacturing key raw material updated successfully'} subHeader={''} />
    );
  }

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          label="Key Raw Material"
          name="materialName"
          maxLength={100}
          placeholder="Enter Key Raw Material Name"
          value={formik.values.materialName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('materialName')}
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
      modalHeader={<>Edit Manufacturing Key Raw Material</>}
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

export default EditManufacturingRawMaterialsModal;
