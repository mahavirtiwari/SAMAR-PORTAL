import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import { useFormModal } from '../../hooks';
import { getAssessmentParametersAction, updateAssessmentParameterAction } from '../../redux/action/systemAdmin/AssessmentParameterAction';
import { resetAssessmentParameterCreateUpdateDelete } from '../../redux/slices/systemAdmin/AssessmentParameterSlice';
import { AppButton, AppDropdown, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object({
  name: Yup.string().trim().max(150, 'Parameter name cannot exceed 150 characters').required('Parameter name is required'),
  disciplineId: Yup.string().required('Select a discipline'),
  isMandatory: Yup.string().required('Select a type'),
  enterpriseSize: Yup.string().required('Select an enterprise classification'),
  vendorCategoryName: Yup.string().required('Select a DRDO category'),
});

const EditManufacturingAssessmentParameterModal = ({ open, handleClose, disciplines, data, drdoVendorCategories, onGeneralError }) => {
  const dispatch = useDispatch();

  // Get error state from Redux
  const { updateError } = useSelector(state => state.SystemAdminAssessmentParameter);

  // Prepare initial values from data
  const initialValues = useMemo(
    () => ({
      name: data?.name || '',
      isMandatory: data?.isMandatory ? 'mandatory' : 'optional',
      sector: 'manufacturing',
      disciplineId: data?.disciplineId || '',
      enterpriseSize: data?.enterpriseSize || '',
      vendorCategoryName: data?.vendorCategoryName ? drdoVendorCategories?.find(cat => cat.categoryName === data.vendorCategoryName)?.id || data.vendorCategoryName : '',
    }),
    [data, drdoVendorCategories],
  );

  // Submit handler
  const handleSubmit = async values => {
    const payload = {
      ...values,
      isMandatory: values.isMandatory === 'mandatory',
      sector: 'manufacturing',
      enterpriseSize: values.enterpriseSize,
      vendorCategoryName: values.vendorCategoryName,
    };

    await dispatch(updateAssessmentParameterAction({ id: data.id, ...payload })).unwrap();

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
    serverError: updateError,
    resetError: resetAssessmentParameterCreateUpdateDelete,
    onGeneralError,
    successMessage: 'Manufacturing Assessment Parameter Updated Successfully',
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
            name="name"
            maxLength={150}
            value={formik.values.name}
            onChange={e => formik.setFieldValue('name', e.target.value)}
            onBlur={formik.handleBlur}
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
                  control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
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
                  control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
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
            <div className="radio-group-bx" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              <span className="label mb-0" style={{ minWidth: 40 }}>
                Enterprise Classification<span className="asterics">*</span>
              </span>
              <RadioGroup value={formik.values.enterpriseSize} name="enterpriseSize" onChange={e => formik.setFieldValue('enterpriseSize', e.target.value)} sx={{ flexDirection: 'row' }}>
                {['startup', 'micro', 'small', 'medium', 'large'].map(size => (
                  <FormControlLabel
                    key={size}
                    value={size}
                    control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
                    label={size === 'startup' ? 'Start-Up' : size.charAt(0).toUpperCase() + size.slice(1)}
                    sx={{
                      marginRight: 2,
                      '& .MuiFormControlLabel-label': {
                        fontSize: '14px',
                      },
                    }}
                  />
                ))}
              </RadioGroup>
            </div>
            {getFieldError('enterpriseSize') && <div className="error-text margin-top-4">{getFieldError('enterpriseSize')}</div>}
          </FormControl>
        </div>
        <div className="col-md-12">
          <AppDropdown
            label="Category"
            name="vendorCategoryName"
            placeholder="Select Category"
            value={formik.values.vendorCategoryName}
            onChange={e => formik.setFieldValue('vendorCategoryName', e.target.value)}
            onBlur={formik.handleBlur}
            options={drdoVendorCategories?.filter(category => category.isActive !== false).map(category => ({ value: category.id, label: category.categoryName }))}
            isRequired={true}
            error={getFieldError('vendorCategoryName')}
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
        modalHeader={<>Edit Manufacturing Assessment Parameter</>}
        modalContent={modalContent}
        modalFooter={modalFooter}
        paperSx={{
          width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={showSuccess}
        image={Icons.successCircle}
        header={'Manufacturing assessment parameter updated successfully'}
        subHeader={'The assessment parameter details have been updated.'}
      />
    </>
  );
};

export default EditManufacturingAssessmentParameterModal;
