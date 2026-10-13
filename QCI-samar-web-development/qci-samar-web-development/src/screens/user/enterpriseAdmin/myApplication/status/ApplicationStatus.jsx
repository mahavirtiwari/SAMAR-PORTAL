import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ApplicationsList from '../../../../../components/applications/ApplicationsList';
import { AppBadge, AppButton, RenewalTag } from '../../../../../components/base';
import AddApplicationModal from '../../../../../components/modals/AddApplicationModal';
import { getApplicationAction } from '../../../../../redux/action/enterpriseAdmin/application/ApplicationAction';
import { resetApplicationDetails } from '../../../../../redux/slices/enterpriseAdmin/application/ApplicationSlice';
import { formatDate } from '../../../../../utils/formatters';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../../../utils/getStatusColors';

const selectEnterpriseApplications = state => state.EnterpriseAdminApplication;

// Helper to safely convert values (string or object) to a display string
const getDisplayValue = val => {
  if (val === null || val === undefined) {
    return '-';
  }
  if (typeof val === 'string') {
    return val;
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    if (val.name) {
      return String(val.name);
    }
    if (val.title) {
      return String(val.title);
    }
    if (val.contactPersonName) {
      return String(val.contactPersonName);
    }
    if (val.applicationNumber) {
      return String(val.applicationNumber);
    }
    const primitive = Object.values(val).find(v => typeof v === 'string' || typeof v === 'number');
    if (primitive !== undefined) {
      return String(primitive);
    }
    try {
      return JSON.stringify(val);
    } catch {
      return '-';
    }
  }
  return String(val);
};

// Enterprise Admin applications list. Reuses the generic ApplicationsList and supplies
// the enterprise slice/action, columns (draft rows route to the draft steps), the
// "Apply New Application" action, and the add-application modal.
// `status`/`heading` lock the list to a single status for the Pending/Draft/etc views.
// `excludeStatus` – when set (e.g. 'draft'), the list shows every status except this one
//                   (used by the "Active" view to mean "all applications except drafts").
const ApplicationStatus = ({ status = '', heading = 'My Applications', excludeStatus = '' }) => {
  const navigate = useNavigate();
  const [openAddApplicationModal, setOpenAddApplicationModal] = useState(false);

  const columns = [
    {
      field: 'action',
      headerName: 'Actions',
      flex: 0.7,
      minWidth: 110,
      sortable: false,
      renderCell: params => (
        <AppButton
          variant="secondary"
          size="extraSmall"
          title={params.row.status === 'draft' ? 'Edit' : 'View'}
          onClick={() => {
            // For service sector, route to service-specific pages
            if (params.row.sector === 'service') {
              return params.row.status === 'draft' ? navigate(`/draft-application/service-steps/${params.row.id}`) : navigate(`/my-application/application-details/${params.row.id}`);
            }

            // Default: manufacturing or general application details
            return params.row.status === 'draft' ? navigate(`/draft-application/manufacturing-steps/${params.row.id}`) : navigate(`/my-application/application-details/${params.row.id}`);
          }}
        />
      ),
    },
    {
      field: 'applicationNo',
      headerName: 'Application Number',
      flex: 1.5,
      minWidth: 180,
      sortable: false,
      renderCell: params => {
        const classification = params.row.enterpriseClassification || '';
        return (
          <div className="double-content">
            <h4>{getDisplayValue(params.row.applicationNumber)}</h4>
            <RenewalTag application={params.row} />
            <div className="d-flex align-items-center">
              <span className={`text-capitalize ${params.row.sector === 'manufacturing' ? 'primary-color' : 'badge-purple-color'}`}>{params.row.sector || '-'}</span>
              {classification && (
                <>
                  <div className="dot-separator"></div>
                  <span className="text-3-color text-capitalize">{classification === 'startup' ? 'Start-Up' : classification}</span>
                </>
              )}
            </div>
          </div>
        );
      },
    },
    {
      field: 'unit',
      headerName: 'Enterprise/Unit Name',
      flex: 1.5,
      minWidth: 180,
      sortable: false,
      renderCell: params => {
        const unitAddress = params.row.unitAddress || '-';
        const unitName = params.row.unitName || '-';
        return (
          <div className="double-content">
            <h4 className="text-1-color">{unitName}</h4>
            <h4 className="text-3-color line-clamp fs-400"> {unitAddress}</h4>
          </div>
        );
      },
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
      selector={selectEnterpriseApplications}
      fetchAction={getApplicationAction}
      resetAction={resetApplicationDetails}
      columns={columns}
      extraParams={excludeStatus ? { excludeStatus } : {}}
      headerRight={<AppButton variant="primary" size="small" title={'Apply New Application'} onClick={() => setOpenAddApplicationModal(true)} />}
      extraContent={<AddApplicationModal open={openAddApplicationModal} handleClose={() => setOpenAddApplicationModal(false)} />}
    />
  );
};

export default ApplicationStatus;
