import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import { useFormModal } from '../../hooks';
import { bulkImportAssessmentParametersAction, getAssessmentParametersAction } from '../../redux/action/systemAdmin/AssessmentParameterAction';
import { resetAssessmentParameterCreateUpdateDelete } from '../../redux/slices/systemAdmin/AssessmentParameterSlice';
import SystemAdminAssessmentParameterService from '../../services/api/systemAdmin/AssessmentParameterService';
import { Logger } from '../../utils/logger';
import { AppButton, AppFileUpload, AppModal, AppMultiSelectDropdown } from '../base';
import AppCommonModal from './AppCommonModal';

const assessmentParameterService = SystemAdminAssessmentParameterService();

const BulkImportAssessmentParameterModal = ({ open, handleClose, sector, drdoVendorCategories, drdoVendorCategoriesV1, onGeneralError }) => {
  const dispatch = useDispatch();

  const { bulkImportError, bulkImportResult } = useSelector(state => state.SystemAdminAssessmentParameter);

  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const handleDownloadTemplate = async () => {
    setTemplateError('');
    setTemplateDownloading(true);
    try {
      const blob = await assessmentParameterService.downloadAssessmentParameterImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'assessment_parameters_import_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      Logger.error('Template download failed:', error);
      setTemplateError('Failed to download template. Please try again.');
    } finally {
      setTemplateDownloading(false);
    }
  };

  const isService = sector === 'service';

  const initialValues = {
    file: null,
    enterpriseSize: [],
    vendorCategoryId: [],
    ...(isService ? { serviceProviderType: '' } : {}),
  };

  const validationSchema = Yup.object({
    file: Yup.mixed()
      .required('File is required')
      .test('fileType', 'File must be an .xlsx, .xls or .csv spreadsheet', value => !value || /\.(xlsx|xls|csv)$/i.test(value.name || ''))
      .test('fileSize', 'File cannot exceed 5 MB', value => !value || value.size <= 5 * 1024 * 1024),
    enterpriseSize: Yup.array().of(Yup.string()).min(1, 'Select at least one enterprise classification').required('Select at least one enterprise classification'),
    vendorCategoryId: Yup.array().min(1, 'Select at least one vendor category').required('Select at least one vendor category'),
    ...(isService ? { serviceProviderType: Yup.string().required('Select a service provider type') } : {}),
  });

  const handleSubmit = async values => {
    const payload = {
      file: values.file,
      sector,
      enterpriseSize: values.enterpriseSize,
      vendorCategoryId: values.vendorCategoryId,
      ...(isService ? { serviceProviderType: values.serviceProviderType } : {}),
    };

    await dispatch(bulkImportAssessmentParametersAction(payload)).unwrap();

    dispatch(resetAssessmentParameterCreateUpdateDelete());
    dispatch(getAssessmentParametersAction({ perPage: 10, page: 1, sector }));
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: bulkImportError,
    resetError: resetAssessmentParameterCreateUpdateDelete,
    onGeneralError,
    successMessage: 'Assessment Parameters Imported Successfully',
  });

  // Reset bulk import state when modal closes
  useEffect(() => {
    if (!open) {
      dispatch(resetAssessmentParameterCreateUpdateDelete());
    }
  }, [open, dispatch]);

  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  // Get vendor categories based on sector
  const getVendorCategoryOptions = () => {
    if (isService) {
      return drdoVendorCategoriesV1
        ?.filter(data => data.serviceProviderType === formik.values.serviceProviderType && data.isActive !== false)
        .map(category => ({ value: category.id, label: category.categoryName }));
    }
    return drdoVendorCategories?.filter(category => category.isActive !== false).map(category => ({ value: category.id, label: category.categoryName }));
  };

  // Build success message with import stats
  const getSuccessSubHeader = () => {
    if (!bulkImportResult?.data) {
      return 'The assessment parameters have been imported successfully.';
    }
    // The API nests these as { disciplines: { created }, questions: { created, removed } … }.
    // They were previously read as flat keys (stats.questionsCreated), which never matched,
    // so the summary always fell through to the generic sentence.
    const stats = bulkImportResult.data;
    const parts = [];
    const add = (count, noun, verb) => {
      if (count) {
        parts.push(`${count} ${noun}${count === 1 ? '' : '(s)'} ${verb}`);
      }
    };

    add(stats.disciplines?.created, 'discipline', 'created');
    add(stats.parameters?.created, 'parameter', 'created');
    add(stats.parameters?.updated, 'parameter', 'updated');
    add(stats.questions?.created, 'question', 'created');
    add(stats.questions?.removed, 'previous question', 'replaced');
    add(stats.options?.created, 'option', 'created');

    const summary = parts.length > 0 ? parts.join(', ') + '.' : 'The assessment parameters have been imported successfully.';

    // A parameter whose stored questions do not total 100% is left inactive rather than
    // put into service with a broken score scale; the importer needs to see which.
    const inactive = Array.isArray(stats.parameters?.inactive) ? stats.parameters.inactive : [];
    if (inactive.length === 0) {
      return summary;
    }
    return `${summary} ${inactive.length} parameter${inactive.length === 1 ? ' was' : 's were'} left inactive because the question weightage does not total 100%: ${inactive.join(', ')}. Correct the questions and activate ${inactive.length === 1 ? 'it' : 'them'} from the parameter list.`;
  };

  // Build error display for row-level validation errors
  const renderErrors = () => {
    if (!bulkImportError) {
      return null;
    }

    // Flatten backend errors into plain display strings. Two shapes arrive here:
    //  - import validation (400): array of row objects { row, parameterName, questionText, errors: [...] }
    //  - field validation (422): object keyed by field name { file: [...], sector: [...] }
    // Rendering a row object directly as a React child throws "Objects are not valid as a React child",
    // which is what blanked the screen — so everything is reduced to strings before render.
    const errorData = bulkImportError?.data || bulkImportError;
    const rawErrors = errorData?.errors;
    const lines = [];

    if (Array.isArray(rawErrors)) {
      rawErrors.forEach(item => {
        if (typeof item === 'string') {
          lines.push(item);
          return;
        }
        if (item && typeof item === 'object') {
          const hasRow = item.row !== undefined && item.row !== null && item.row !== 'N/A' && item.row !== 0;
          const rowLabel = hasRow ? `Row ${item.row}` : null;
          const paramName = item.parameterName || item.parameter_name;
          const prefix = [rowLabel, paramName].filter(Boolean).join(' · ');
          const messages = Array.isArray(item.errors) ? item.errors : item.errors ? [item.errors] : [];
          messages.forEach(msg => lines.push(prefix ? `${prefix}: ${msg}` : String(msg)));
        }
      });
    } else if (rawErrors && typeof rawErrors === 'object') {
      Object.entries(rawErrors).forEach(([field, messages]) => {
        const text = Array.isArray(messages) ? messages.join(', ') : String(messages);
        lines.push(`${field}: ${text}`);
      });
    }

    if (lines.length > 0) {
      return (
        <div className="col-md-12">
          <div style={{ backgroundColor: 'var(--danger-light)', borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
            <span className="label" style={{ color: 'var(--danger-primary)', marginBottom: 8, display: 'block' }}>
              Import Errors
            </span>
            {lines.map((line, idx) => (
              <div key={idx} style={{ fontSize: 12, color: 'var(--danger-primary)', marginBottom: 4 }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Handle general error message
    const message = errorData?.message || (typeof errorData === 'string' ? errorData : null);
    if (message) {
      return (
        <div className="col-md-12">
          <div style={{ backgroundColor: 'var(--danger-light)', borderRadius: 8, padding: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--danger-primary)' }}>{message}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  const modalContent = (
    <form onSubmit={formik.handleSubmit}>
      <div className="row gap-vertical-24">
        <div className="col-md-12">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span className="label" style={{ margin: 0 }}>
              Upload File<span className="asterics">*</span>
            </span>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={templateDownloading}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--primary)',
                fontSize: 13,
                cursor: templateDownloading ? 'wait' : 'pointer',
                textDecoration: 'underline',
              }}>
              {templateDownloading ? 'Downloading…' : 'Download template'}
            </button>
          </div>
          <AppFileUpload
            label=""
            accept=".xlsx,.xls,.csv"
            maxSizeMB={5}
            value={formik.values.file}
            onChange={file => formik.setFieldValue('file', file)}
            isRequired={false}
            error={getFieldError('file')}
            subLabel="Supported formats: .xlsx, .xls, .csv (max 5MB)"
          />
          {templateError && <div className="error-text margin-top-4">{templateError}</div>}
        </div>
        <div className="col-md-12">
          <FormControl component="fieldset" sx={{ width: '100%' }}>
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
        {isService && (
          <div className="col-md-12">
            <FormControl component="fieldset" sx={{ width: '100%' }}>
              <span className="label">
                Type of Service Provider<span className="asterics">*</span>
              </span>
              <RadioGroup
                value={formik.values.serviceProviderType}
                onChange={e => {
                  formik.setFieldValue('serviceProviderType', e.target.value);
                  formik.setFieldValue('vendorCategoryId', []);
                }}
                sx={{ flexDirection: 'row' }}>
                <FormControlLabel
                  value="annual_maintenance_contract"
                  control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                  label="Annual Maintenance Contract (AMC)"
                  sx={{
                    marginRight: 3,
                    '& .MuiFormControlLabel-label': { fontSize: '14px' },
                  }}
                />
                <FormControlLabel
                  value="critical_service_provider"
                  control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                  label="Critical Service Provider"
                  sx={{
                    marginRight: 3,
                    '& .MuiFormControlLabel-label': { fontSize: '14px' },
                  }}
                />
                <FormControlLabel
                  value="civil_works_contractor"
                  control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                  label="Civil Works Contractors"
                  sx={{
                    '& .MuiFormControlLabel-label': { fontSize: '14px' },
                  }}
                />
              </RadioGroup>
              {getFieldError('serviceProviderType') && <div className="error-text margin-top-4">{getFieldError('serviceProviderType')}</div>}
            </FormControl>
          </div>
        )}
        {(!isService || formik.values.serviceProviderType) && (
          <div className="col-md-12">
            <AppMultiSelectDropdown
              label="Category"
              name="vendorCategoryId"
              placeholder="Select Category"
              value={formik.values.vendorCategoryId}
              onChange={value => formik.setFieldValue('vendorCategoryId', value || [])}
              onBlur={formik.handleBlur}
              options={getVendorCategoryOptions()}
              isRequired={true}
              error={getFieldError('vendorCategoryId')}
              chipMode
              selectAllOption={true}
            />
          </div>
        )}
        {renderErrors()}
      </div>
    </form>
  );

  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" {...cancelButtonProps} />
      <AppButton title="Import" size="medium" {...submitButtonProps} />
    </>
  );

  return (
    <>
      <AppCommonModal
        open={open}
        onClose={handleClose}
        modalHeader={<>Bulk Import {isService ? 'Service' : 'Manufacturing'} Assessment Parameters</>}
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
        header={'Assessment parameters imported successfully'}
        subHeader={getSuccessSubHeader()}
      />
    </>
  );
};

export default BulkImportAssessmentParameterModal;
