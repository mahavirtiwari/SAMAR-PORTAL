import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppModal, AppToolTip } from '../../../../components/base';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AddManufacturingRawMaterialsModal, EditManufacturingRawMaterialsModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { activateRawMaterialAction, deactivateRawMaterialAction, getRawMaterialAction, listRawMaterialsAction } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const getMasterRowId = row => row.id || row.user_id;

const RawMaterials = () => {
  const dispatch = useDispatch();

  const [showAddAssessorModal, setShowAddAssessorModal] = useState(false);
  const [showEditUnitAdminModal, setShowEditUnitAdminModal] = useState(false);
  const [selectedUnitAdmin, setSelectedUnitAdmin] = useState(null);
  const [_apiError, setApiError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    User: '',
    unitStatus: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Raw materials state from Redux
  const { rawMaterials, rawMaterialsLoading, getRawMaterial, activateRawMaterialLoading, deactivateRawMaterialLoading, activateRawMaterial, deactivateRawMaterial } = useSelector(
    state => state.Master,
  );
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
    dispatch(listRawMaterialsAction(filtersData));
  }, [dispatch, page, pageSize, filters]);

  // Refresh list when raw material activate/deactivate operations complete
  useEffect(() => {
    if (activateRawMaterial || deactivateRawMaterial) {
      const filtersData = {
        search: filters.search,
        status: filters?.unitStatus,
        perPage: pageSize,
        page: page,
      };
      dispatch(listRawMaterialsAction(filtersData));
    }
  }, [activateRawMaterial, deactivateRawMaterial, dispatch, filters.search, filters?.unitStatus, pageSize, page]);
  const _handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGeneralError = error => {
    setApiError(error);
    toastError(error);
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
      dispatch(getRawMaterialAction(unitAdmin.id));
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
    if (!itemToToggle || activateRawMaterialLoading || deactivateRawMaterialLoading) {
      return;
    }

    const { id, isActive } = itemToToggle;

    if (isActive) {
      // Item is active, so deactivate
      dispatch(deactivateRawMaterialAction(id))
        .then(() => {
          // Close modal - onExited callback will clear itemToToggle after animation
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Deactivate raw material failed:', error);
        });
    } else {
      // Item is inactive, so activate
      dispatch(activateRawMaterialAction(id))
        .then(() => {
          // Close modal - onExited callback will clear itemToToggle after animation
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Activate raw material failed:', error);
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
                  <AppToolTip title="Deactivate Key Raw Material">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Key Raw Material">
                    <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'materialName',
        headerName: 'Name of Key Raw Materials',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="fs-14 fw-500 text-2-color">{params.row.materialName}</h4>
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
                    <h1 className="page-heading">Manufacturing Key Raw Materials</h1>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Add New'} onClick={() => setShowAddAssessorModal(true)} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={rawMaterials?.data || []}
                    columns={columns}
                    rowCount={rawMaterials?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    loading={rawMaterialsLoading}
                    getRowId={getMasterRowId}
                    emptyTitle="No Key Raw Materials"
                    emptySubtitle="No key raw materials have been configured yet."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddManufacturingRawMaterialsModal open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditManufacturingRawMaterialsModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={getRawMaterial} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        onExited={() => setItemToToggle(null)}
        header={itemToToggle?.isActive ? 'Deactivate Key Raw Material?' : 'Activate Key Raw Material?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonDisabled={activateRawMaterialLoading || deactivateRawMaterialLoading}
        leftButtonOnClick={() => setShowToggleConfirmModal(false)}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateRawMaterialLoading || deactivateRawMaterialLoading}
        rightButtonDisabled={activateRawMaterialLoading || deactivateRawMaterialLoading}
      />
    </Layout>
  );
};

export default RawMaterials;
