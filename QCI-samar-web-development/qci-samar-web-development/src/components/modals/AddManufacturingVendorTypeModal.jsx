import { useState } from 'react';
import Icons from '../../constants/Icons';
import { AppButton, AppModal, AppMultiSelectDropdown } from '../base';
import AppCommonModal from './AppCommonModal';

// Dummy data for units
const _UNITS_DATA = [
  { id: 1, name: 'Research & Development Unit' },
  { id: 2, name: 'Quality Assurance Unit' },
  { id: 3, name: 'Manufacturing Unit' },
  { id: 4, name: 'Testing & Validation Unit' },
  { id: 5, name: 'Operations Unit' },
];

const AddManufacturingVendorTypeModal = ({ open, handleClose, handleCancel, handleSave, disabled, loading }) => {
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
  const modalTitle = <>Add Manufacturing Type</>;

  // Modal content
  const modalContent = (
    <div className="row gap-vertical-24">
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
          width: { xs: '100%', sm: '90%', md: '800px', lg: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
      />
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        show={successfulModal}
        image={Icons.successCircle}
        header={'Manufacturing type added successfully'}
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

export default AddManufacturingVendorTypeModal;
