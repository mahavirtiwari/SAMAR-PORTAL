import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppInput, AppToolTip } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { useListFilters } from '../../../../hooks';
import { getAllUsersAction } from '../../../../redux/action/common/UnitAdminAction';
import { listAssessorDomainsAction } from '../../../../redux/action/master/MasterAction';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';

const getAssessorRowId = row => row.id || row.user_id;

const Assessors = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [_showAddAssessorModal, _setShowAddAssessorModal] = useState(false);
  const [_showEditAssessorModal, setShowEditAssessorModal] = useState(false);
  const [selectedAssessor, _setSelectedAssessor] = useState(null);
  const [_apiError, _setApiError] = useState('');
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

  const { user } = useSelector(state => state.Account);
  const { userList, userListLoading, userDetails, userAccountActivate, userAccountDeactivate } = useSelector(state => state.UnitAdmin);
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
      organizationId: user?.organization?.id,
      perPage: pageSize,
      page: page,
    };
    dispatch(getAllUsersAction(filtersData));
  }, [dispatch, user?.organization?.id, appliedQuery, page, pageSize, userAccountActivate, userAccountDeactivate]);

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

  // Open edit modal when userDetails data is received
  useEffect(() => {
    if (userDetails && selectedAssessor) {
      setShowEditAssessorModal(true);
    }
  }, [userDetails, selectedAssessor]);

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1,
        minWidth: 180,
        sortable: false,
        renderCell: params => {
          // Check actual user status instead of local toggle state

          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/assessors/assessor-details/${params.row.id}`)} />
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
        minWidth: 100,
        sortable: false,
        renderCell: params => <h4 className="fs-12 fw-500 text-2-color mb-0">{params.row.mobileNumber || '-'}</h4>,
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
    [navigate],
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
                    placeholder="Search by name, email"
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
                rows={userList?.data}
                loading={userListLoading}
                columns={columns}
                rowCount={userList?.pagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                getRowId={getAssessorRowId}
                emptyTitle="No Assessors"
                emptySubtitle="Assessors have not been added to the system yet."
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Assessors;
