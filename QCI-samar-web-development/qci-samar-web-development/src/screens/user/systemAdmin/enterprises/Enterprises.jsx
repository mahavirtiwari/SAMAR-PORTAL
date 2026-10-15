import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppInput, AppModal, AppToolTip } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import { MESSAGE_DISPLAY_DELAY_MS } from '../../../../constants/appConstants';
import Icons from '../../../../constants/Icons';
import { useListFilters } from '../../../../hooks';
import { getStateAction } from '../../../../redux/action/master/MasterAction';
import { activateOrganizationAction, deactivateOrganizationAction, exportOrganizationsAction, getOrganizationsAction } from '../../../../redux/action/systemAdmin/EnterprisesAction';
import { resetActivateDeactivateState, resetEnterprisesState } from '../../../../redux/slices/systemAdmin/EnterprisesSlice';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const Enterprises = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [gridRows, setGridRows] = useState([]);

  // Filters and pagination are held in the URL so returning from a detail page
  // restores the list the user had filtered down to.
  const { filters, setFilters, appliedFilters, appliedQuery, setAppliedFilters, page, setPage, pageSize, setPageSize, resetFilters } = useListFilters({
    search: '',
    state: '',
    status: '',
  });
  // Reopen the filter panel on return when a filter is active, so the restored list shows what it is filtered by.
  const [showFilters, setShowFilters] = useState(() => Object.entries(appliedFilters).some(([key, value]) => key !== 'search' && value !== '' && value != null));
  const { organizations, organizationsLoading, exportLoading, activateLoading, deactivateLoading, activatedOrganization, deactivatedOrganization, activateError, deactivateError } = useSelector(
    state => state.SystemAdminEnterprises,
  );
  const { getState: statesList } = useSelector(state => state.Master);

  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [dropdownResetKey, setDropdownResetKey] = useState(0);

  // Fetch states on mount
  useEffect(() => {
    const filtersData = {
      all: true,
    };
    dispatch(getStateAction(filtersData));
  }, [dispatch]);

  // Filter options
  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending_details', label: 'Pending Details' },
  ];

  const stateOptions = Array.isArray(statesList)
    ? statesList.map(state => ({
        value: state.name || state,
        label: state.name || state,
      }))
    : [];

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = () => {
    // Copy current filters to appliedFilters and reset to first page
    setAppliedFilters({
      search: filters.search,
      state: filters.state,
      status: filters.status,
    });
    setPage(1);
  };

  // Auto-apply search after the user stops typing (debounced); other filters still require
  // Apply Filters. The equality check matters on mount: without it this would fire once with
  // the value restored from the URL and send the user back to page 1, undoing the page they
  // returned to.
  useEffect(() => {
    const typed = filters.search || '';
    if (typed === appliedFilters.search) {
      return undefined;
    }

    const id = setTimeout(() => {
      setAppliedFilters(prev => ({ ...prev, search: typed }));
      setPage(1);
    }, 500);

    return () => clearTimeout(id);
  }, [filters.search, appliedFilters.search, setAppliedFilters, setPage]);

  const handleReset = () => {
    resetFilters();
    setDropdownResetKey(prev => prev + 1);
  };

  const handleExport = async () => {
    try {
      const result = await dispatch(exportOrganizationsAction());
      if (result.type === 'enterprises/export/fulfilled') {
        // Create and download CSV file
        const csvData = result.payload;
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `enterprise_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      Logger.error('Export failed:', error);
    }
  };
  useEffect(() => {
    const filtersData = {
      isVerified: false,
      page,
      perPage: pageSize,
      search: appliedQuery.search || '',
      state: appliedQuery.state || '',
      status: appliedQuery.status || '',
    };
    dispatch(getOrganizationsAction(filtersData));
    dispatch(resetEnterprisesState());
  }, [dispatch, page, pageSize, activatedOrganization, deactivatedOrganization, appliedQuery]);

  // Handle activate/deactivate success
  useEffect(() => {
    if (activatedOrganization) {
      setTimeout(() => {
        setShowActivateModal(false);
        setSuccessMessage('Enterprises activated successfully');
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), MESSAGE_DISPLAY_DELAY_MS);
        dispatch(resetActivateDeactivateState());
      }, 300);
    }
    if (deactivatedOrganization) {
      setTimeout(() => {
        setShowDeactivateModal(false);
        setSelectedOrganization(null);
        setSuccessMessage('Enterprise deactivated successfully');
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), MESSAGE_DISPLAY_DELAY_MS);
        dispatch(resetActivateDeactivateState());
      }, 300);
    }
  }, [activatedOrganization, deactivatedOrganization, dispatch]);

  // Handle errors
  useEffect(() => {
    if (activateError) {
      setTimeout(() => {
        setErrorMessage(`Error activating organisation: ${activateError}`);
        setShowErrorModal(true);
      }, 300);
      dispatch(resetActivateDeactivateState());
    }
    if (deactivateError) {
      setTimeout(() => {
        setErrorMessage(`Error deactivating organisation: ${deactivateError}`);
        setShowErrorModal(true);
      }, 300);
      dispatch(resetActivateDeactivateState());
    }
  }, [activateError, deactivateError, dispatch]);

  const handleActivate = useCallback(row => {
    setSelectedOrganization(row);
    setShowActivateModal(true);
  }, []);

  const handleDeactivate = useCallback(row => {
    setSelectedOrganization(row);
    setDeactivateReason('');
    setShowDeactivateModal(true);
  }, []);

  const confirmActivate = () => {
    if (selectedOrganization) {
      dispatch(activateOrganizationAction(selectedOrganization.id));
    }
  };

  const confirmDeactivate = () => {
    if (selectedOrganization) {
      dispatch(deactivateOrganizationAction({ id: selectedOrganization.id, reason: deactivateReason.trim() }));
    }
  };
  useEffect(() => {
    if (organizations?.data?.organizations) {
      setGridRows(organizations.data.organizations);
    }
  }, [organizations?.data?.organizations]);
  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1,
        minWidth: 140,
        sortable: false,
        renderCell: params => (
          <div className="gap-8 d-flex align-items-center">
            <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/system-admin-enterprise-details/${params.row.id}`)} />
            <div className="toggle-btns d-flex">
              {params.row.status === 'active' ? (
                <AppToolTip title="Deactivate Enterprise">
                  <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleDeactivate(params.row)} />
                </AppToolTip>
              ) : (
                <AppToolTip title="Activate Enterprise">
                  <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleActivate(params.row)} />
                </AppToolTip>
              )}
            </div>
          </div>
        ),
      },
      {
        field: 'enterpriseSector',
        headerName: 'Enterprise Name',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <p className="mb-0 fs-14 fw-500 text-heading">{params.row.name || '-'}</p>
            <span>{params.row.unitName || '-'}</span>
          </div>
        ),
      },

      {
        field: 'enterpriseAdmin',
        headerName: 'Enterprise Admin',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <p className="mb-0 fs-14 fw-500 text-heading">{params.row.enterpriseAdmin || '-'}</p>
            <span>{params.row.samarId || '-'}</span>
          </div>
        ),
      },

      {
        field: 'state',
        headerName: 'State',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => (
          <div>
            <p className="mb-0 fs-12 fw-500 text-2-color">{params.row.registeredState || '-'}</p>
          </div>
        ),
      },

      {
        field: 'applications',
        sortable: false,
        headerName: 'Applications',
        flex: 1,
        minWidth: 120,
        renderCell: params => <p className="mb-0 fs-12 fw-500 text-2-color">{params.row.applicationsCount || '-'}</p>,
      },
      {
        field: 'registeredOn',
        headerName: 'Registered on',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => (
          <div>
            <p className="mb-0 fs-12 fw-500 text-2-color">{formatDate(params.row.createdAt)}</p>
          </div>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 1.2,
        sortable: false,
        minWidth: 140,
        renderCell: params => <AppBadge variant={getBadgeVariantByLabel(params.row?.status) || '-'} label={getStatusLabel(params.row?.status)} />,
      },
    ],
    [navigate, handleActivate, handleDeactivate],
  );
  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Enterprises</h1>
                <div className="input-search-document">
                  <AppInput
                    inputType="search"
                    name="search"
                    label="Search by enterprise name"
                    customInputClass={'search-input'}
                    value={filters.search} // Ensure the input value is controlled
                    onChange={e => handleFilterChange('search', e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    placeholder="Search by enterprise name"
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
                  />
                </div>
              </div>
              <div className="table-header-right">
                <AppButton
                  variant="secondary"
                  size="small"
                  title={'Export'}
                  leftIcon={Icons.exportFile}
                  leftIconStyle={'icon-14'}
                  loading={exportLoading}
                  disabled={exportLoading}
                  onClick={handleExport}
                />
                <AppButton
                  variant={showFilters ? 'active-filter-btn' : 'filter-btn'}
                  size="small"
                  title={'Filters'}
                  leftIcon={showFilters ? Icons.activeFilter : Icons.filter}
                  leftIconStyle={'icon-14'}
                  onClick={() => setShowFilters(!showFilters)}
                />
              </div>
            </div>

            {/* Filter Section */}
            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="state" value={filters.state} onChange={e => handleFilterChange('state', e.target.value)} options={stateOptions} label="State" resetKey={dropdownResetKey} />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="status" value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} options={statusOptions} label="Status" resetKey={dropdownResetKey} />
                  </div>
                </div>

                <div
                  className="filter-actions"
                  style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-start',
                  }}>
                  <AppButton variant="primary" size="small" title="Apply Filters" leftIcon={Icons.searchWhite} leftIconStyle={'icon-14'} onClick={handleSearch} />
                  <AppButton variant="tertiary" size="small" title="Reset" onClick={handleReset} leftIcon={Icons.closeCircle} leftIconStyle={'icon-14'} />
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <AppDataGrid
                rows={gridRows || []}
                columns={columns}
                loading={organizationsLoading && gridRows.length === 0}
                rowCount={organizations?.data?.pagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                emptyTitle="No Enterprises"
                emptySubtitle="There are no enterprise profiles to display."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Activate Confirmation Modal */}
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }}
        image={Icons.successCircle}
        show={showActivateModal}
        header={'Activate Enterprise?'}
        subHeader={`Users in "${selectedOrganization?.name}" will regain access.`}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => {
          setShowActivateModal(false);
          setSelectedOrganization(null);
        }}
        rightButton={activateLoading ? 'Activating' : 'Activate'}
        rightButtonClassName={'w-100 success-primary'}
        rightButtonOnClick={confirmActivate}
        rightButtonDisabled={activateLoading}
      />

      {/* Deactivate Confirmation Modal */}
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.deleteModal}
        show={showDeactivateModal}
        header={'Deactivate Enterprise?'}
        subHeader={`All users in "${selectedOrganization?.name}" will lose access immediately.`}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => {
          setShowDeactivateModal(false);
          setSelectedOrganization(null);
        }}
        textAreaLabel="Reason for deactivation"
        textAreaPlaceholder="Why is this enterprise being deactivated?"
        isRequiredTextArea
        textAreaValue={deactivateReason}
        onTextAreaChange={e => setDeactivateReason(e.target.value)}
        textAreaHelperText="Kept in the history (at least 5 characters)."
        rightButton={deactivateLoading ? 'Deactivating' : 'Deactivate'}
        rightButtonClassName={'w-100 danger-primary'}
        rightButtonOnClick={confirmDeactivate}
        rightButtonDisabled={deactivateLoading || deactivateReason.trim().length < 5}
      />

      {/* Success Modal */}
      <AppModal modalHeaderStyle={{ backgroundColor: 'var(--success-light)' }} show={showSuccessModal} image={Icons.successCircle} header={successMessage} subHeader={''} />

      {/* Error Modal */}
      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        show={showErrorModal}
        image={Icons.deleteModal}
        header={'Error'}
        subHeader={errorMessage}
        twoButtons={false}
        leftButton={'Close'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => {
          setShowErrorModal(false);
          setErrorMessage('');
        }}
      />
    </Layout>
  );
};

export default Enterprises;
