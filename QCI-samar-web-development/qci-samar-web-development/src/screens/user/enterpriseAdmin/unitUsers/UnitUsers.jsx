import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDataGrid, AppInput } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { getAllUsersAction } from '../../../../redux/action/common/UnitAdminAction';
import { resetApplicationDetails } from '../../../../redux/slices/enterpriseAdmin/application/ApplicationSlice';

// Helper function to format unit address from assigned unit
const formatUnitAddress = assignedUnit => {
  if (!assignedUnit) {
    return '-';
  }
  const parts = [assignedUnit.address, assignedUnit.district, assignedUnit.state, assignedUnit.pincode].filter(Boolean);
  return parts.join(', ') || '-';
};

// Helper function to format last login date
const formatLastLogin = lastLoginAt => {
  if (!lastLoginAt) {
    return '-';
  }
  const date = new Date(lastLoginAt);
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const UnitUsers = () => {
  const dispatch = useDispatch();

  const [filters] = useState({
    applicationStartDate: '',
    applicationLastDate: '',
    assessmentStartDate: '',
    assessmentLastDate: '',
    paymentStatus: '',
    applicationStatus: '',
    rating: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { user } = useSelector(state => state.Account);
  const { userList, userListLoading } = useSelector(state => state.UnitAdmin);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const filtersData = {
      search: searchQuery || null,
      role: 'unit_admin',
      status: filters?.unitStatus,
      isActive: true,
      organizationId: user?.organization?.id,
      perPage: pageSize,
      page: page,
    };
    dispatch(getAllUsersAction(filtersData));
    dispatch(resetApplicationDetails());
  }, [dispatch, page, pageSize, searchQuery]);
  const handleSearchChange = e => {
    setSearchQuery(e.target.value);
    setPage(1);
  };
  const columns = useMemo(
    () => [
      {
        field: 'user',
        headerName: 'User',
        flex: 1.3,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-2-color">{params.row.fullName || '-'}</h4>
            <span className="fs-12 fw-400 text-3-color">{params.row.email}</span>
          </div>
        ),
      },
      {
        field: 'samarId',
        headerName: 'Samar Id',
        flex: 1,
        minWidth: 150,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <span className="fs-12 fw-500 heading-color">{params.row.samarId || '-'}</span>
          </div>
        ),
      },
      {
        field: 'contact',
        headerName: 'Contact',
        flex: 0.8,
        minWidth: 120,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-2-color">{params.row.mobileNumber || '-'}</h4>
          </div>
        ),
      },
      {
        field: 'unitAddress',
        headerName: 'Enterprise/Unit Name',
        flex: 1.5,
        minWidth: 200,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 className="text-1-color">{params.row.assignedUnit?.name || '-'}</h4>
            <h4 className="text-3-color line-clamp fs-400">{formatUnitAddress(params.row.assignedUnit)}</h4>
          </div>
        ),
      },
      {
        field: 'lastLogin',
        headerName: 'Last Login',
        flex: 1,
        minWidth: 150,
        headerAlign: 'right',
        sortable: false,
        renderCell: params => (
          <div className="table-flex-end">
            <span className="fs-12 fw-400 text-3-color">{formatLastLogin(params.row.lastLoginAt)}</span>
          </div>
        ),
      },
    ],
    [],
  );
  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Unit Users</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search by user"
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
                  />
                </div>
              </div>
            </div>

            {/* Filter Section */}

            <div className="table-wrapper">
              <AppDataGrid
                rows={userList?.data}
                columns={columns}
                rowCount={userList?.pagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                loading={userListLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UnitUsers;
