import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { listManufacturingStoresAction, updateManufacturingStoreAction } from '../../redux/action/master/MasterAction';
import { resetManufacturingStoreCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput } from '../base';
import AppCommonModal from './AppCommonModal';
import AppModal from './AppModal';

const validationSchema = Yup.object().shape({
  storeName: Yup.string().trim().max(255, 'Store name cannot exceed 255 characters').required('Store name is required'),
});

const EditManufacturingVendorStoresModal = ({ open, handleClose, data, onGeneralError }) => {
  const dispatch = useDispatch();
  const { updateManufacturingStoresError } = useSelector(state => state.Master);

  const initialValues = useMemo(
    () => ({
      storeName: data?.storeName || '',
    }),
    [data],
  );

  const handleSubmit = async values => {
    await dispatch(
      updateManufacturingStoreAction({
        id: data?.id,
        ...values,
      }),
    ).unwrap();
    dispatch(resetManufacturingStoreCreateUpdate());
    dispatch(listManufacturingStoresAction({ perPage: 15, page: 1 }));
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: updateManufacturingStoresError,
    resetError: resetManufacturingStoreCreateUpdate,
    onGeneralError,
    successMessage: 'Manufacturing Store Updated Successfully',
  });

  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  if (showSuccess) {
    return (
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Manufacturing vendor store updated successfully'} subHeader={''} />
    );
  }

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          label="Store Name"
          name="storeName"
          placeholder="Enter Store Name"
          maxLength={100}
          value={formik.values.storeName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('storeName')}
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
      modalHeader={<>Edit Manufacturing Store</>}
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

export default EditManufacturingVendorStoresModal;
