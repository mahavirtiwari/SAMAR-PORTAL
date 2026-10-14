import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { createBoughtOutPartAction, listBoughtOutPartsAction } from '../../redux/action/master/MasterAction';
import { resetBoughtOutPartCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput } from '../base';
import AppCommonModal from './AppCommonModal';
import AppModal from './AppModal';

const validationSchema = Yup.object().shape({
  partName: Yup.string().trim().max(255, 'Bought out part name cannot exceed 255 characters').required('Bought out part name is required'),
});

const initialValues = {
  partName: '',
};

const AddBoughtOutPartModal = ({ open, handleClose, onGeneralError }) => {
  const dispatch = useDispatch();
  const { createBoughtOutPartError } = useSelector(state => state.Master);

  const handleSubmit = async values => {
    await dispatch(
      createBoughtOutPartAction({
        ...values,
        isActive: true,
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
    serverError: createBoughtOutPartError,
    resetError: resetBoughtOutPartCreateUpdate,
    onGeneralError,
    successMessage: 'Manufacturing Bought-Out Part Added Successfully',
  });

  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  if (showSuccess) {
    return (
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Manufacturing bought out part added successfully'} subHeader={''} />
    );
  }

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          label="Bought-Out Part"
          name="partName"
          placeholder="Enter bought-out part name"
          value={formik.values.partName}
          maxLength={100}
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
      modalHeader={<>Add Manufacturing Bought-Out Part</>}
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

export default AddBoughtOutPartModal;
