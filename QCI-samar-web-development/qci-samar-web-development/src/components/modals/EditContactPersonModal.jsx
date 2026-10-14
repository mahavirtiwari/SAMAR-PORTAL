import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { AppButton, AppInput } from '../base';
import AppCommonModal from './AppCommonModal';

const EditContactPersonModal = ({ show, handleClose, handleCancel, handleSave, initialData = {} }) => {
  // State for form data
  const [formData, setFormData] = useState({
    name: '',
    designation: '',
    mobileNumber: '',
    emailId: '',
  });

  // State for form errors
  const [errors, setErrors] = useState({
    name: '',
    designation: '',
    mobileNumber: '',
    emailId: '',
  });

  // State for loading
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (show && initialData) {
      setFormData({
        name: initialData.contactPersonName || '',
        designation: initialData.contactPersonDesignation || '',
        mobileNumber: initialData.contactPersonMobile || '',
        emailId: initialData.contactPersonEmail || '',
      });
      // Clear errors when modal opens
      setErrors({
        name: '',
        designation: '',
        mobileNumber: '',
        emailId: '',
      });
    }
  }, [show, initialData]);

  // Handle input changes
  const handleInputChange = (field, value) => {
    const sanitizedValue = field === 'mobileNumber' ? String(value).replace(/\D/g, '').slice(0, 10) : value;
    setFormData(prevData => ({
      ...prevData,
      [field]: sanitizedValue,
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prevErrors => ({
        ...prevErrors,
        [field]: '',
      }));
    }
  };

  // Validate form data
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.designation.trim()) {
      newErrors.designation = 'Designation is required';
    }

    const mobileNumber = formData.mobileNumber.trim();
    if (!mobileNumber) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else if (!/^\d+$/.test(mobileNumber)) {
      newErrors.mobileNumber = 'Mobile number must contain only digits';
    } else if (mobileNumber.length < 10 || mobileNumber.length > 10) {
      newErrors.mobileNumber = 'Mobile number must be 10 digits';
    }

    if (!formData.emailId.trim()) {
      newErrors.emailId = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailId)) {
      newErrors.emailId = 'Enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle modal close
  const handleModalClose = () => {
    if (handleClose) {
      handleClose();
    }
  };

  // Handle cancel button click
  const handleCancelClick = () => {
    if (handleCancel) {
      handleCancel();
    } else {
      handleModalClose();
    }
  };

  // Handle save button click
  const handleSaveClick = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      if (handleSave) {
        await handleSave(formData);
      }
      handleModalClose();
    } catch {
      // Handle error - you might want to show an error message to the user here
      // Logger.error('Error saving contact person:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Modal title
  const modalTitle = <>Edit Contact Person</>;

  // Modal content
  const modalContent = (
    <div className="row gap-vertical-30">
      <div className="col-md-6">
        <AppInput label="Name" placeholder="Enter Name" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} isRequired={true} error={errors.name} disabled={isLoading} />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Designation"
          placeholder="Enter Designation"
          value={formData.designation}
          onChange={e => handleInputChange('designation', e.target.value)}
          isRequired={true}
          error={errors.designation}
          disabled={isLoading}
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Mobile Number"
          placeholder="Enter Mobile Number"
          value={formData.mobileNumber}
          onChange={e => handleInputChange('mobileNumber', e.target.value)}
          isRequired={true}
          error={errors.mobileNumber}
          disabled={isLoading}
        />
      </div>
      <div className="col-md-6">
        <AppInput
          label="Email"
          placeholder="Enter Email"
          value={formData.emailId}
          onChange={e => handleInputChange('emailId', e.target.value)}
          isRequired={true}
          error={errors.emailId}
          disabled={isLoading}
        />
      </div>
    </div>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" title="Cancel" onClick={handleCancelClick} disabled={isLoading} size="medium" />
      <AppButton title="Save" onClick={handleSaveClick} disabled={isLoading} loading={isLoading} size="medium" />
    </>
  );

  return (
    <AppCommonModal
      open={show}
      onClose={handleClose}
      modalHeader={modalTitle}
      modalContent={modalContent}
      modalFooter={modalFooter}
      paperSx={{
        width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
        maxWidth: '98vw',
        margin: { xs: 1, sm: 2, md: 3 },
      }}
    />
  );
};

// PropTypes validation
EditContactPersonModal.propTypes = {
  show: PropTypes.bool.isRequired,
  handleClose: PropTypes.func,
  handleCancel: PropTypes.func,
  handleSave: PropTypes.func,
  initialData: PropTypes.shape({
    name: PropTypes.string,
    designation: PropTypes.string,
    mobileNumber: PropTypes.string,
    emailId: PropTypes.string,
  }),
};

export default EditContactPersonModal;
