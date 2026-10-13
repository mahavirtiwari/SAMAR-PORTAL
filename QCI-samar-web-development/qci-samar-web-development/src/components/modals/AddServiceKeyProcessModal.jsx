import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { createKeyProcessV1Action, listKeyProcessV1Action } from '../../redux/action/master/MasterAction';
import { resetKeyProcessV1CreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  processName: Yup.string().trim().max(255, 'Key process name cannot exceed 255 characters').required('Key process name is required'),
  serviceProviderType: Yup.string().required('Select a service provider type'),
});

const AddServiceKeyProcessModal = ({ open, handleClose, onGeneralError }) => {
  const dispatch = useDispatch();
  const { createKeyProcessV1Error } = useSelector(state => state.Master);

  const initialValues = useMemo(
    () => ({
      processName: '',
      serviceProviderType: '',
    }),
    [],
  );

  const handleSubmit = async values => {
    await dispatch(
      createKeyProcessV1Action({
        ...values,
        isActive: true,
      }),
    ).unwrap();
  };

  const handleSuccess = () => {
    dispatch(listKeyProcessV1Action({ page: 1, perPage: 15 }));
    dispatch(resetKeyProcessV1CreateUpdate());
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    onSuccess: handleSuccess,
    onGeneralError,
    open,
    onClose: handleClose,
    serverError: createKeyProcessV1Error,
    successDuration: 3000,
  });

  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-12">
        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <span className="label">
            Type of Service Provider<span className="asterics">*</span>
          </span>
          <RadioGroup value={formik.values.serviceProviderType} onChange={e => formik.setFieldValue('serviceProviderType', e.target.value)} sx={{ flexDirection: 'row' }}>
            <FormControlLabel
              value="annual_maintenance_contract"
              control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
              label="Annual Maintenance Contract (AMC)"
              sx={{
                marginRight: 3,
                '& .MuiFormControlLabel-label': {
                  fontSize: '14px',
                },
              }}
            />
            <FormControlLabel
              value="critical_service_provider"
              control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
              label="Critical Service Provider"
              sx={{
                marginRight: 3,
                '& .MuiFormControlLabel-label': {
                  fontSize: '14px',
                },
              }}
            />
            <FormControlLabel
              value="civil_works_contractor"
              control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
              label="Civil Works Contractors"
              sx={{
                '& .MuiFormControlLabel-label': {
                  fontSize: '14px',
                },
              }}
            />
          </RadioGroup>
          {formik.touched.serviceProviderType && formik.errors.serviceProviderType && <div className="error-text margin-top-4">{formik.errors.serviceProviderType}</div>}
        </FormControl>
      </div>
      <div className="col-md-12">
        <AppInput
          label="Key Process Name"
          name="processName"
          placeholder="Enter Key Process Name"
          value={formik.values.processName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          maxLength={100}
          error={getFieldError('processName')}
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

  if (showSuccess) {
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Service key process added successfully'} subHeader={''} />;
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Add Service Key Process</>}
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

export default AddServiceKeyProcessModal;
