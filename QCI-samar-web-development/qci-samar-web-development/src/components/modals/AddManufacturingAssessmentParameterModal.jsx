import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import { useFormModal } from '../../hooks';
import { createAssessmentParameterAction, getAssessmentParametersAction } from '../../redux/action/systemAdmin/AssessmentParameterAction';
import { resetAssessmentParameterCreateUpdateDelete } from '../../redux/slices/systemAdmin/AssessmentParameterSlice';
import { AppButton, AppDropdown, AppInput, AppModal, AppMultiSelectDropdown } from '../base';
import AppCommonModal from './AppCommonModal';

const initialValues = {
  name: '',
  isMandatory: '',
  sector: 'manufacturing',
  disciplineId: '',
  enterpriseSize: [],
  vendorCategoryId: [],
};

const validationSchema = Yup.object({
  name: Yup.string().trim().max(150, 'Parameter name cannot exceed 150 characters').required('Parameter name is required'),
  disciplineId: Yup.string().required('Select a discipline'),
  isMandatory: Yup.string().required('Select a type'),
  enterpriseSize: Yup.array().of(Yup.string()).min(1, 'Select at least one enterprise classification').required('Select at least one enterprise classification'),
  vendorCategoryId: Yup.array().of(Yup.string()).min(1, 'Select at least one DRDO category').required('Select at least one DRDO category'),
});

const AddManufacturingAssessmentParameterModal = ({ open, handleClose, disciplines, drdoVendorCategories, onGeneralError }) => {
  const dispatch = useDispatch();

  // Get error state from Redux
  const { createError } = useSelector(state => state.SystemAdminAssessmentParameter);

  // Submit handler
  const handleSubmit = async values => {
    const payload = {
      ...values,
      isMandatory: values.isMandatory === 'mandatory',
      sector: 'manufacturing',
      // Send all selected values as arrays
      enterpriseSize: Array.isArray(values.enterpriseSize) ? values.enterpriseSize : [values.enterpriseSize],
      vendorCategoryId: Array.isArray(values.vendorCategoryId) ? values.vendorCategoryId.map(id => (typeof id === 'string' ? parseInt(id, 10) : id)) : [values.vendorCategoryId],
    };

    await dispatch(createAssessmentParameterAction(payload)).unwrap();

    // Reset slice flags
    dispatch(resetAssessmentParameterCreateUpdateDelete());

    // Refresh the list
    dispatch(getAssessmentParametersAction({ perPage: 10, page: 1, sector: 'manufacturing' }));
  };

  // Use the form modal hook
  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: createError,
    resetError: resetAssessmentParameterCreateUpdateDelete,
    onGeneralError,
    successMessage: 'Manufacturing Assessment Parameter Added Successfully',
  });

  // Helper for field errors
  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  // Modal content
  const modalContent = (
    <form onSubmit={formik.handleSubmit}>
      <div className="row gap-vertical-24">
        <div className="col-md-12">
          <AppDropdown
            label="Discipline"
            name="disciplineId"
            placeholder="Select Discipline"
            value={formik.values.disciplineId}
            onChange={e => formik.setFieldValue('disciplineId', e.target.value)}
            onBlur={formik.handleBlur}
            options={disciplines?.filter(discipline => discipline.isActive !== false).map(unit => ({ value: unit.id, label: unit.name }))}
            isRequired={true}
            error={getFieldError('disciplineId')}
          />
        </div>
        <div className="col-md-12">
          <AppInput
            label="Parameter"
            placeholder="Enter parameter"
            maxLength={150}
            value={formik.values.name}
            onChange={e => formik.setFieldValue('name', e.target.value)}
            onBlur={formik.handleBlur}
            name="name"
            isRequired={true}
            error={getFieldError('name')}
          />
        </div>
        <div className="col-md-12">
          <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
            <div className="radio-group-bx" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row', gap: 16 }}>
              <span className="label mb-0" style={{ minWidth: 40 }}>
                Type<span className="asterics">*</span>
              </span>
              <RadioGroup value={formik.values.isMandatory} name="isMandatory" onChange={e => formik.setFieldValue('isMandatory', e.target.value)} sx={{ flexDirection: 'row' }}>
                <FormControlLabel
                  value="mandatory"
                  control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                  label="Mandatory"
                  sx={{
                    marginRight: 2,
                    '& .MuiFormControlLabel-label': {
                      fontSize: '14px',
                    },
                  }}
                />
                <FormControlLabel
                  value="optional"
                  control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                  label="Optional"
                  sx={{
                    '& .MuiFormControlLabel-label': {
                      fontSize: '14px',
                    },
                  }}
                />
              </RadioGroup>
            </div>
            {getFieldError('isMandatory') && <div className="error-text margin-top-4">{getFieldError('isMandatory')}</div>}
          </FormControl>
        </div>
        <div className="col-md-12">
          <FormControl component="fieldset" sx={{ marginBottom: 2, width: '100%' }}>
            <span className="label">
              Enterprise Classification<span className="asterics">*</span>
            </span>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              {['startup', 'micro', 'small', 'medium', 'large'].map(sizeValue => (
                <button
                  key={sizeValue}
                  type="button"
                  onClick={() => {
                    const currentSizes = formik.values.enterpriseSize;
                    const newSizes = currentSizes.includes(sizeValue) ? currentSizes.filter(size => size !== sizeValue) : [...currentSizes, sizeValue];
                    formik.setFieldValue('enterpriseSize', newSizes);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}>
                  {formik.values.enterpriseSize.includes(sizeValue) ? (
                    <img src={Icons.squareTick} alt="checkbox" className="icon-22" />
                  ) : (
                    <img src={Icons.squareUncheck} alt="checkbox" className="icon-22" />
                  )}
                  <span style={{ textTransform: 'capitalize' }}>{sizeValue === 'startup' ? 'Start-Up' : sizeValue.charAt(0).toUpperCase() + sizeValue.slice(1)}</span>
                </button>
              ))}
            </div>
            {getFieldError('enterpriseSize') && <div className="error-text margin-top-4">{getFieldError('enterpriseSize')}</div>}
          </FormControl>
        </div>
        <div className="col-md-12">
          <AppMultiSelectDropdown
            label="Category"
            name="vendorCategoryId"
            placeholder="Select Category"
            value={formik.values.vendorCategoryId}
            onChange={value => formik.setFieldValue('vendorCategoryId', value || [])}
            onBlur={formik.handleBlur}
            options={drdoVendorCategories?.filter(category => category.isActive !== false).map(category => ({ value: String(category.id), label: category.categoryName }))}
            isRequired={true}
            error={getFieldError('vendorCategoryId')}
            chipMode
            selectAllOption={true}
          />
        </div>
      </div>
    </form>
  );

  // Modal footer
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
        modalHeader={<>Add Manufacturing Assessment Parameter</>}
        modalContent={modalContent}
        modalFooter={modalFooter}
        paperSx={{
          width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={showSuccess}
        image={Icons.successCircle}
        header={'Manufacturing assessment parameter added successfully'}
        subHeader={''}
      />
    </>
  );
};

export default AddManufacturingAssessmentParameterModal;
