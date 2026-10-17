import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppInput, AppModal, AppToolTip } from '../../../../../components/base';
import { toastError } from '../../../../../components/base/toast';
import { Layout } from '../../../../../components/layout';
import { AddAssessorsModal, EditAssessorsModal } from '../../../../../components/modals';
import ContactDetailsCell from '../../../../../components/shared/ContactDetailsCell';
import ResendPasswordButton from '../../../../../components/shared/ResendPasswordButton';
import Icons from '../../../../../constants/Icons';
import { useListFilters } from '../../../../../hooks';
import { activateUserAccountAction, deactivateUserAccountAction, getAllUsersAction, getUserDetailsAction } from '../../../../../redux/action/common/UnitAdminAction';
import { listAssessorDomainsAction } from '../../../../../redux/action/master/MasterAction';
import { resetUserDetails } from '../../../../../redux/slices/common/UnitAdminSlice';
import { getBadgeVariantByLabel } from '../../../../../utils/getStatusColors';
import { Logger } from '../../../../../utils/logger';

const getUserRowId = row => row.id || row.user_id;

const Assessors = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [showAddAssessorModal, setShowAddAssessorModal] = useState(false);
  const [showEditUnitAdminModal, setShowEditUnitAdminModal] = useState(false);
  const [selectedUnitAdmin, setSelectedUnitAdmin] = useState(null);
  const [_apiError, setApiError] = useState('');
  // Filters and pagination are held in the URL so returning from a detail page
  // restores the list the user had filtered down to.
  const { filters, setFilters, appliedFilters, appliedQuery, setAppliedFilters, page, setPage, pageSize, setPageSize, resetFilters } = useListFilters({
    search: '',
    samarId: '',
    domainId: '',
    unitStatus: '',
  });
  // Reopen the filter panel on return when a filter is active, so the restored list shows what it is filtered by.
  const [showFilters, setShowFilters] = useState(() => Object.entries(appliedFilters).some(([key, value]) => key !== 'search' && value !== '' && value != null));
  const [dropdownResetKey, setDropdownResetKey] = useState(0);
  const [showToggleConfirmModal, setShowToggleConfirmModal] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);
  const [toggleReason, setToggleReason] = useState('');

  const { userList, userListLoading, userDetails, userAccountActivateLoading, userAccountDeactivateLoading, userAccountActivate, userAccountDeactivate } = useSelector(state => state.UnitAdmin);
  const { assessorDomains } = useSelector(state => state.Master);

  const domainOptions = Array.isArray(assessorDomains?.data) ? assessorDomains.data.map(domain => ({ value: domain.id, label: domain.domainName })) : [];

  // Load the assessor-domain master list for the Domain filter dropdown
  useEffect(() => {
    dispatch(listAssessorDomainsAction({ isActive: true, page: 1, perPage: 1000 }));
  }, [dispatch]);

  // Fetch assessors whenever a filter is committed (via search debounce or Apply) or pagination changes
  useEffect(() => {
    const filtersData = {
      search: (appliedQuery.search || '').trim(),
      samarId: (appliedQuery.samarId || '').trim(),
      domainId: appliedQuery.domainId,
      role: 'assessor',
      status: appliedQuery.unitStatus,
      perPage: pageSize,
      page: page,
    };
    dispatch(getAllUsersAction(filtersData));
  }, [dispatch, appliedQuery, page, pageSize, userAccountActivate, userAccountDeactivate]);

  // Auto-commit the top search box after the user stops typing; panel filters commit on Apply.
  // The equality check matters on mount: without it this would fire once with the value
  // restored from the URL and send the user back to page 1, undoing the page they returned to.
  useEffect(() => {
    const typed = filters.search || '';
    if (typed === appliedFilters.search) {
      return undefined;
    }

    const id = setTimeout(() => {
      setAppliedFilters(prev => ({ ...prev, search: typed }));
      setPage(1);
    }, 300);

    return () => clearTimeout(id);
  }, [filters.search, appliedFilters.search, setAppliedFilters, setPage]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      search: filters.search,
      samarId: filters.samarId,
      domainId: filters.domainId,
      unitStatus: filters.unitStatus,
    });
    setPage(1);
  };

  const handleResetFilters = () => {
    resetFilters();
    setDropdownResetKey(prev => prev + 1);
  };

  const handleGeneralError = error => {
    setApiError(error);
    toastError(error);
  };

  // Open edit modal when userDetails data is received
  useEffect(() => {
    if (userDetails && selectedUnitAdmin) {
      setShowEditUnitAdminModal(true);
    }
  }, [userDetails, selectedUnitAdmin]);

  const handleCloseModal = () => {
    setShowAddAssessorModal(false);
  };

  const handleEditUnitAdmin = useCallback(
    unitAdmin => {
      setSelectedUnitAdmin(unitAdmin);
      dispatch(getUserDetailsAction(unitAdmin.id));
    },
    [dispatch],
  );

  const handleCloseEditModal = () => {
    setShowEditUnitAdminModal(false);
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
          // Close modal - onExited callback will clear userToToggle after animation
          setShowToggleConfirmModal(false);
        })
        .catch(error => {
          Logger.error('Deactivate user failed:', error);
        });
    } else {
      // User is inactive, so activate
      dispatch(activateUserAccountAction(id))
        .then(() => {
          // Close modal - onExited callback will clear userToToggle after animation
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
        minWidth: 210,
        sortable: false,
        renderCell: params => {
          const rowId = params.row?.id || params.row?.user_id;
          // Check actual user status instead of local toggle state
          const isUserActive = params.row?.isActive ?? params.row?.status === 'active' ?? true;

          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/assessors/assessor-details/${params.row.id}`)} />
              <div style={{ display: 'flex', gap: '8px' }}>
                {params.row.status === 'invited' ? null : (
                  <AppToolTip title="Edit Assessor">
                    <AppButton
                      variant="secondary"
                      size="extraSmall"
                      leftIconStyle={'icon-14 me-0'}
                      leftIcon={Icons.edit}
                      buttonPaddingX="0"
                      minWidth={30}
                      onClick={() => handleEditUnitAdmin(params.row)}
                    />
                  </AppToolTip>
                )}
              </div>
              {params.row.status === 'invited' ? null : (
                <div className="toggle-btns d-flex">
                  {isUserActive ? (
                    <AppToolTip title="Deactivate Assessor">
                      <Image src={Icons.active} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, true, params.row.fullName || params.row.user)} />
                    </AppToolTip>
                  ) : (
                    <AppToolTip title="Activate Assessor">
                      <Image src={Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => handleToggle(rowId, false, params.row.fullName || params.row.user)} />
                    </AppToolTip>
                  )}
                </div>
              )}
              {params.row.status === 'invited' || isUserActive ? <ResendPasswordButton user={params.row} /> : null}
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
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="fs-14 fw-500 text-2-color">{params.row.fullName || params.row.user}</h4>
            <span className="fs-12 fw-400 text-3-color">{params.row.username || ''}</span>
          </div>
        ),
      },

      {
        field: 'contact',
        headerName: 'Contact Details',
        flex: 2,
        minWidth: 220,
        sortable: false,
        renderCell: params => <ContactDetailsCell email={params.row.email} mobile={params.row.mobileNumber} />,
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
    [navigate, handleEditUnitAdmin, handleToggle],
  );
  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Assessors</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    placeholder="SAMAR ID, name, email or mobile"
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
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
                <AppButton variant="primary" size="small" title={'Add Assessor'} onClick={() => setShowAddAssessorModal(true)} />
              </div>
            </div>

            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppInput
                      label="SAMAR ID"
                      name="samarId"
                      value={filters.samarId}
                      onChange={e => handleFilterChange('samarId', e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleApplyFilters();
                        }
                      }}
                      placeholder="Search by SAMAR ID"
                      customWidth="100%"
                    />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="domainId"
                      value={filters.domainId}
                      onChange={e => handleFilterChange('domainId', e.target.value)}
                      options={domainOptions}
                      label="Domain"
                      resetKey={dropdownResetKey}
                    />
                  </div>
                </div>

                <div className="filter-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
                  <AppButton variant="primary" size="small" title="Apply Filters" leftIcon={Icons.searchWhite} leftIconStyle={'icon-14'} onClick={handleApplyFilters} />
                  <AppButton variant="tertiary" size="small" title="Reset" onClick={handleResetFilters} leftIcon={Icons.closeCircle} leftIconStyle={'icon-14'} />
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <AppDataGrid
                rows={userList?.data || []}
                loading={userListLoading}
                columns={columns}
                rowCount={userList?.pagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                getRowId={getUserRowId}
                emptyTitle="No Assessors"
                emptySubtitle="Assessors have not been added to the system yet."
              />
            </div>
          </div>
        </div>
      </div>
      <AddAssessorsModal open={showAddAssessorModal} handleClose={handleCloseModal} onGeneralError={handleGeneralError} />

      <EditAssessorsModal open={showEditUnitAdminModal} handleClose={handleCloseEditModal} data={userDetails} onGeneralError={handleGeneralError} />

      <AppModal
        modalHeaderStyle={{ backgroundColor: userToToggle?.isActive ? 'var(--danger-light)' : 'var(--success-light)' }}
        image={userToToggle?.isActive ? Icons.rejectIcon : Icons.successCircle}
        show={showToggleConfirmModal}
        onExited={() => setUserToToggle(null)}
        header={userToToggle?.isActive ? 'Deactivate Assessor?' : 'Activate Assessor?'}
        subHeader={userToToggle?.isActive ? 'This will no longer be available for selection across the platform.' : 'This will be available for selection across the platform.'}
        twoButtons
        leftButton={'Cancel'}
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => setShowToggleConfirmModal(false)}
        rightButton={userToToggle?.isActive ? 'Deactivate' : 'Activate'}
        rightButtonClassName={`w-100 ${userToToggle?.isActive ? 'danger-primary' : 'primary'}`}
        textAreaLabel={userToToggle?.isActive ? 'Reason for deactivation' : undefined}
        textAreaPlaceholder="Why is this assessor being deactivated?"
        isRequiredTextArea
        textAreaValue={toggleReason}
        onTextAreaChange={e => setToggleReason(e.target.value)}
        textAreaHelperText="Kept in the history (at least 5 characters)."
        rightButtonOnClick={confirmToggleUser}
        rightButtonLoading={userAccountActivateLoading || userAccountDeactivateLoading}
        rightButtonDisabled={userAccountActivateLoading || userAccountDeactivateLoading || (userToToggle?.isActive && toggleReason.trim().length < 5)}
      />
    </Layout>
  );
};

export default Assessors;
