import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import { useFormModal } from '../../hooks';
import { getDisciplinesAction, updateDisciplineAction } from '../../redux/action/systemAdmin/DisciplinesAction';
import { resetDisciplinesCreateUpdateDelete } from '../../redux/slices/systemAdmin/DisciplinesSlice';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const DESCRIPTION_MAX_LENGTH = 1000;

const validationSchema = Yup.object().shape({
  name: Yup.string().trim().max(100, 'Discipline name cannot exceed 100 characters').required('Discipline name is required'),
  description: Yup.string().trim().max(DESCRIPTION_MAX_LENGTH, `Description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`),
});

const EditDisciplineModal = ({ open, handleClose, data, sector = 'manufacturing', onGeneralError }) => {
  const dispatch = useDispatch();

  // Get error state from Redux
  const { updateError } = useSelector(state => state.SystemAdminDisciplines);

  // Prepare initial values from data
  const initialValues = useMemo(
    () => ({
      name: data?.name || '',
      description: data?.description || '',
      sector,
    }),
    [data, sector],
  );

  // Submit handler
  const handleSubmit = async values => {
    await dispatch(updateDisciplineAction({ id: data.id, ...values, sector })).unwrap();

    // Reset slice flags
    dispatch(resetDisciplinesCreateUpdateDelete());

    // Refresh the list
    dispatch(getDisciplinesAction({ perPage: 10, page: 1, sector }));
  };

  // Use the form modal hook
  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: updateError,
    resetError: resetDisciplinesCreateUpdateDelete,
    onGeneralError,
    successMessage: 'Discipline Updated Successfully',
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
      <div className="col-md-12">
        <AppInput
          inputType="textarea"
          label="Description"
          name="description"
          placeholder="What this discipline covers (optional)"
          maxLength={DESCRIPTION_MAX_LENGTH}
          multiline={true}
          value={formik.values.description}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={getFieldError('description')}
        />
        <div className="d-flex justify-content-end margin-top-4">
          <span className="fs-12 fw-500 text-3-color">
            {(formik.values.description || '').length}/{DESCRIPTION_MAX_LENGTH}
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

  return (
    <>
      <AppCommonModal
        open={open}
        onClose={handleClose}
        modalHeader={<>Edit Discipline</>}
        modalContent={modalContent}
        modalFooter={modalFooter}
        paperSx={{
          width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '800px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={showSuccess} image={Icons.successCircle} header={'Discipline updated successfully'} subHeader={''} />
    </>
  );
};

export default EditDisciplineModal;
