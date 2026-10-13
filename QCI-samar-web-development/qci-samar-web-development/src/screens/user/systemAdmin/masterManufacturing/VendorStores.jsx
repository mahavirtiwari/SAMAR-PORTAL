import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppModal, AppToolTip } from '../../../../components/base';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AddManufacturingVendorStoresModal, EditManufacturingVendorStoresModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { activateManufacturingStoreAction, deactivateManufacturingStoreAction, getManufacturingStoreAction, listManufacturingStoresAction } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const getMasterRowId = row => row.id || row.user_id;

const VendorStores = () => {
  const dispatch = useDispatch();

  const [showAddAssessorModal, setShowAddAssessorModal] = useState(false);
  const [showEditUnitAdminModal, setShowEditUnitAdminModal] = useState(false);
  const [selectedUnitAdmin, setSelectedUnitAdmin] = useState(null);
  const [_apiError, setApiError] = useState('');
  const [filters, _setFilters] = useState({
    search: '',
    User: '',
    unitStatus: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const {
    manufacturingStores,
    manufacturingStore,
    activateManufacturingStoreLoading,
    manufacturingStoresLoading,
    deactivateManufacturingStoreLoading,
    activateManufacturingStore,
    deactivateManufacturingStore,
  } = useSelector(state => state.Master);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [itemToToggle, setItemToToggle] = useState(null);

  const handleGeneralError = error => {
    setApiError(error);
    toastError(error);
  };

  // Fetch list effect
  useEffect(() => {
    const filtersData = {
      search: filters.search,
      perPage: pageSize,
      page: page,
    };
    dispatch(listManufacturingStoresAction(filtersData));
  }, [dispatch, page, pageSize, filters]);

  // Refresh list when manufacturing store activate/deactivate operations complete
  useEffect(() => {
    if (activateManufacturingStore || deactivateManufacturingStore) {
      const filtersData = {
        search: filters.search,
        perPage: pageSize,
        page: page,
      };
      dispatch(listManufacturingStoresAction(filtersData));
    }
  }, [activateManufacturingStore, deactivateManufacturingStore, dispatch, filters.search, pageSize, page]);

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
      dispatch(getManufacturingStoreAction(unitAdmin.id));
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
    if (!itemToToggle || activateManufacturingStoreLoading || deactivateManufacturingStoreLoading) {
      return;
    }

    const { id, isActive } = itemToToggle;

    if (isActive) {
      // Item is active, so deactivate
      dispatch(deactivateManufacturingStoreAction(id))
        .then(() => {
          // Close modal on success - useEffect will handle refresh
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Deactivate vendor store failed:', error);
        });
    } else {
      // Item is inactive, so activate
      dispatch(activateManufacturingStoreAction(id))
        .then(() => {
          // Close modal on success - useEffect will handle refresh
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Activate vendor store failed:', error);
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
                  <AppToolTip title="Deactivate Store">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Store">
                    <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'storeName',
        headerName: 'Store name',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content line-clamp">
            <h4 className="fs-14 fw-500 text-2-color">{params.row.storeName}</h4>
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
                    <h1 className="page-heading">Manufacturing Stores</h1>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Add New'} onClick={() => setShowAddAssessorModal(true)} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={manufacturingStores?.data || []}
                    columns={columns}
                    rowCount={manufacturingStores?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    getRowId={getMasterRowId}
                    loading={manufacturingStoresLoading}
                    emptyTitle="No Stores"
                    emptySubtitle="No vendor stores have been configured yet."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddManufacturingVendorStoresModal open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditManufacturingVendorStoresModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={manufacturingStore} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        header={itemToToggle?.isActive ? 'Deactivate Store?' : 'Activate Store?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonDisabled={activateManufacturingStoreLoading || deactivateManufacturingStoreLoading}
        leftButtonOnClick={() => {
          setShowToggleConfirmModal(false);
        }}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateManufacturingStoreLoading || deactivateManufacturingStoreLoading}
        rightButtonDisabled={activateManufacturingStoreLoading || deactivateManufacturingStoreLoading}
        onExited={() => setItemToToggle(null)}
      />
    </Layout>
  );
};

export default VendorStores;
