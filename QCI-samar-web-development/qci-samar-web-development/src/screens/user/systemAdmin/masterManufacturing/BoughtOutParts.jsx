import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppModal, AppToolTip } from '../../../../components/base';
import ListSearchBox from '../../../../components/base/ListSearchBox';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import AddBoughtOutPartModal from '../../../../components/modals/AddBoughtOutPartModal';
import EditBoughtOutPartModal from '../../../../components/modals/EditBoughtOutPartModal';
import Icons from '../../../../constants/Icons';
import { activateBoughtOutPartAction, deactivateBoughtOutPartAction, getBoughtOutPartAction, listBoughtOutPartsAction } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

const getMasterRowId = row => row.id || row.user_id;

const BoughtOutParts = () => {
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
  const { getBoughtOutPart, boughtOutParts, activateBoughtOutPartLoading, deactivateBoughtOutPartLoading, activateBoughtOutPart, deactivateBoughtOutPart } = useSelector(state => state.Master);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [itemToToggle, setItemToToggle] = useState(null);
  // Fetch list effect
  useEffect(() => {
    const filtersData = {
      search: filters.search,
      status: filters?.unitStatus,
      perPage: pageSize,
      page: page,
    };
    dispatch(listBoughtOutPartsAction(filtersData));
  }, [dispatch, page, pageSize, filters]);

  // Refresh list when activate/deactivate operations complete
  useEffect(() => {
    if (activateBoughtOutPart || deactivateBoughtOutPart) {
      const filtersData = {
        search: filters.search,
        status: filters?.unitStatus,
        perPage: pageSize,
        page: page,
      };
      dispatch(listBoughtOutPartsAction(filtersData));
    }
  }, [activateBoughtOutPart, deactivateBoughtOutPart, dispatch, filters.search, filters?.unitStatus, pageSize, page]);

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
      dispatch(getBoughtOutPartAction(unitAdmin.id));
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
    if (!itemToToggle || activateBoughtOutPartLoading || deactivateBoughtOutPartLoading) {
      return;
    }

    const { id, isActive } = itemToToggle;

    if (isActive) {
      // Item is active, so deactivate
      dispatch(deactivateBoughtOutPartAction(id))
        .then(() => {
          // Close modal - onExited callback will clear itemToToggle after animation
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Deactivate bought-out part failed:', error);
        });
    } else {
      // Item is inactive, so activate
      dispatch(activateBoughtOutPartAction(id))
        .then(() => {
          // Close modal - onExited callback will clear itemToToggle after animation
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Activate bought-out part failed:', error);
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
                  <AppToolTip title="Deactivate Bought-Out Part">
                    <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                ) : (
                  <AppToolTip title="Activate Bought-Out Part">
                    <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                  </AppToolTip>
                )}
              </div>
            </div>
          );
        },
      },
      {
        field: 'partName',
        headerName: 'Name of Bought-Out Parts',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="fs-14 fw-500 text-2-color">{params.row.partName}</h4>
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
                    <h1 className="page-heading">Manufacturing Bought-Out Parts</h1>
                    <div className="input-search-document">
                      <ListSearchBox
                        value={filters.search}
                        placeholder="Search bought-out parts"
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
                    rows={boughtOutParts?.data || []}
                    columns={columns}
                    loading={boughtOutParts?.loading}
                    rowCount={boughtOutParts?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    getRowId={getMasterRowId}
                    emptyTitle="No Bought-Out Parts"
                    emptySubtitle="No bought-out parts have been configured yet."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddBoughtOutPartModal open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditBoughtOutPartModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={getBoughtOutPart} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: itemToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={itemToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        onExited={() => setItemToToggle(null)}
        header={itemToToggle?.isActive ? 'Deactivate Bought Out Part?' : 'Activate Bought Out Part?'}
        subHeader={itemToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => setShowToggleConfirmModal(false)}
        rightButton={itemToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${itemToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        rightButtonOnClick={confirmToggleItem}
        rightButtonLoading={activateBoughtOutPartLoading || deactivateBoughtOutPartLoading}
        rightButtonDisabled={activateBoughtOutPartLoading || deactivateBoughtOutPartLoading}
        leftButtonDisabled={activateBoughtOutPartLoading || deactivateBoughtOutPartLoading}
      />
    </Layout>
  );
};

export default BoughtOutParts;
