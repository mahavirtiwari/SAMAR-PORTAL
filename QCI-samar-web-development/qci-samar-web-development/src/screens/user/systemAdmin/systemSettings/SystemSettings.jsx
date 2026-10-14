import { useFormik } from 'formik';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { AppButton, AppInput, AppModal, AppSwitch } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import AppCommonModal from '../../../../components/modals/AppCommonModal';
import Icons from '../../../../constants/Icons';
import {
  getApplicationSubmissionSettingByKeyAction,
  getCertificateValiditySettingByKeyAction,
  getDrdoApprovalSettingByKeyAction,
  getMaintenanceModeSettingByKeyAction,
  getRecertificationWindowSettingByKeyAction,
  updateApplicationSubmissionSettingAction,
  updateCertificateValiditySettingAction,
  updateDrdoApprovalSettingAction,
  updateMaintenanceModeSettingAction,
  updateRecertificationWindowSettingAction,
} from '../../../../redux/action/common/SystemSettingAction';
import { Logger } from '../../../../utils/logger';

const SystemSettings = () => {
  const [drdoApproval, setDrdoApproval] = useState(false);
  const [acceptNew, setAcceptNew] = useState(false);
  const [maintenance, setMaintenance] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', subtitle: '', onConfirm: null, confirmLabel: 'Enable' });

  // Edit modal state (separate modal, use AppCommonModal)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalType, setEditModalType] = useState(''); // 'validity' | 'recert'
  const [editValue, setEditValue] = useState('');
  const [certificateValidity, setCertificateValidity] = useState();
  const [recertificationWindow, setRecertificationWindow] = useState();
  const { drdoSetting, certificateValiditySetting, recertWindowSetting, applicationSubmissionSetting, maintenanceSetting } = useSelector(state => state.SystemSetting);

  const openConfirm = (key, currentValue) => {
    if (key === 'drdo') {
      setModalConfig({
        title: currentValue ? 'Disable DRDO Approval?' : 'Enable DRDO Approval?',
        subtitle: currentValue
          ? 'If disabled, all new applications will directly proceed to payment without requiring DRDO approval.'
          : 'If enabled, all new applications will require DRDO approval before proceeding to payment.',
        onConfirm: async () => {
          try {
            const newValue = !drdoApproval;
            // update via action (send as string '1'/'0')
            const data = {
              key: 'drdo_approval_required',
              value: newValue ? '1' : '0',
            };
            await dispatch(updateDrdoApprovalSettingAction(data)).unwrap();
            setDrdoApproval(newValue);
          } catch (err) {
            Logger.error('Error updating DRDO Approval setting:', err);
          }
          setModalOpen(false);
        },
        confirmLabel: currentValue ? 'Disable' : 'Enable',
      });
      setModalOpen(true);
    }

    if (key === 'accept') {
      setModalConfig({
        title: currentValue ? 'Disable New Applications?' : 'Enable New Applications?',
        subtitle: currentValue
          ? 'Enterprises will not be able to submit new applications. Existing applications will remain accessible.'
          : 'Enterprises will be able to submit new applications on the portal.',
        onConfirm: async () => {
          try {
            const newValue = !acceptNew;
            const data = {
              key: 'application_submission_open',
              value: newValue ? '1' : '0',
            };
            await dispatch(updateApplicationSubmissionSettingAction(data)).unwrap();
            setAcceptNew(newValue);
          } catch (err) {
            Logger.error('Error updating Application Submission setting:', err);
          }
          setModalOpen(false);
        },
        confirmLabel: currentValue ? 'Disable' : 'Enable',
      });
      setModalOpen(true);
    }

    if (key === 'maintenance') {
      setModalConfig({
        title: currentValue ? 'Disable Maintenance Mode?' : 'Enable Maintenance Mode?',
        subtitle: currentValue
          ? 'This will restore full portal functionality and allow users to resume actions.'
          : 'Enabling maintenance mode restricts all portal operations for standard users while maintaining login access.',
        // change modal header style and image when enabling maintenance
        modalHeaderStyle: currentValue ? { backgroundColor: 'var(--warning-light)' } : { backgroundColor: 'var(--danger-light)' },
        image: currentValue ? Icons.warningIcon : Icons.rejectIcon,
        rightButtonClassName: currentValue ? 'w-100' : 'w-100 danger-primary',
        onConfirm: async () => {
          try {
            const newValue = !maintenance;
            const data = {
              key: 'maintenance_mode',
              value: newValue ? '1' : '0',
            };
            await dispatch(updateMaintenanceModeSettingAction(data)).unwrap();
            setMaintenance(newValue);
          } catch (err) {
            Logger.error('Error updating Maintenance Mode setting:', err);
          }
          setModalOpen(false);
        },
        confirmLabel: currentValue ? 'Disable' : 'Enable',
      });
      setModalOpen(true);
    }
  };

  const dispatch = useDispatch();

  useEffect(() => {
    // Load all settings once on mount. Each toggle/edit already applies its own confirmed value to
    // local state right after its update call succeeds (see openConfirm / formik onSubmit below), so
    // re-fetching everything here on every single update raced that optimistic value against a fresh
    // GET and could snap a switch back to its old position once the GET resolved.
    const loadAll = async () => {
      await Promise.all([
        dispatch(getDrdoApprovalSettingByKeyAction('drdo_approval_required')),
        dispatch(getCertificateValiditySettingByKeyAction('certificate_validity_years')),
        dispatch(getRecertificationWindowSettingByKeyAction('recertification_window_days')),
        dispatch(getApplicationSubmissionSettingByKeyAction('application_submission_open')),
        dispatch(getMaintenanceModeSettingByKeyAction('maintenance_mode')),
      ]);
    };
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (drdoSetting && typeof drdoSetting.value !== 'undefined') {
      const val = drdoSetting.value;
      setDrdoApproval(String(val) === '1' || String(val) === 'true' || val === true || Number(val) === 1);
    }
    if (certificateValiditySetting && typeof certificateValiditySetting.value !== 'undefined') {
      setCertificateValidity(Number(certificateValiditySetting.value) || certificateValidity);
    }
    if (recertWindowSetting && typeof recertWindowSetting.value !== 'undefined') {
      setRecertificationWindow(Number(recertWindowSetting.value) || recertificationWindow);
    }
    if (applicationSubmissionSetting && typeof applicationSubmissionSetting.value !== 'undefined') {
      const val = applicationSubmissionSetting.value;
      setAcceptNew(String(val) === '1' || String(val) === 'true' || val === true || Number(val) === 1);
    }
    if (maintenanceSetting && typeof maintenanceSetting.value !== 'undefined') {
      const val = maintenanceSetting.value;
      setMaintenance(!(String(val) === '1' || String(val) === 'true' || val === true || Number(val) === 1) ? false : true);
    }
  }, [drdoSetting, certificateValiditySetting, recertWindowSetting, applicationSubmissionSetting, maintenanceSetting]);

  const closeEditModal = () => {
    formik.resetForm();
    setEditModalOpen(false);
    setEditValue('');
    setEditModalType('');
  };

  // formik for edit modal input with required positive integer validation
  const formik = useFormik({
    initialValues: { editValue: editValue || '' },
    enableReinitialize: true,
    validateOnMount: true,
    validate: values => {
      const errors = {};
      const raw = values.editValue?.toString().trim();
      if (!raw) {
        errors.editValue = 'Value is required';
      } else {
        const num = parseInt(raw, 10);
        if (isNaN(num) || num <= 0) {
          errors.editValue = 'Enter a positive integer';
        }
      }
      return errors;
    },
    onSubmit: values => {
      const val = parseInt(values.editValue, 10);
      if (isNaN(val) || val <= 0) {
        return;
      }
      if (editModalType === 'validity') {
        dispatch(updateCertificateValiditySettingAction({ key: 'certificate_validity_years', value: String(val) }));
        setCertificateValidity(val);
      } else if (editModalType === 'recert') {
        dispatch(updateRecertificationWindowSettingAction({ key: 'recertification_window_days', value: String(val) }));
        setRecertificationWindow(val);
      }
      closeEditModal();
    },
  });

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">System Settings</h1>
              </div>
            </div>

            <div className="table-wrapper">
              <div className="row">
                <div className="col-sm-12">
                  <div className="inner-page-heading">
                    <h4 className="page-heading pt-1">Application Workflow</h4>
                  </div>
                </div>
              </div>
              {/* Application Workflow */}

              <div className="row">
                <div className="col-sm-6">
                  <div className="settings-card-outer">
                    <div className="settings-card">
                      <div className="seeting-left">
                        <div className="icon-bk">
                          <img src={Icons.drdo} alt="" className="img-fluid" />
                        </div>
                        <h4>DRDO Approval Management</h4>
                        <p>Enable or disable DRDO approval for new applications. When disabled, applications will be auto-approved.</p>
                      </div>

                      <div className="seeting-right">
                        <AppSwitch
                          id="drdo-switch"
                          checked={drdoApproval}
                          labels={{ on: 'Enabled', off: 'Disabled' }}
                          ariaLabel="DRDO Approval Toggle"
                          onChange={() => openConfirm('drdo', drdoApproval)}
                        />
                      </div>
                    </div>
                    {drdoApproval ? (
                      <div className="success-note">
                        <img src={Icons.greenTickCircle} alt="" className="img-fluid" />
                        All new applications will require DRDO approval before proceeding to payment.
                      </div>
                    ) : (
                      <div className="warning-note">
                        <img src={Icons.info} alt="" className="img-fluid" />
                        New applications can proceed to payment without DRDO approval.
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="settings-card-outer">
                    <div className="settings-card">
                      <div className="seeting-left">
                        <div className="left">
                          <div className="icon-bk">
                            <img src={Icons.newAccept} alt="" className="img-fluid" />
                          </div>
                          <div>
                            <h4>Accept New Applications</h4>
                            <p>Enable or disable the submission of new applications.</p>
                          </div>
                        </div>
                      </div>
                      <div className="seeting-right">
                        <AppSwitch
                          id="accept-switch"
                          checked={acceptNew}
                          labels={{ on: 'Enabled', off: 'Disabled' }}
                          ariaLabel="Accept New Applications Toggle"
                          onChange={() => openConfirm('accept', acceptNew)}
                        />
                      </div>
                    </div>
                    {acceptNew ? (
                      <div className="success-note">
                        <img src={Icons.greenTickCircle} alt="" className="img-fluid" />
                        Enterprises can submit new applications.
                      </div>
                    ) : (
                      <div className="warning-note">
                        <img src={Icons.info} alt="" className="img-fluid" />
                        Enterprises will not be able to submit new applications. Existing applications remain accessible.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="cus-divider"></div>

              <div className="row">
                <div className="col-sm-12">
                  <div className="inner-page-heading">
                    <h4 className="page-heading">Certificate Lifecycle</h4>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-sm-6">
                  <div className="settings-card-outer">
                    <div className="settings-card small">
                      <div className="seeting-left">
                        <div className="left">
                          <div className="icon-bk">
                            <img src={Icons.validityPeriod} alt="" className="img-fluid" />
                          </div>
                          <div>
                            <h4>Certificate Validity Period</h4>
                            <p>Certificates will expire automatically after this period.</p>
                          </div>
                        </div>
                      </div>
                      <div className="seeting-right">
                        <div className="recert-card">
                          <div className="recert-value">{certificateValidity} Years</div>
                          <Link
                            to={''}
                            onClick={e => {
                              e.preventDefault();
                              setEditModalType('validity');
                              setEditValue(String(certificateValidity));
                              setEditModalOpen(true);
                            }}>
                            <img src={Icons.edit} alt="" className="img-fluid" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="settings-card-outer">
                    <div className="settings-card small">
                      <div className="seeting-left">
                        <div className="left">
                          <div className="icon-bk">
                            <img src={Icons.calendarBlue} alt="" className="img-fluid" />
                          </div>
                          <div>
                            <h4>Recertification Window</h4>
                            <p>Enterprises can apply for renewal within the recertification window.</p>
                          </div>
                        </div>
                      </div>
                      <div className="seeting-right">
                        <div className="recert-card">
                          <div className="recert-value">{recertificationWindow} Days</div>
                          <Link
                            to={''}
                            onClick={e => {
                              e.preventDefault();
                              setEditModalType('recert');
                              setEditValue(String(recertificationWindow));
                              setEditModalOpen(true);
                            }}>
                            <img src={Icons.edit} alt="" className="img-fluid" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="cus-divider"></div>

              <div className="row">
                <div className="col-sm-12">
                  <div className="inner-page-heading">
                    <h4 className="page-heading">System Availability</h4>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-sm-6">
                  <div className="settings-row">
                    <div className="maintenance-card" style={{ width: '100%' }}>
                      <div className="seeting-left settings-card">
                        <div className="icon-bk">
                          <img src={Icons.settingIcon} alt="" className="img-fluid" />
                        </div>
                        <div>
                          <h4>Maintenance Mode</h4>
                          <p>Restricts portal access and displays a maintenance message to users. You can turn it off anytime.</p>
                        </div>
                      </div>
                      <div className="seeting-right">
                        {/* "Enabled/Disabled" would read backwards here — switching this on takes the portal down. */}
                        <AppSwitch
                          id="maintenance-switch"
                          checked={maintenance}
                          variant="danger"
                          labels={{ on: 'Active', off: 'Inactive' }}
                          ariaLabel="Maintenance Toggle"
                          onChange={() => openConfirm('maintenance', maintenance)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Confirmation modal using AppModal */}
      <AppModal
        modalHeaderStyle={modalConfig.modalHeaderStyle || { backgroundColor: 'var(--warning-light)' }}
        show={modalOpen}
        image={modalConfig.image || Icons.warningIcon}
        handleClose={() => setModalOpen(false)}
        header={modalConfig.title}
        subHeader={modalConfig.subtitle}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        rightButtonClassName={modalConfig.rightButtonClassName || 'w-100'}
        rightButton={modalConfig.confirmLabel || 'Confirm'}
        leftButtonOnClick={() => setModalOpen(false)}
        rightButtonOnClick={() => modalConfig.onConfirm && modalConfig.onConfirm()}
      />

      <AppCommonModal
        open={editModalOpen}
        onClose={closeEditModal}
        handleClose={closeEditModal}
        paperSx={{
          width: { xs: 'calc(100% - 16px)', sm: '90%', md: '800px', lg: '700px' },
          maxWidth: '98vw',
          margin: { xs: 1, sm: 2, md: 3 },
        }}
        modalHeader={editModalType === 'validity' ? 'Edit Certificate Validity Period' : 'Edit Recertification Window'}
        modalContent={
          <div style={{ padding: '8px 0' }}>
            <AppInput label="Edit Value" name="editValue" id="edit-value" value={formik.values.editValue} onChange={e => formik.setFieldValue('editValue', e.target.value)} />
            {formik.touched.editValue && formik.errors.editValue ? <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{formik.errors.editValue}</div> : null}
          </div>
        }
        modalFooter={
          <div style={{ display: 'flex', gap: 8 }}>
            <AppButton variant="tertiary" size="medium" title="Cancel" onClick={closeEditModal} />
            <AppButton title="Save" size="medium" onClick={() => formik.submitForm()} disabled={!formik.isValid || formik.isSubmitting} />
          </div>
        }
      />
    </Layout>
  );
};

export default SystemSettings;
