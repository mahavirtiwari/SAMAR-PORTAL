import { useFormik } from 'formik';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { Logger } from '../../utils/logger';
import { AppButton } from '../base';
import AppCommonModal from './AppCommonModal';

const AddApplicationModal = ({ open, handleClose, disabled, loading }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('manufacturing');
  // Formik initial values
  const formik = useFormik({
    initialValues: { sector: activeTab },
    validationSchema: Yup.object({}),
    onSubmit: () => {
      handleSaveAndNext();
    },
    enableReinitialize: true, // Reset form when initialValues change
  });

  // Clear form when tab changes (only if switching to a different tab)
  const handleTabChange = tabName => {
    if (tabName !== activeTab) {
      setActiveTab(tabName);
      formik.resetForm();
    }
  };

  useEffect(() => {
    if (Object.keys(formik.errors).length > 0) {
      Logger.info('Formik Errors:', formik.errors);
    }
  }, [formik.errors]);

  const _dispatch = useDispatch();
  const hasFetchedRef = useRef(false);

  // useEffect(() => {
  //   if (!open) {
  //     return;
  //   }
  //   if (hasFetchedRef.current) {
  //     return;
  //   }

  //   hasFetchedRef.current = true;

  //   const timeoutId = setTimeout(() => {
  //     const data = { isActive: true, all: true };
  //     dispatch(getApplicationAction());
  //     dispatch(listVendorCategoriesAction(data));
  //     dispatch(listVendorCategoriesV1Action(data));
  //     dispatch(listThirdPartyCertsAction(data));
  //     dispatch(listManufacturingStoresAction(data));
  //     dispatch(listVendorLabsAction(data));
  //     dispatch(listKeyProcessV1Action(data));
  //     dispatch(listRawMaterialsAction(data));
  //     dispatch(listBoughtOutPartsAction(data));
  //     dispatch(listKeyResourcesAction(data));
  //     dispatch(listOutsourcedComponentsAction(data));
  //     // Avoid fetching organizations here — this toggles the global
  //     // `organizationsLoading` flag and causes blocking loaders in parent
  //     // screens (like Dashboard). Organization data is fetched elsewhere.
  //     dispatch(listCountriesAction(data));
  //     dispatch(listKeyProcessesAction(data));
  //   }, 500); // 500ms debounce

  //   return () => clearTimeout(timeoutId);
  // }, [dispatch, open, user?.organization?.id]);

  const handleSaveAndNext = () => {
    // Navigate to steps page based on selected sector
    handleClose();
    navigate(activeTab === 'manufacturing' ? '/create-new-application/manufacturing-steps' : '/create-new-application/services-steps', { state: { sector: activeTab } });
  };

  // Fetch latest parameter details when parameterId or activation toggles change

  useEffect(() => {
    if (!open) {
      formik.resetForm();
      // allow fetching again on next open
      hasFetchedRef.current = false;
    }
  }, [open]); // Reset form when modal is closed

  // Modal title
  const modalTitle = <>Apply for New Application</>;

  // Modal content
  const modalContent = (
    <form onSubmit={formik.handleSubmit}>
      <div className="row gap-vertical-24">
        <div className="col-md-12">
          <p className="fs-16 fw-500 heading-color">Select the activity of the unit for which you want to apply</p>
          <div>
            {/* <span className="label">
              Unit Sector
              <span className="asterics">*</span>
            </span> */}
            {/* Bootstrap Tab Navigation */}
            <ul className="nav nav-tabs custom-unit-tabs" id="unitTabs" role="tablist">
              <li className="nav-item col-6" role="presentation">
                <button
                  className={`nav-link unit-type-tab manufacturing-tab ${activeTab === 'manufacturing' ? 'active' : ''}`}
                  id="manufacturing-tab"
                  data-bs-toggle="tab"
                  data-bs-target="#manufacturing"
                  type="button"
                  role="tab"
                  aria-controls="manufacturing"
                  aria-selected={activeTab === 'manufacturing'}
                  onClick={() => handleTabChange('manufacturing')}>
                  <div className="unit-type-container-tab">
                    <div className="tabIcon">
                      <span className="unit-type">Manufacturing</span>
                    </div>
                  </div>
                </button>
              </li>
              <li className="nav-item col-6" role="presentation">
                <button
                  className={`nav-link unit-type-tab services-tab ${activeTab === 'services' ? 'active' : ''}`}
                  id="services-tab"
                  data-bs-toggle="tab"
                  data-bs-target="#services"
                  type="button"
                  role="tab"
                  aria-controls="services"
                  aria-selected={activeTab === 'services'}
                  onClick={() => handleTabChange('services')}>
                  <div className="unit-type-container-tab">
                    <div className="tabIcon">
                      <span className="unit-type">Service</span>
                    </div>
                  </div>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  );

  // Modal footer
  const modalFooter = (
    <>
      <AppButton variant="tertiary" size="medium" title="Cancel" onClick={handleClose} />
      <AppButton title="Continue" size="medium" type="submit" onClick={formik.handleSubmit} disabled={disabled} loading={loading} />
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
};

export default AddApplicationModal;
