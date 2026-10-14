import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { AppBadge, AppDataGrid, AppInput } from '../../../../components/base';
import AppIconButton from '../../../../components/base/AppIconButton';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { getApplicationAction } from '../../../../redux/action/enterpriseAdmin/application/ApplicationAction';
import { getUnitDetailsAction } from '../../../../redux/action/enterpriseAdmin/unit/UnitAction';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../../utils/getStatusColors';

const columns = [
  {
    field: 'applicationNo',
    headerName: 'Application Number',
    flex: 1.5,
    minWidth: 180,
    sortable: false,
    renderCell: params => <p className="mb-0 fs-12 fw-500 text-1-color">{params.row.applicationNumber}</p>,
  },
  {
    field: 'applicationDate',
    headerName: 'Application Date',
    flex: 1,
    minWidth: 140,
    sortable: false,
    renderCell: params => <p className="mb-0 fs-12 fw-500 text-2-color">{formatDate(params.row.createdAt)}</p>,
  },
  {
    field: 'applicationStatus',
    headerName: 'Application Status',
    flex: 1.2,
    minWidth: 160,
    sortable: false,
    renderCell: params => <AppBadge variant={getBadgeVariantByLabel(params.row.status) || 'grey'} label={params.row.applicantStatusLabel ?? getStatusLabel(params.row.status)} />,
  },
  {
    field: 'assessmentDate',
    headerName: 'Assessment Date',
    flex: 1,
    minWidth: 140,
    sortable: false,
    renderCell: params => {
      const start = params.row.assessmentScheduledStartDate;
      const end = params.row.assessmentScheduledEndDate;
      if (start || end) {
        const formattedStart = start ? formatDate(start) : '-';
        const formattedEnd = end ? formatDate(end) : '-';
        return <p className="mb-0 fs-12 fw-500 text-2-color">{`${formattedStart} - ${formattedEnd}`}</p>;
      }
      return <p className="mb-0 fs-12 fw-500 text-2-color">{params.row.assessmentDate ? formatDate(params.row.assessmentDate) : '-'}</p>;
    },
  },
  {
    field: 'rating',
    headerName: 'Rating',
    flex: 1,
    minWidth: 120,
    sortable: false,
    renderCell: params => <p className="mb-0 fs-12 fw-500 text-1-color">{params.row.rating || '-'}</p>,
  },
];
const UnitDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const { getUnitDetail } = useSelector(state => state.Unit);
  const { applicationList } = useSelector(state => state.EnterpriseAdminApplication);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const unitDetail = getUnitDetail?.unit;
  useEffect(() => {
    if (id) {
      dispatch(getUnitDetailsAction(id));
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (!id) {
      return;
    }
    // Scoped to this unit — without unitId the endpoint returns every application in the
    // organisation, which would read as the unit's own on this screen.
    const filtersData = {
      status: null,
      type: null,
      q: debouncedSearch || null,
      unitId: id,
      perPage: pageSize,
      page: page,
    };
    dispatch(getApplicationAction(filtersData));
  }, [dispatch, id, page, pageSize, debouncedSearch]);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);
  // Format commencementDate
  const formattedCommencementDate = unitDetail?.commencementDate ? formatDate(unitDetail.commencementDate) : '';
  return (
    <Layout
      subHeader={
        <div className="subHeaderWrapper">
          <div className="subHeaderLeft">
            <div className="subHeaderLeftBox">
              <AppIconButton icon={Icons.back} label="Go back" iconClassName="icon-24" onClick={() => navigate(-1)} />
              <div className="heading-seperator"></div>
              <h1 className="heading-createApp">Unit Details</h1>
            </div>
            <div className="subHeaderRightBx">
              <ul className="breadCrumbHeader">
                <li className="margin-left-30">Manage Units</li>
                <div className="dot-separator" />
                <li>Unit Details</li>
              </ul>
              <AppBadge variant="green" label={unitDetail?.status} className="margin-left-30" />
            </div>
          </div>
        </div>
      }>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="details-card">
                <div className="top-details-card-content">
                  <div className="top-right-details-card">
                    <div className="rowBetween">
                      <div>
                        <h4 className="fs-24 fw-600 heading-color mb-0">{unitDetail?.name}</h4>
                        <div className="d-flex align-items-center margin-top-8">
                          <img src={Icons.location} alt="location" className="icon-18 margin-right-4" />
                          <p className="fs-12 fw-500 text-2-color mb-0">{unitDetail?.address}</p>
                        </div>
                      </div>
                      <div className="date-commencement-container">
                        <p className="fs-12 fw-500 text-3-color mb-0">Date of Commencement</p>
                        <p className="fs-14 fw-500 heading-color mb-0">{formattedCommencementDate}</p>
                      </div>
                    </div>

                    <ul className="enterpriseInfoUl enterpriseInfoHorizontalUl margin-top-16">
                      <li>
                        <img src={Icons.call} alt="mobile" className="icon-18 margin-right-4" />
                        <p className="mb-0 fs-12 fw-500 text-3-color">Mobile Number:</p>
                        <p className="mb-0 fs-12 fw-500 text-1-color margin-left-4">{unitDetail?.mobileNumber}</p>
                      </li>
                      <li>
                        <img src={Icons.landline} alt="landline" className="icon-18 margin-right-4" />
                        <p className="mb-0 fs-12 fw-500 text-3-color">Landline Number:</p>
                        <p className="mb-0 fs-12 fw-500 text-1-color margin-left-4">{unitDetail?.landlineNumber}</p>
                      </li>
                      <li>
                        <img src={Icons.email} alt="email" className="icon-18 margin-right-4" />
                        <p className="mb-0 fs-12 fw-500 text-3-color">Email:</p>
                        <p className="mb-0 fs-12 fw-500 text-1-color margin-left-4">{unitDetail?.email}</p>
                      </li>
                      <li>
                        <img src={Icons.email} alt="email" className="icon-18 margin-right-4" />
                        <p className="mb-0 fs-12 fw-500 text-3-color">Alternate Email:</p>
                        <p className="mb-0 fs-12 fw-500 text-1-color margin-left-4">{unitDetail?.alternateEmail}</p>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="details-card">
                <div className="bottom-EnterpriseInfo">
                  <h5 className="heading-color">Contact Person Details</h5>
                  <ul className="enterpriseInfoUl enterpriseInfoHorizontalUl">
                    <li>
                      <img src={Icons.user} alt="" className="icon-20 margin-right-8" />
                      <p className="fs-12 fw-400 mb-0 text-3-color">Name:</p>
                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{unitDetail?.contactPersonName}</p>
                    </li>
                    <li>
                      <img src={Icons.designation} alt="" className="icon-20 margin-right-8" />
                      <p className="fs-12 fw-400 mb-0 text-3-color">Designation:</p>
                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{unitDetail?.contactPersonDesignation}</p>
                    </li>
                    <li>
                      <img src={Icons.receiver} alt="" className="icon-20 margin-right-8" />
                      <p className="fs-12 fw-400 mb-0 text-3-color">Mobile Number:</p>
                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{unitDetail?.contactPersonMobileNumber}</p>
                    </li>
                    <li>
                      <img src={Icons.email} alt="" className="icon-20 margin-right-8" />
                      <p className="fs-12 fw-400 mb-0 text-3-color">Email:</p>
                      <p className="fs-12 fw-500 mb-0 heading-color margin-left-12">{unitDetail?.contactPersonEmail}</p>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading">Applications</h1>
                    <div className="input-search-document">
                      <AppInput
                        label={'Search'}
                        inputType="search"
                        name="search"
                        customInputClass={'search-input'}
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Search by application number"
                        customWidth="100%"
                        leftIcon={Icons.search}
                        marginLeft="6px"
                      />
                    </div>
                  </div>
                </div>

                <div className="table-wrapper">
                  <AppDataGrid
                    rows={applicationList?.data}
                    columns={columns}
                    rowCount={applicationList?.pagination?.total || 0}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UnitDetails;
