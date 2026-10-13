import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { createVendorCategoryAction, listVendorCategoriesAction } from '../../redux/action/master/MasterAction';
import { resetVendorCategoryCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput } from '../base';
import AppCommonModal from './AppCommonModal';
import AppModal from './AppModal';

const validationSchema = Yup.object().shape({
  categoryName: Yup.string().trim().max(255, 'Category name cannot exceed 255 characters').required('Category name is required'),
});

const initialValues = {
  categoryName: '',
};

const AddManufacturingVendorCategoriesModal = ({ open, handleClose, onGeneralError }) => {
  const dispatch = useDispatch();
  const { createdrdoVendorCategoriesError } = useSelector(state => state.Master);

  const handleSubmit = async values => {
    await dispatch(
      createVendorCategoryAction({
        ...values,
        isActive: true,
      }),
    ).unwrap();
    dispatch(resetVendorCategoryCreateUpdate());
    dispatch(listVendorCategoriesAction({ perPage: 15, page: 1 }));
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: createdrdoVendorCategoriesError,
    resetError: resetVendorCategoryCreateUpdate,
    onGeneralError,
    successMessage: 'Manufacturing Category Added Successfully',
  });

  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  if (showSuccess) {
    return (
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Manufacturing vendor category added successfully'} subHeader={''} />
    );
  }

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          label="Category Name"
          name="categoryName"
          placeholder="Enter Category Name"
          maxLength={100}
          value={formik.values.categoryName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('categoryName')}
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
      modalHeader={<>Add Manufacturing Category</>}
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

export default AddManufacturingVendorCategoriesModal;
