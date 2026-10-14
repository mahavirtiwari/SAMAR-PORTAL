import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import { MODAL_LIST_PAGE_SIZE } from '../../constants/appConstants';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { createVendorLabAction, listVendorLabsAction } from '../../redux/action/master/MasterAction';
import { resetVendorLabCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  labName: Yup.string().trim().max(255, 'Services name cannot exceed 255 characters').required('Services name is required'),
  serviceProviderType: Yup.string().required('Select a service provider type'),
});

const AddServicesVendorLabModal = ({ open, handleClose, onGeneralError }) => {
  const dispatch = useDispatch();
  const { createVendorLabError } = useSelector(state => state.Master);

  const initialValues = useMemo(
    () => ({
      labName: '',
      serviceProviderType: '',
    }),
    [],
  );

  const handleSubmit = async values => {
    await dispatch(
      createVendorLabAction({
        ...values,
        isActive: true,
      }),
    ).unwrap();
  };

  const handleSuccess = () => {
    dispatch(listVendorLabsAction({ page: 1, perPage: MODAL_LIST_PAGE_SIZE }));
    dispatch(resetVendorLabCreateUpdate());
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    onSuccess: handleSuccess,
    onGeneralError,
    open,
    onClose: handleClose,
    serverError: createVendorLabError,
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
              control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
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
              control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
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
              control={<Radio icon={<img src={Icons.uncheck} alt="" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="" className="icon-22" />} />}
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
          label="Services Name"
          name="labName"
          placeholder="Enter Services Name"
          value={formik.values.labName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          maxLength={100}
          isRequired={true}
          error={getFieldError('labName')}
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
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Services vendor lab added successfully'} subHeader={''} />;
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Add Service Services</>}
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

export default AddServicesVendorLabModal;
