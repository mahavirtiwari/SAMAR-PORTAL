import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppModal, AppToolTip } from '../../../../components/base';
import ListSearchBox from '../../../../components/base/ListSearchBox';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AddServiceKeyProcessModal, EditServiceKeyProcessModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { activateKeyProcessV1Action, deactivateKeyProcessV1Action, getKeyProcessV1Action, listKeyProcessV1Action } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';
import { serviceProviderTypeOptions } from '../../../../utils/ServiceProviderTypes';

const getMasterRowId = row => row.id || row.user_id;

const getServiceProviderTypeLabel = value => {
  const option = serviceProviderTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value || '-';
};

const KeyProcesses = () => {
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
  const [_apiError, setApiError] = useState(null);
  const { keyProcessV1, getKeyProcessV1, activateKeyProcessV1Loading, deactivateKeyProcessV1Loading, activateKeyProcessV1, deactivateKeyProcessV1 } = useSelector(state => state.Master);

  const handleGeneralError = error => {
    setApiError(error);
    toastError(error, { duration: 6000 });
  };

  // Debounced search effect
  useEffect(() => {
    const filtersData = {
      search: filters.search,
      status: filters?.unitStatus,
      perPage: pageSize,
      page: page,
      serviceProviderType: filters.serviceProviderType || undefined,
    };
    dispatch(listKeyProcessV1Action(filtersData));
  }, [dispatch, page, pageSize, filters]);

  // Refresh list after activate/deactivate
  useEffect(() => {
    if (activateKeyProcessV1 || deactivateKeyProcessV1) {
      const filtersData = {
        search: filters.search,
        status: filters?.unitStatus,
        perPage: pageSize,
        page: page,
        serviceProviderType: filters.serviceProviderType || undefined,
      };
      dispatch(listKeyProcessV1Action(filtersData));
    }
  }, [dispatch, activateKeyProcessV1, deactivateKeyProcessV1, filters.search, filters.unitStatus, filters.serviceProviderType, pageSize, page]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
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
      dispatch(getKeyProcessV1Action(unitAdmin.id));
    },
    [dispatch],
  );

  const handleCloseEditModal = () => {
    setShowEditUnitAdminModal(false);
    setSelectedUnitAdmin(null);
  };

  const handleToggle = useCallback((rowId, isCurrentlyActive, itemName) => {
    setItemToToggle({
      id: rowId,
      isActive: isCurrentlyActive,
      name: itemName,
    });
    setShowToggleConfirmModal(true);
  }, []);

  const confirmToggleItem = () => {
    if (!itemToToggle || activateKeyProcessV1Loading || deactivateKeyProcessV1Loading) {
      return;
    }
    const { id, isActive } = itemToToggle;
    try {
      if (isActive) {
        dispatch(deactivateKeyProcessV1Action(id))
          .then(() => {
            setShowToggleConfirmModal(false);
          })
          .catch(error => {
            Logger.error('Deactivate key process failed:', error);
          });
      } else {
        dispatch(activateKeyProcessV1Action(id))
          .then(() => {
            setShowToggleConfirmModal(false);
          })
          .catch(error => {
            Logger.error('Activate key process failed:', error);
          });
      }
    } catch (error) {
      Logger.error('Toggle key process failed:', error);
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
                  <AppToolTip title="Deactivate Key Process">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Key Process">
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
        field: 'processName',
        headerName: 'Key Process Name',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="fs-14 fw-500 text-2-color">{params.row.processName}</h4>
          </div>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 1,
        minWidth: 120,
        sortable: false,
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
                    <h1 className="page-heading">Key Services</h1>
                    <div className="input-search-document">
                      <ListSearchBox
                        value={filters.search}
                        placeholder="Search key services"
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
                    rows={keyProcessV1?.data || []}
                    columns={columns}
                    rowCount={keyProcessV1?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    loading={keyProcessV1?.loading}
                    getRowId={getMasterRowId}
                    emptyTitle="No Key Services"
                    emptySubtitle="No service key processes have been configured yet."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddServiceKeyProcessModal open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditServiceKeyProcessModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={getKeyProcessV1} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        header={itemToToggle?.isActive ? 'Deactivate Key Process?' : 'Activate Key Process?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonDisabled={activateKeyProcessV1Loading || deactivateKeyProcessV1Loading}
        leftButtonOnClick={() => {
          setShowToggleConfirmModal(false);
        }}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateKeyProcessV1Loading || deactivateKeyProcessV1Loading}
        rightButtonDisabled={activateKeyProcessV1Loading || deactivateKeyProcessV1Loading}
        onExited={() => setItemToToggle(null)}
      />
    </Layout>
  );
};

export default KeyProcesses;
