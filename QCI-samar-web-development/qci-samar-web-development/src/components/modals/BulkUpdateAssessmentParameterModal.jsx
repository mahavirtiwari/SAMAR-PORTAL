import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import { useFormModal } from '../../hooks';
import { bulkUpdateAssessmentParametersAction, getAssessmentParametersAction } from '../../redux/action/systemAdmin/AssessmentParameterAction';
import { resetAssessmentParameterCreateUpdateDelete } from '../../redux/slices/systemAdmin/AssessmentParameterSlice';
import SystemAdminAssessmentParameterService from '../../services/api/systemAdmin/AssessmentParameterService';
import { Logger } from '../../utils/logger';
import { AppButton, AppFileUpload, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const assessmentParameterService = SystemAdminAssessmentParameterService();

const BulkUpdateAssessmentParameterModal = ({ open, handleClose, sector, onGeneralError }) => {
  const dispatch = useDispatch();

  const { bulkUpdateError, bulkUpdateResult } = useSelector(state => state.SystemAdminAssessmentParameter);

  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const isService = sector === 'service';

  const handleDownloadTemplate = async () => {
    setTemplateError('');
    setTemplateDownloading(true);
    try {
      const blob = await assessmentParameterService.downloadBulkUpdateTemplate(sector);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'assessment_parameters_bulk_update_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      Logger.error('Bulk update template download failed:', error);
      setTemplateError('Failed to download template. Please try again.');
    } finally {
      setTemplateDownloading(false);
    }
  };

  const initialValues = {
    file: null,
  };

  const validationSchema = Yup.object({
    file: Yup.mixed()
      .required('File is required')
      .test('fileType', 'File must be an .xlsx, .xls or .csv spreadsheet', value => !value || /\.(xlsx|xls|csv)$/i.test(value.name || ''))
      .test('fileSize', 'File cannot exceed 5 MB', value => !value || value.size <= 5 * 1024 * 1024),
  });

  const handleSubmit = async values => {
    await dispatch(bulkUpdateAssessmentParametersAction({ file: values.file, sector })).unwrap();

    dispatch(resetAssessmentParameterCreateUpdateDelete());
    dispatch(getAssessmentParametersAction({ perPage: 10, page: 1, sector }));
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps } = useFormModal({
    open,
    onClose: handleClose,
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    serverError: bulkUpdateError,
    resetError: resetAssessmentParameterCreateUpdateDelete,
    onGeneralError,
    successMessage: 'Assessment Parameters Updated Successfully',
  });

  // Reset bulk update state when modal closes
  useEffect(() => {
    if (!open) {
      dispatch(resetAssessmentParameterCreateUpdateDelete());
    }
  }, [open, dispatch]);

  const getFieldError = fieldName => {
    return formik.touched[fieldName] && formik.errors[fieldName] ? formik.errors[fieldName] : '';
  };

  // Build success message with update stats
  const getSuccessSubHeader = () => {
    if (!bulkUpdateResult?.data) {
      return 'The assessment parameters have been updated successfully.';
    }
    // The API nests these as { parameters: { updated }, questions: { updated, created, removed } … }.
    // They were previously read as flat keys, which never matched, so the counts never showed.
    const stats = bulkUpdateResult.data;
    const parts = [];
    const add = (count, noun, verb) => {
      if (count) {
        parts.push(`${count} ${noun}${count === 1 ? '' : '(s)'} ${verb}`);
      }
    };

    add(stats.parameters?.updated, 'parameter', 'updated');
    add(stats.questions?.updated, 'question', 'updated');
    add(stats.questions?.created, 'question', 'added');
    add(stats.questions?.removed, 'question', 'removed');
    add(stats.options?.created, 'option', 'created');

    const summary = parts.length > 0 ? parts.join(', ') + '.' : 'The assessment parameters have been updated successfully.';

    // A parameter whose stored questions do not total 100% is left inactive rather than
    // put into service with a broken score scale; the importer needs to see which.
    const inactive = Array.isArray(stats.parameters?.inactive) ? stats.parameters.inactive : [];
    if (inactive.length === 0) {
      return summary;
    }
    return `${summary} ${inactive.length} parameter${inactive.length === 1 ? ' was' : 's were'} left inactive because the question weightage does not total 100%: ${inactive.join(', ')}. Correct the questions and activate ${inactive.length === 1 ? 'it' : 'them'} from the parameter list.`;
  };

  // Build error display for row-level validation errors. Mirrors the bulk-import error shapes:
  //  - update validation (400): array of row objects { row, parameterName, errors: [...] }
  //  - field validation (422): object keyed by field name { file: [...], sector: [...] }
  const renderErrors = () => {
    if (!bulkUpdateError) {
      return null;
    }

    const errorData = bulkUpdateError?.data || bulkUpdateError;
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
              Update Errors
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
              {templateDownloading ? 'Downloading…' : 'Download Bulk Update Template'}
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
            subLabel="Rows are matched by the Parameter ID column. Supported formats: .xlsx, .xls, .csv (max 5MB)"
          />
          {templateError && <div className="error-text margin-top-4">{templateError}</div>}
        </div>
        {renderErrors()}
      </div>
    </form>
  );

  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" {...cancelButtonProps} />
      <AppButton title="Update" size="medium" {...submitButtonProps} />
    </>
  );

  return (
    <>
      <AppCommonModal
        open={open}
        onClose={handleClose}
        modalHeader={<>Bulk Update {isService ? 'Service' : 'Manufacturing'} Assessment Parameters</>}
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
        header={'Assessment parameters updated successfully'}
        subHeader={getSuccessSubHeader()}
      />
    </>
  );
};

export default BulkUpdateAssessmentParameterModal;
