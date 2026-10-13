import { Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ApplicationsList from '../../../../components/applications/ApplicationsList';
import { AppBadge, AppButton, RenewalTag } from '../../../../components/base';
import { applicationStatusOptions } from '../../../../constants/filterData';
import { getApplicationAction } from '../../../../redux/action/drdoAdmin/application/ApplicationAction';
import { resetApplicationDetails } from '../../../../redux/slices/drdoAdmin/application/ApplicationSlice';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../../utils/getStatusColors';

const selectDrdoAdminApplications = state => state.DrdoAdminApplication;
// DRDO never sees draft applications.
const drdoStatusOptions = applicationStatusOptions.filter(opt => opt.value !== 'draft');

// DRDO Admin applications list backed by the generic ApplicationsList.
// Drafts are excluded from the result set and the status filter.
// `status`/`heading` lock the list to a single status for the status-filtered views.
// `excludeStatus` defaults to 'draft'; the Active view widens it to also drop
// certified/rejected so the list matches the dashboard "Active Applications" count.
const ApplicationStatus = ({ status = '', heading = 'Applications', excludeStatus = 'draft' }) => {
  const navigate = useNavigate();

  const columns = [
    {
      field: 'action',
      headerName: 'Actions',
      flex: 0.7,
      minWidth: 110,
      sortable: false,
      renderCell: params => <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(`/my-application/application-details/${params.row.id}`)} />,
    },
    {
      field: 'applicationNumber',
      headerName: 'Application Number',
      flex: 1.5,
      minWidth: 180,
      sortable: false,
      renderCell: params => (
        <div className="double-content">
          <h4>{params.row.applicationNumber} </h4>
          <RenewalTag application={params.row} />
          <div className="d-flex align-items-center">
            <span className={`text-capitalize ${params.row.sector === 'manufacturing' ? 'primary-color' : 'badge-purple-color'}`}>{params.row.sector}</span>
            <div className="dot-separator"></div>
            <span className="fs-14 fw-500 text-2-color text-capitalize">{params.row.enterpriseClassification === 'startup' ? 'Start-Up' : params.row.enterpriseClassification}</span>
          </div>
        </div>
      ),
    },
    {
      field: 'Enterprise/Unit',
      headerName: 'Enterprise/Unit Name',
      flex: 1.5,
      minWidth: 180,
      sortable: false,
      renderCell: params => (
        <div className="double-content">
          <h4>{params.row.unitName}</h4>
          <Typography variant="body2" className="fs-12 text-3-color  line-clamp" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
            {params.row.unitAddress || '-'}
          </Typography>
        </div>
      ),
    },
    {
      field: 'applicationDate',
      headerName: 'Application Date',
      flex: 1.2,
      minWidth: 140,
      sortable: false,
      renderCell: params => <span className="text-1-color fw-600">{formatDate(params.row.createdAt)}</span>,
    },
    {
      field: 'applicantStatus',
      headerName: 'Application Status',
      flex: 1.2,
      minWidth: 140,
      sortable: false,
      renderCell: params => <AppBadge variant={getBadgeVariantByLabel(params.row?.status) || '-'} label={params.row?.applicantStatusLabel ?? getStatusLabel(params.row?.status)} />,
    },
    {
      field: 'assessmentDate',
      headerName: 'Assessment Date',
      flex: 1,
      minWidth: 120,
      sortable: false,
      renderCell: params => {
        const start = params.row.assessmentScheduledStartDate;
        const endDate = params.row.assessmentScheduledEndDate;
        const formattedStart = start ? formatDate(start) : '-';
        const formattedEnd = endDate ? formatDate(endDate) : '-';
        const formatted = formattedStart === '-' && formattedEnd === '-' ? '-' : `${formattedStart} - ${formattedEnd}`;
        return (
          <div className="double-content">
            <p className="mb-0 fs-12 fw-500 text-2-color">{formatted}</p>
          </div>
        );
      },
    },
  ];

  return (
    <ApplicationsList
      heading={heading}
      status={status}
      selector={selectDrdoAdminApplications}
      fetchAction={getApplicationAction}
      resetAction={resetApplicationDetails}
      columns={columns}
      statusOptions={drdoStatusOptions}
      extraParams={{ excludeStatus }}
    />
  );
};

export default ApplicationStatus;
