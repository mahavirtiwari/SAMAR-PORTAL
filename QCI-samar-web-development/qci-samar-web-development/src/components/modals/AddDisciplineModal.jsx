import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import { DEFAULT_PAGE_SIZE } from '../../constants/appConstants';
import Icons from '../../constants/Icons';
import { useFormModal } from '../../hooks';
import { createDisciplineAction, getDisciplinesAction } from '../../redux/action/systemAdmin/DisciplinesAction';
import { resetDisciplinesCreateUpdateDelete } from '../../redux/slices/systemAdmin/DisciplinesSlice';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  name: Yup.string().trim().max(100, 'Discipline name cannot exceed 100 characters').required('Discipline name is required'),
});

const AddDisciplineModal = ({ open, handleClose, sector = 'manufacturing', onGeneralError }) => {
  const dispatch = useDispatch();

  // Get error state from Redux
  const { createError } = useSelector(state => state.SystemAdminDisciplines);

  const initialValues = {
    name: '',
    sector,
  };

  // Submit handler
  const handleSubmit = async values => {
    await dispatch(createDisciplineAction({ ...values, sector })).unwrap();

    // Reset slice flags
    dispatch(resetDisciplinesCreateUpdateDelete());

    // Refresh the list
    dispatch(getDisciplinesAction({ perPage: DEFAULT_PAGE_SIZE, page: 1, sector }));
  };

  // Use the form modal hook
  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: createError,
    resetError: resetDisciplinesCreateUpdateDelete,
    onGeneralError,
    successMessage: 'Discipline Added Successfully',
  });

  // Helper for field errors
  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <AppInput
          label="Discipline Name"
          name="name"
          placeholder="Enter Discipline Name"
          maxLength={100}
          value={formik.values.name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={getFieldError('name')}
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
    <>
      <AppCommonModal
        open={open}
        onClose={handleClose}
        modalHeader={<>Add Discipline</>}
        modalContent={modalContent}
        modalFooter={modalFooter}
        paperSx={{
          width: { xs: '100%', sm: '90%', md: '800px', lg: '800px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={showSuccess} image={Icons.successCircle} header={'Discipline added successfully'} subHeader={''} />
    </>
  );
};

export default AddDisciplineModal;
