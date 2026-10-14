import { useState } from 'react';
import Icons from '../../constants/Icons';
import { AppButton, AppModal, AppMultiSelectDropdown } from '../base';
import AppCommonModal from './AppCommonModal';

const EditManufacturingVendorTypeModal = ({ open, handleClose, handleCancel, handleSave, disabled, loading }) => {
  const [successfulModal, setSuccessfulModal] = useState(false);
  const [_status, _setStatus] = useState('Active');
  // Dummy data for dropdowns
  const dummyOptions = [
    { value: 'catA', label: 'Category A' },
    { value: 'catB', label: 'Category B' },
    { value: 'catC', label: 'Category C' },
  ];
  // Only pass array of values (strings) for value prop
  const [dummySelected, setDummySelected] = useState(['catA', 'catC']);

  const handleDummyChange = selected => setDummySelected(selected);

  // Handle save with form data
  const onSave = () => {
    setSuccessfulModal(true);
  };

  // Modal title
  const modalTitle = <>Edit Manufacturing Type</>;

  // Modal content
  const modalContent = (
    <div className="row gap-vertical-24 bottom-seperator">
      <div className="col-md-12">
        <AppMultiSelectDropdown
          label="Category under DRDO vendor registration"
          options={dummyOptions}
          value={dummySelected}
          onChange={handleDummyChange}
          placeholder="Select the Category under DRDO vendor registration"
          name="dummyCategory"
          isRequired={true}
        />
      </div>
      <div className="col-md-12">
        <AppMultiSelectDropdown
          label="Stores under DRDO vendor registration"
          options={dummyOptions}
          value={dummySelected}
          onChange={handleDummyChange}
          placeholder="Select the Stores under DRDO vendor registration"
          name="dummyStores"
          isRequired={true}
        />
      </div>

      {/* <div className="col-md-12">
        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <div className="radio-group-bx">
            <span className="label mb-0">Status</span>
            <RadioGroup value={status} onChange={e => setStatus(e.target.value)} sx={{ flexDirection: 'row', gap: 2 }}>
              <FormControlLabel
                value="Active"
                control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                label="Active"
                sx={{
                  marginRight: 3,
                  '& .MuiFormControlLabel-label': {
                    fontSize: '14px',
                  },
                }}
              />
              <FormControlLabel
                value="Inactive"
                control={<Radio icon={<img src={Icons.uncheck} alt="Uncheck Icon" className="icon-22" />} checkedIcon={<img src={Icons.radioBtn} alt="Check Icon" className="icon-22" />} />}
                label="Inactive"
                sx={{
                  '& .MuiFormControlLabel-label': {
                    fontSize: '14px',
                  },
                }}
              />
            </RadioGroup>
          </div>
        </FormControl>
      </div> */}
    </div>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" onClick={handleCancel} />
      <AppButton title="Save" size="medium" onClick={handleSave || onSave} disabled={disabled} loading={loading} />
    </>
  );

  return (
    <>
      <AppCommonModal
        open={open}
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
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={successfulModal}
        image={Icons.successCircle}
        header={'Manufacturing type updated successfully'}
        subHeader={''}
        singleButton={true}
        buttonClassName={'w-100 primary medium'}
        buttonOnClick={() => {
          setSuccessfulModal(false);
          handleCancel();
        }}
        singleButtonLabel={'OK'}
      />
    </>
  );
};

export default EditManufacturingVendorTypeModal;
