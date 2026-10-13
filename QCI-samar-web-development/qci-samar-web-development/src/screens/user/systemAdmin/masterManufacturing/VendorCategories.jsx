import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppModal, AppToolTip } from '../../../../components/base';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AddManufacturingVendorCategoriesModal, EditManufacturingVendorCategoriesModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import { activateVendorCategoryAction, deactivateVendorCategoryAction, getVendorCategoryAction, listVendorCategoriesAction } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const getMasterRowId = row => row.id || row.user_id;

const ManufacturingVendorCategories = () => {
  const dispatch = useDispatch();

  const [showAddAssessorModal, setShowAddAssessorModal] = useState(false);
  const [showEditUnitAdminModal, setShowEditUnitAdminModal] = useState(false);
  const [selectedUnitAdmin, setSelectedUnitAdmin] = useState(null);
  const [_apiError, setApiError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    User: '',
    unitStatus: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const {
    drdoVendorCategories,
    drdoVendorCategoriesLoading,
    vendorCategory,
    activateVendorCategoryLoading,
    deactivateVendorCategoryLoading,
    activateVendorCategory,
    deactivateVendorCategory,
    createvendorCategory,
    updatevendorCategory,
  } = useSelector(state => state.Master);
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
    dispatch(listVendorCategoriesAction(filtersData));
  }, [dispatch, page, pageSize, filters]);

  // Refresh list when Vendor category CRUD operations complete
  useEffect(() => {
    if (activateVendorCategory || deactivateVendorCategory || createvendorCategory || updatevendorCategory) {
      const filtersData = {
        search: filters.search,
        status: filters?.unitStatus,
        perPage: pageSize,
        page: page,
      };
      dispatch(listVendorCategoriesAction(filtersData));
    }
  }, [activateVendorCategory, deactivateVendorCategory, createvendorCategory, updatevendorCategory, dispatch, filters.search, filters?.unitStatus, pageSize, page]);

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
      dispatch(getVendorCategoryAction(unitAdmin.id));
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
    if (!itemToToggle || activateVendorCategoryLoading || deactivateVendorCategoryLoading) {
      return;
    }

    const { id, isActive } = itemToToggle;

    if (isActive) {
      // Item is active, so deactivate
      dispatch(deactivateVendorCategoryAction(id))
        .then(() => {
          // Close modal - onExited callback will clear itemToToggle after animation
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Deactivate vendor category failed:', error);
        });
    } else {
      // Item is inactive, so activate
      dispatch(activateVendorCategoryAction(id))
        .then(() => {
          // Close modal - onExited callback will clear itemToToggle after animation
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Activate vendor category failed:', error);
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
                  <AppToolTip title="Deactivate Category">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Category">
                    <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'Vendor category',
        headerName: 'Category',
        sortable: false,
        flex: 1.2,
        minWidth: 150,
        renderCell: params => (
          <div className="double-content line-clamp">
            <h4 className="fs-14 fw-500 text-2-color">{params.row.categoryName}</h4>
          </div>
        ),
      },

      {
        field: 'status',
        headerName: 'Status',
        flex: 1,
        sortable: false,
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
                    <h1 className="page-heading">Categories</h1>
                  </div>
                  <div className="table-header-right">
                    <AppButton variant="primary" size="small" title={'Add New'} onClick={() => setShowAddAssessorModal(true)} />
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={drdoVendorCategories?.data || []}
                    columns={columns}
                    rowCount={drdoVendorCategories?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    loading={drdoVendorCategoriesLoading}
                    getRowId={getMasterRowId}
                    emptyTitle="No Categories"
                    emptySubtitle="No vendor categories have been configured yet."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddManufacturingVendorCategoriesModal open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditManufacturingVendorCategoriesModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={vendorCategory} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        onExited={() => setItemToToggle(null)}
        header={itemToToggle?.isActive ? 'Deactivate Category?' : 'Activate Category?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonDisabled={activateVendorCategoryLoading || deactivateVendorCategoryLoading}
        leftButtonOnClick={() => setShowToggleConfirmModal(false)}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateVendorCategoryLoading || deactivateVendorCategoryLoading}
        rightButtonDisabled={activateVendorCategoryLoading || deactivateVendorCategoryLoading}
      />
    </Layout>
  );
};

export default ManufacturingVendorCategories;
