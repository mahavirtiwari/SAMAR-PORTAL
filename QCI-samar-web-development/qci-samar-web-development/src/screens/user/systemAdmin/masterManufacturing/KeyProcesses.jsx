import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppModal, AppToolTip } from '../../../../components/base';
import ListSearchBox from '../../../../components/base/ListSearchBox';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import AddKeyProcessModal from '../../../../components/modals/AddKeyProcessModal';
import EditKeyProcessModal from '../../../../components/modals/EditKeyProcessModal';
import Icons from '../../../../constants/Icons';
import { activateKeyProcessAction, deactivateKeyProcessAction, getKeyProcessAction, listKeyProcessesAction } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const getMasterRowId = row => row.id || row.user_id;

const ManufacturingKeyProcesses = () => {
  const dispatch = useDispatch();
  const [_apiError, setApiError] = useState('');

  const [showAddAssessorModal, setShowAddAssessorModal] = useState(false);
  const [showEditUnitAdminModal, setShowEditUnitAdminModal] = useState(false);
  const [selectedUnitAdmin, setSelectedUnitAdmin] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    User: '',
    unitStatus: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { keyProcess, getKeyProcesses, activateKeyProcessLoading, deactivateKeyProcessLoading, activateKeyProcess, deactivateKeyProcess } = useSelector(state => state.Master);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [itemToToggle, setItemToToggle] = useState(null);
  // Debounced search effect
  useEffect(() => {
    const filtersData = {
      search: filters.search,
      status: filters?.unitStatus,
      perPage: pageSize,
      page: page,
    };
    dispatch(listKeyProcessesAction(filtersData));
  }, [dispatch, page, pageSize, filters]);

  // Refresh list when key process activate/deactivate operations complete
  useEffect(() => {
    if (activateKeyProcess || deactivateKeyProcess) {
      const filtersData = {
        search: filters.search,
        status: filters?.unitStatus,
        perPage: pageSize,
        page: page,
      };
      dispatch(listKeyProcessesAction(filtersData));
    }
  }, [activateKeyProcess, deactivateKeyProcess, dispatch, filters.search, filters?.unitStatus, pageSize, page]);

  const _handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle general error callback from modal (for non-field errors)
  const handleGeneralError = errorMessage => {
    setApiError(errorMessage);
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
      dispatch(getKeyProcessAction(unitAdmin.id));
    },
    [dispatch],
  );

  const handleCloseEditModal = () => {
    setShowEditUnitAdminModal(false);
    setSelectedUnitAdmin(null);
  };

  const handleToggle = useCallback((rowId, isCurrentlyActive, itemName) => {
    // Store item info for confirmation modal
    setItemToToggle({
      id: rowId,
      isActive: isCurrentlyActive,
      name: itemName,
    });
    setShowToggleConfirmModal(true);
  }, []);

  const confirmToggleItem = () => {
    if (!itemToToggle || activateKeyProcessLoading || deactivateKeyProcessLoading) {
      return;
    }

    const { id, isActive } = itemToToggle;

    if (isActive) {
      // Item is active, so deactivate
      dispatch(deactivateKeyProcessAction(id))
        .then(() => {
          // Close modal - onExited callback will clear itemToToggle after animation
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Deactivate key process failed:', error);
        });
    } else {
      // Item is inactive, so activate
      dispatch(activateKeyProcessAction(id))
        .then(() => {
          // Close modal - onExited callback will clear itemToToggle after animation
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Activate key process failed:', error);
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
        field: 'processName',
        headerName: 'Key Process name',
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
                    <h1 className="page-heading">Manufacturing Key Processes</h1>
                    <div className="input-search-document">
                      <ListSearchBox
                        value={filters.search}
                        placeholder="Search key processes"
                        onSearch={value => {
                          setFilters(prev => ({ ...prev, search: value }));
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Add New'} onClick={() => setShowAddAssessorModal(true)} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={getKeyProcesses?.data || []}
                    columns={columns}
                    loading={getKeyProcesses?.loading}
                    rowCount={getKeyProcesses?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    getRowId={getMasterRowId}
                    emptyTitle="No Key Processes"
                    emptySubtitle="No key processes have been configured yet."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddKeyProcessModal open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditKeyProcessModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={keyProcess} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        onExited={() => setItemToToggle(null)}
        header={itemToToggle?.isActive ? 'Deactivate Key Process?' : 'Activate Key Process?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonDisabled={activateKeyProcessLoading || deactivateKeyProcessLoading}
        leftButtonOnClick={() => setShowToggleConfirmModal(false)}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateKeyProcessLoading || deactivateKeyProcessLoading}
        rightButtonDisabled={activateKeyProcessLoading || deactivateKeyProcessLoading}
      />
    </Layout>
  );
};

export default ManufacturingKeyProcesses;
