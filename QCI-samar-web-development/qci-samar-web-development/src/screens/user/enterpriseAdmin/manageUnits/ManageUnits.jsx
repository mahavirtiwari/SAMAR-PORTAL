import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppInput } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { getAllUsersAction } from '../../../../redux/action/common/UnitAdminAction';
import { getAllUnitsAction } from '../../../../redux/action/enterpriseAdmin/unit/UnitAction';

const ManageUnits = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    unitAdmin: '',
    unitStatus: '',
  });
  // /units always paginates (server default 15), so paging has to be server-side.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { user } = useSelector(state => state.Account);

  const { unitList, unitListPagination, unitListLoading } = useSelector(state => state.Unit);
  const { userList } = useSelector(state => state.UnitAdmin);
  const unitStatusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    // Paging is server-side now, so a narrower result set must start from the first page.
    setPage(1);
  };

  const handleReset = () => {
    setFilters({
      search: '',
      unitAdmin: '',
      unitStatus: '',
    });
    setPage(1);
  };

  const handleAddNewUnit = () => {
    navigate('/add-new-unit');
  };

  useEffect(() => {
    const filtersData = {
      search: '',
      role: 'unit_admin',
      status: '',
      isActive: true,
      organizationId: user?.organization?.id,
    };
    dispatch(getAllUsersAction(filtersData));
  }, [dispatch, user?.roles, user.organization.id]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const filtersData = {
        search: filters?.search,
        status: filters?.unitStatus,
        organizationId: user.organization.id,
        unitAdmin: filters?.unitAdmin,
        perPage: pageSize,
        page: page,
      };
      dispatch(getAllUnitsAction(filtersData));
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [dispatch, user.organization.id, filters.search, filters.unitAdmin, filters.unitStatus, page, pageSize]);

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1,
        minWidth: 130,
        sortable: false,
        renderCell: params => (
          <div style={{ display: 'flex', gap: '8px' }}>
            <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/units/unit-details/${params.row.id}`)} />

            <div className="table-icon-button" onClick={() => navigate(`/units/edit-unit/${params.row.id}`)}>
              <img className="icon-14" src={Icons.edit} alt="Edit" />
            </div>
          </div>
        ),
      },
      { field: 'name', sortable: false, headerName: 'Enterprise/Unit Name', flex: 1.5, minWidth: 180 },
      { field: 'address', sortable: false, headerName: 'Address', flex: 2, minWidth: 200 },
      { field: 'district', sortable: false, headerName: 'District', flex: 1, minWidth: 120 },
      { field: 'state', sortable: false, headerName: 'State', flex: 1, minWidth: 100 },
      {
        field: 'unitAdmin',
        sortable: false,
        headerName: 'Unit Admin',
        flex: 1.2,
        minWidth: 140,
        renderCell: params => <p className="mb-0 fs-12 fw-500 text-2-color">{params.row?.unitAdmins[0]?.name || '-'}</p>,
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 1,
        minWidth: 100,
        renderCell: params => <AppBadge variant={params.row.status === 'active' ? 'green' : 'red'} label={params.value} />,
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
                <h1 className="page-heading">Manage Units</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    placeholder="Search by user"
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
                <AppButton variant="primary" size="small" title={'Add Unit'} onClick={handleAddNewUnit} />
              </div>
            </div>

            {/* Filter Section */}
            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="unitAdmin"
                      value={filters.unitAdmin}
                      onChange={e => handleFilterChange('unitAdmin', e.target.value)}
                      options={userList?.users?.map(user => ({ value: user.id, label: user.fullName })) || []}
                      label="Unit Admin"
                      placeholder="Select Unit Admin"
                    />
                  </div>

                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="unitStatus"
                      value={filters.unitStatus}
                      onChange={e => handleFilterChange('unitStatus', e.target.value)}
                      options={unitStatusOptions}
                      label="Unit Status"
                      placeholder="Select Unit Status"
                    />
                  </div>
                </div>

                <div
                  className="filter-actions"
                  style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-start',
                  }}>
                  <AppButton variant="tertiary" size="small" title="Reset" onClick={handleReset} leftIcon={Icons.closeCircle} leftIconStyle={'icon-14'} />
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <AppDataGrid
                rows={unitList}
                columns={columns}
                rowCount={unitListPagination?.total || 0}
                loading={unitListLoading}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                emptyTitle="No Units"
                emptySubtitle="There are currently no units to display."
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ManageUnits;
