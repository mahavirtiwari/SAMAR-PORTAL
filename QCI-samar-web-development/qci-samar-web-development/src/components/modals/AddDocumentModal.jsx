import { useFormik } from 'formik';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import { uploadDocumentAction } from '../../redux/action/common/DocumentAction';
import { Logger } from '../../utils/logger';
import { mapServerErrorsToFormik } from '../../utils/serverErrorUtils';
import { AppButton, AppInput } from '../base';
import AppCommonModal from './AppCommonModal';

function AddDocumentModal({ open, handleClose, handleCancel, handleSave, onGeneralError, serverError }) {
  const dispatch = useDispatch();
  const { uploadLoading } = useSelector(state => state.SystemAdminDocument);
  const [dragActive, setDragActive] = useState(false);

  const formik = useFormik({
    initialValues: {
      title: '',
      type: '',
      file: null,
    },
    validationSchema: Yup.object({
      title: Yup.string().trim().max(150, 'Title cannot exceed 150 characters').required('Title is required'),
      file: Yup.mixed()
        .required('Select a document to upload')
        .test('fileType', 'Document must be a PDF', value => !value || /\.pdf$/i.test(value.name || ''))
        .test('fileSize', 'Document cannot exceed 10 MB', value => !value || value.size <= 10 * 1024 * 1024),
    }),
    onSubmit: async values => {
      try {
        const formData = new FormData();
        formData.append('file', values.file);
        formData.append('title', values.title);
        // formData.append('isActive', true);

        // default to pdf if type not provided
        formData.append('type', values.type || 'pdf');
        const payload = await dispatch(uploadDocumentAction(formData)).unwrap();
        if (handleSave) {
          handleSave({
            name: values.title,
            documentType: values.type,
            fileType: values.file.type,
            size: `${(values.file.size / (1024 * 1024)).toFixed(1)} MB`,
            file: values.file,
            ...payload,
          });
        }
        reset();
        formik.resetForm();
        handleClose();
      } catch (error) {
        Logger.error('Failed to add assessment question and options:', error);
        // Map server validation errors into Formik fields if present
        try {
          const general = mapServerErrorsToFormik(error, formik.setFieldError);
          if (general && onGeneralError) {
            onGeneralError(general);
          }
        } catch (mapErr) {
          Logger.error('Failed mapping server errors:', mapErr);
        }
      }
    },
  });

  useEffect(() => {
    if (serverError) {
      const generalError = mapServerErrorsToFormik(serverError, formik.setFieldError);
      if (generalError && onGeneralError) {
        onGeneralError(generalError);
      }
    }
  }, [serverError]);

  const reset = () => {
    formik.resetForm();
    formik.setFieldValue('type', '');
    formik.setFieldValue('file', null);
    setDragActive(false);
  };

  const handleFile = e => {
    const f = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (f) {
      const isPdf = f.type === 'application/pdf' || (f.name || '').toLowerCase().endsWith('.pdf');
      const isWithinSize = f.size <= 50 * 1024 * 1024;
      if (!isPdf) {
        formik.setFieldTouched('file', true, false);
        formik.setFieldError('file', 'Only PDF files are supported');
        return;
      }
      if (!isWithinSize) {
        formik.setFieldTouched('file', true, false);
        formik.setFieldError('file', 'Maximum file size allowed is 50 MB');
        return;
      }
      formik.setFieldError('file', undefined);
      formik.setFieldValue('file', f);
    }
  };

  const handleDrag = active => e => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active);
  };

  const handleDrop = e => {
    handleDrag(false)(e);
    handleFile(e);
  };
  const handleBrowse = () => document.getElementById('document-upload-input').click();

  // upload handled via formik.handleSubmit

  // Modal title
  const modalTitle = <>Add Document</>;

  // Modal content
  const modalContent = (
    <div className="row gap-vertical-24">
      <div className="col-md-12">
        <span className="input-label fs-12 fw-500 text-1-color">
          Document<span className="asterics">*</span>
        </span>
        {!formik.values.file ? (
          <div
            className={`document-container content-center${dragActive ? ' drag-active' : ''}`}
            onDragOver={handleDrag(true)}
            onDragLeave={handleDrag(false)}
            onDrop={handleDrop}
            onClick={!formik.values.file ? handleBrowse : undefined}
            style={{ cursor: formik.values.file ? 'default' : 'pointer', border: dragActive ? '1px dashed var(--primary-color)' : '1px dashed var(--outline)' }}>
            <input id="document-upload-input" type="file" style={{ display: 'none' }} accept=".pdf" onChange={handleFile} />

            <div className="document-icon-container margin-bottom-16">
              <img src={Icons.documentUpload} alt="upload" className="icon-44" />
            </div>
            <div className="text-center">
              <h3 className="fs-16 fw-600 text-1-color mb-6">Drag & drop file here or click to browse</h3>
              <p className="fs-12 fw-500 text-3-color margin-bottom-20">Only .pdf files are supported. Maximum file size allowed is 50 MB.</p>
              <AppButton
                variant="tertiary"
                size="small"
                title={'Browse Files'}
                onClick={e => {
                  e.stopPropagation();
                  handleBrowse();
                }}
              />
              {formik.errors.file && <div className="fs-12 fw-500 text-danger margin-top-12">{formik.errors.file}</div>}
            </div>
          </div>
        ) : (
          <div className="document-preview-container">
            <div className="rowBetween">
              <div>
                <div className="fs-16 fw-600 text-1-color mb-2">{formik.values.file?.name}</div>
                <div className="fs-12 fw-500 text-3-color">{(formik.values.file?.size / (1024 * 1024)).toFixed(1)} MB</div>
              </div>
              <div
                className="d-flex align-items-center"
                onClick={e => {
                  e.stopPropagation();
                  formik.setFieldValue('file', null);
                }}>
                <img src={Icons.crossGrey} alt="delete" className="icon-20 cursor-pointer" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="col-md-12">
        <AppInput
          label="Title"
          name="title"
          placeholder="Enter Title"
          maxLength={150}
          value={formik.values.title}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          error={formik.touched.title && Boolean(formik.errors.title)}
          helperText={formik.touched.title && formik.errors.title}
        />{' '}
      </div>
    </div>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton
        variant="tertiary"
        size="medium"
        title="Cancel"
        onClick={() => {
          reset();
          handleCancel();
        }}
      />
      <AppButton title="Upload" size="medium" onClick={formik.handleSubmit} disabled={uploadLoading} loading={uploadLoading} />
    </>
  );

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
}

export default AddDocumentModal;
