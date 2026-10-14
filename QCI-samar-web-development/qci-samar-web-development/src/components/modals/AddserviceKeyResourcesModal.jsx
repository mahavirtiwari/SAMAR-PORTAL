import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import { MODAL_LIST_PAGE_SIZE } from '../../constants/appConstants';
import Icons from '../../constants/Icons';
import useFormModal from '../../hooks/useFormModal';
import { createKeyResourceAction, listKeyResourcesAction } from '../../redux/action/master/MasterAction';
import { resetKeyResourceCreateUpdate } from '../../redux/slices/master/MasterSlice';
import { AppButton, AppInput, AppModal } from '../base';
import AppCommonModal from './AppCommonModal';

const validationSchema = Yup.object().shape({
  resourceName: Yup.string().trim().max(255, 'Key service resource name cannot exceed 255 characters').required('Key service resource name is required'),
  serviceProviderType: Yup.string().required('Select a service provider type'),
});

const AddServiceKeyResourcesModal = ({ open, handleClose, onGeneralError }) => {
  const dispatch = useDispatch();
  const { createKeyResourceError } = useSelector(state => state.Master);

  const initialValues = useMemo(
    () => ({
      resourceName: '',
      serviceProviderType: '',
    }),
    [],
  );

  const handleSubmit = async values => {
    await dispatch(
      createKeyResourceAction({
        ...values,
        isActive: true,
      }),
    ).unwrap();
  };

  const handleSuccess = () => {
    dispatch(listKeyResourcesAction({ page: 1, perPage: MODAL_LIST_PAGE_SIZE }));
    dispatch(resetKeyResourceCreateUpdate());
  };

  const { formik, showSuccess, submitButtonProps, cancelButtonProps, getFieldError } = useFormModal({
    initialValues,
    validationSchema,
    onSubmit: handleSubmit,
    onSuccess: handleSuccess,
    onGeneralError,
    open,
    onClose: handleClose,
    serverError: createKeyResourceError,
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
          label="Key Service Resource"
          name="resourceName"
          placeholder="Enter Key Service Resource Name"
          value={formik.values.resourceName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          isRequired={true}
          maxLength={100}
          error={getFieldError('resourceName')}
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
    return <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={true} image={Icons.successCircle} header={'Key service resource added successfully'} subHeader={''} />;
  }

  return (
    <AppCommonModal
      open={open}
      onClose={handleClose}
      modalHeader={<>Add Key Service Resource</>}
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

export default AddServiceKeyResourcesModal;
