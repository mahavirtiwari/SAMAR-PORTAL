import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppInput, AppModal, AppToolTip } from '../../../../../components/base';
import { toastError } from '../../../../../components/base/toast';
import { Layout } from '../../../../../components/layout';
import { AddOperationsManagerModal, EditOperationsManagerModal } from '../../../../../components/modals';
import Icons from '../../../../../constants/Icons';
import { activateUserAccountAction, deactivateUserAccountAction, getAllUsersAction, getUserDetailsAction } from '../../../../../redux/action/common/UnitAdminAction';
import { resetUserDetails } from '../../../../../redux/slices/common/UnitAdminSlice';
import { getBadgeVariantByLabel } from '../../../../../utils/getStatusColors';
import { Logger } from '../../../../../utils/logger';

const getUserRowId = row => row.id || row.user_id;

const OperationsManager = () => {
  const dispatch = useDispatch();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUnitAdmin, setSelectedUnitAdmin] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    unitStatus: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [_serverError, setServerError] = useState('');
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);
  const [toggleReason, setToggleReason] = useState('');

  const { user } = useSelector(state => state.Account);
  const { userList, userListLoading, userDetails, userAccountActivateLoading, userAccountDeactivateLoading, userAccountActivate, userAccountDeactivate } = useSelector(state => state.UnitAdmin);

  // Fetch users with search debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const filtersData = {
        search: filters.search,
        role: 'operations_manager',
        status: filters?.unitStatus,
        organizationId: user?.organization?.id,
        perPage: pageSize,
        page: page,
      };
      dispatch(getAllUsersAction(filtersData));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [dispatch, user?.organization?.id, filters.search, filters.unitStatus, page, pageSize]);

  // Refresh user list when activate/deactivate is successful
  useEffect(() => {
    if (userAccountActivate || userAccountDeactivate) {
      const filtersData = {
        search: filters.search,
        role: 'operations_manager',
        status: filters?.unitStatus,
        organizationId: user?.organization?.id,
        perPage: pageSize,
        page: page,
      };
      dispatch(getAllUsersAction(filtersData));
    }
  }, [userAccountActivate, userAccountDeactivate, dispatch, filters.search, filters.unitStatus, user?.organization?.id, pageSize, page]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGeneralError = error => {
    setServerError(error);
    toastError(error);
  };

  // Open edit modal when userDetails data is received
  useEffect(() => {
    if (userDetails && selectedUnitAdmin) {
      setShowEditModal(true);
    }
  }, [userDetails, selectedUnitAdmin]);

  const handleCloseModal = () => {
    setShowAddModal(false);
  };

  const handleEditUnitAdmin = useCallback(
    unitAdmin => {
      setSelectedUnitAdmin(unitAdmin);
      dispatch(getUserDetailsAction(unitAdmin.id));
    },
    [dispatch],
  );

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedUnitAdmin(null);
    dispatch(resetUserDetails());
  };

  const handleToggle = useCallback((rowId, isCurrentlyActive, userName) => {
    // Store user info for confirmation modal
    setUserToToggle({
      id: rowId,
      isActive: isCurrentlyActive,
      name: userName,
    });
    setToggleReason('');
    setShowToggleConfirmModal(true);
  }, []);

  const confirmToggleUser = () => {
    if (!userToToggle) {
      return;
    }

    const { id, isActive } = userToToggle;

    if (isActive) {
      // User is active, so deactivate
      dispatch(deactivateUserAccountAction({ id, reason: toggleReason.trim() }))
        .then(() => {
          // Close modal on success - useEffect will handle refresh
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Deactivate user failed:', error);
        });
    } else {
      // User is inactive, so activate
      dispatch(activateUserAccountAction(id))
        .then(() => {
          // Close modal on success - useEffect will handle refresh
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Activate user failed:', error);
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
          const rowId = params.row?.id || params.row?.user_id;
          // Check actual user status instead of local toggle state
          const isUserActive = params.row?.isActive ?? params.row?.status === 'active' ?? true;

          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              {params.row.status !== 'invited' && <AppButton variant="secondary" size="extraSmall" title={'Edit'} onClick={() => handleEditUnitAdmin(params.row)} />}
              {params.row.status !== 'invited' && (
                <div className="toggle-btns d-flex">
                  {isUserActive ? (
                    <AppToolTip title="Deactivate Operations Manager">
                      <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                    </AppToolTip>
                  ) : (
                    <AppToolTip title="Activate Operations Manager">
                      <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                    </AppToolTip>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
      {
        field: 'samarId',
        headerName: 'Samar Id',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <span className="fs-12 fw-500 heading-color">{params.row.samarId ? params.row.samarId : '-'}</span>
          </div>
        ),
      },
      {
        field: 'name',
        headerName: 'Name',
        flex: 1.2,
        minWidth: 200,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="fs-14 fw-500 text-2-color">{params.row.fullName || params.row.user}</h4>
            <span className="fs-12 fw-400 text-3-color">{params.row.username || ''}</span>
          </div>
        ),
      },
      {
        field: 'email',
        headerName: 'Email',
        flex: 1.8,
        minWidth: 200,
        sortable: false,
        renderCell: params => (
          <AppToolTip title={params.row.email || '-'}>
            <span className="text-2-color fs-12 fw-500 double-content line-clamp-1" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {params.row.email || '-'}
            </span>
          </AppToolTip>
        ),
      },

      {
        field: 'mobile',
        headerName: 'Mobile',
        flex: 1,
        minWidth: 180,
        sortable: false,
        renderCell: params => <h4 className="fs-12 fw-500 text-2-color">{params.row.mobileNumber || '-'}</h4>,
      },
      {
        field: 'assignedStates',
        headerName: 'Assigned States',
        flex: 2,
        minWidth: 250,
        sortable: false,
        renderCell: params => {
          const assignedStates = params.row.assignedStates;
          if (!assignedStates || !Array.isArray(assignedStates) || assignedStates.length === 0) {
            return <h4 className="fs-12 fw-500 text-2-color">-</h4>;
          }
          const visibleCount = 2;
          const visible = assignedStates.slice(0, visibleCount).join(', ');
          const remaining = assignedStates.length - visibleCount;
          return (
            <AppToolTip title={assignedStates.join(', ')}>
              <span className="fs-12 fw-500 text-2-color" style={{ wordBreak: 'break-word' }}>
                {visible}
                {remaining > 0 && ` +${remaining} more`}
              </span>
            </AppToolTip>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 1,
        minWidth: 100,
        sortable: false,
        renderCell: params => {
          return <AppBadge variant={getBadgeVariantByLabel(params.row?.status) || '-'} label={params.row?.status} />;
        },
      },
    ],
    [handleEditUnitAdmin, handleToggle],
  );
  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Operations Managers</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    placeholder="search by email or mobile number"
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
                  />
                </div>
              </div>
              <div className="table-header-right">
                <AppButton variant="primary" size="small" title={'Add Operations Manager'} onClick={() => setShowAddModal(true)} />
              </div>
            </div>

            <div className="table-wrapper">
              <AppDataGrid
                rows={userList?.data || []}
                columns={columns}
                rowCount={userList?.pagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                getRowId={getUserRowId}
                loading={userListLoading}
                emptyTitle="No Operations Managers"
                emptySubtitle="Operations Managers have not been added to the system yet."
              />
            </div>
          </div>
        </div>
      </div>

      <AddOperationsManagerModal open={showAddModal} handleClose={handleCloseModal} organizationId={user?.organization?.id} onGeneralError={handleGeneralError} />

      <EditOperationsManagerModal open={showEditModal} handleClose={handleCloseEditModal} data={userDetails} organizationId={user?.organization?.id} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: userToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={userToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        header={userToToggle?.isActive ? 'Deactivate Operations Manager?' : 'Activate Operations Manager?'}
        subHeader={userToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => {
          setShowToggleConfirmModal(false);
        }}
        rightButton={userToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${userToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        textAreaLabel={userToToggle?.isActive ? 'Reason for deactivation' : undefined}
        textAreaPlaceholder="Why is this operations manager being deactivated?"
        isRequiredTextArea
        textAreaValue={toggleReason}
        onTextAreaChange={e => setToggleReason(e.target.value)}
        textAreaHelperText="Kept in the history (at least 5 characters)."
        rightButtonOnClick={confirmToggleUser}
        rightButtonLoading={userAccountActivateLoading || userAccountDeactivateLoading}
        rightButtonDisabled={userAccountActivateLoading || userAccountDeactivateLoading || (userToToggle?.isActive && toggleReason.trim().length < 5)}
        onExited={() => setUserToToggle(null)}
      />
    </Layout>
  );
};

export default OperationsManager;
