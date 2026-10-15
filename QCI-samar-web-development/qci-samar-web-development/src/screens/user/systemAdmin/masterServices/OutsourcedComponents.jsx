import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppModal, AppToolTip } from '../../../../components/base';
import ListSearchBox from '../../../../components/base/ListSearchBox';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AddServiceOutsourcedComponent, EditServiceOutsourcedComponentsModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { activateOutsourcedComponentAction, deactivateOutsourcedComponentAction, getOutsourcedComponentAction, listOutsourcedComponentsAction } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';
import { serviceProviderTypeOptions } from '../../../../utils/ServiceProviderTypes';

const getMasterRowId = row => row.id || row.user_id;

const getServiceProviderTypeLabel = value => {
  const option = serviceProviderTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value || '-';
};

const OutsourcedComponents = () => {
  const dispatch = useDispatch();

  const [showAddAssessorModal, setShowAddAssessorModal] = useState(false);
  const [showEditUnitAdminModal, setShowEditUnitAdminModal] = useState(false);
  const [selectedUnitAdmin, setSelectedUnitAdmin] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    User: '',
    unitStatus: '',
    serviceProviderType: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [itemToToggle, setItemToToggle] = useState(null);
  const [_serverError, setServerError] = useState('');

  const {
    outsourcedComponents,
    outsourcedComponentsLoading,
    getOutsourcedComponent,
    activateOutsourcedComponentLoading,
    deactivateOutsourcedComponentLoading,
    activateOutsourcedComponent,
    deactivateOutsourcedComponent,
  } = useSelector(state => state.Master);

  // Debounced search effect
  useEffect(() => {
    const filtersData = {
      search: filters.search,
      status: filters?.unitStatus,
      perPage: pageSize,
      page: page,
      serviceProviderType: filters.serviceProviderType || undefined,
    };
    dispatch(listOutsourcedComponentsAction(filtersData));
  }, [dispatch, page, pageSize, filters]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGeneralError = errorMessage => {
    setServerError(errorMessage);
    toastError(errorMessage);
  };

  // Open edit modal when userDetails data is received
  useEffect(() => {
    if (selectedUnitAdmin) {
      setShowEditUnitAdminModal(true);
    }
  }, [selectedUnitAdmin]);

  const handleCloseModal = () => {
    setShowAddAssessorModal(false);
  };

  const handleEditUnitAdmin = useCallback(
    unitAdmin => {
      setSelectedUnitAdmin(unitAdmin);
      dispatch(getOutsourcedComponentAction(unitAdmin.id));
    },
    [dispatch],
  );

  const handleCloseEditModal = () => {
    setShowEditUnitAdminModal(false);
    setSelectedUnitAdmin(null);
  };

  // Refresh list when activate/deactivate operations complete
  useEffect(() => {
    if (activateOutsourcedComponent || deactivateOutsourcedComponent) {
      const filtersData = {
        search: filters.search,
        status: filters?.unitStatus,
        perPage: pageSize,
        page: page,
        serviceProviderType: filters.serviceProviderType || undefined,
      };
      dispatch(listOutsourcedComponentsAction(filtersData));
    }
  }, [activateOutsourcedComponent, deactivateOutsourcedComponent, dispatch, filters.search, filters.unitStatus, filters.serviceProviderType, pageSize, page]);

  const handleToggle = useCallback((rowId, isCurrentlyActive, itemName) => {
    setItemToToggle({
      id: rowId,
      isActive: isCurrentlyActive,
      name: itemName,
    });
    setShowToggleConfirmModal(true);
  }, []);

  const confirmToggleItem = () => {
    if (!itemToToggle || activateOutsourcedComponentLoading || deactivateOutsourcedComponentLoading) {
      return;
    }
    const { id, isActive } = itemToToggle;
    if (isActive) {
      dispatch(deactivateOutsourcedComponentAction(id))
        .then(() => {
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Deactivate outsourced component failed:', error);
        });
    } else {
      dispatch(activateOutsourcedComponentAction(id))
        .then(() => {
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Activate outsourced component failed:', error);
        });
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1,
        minWidth: 130,
        sortable: false,
        renderCell: params => {
          const rowId = params.row?.id;
          const isItemActive = params.row?.isActive ?? true;
          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <AppButton variant="secondary" size="extraSmall" title={'Edit'} onClick={() => handleEditUnitAdmin(params.row)} />
              <div className="toggle-btns d-flex">
                {isItemActive ? (
                  <AppToolTip title="Deactivate Outsourced Service Component">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Outsourced Service Component">
                    <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'serviceProviderType',
        headerName: 'Type of Service Provider',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => <span className="fs-12 fw-500 heading-color">{getServiceProviderTypeLabel(params.row.serviceProviderType)}</span>,
      },
      {
        field: 'outsourcedComponentName',
        headerName: 'Name of Outsourced Service Component',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="fs-14 fw-500 text-2-color">{params.row.componentName}</h4>
          </div>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        sortable: false,
        flex: 1,
        minWidth: 120,
        renderCell: params => {
          return <AppBadge variant={getBadgeVariantByLabel(params.row?.isActive ? 'Active' : 'Inactive')} label={params.row?.isActive ? 'Active' : 'Inactive'} />;
        },
      },
    ],
    [handleEditUnitAdmin, handleToggle],
  );

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading">Outsourced Service Components</h1>
                    <div className="input-search-document">
                      <ListSearchBox
                        value={filters.search}
                        placeholder="Search outsourced components"
                        onSearch={value => {
                          setFilters(prev => ({ ...prev, search: value }));
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="table-header-right">
                    <AppButton
                      variant={showFilters ? 'active-filter-btn' : 'filter-btn'}
                      size="small"
                      title={'Filters'}
                      leftIcon={showFilters ? Icons.activeFilter : Icons.filter}
                      leftIconStyle={'icon-14'}
                      onClick={() => setShowFilters(!showFilters)}
                    />
                    <AppButton variant="primary" size="small" title={'Add New'} onClick={() => setShowAddAssessorModal(true)} />
                  </div>
                </div>
                {/* Filter Section */}
                {showFilters && (
                  <div className="filter-section">
                    <div className="row" style={{ marginBottom: '16px' }}>
                      <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                        <AppDropdown
                          name="serviceProviderType"
                          value={filters.serviceProviderType}
                          onChange={e => handleFilterChange('serviceProviderType', e.target.value)}
                          options={serviceProviderTypeOptions}
                          label="Service Provider Type"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={outsourcedComponents?.data || []}
                    columns={columns}
                    rowCount={outsourcedComponents?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    getRowId={getMasterRowId}
                    loading={outsourcedComponentsLoading}
                    emptyTitle="No Outsourced Service Components"
                    emptySubtitle="No outsourced service components have been configured yet."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddServiceOutsourcedComponent open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditServiceOutsourcedComponentsModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={getOutsourcedComponent} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        header={itemToToggle?.isActive ? 'Deactivate Outsourced Component?' : 'Activate Outsourced Component?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonDisabled={activateOutsourcedComponentLoading || deactivateOutsourcedComponentLoading}
        leftButtonOnClick={() => {
          setShowToggleConfirmModal(false);
        }}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateOutsourcedComponentLoading || deactivateOutsourcedComponentLoading}
        rightButtonDisabled={activateOutsourcedComponentLoading || deactivateOutsourcedComponentLoading}
        onExited={() => setItemToToggle(null)}
      />
    </Layout>
  );
};

export default OutsourcedComponents;
