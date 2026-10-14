import { useMemo, useState } from 'react';
import Icons from '../../../constants/Icons';
import { onActivate } from '../../../utils/a11y';
import { formatDate } from '../../../utils/formatters';
import { Logger } from '../../../utils/logger';
import ViewLocation from '../../../utils/ViewLocation';
import { AppButton, AppDataGrid } from '../../base';
import AppIconButton from '../../base/AppIconButton';

const ScheduleTab = ({ assessment, disabledJoinBtn }) => {
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  // The full assessor team arrives with the assessment, so paging stays client-side.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Meeting link is a service-sector-only field (online assessments).
  const isService = assessment?.application?.sector === 'service';
  const meetingLink = assessment?.meetingLink || '';

  const contactName = assessment?.application?.contactPersonName || '';
  const contactDesignation = assessment?.application?.contactPersonDesignation || '';
  const contactMobile = assessment?.application?.contactPersonMobile || '';
  const contactEmail = assessment?.application?.contactPersonEmail || '';
  const hasContact = Boolean(contactName || contactMobile || contactEmail);

  const handleCopyLink = async () => {
    try {
      if (!meetingLink) {
        return;
      }
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Logger.error('Failed to copy meeting link:', err);
    }
  };

  const handleCopyContact = async (value, field) => {
    try {
      if (!value) {
        return;
      }
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    } catch (err) {
      Logger.error('Failed to copy contact detail:', err);
    }
  };

  const handleJoinMeeting = () => {
    try {
      if (!meetingLink) {
        return;
      }
      window.open(meetingLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      Logger.error('Failed to open meeting link:', err);
    }
  };

  const rows = useMemo(
    () =>
      (assessment?.teamMembers || []).map((member, index) => ({
        id: member.userId || index + 1,
        samarId: member.samarId || '-',
        assessorName: member.name || '-',
        emailId: member.email || '-',
        location: member.location || '-',
        domain: member.department || '-',
        role: member.role || '-',
      })),
    [assessment?.teamMembers],
  );
  const columns = useMemo(
    () => [
      {
        field: 'samarId',
        headerName: 'Samar Id',
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: params => <p className="mb-0 fs-12 fw-500 text-1-color">{params.row.samarId}</p>,
      },
      {
        field: 'assessorName',
        headerName: 'Assessor Name',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => <p className="mb-0 fs-12 fw-500 text-1-color">{params.row.assessorName}</p>,
      },
      {
        field: 'emailId',
        headerName: 'Email',
        flex: 1.8,
        minWidth: 200,
        sortable: false,
        renderCell: params => <p className="mb-0 fs-12 fw-500 text-2-color">{params.row.emailId}</p>,
      },
      {
        field: 'location',
        headerName: 'Location',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => <p className="mb-0 fs-12 fw-500 text-2-color">{params.row.location}</p>,
      },

      {
        field: 'role',
        headerName: 'Role',
        flex: 1.2,
        sortable: false,
        minWidth: 140,
        renderCell: params => {
          const roleColor = params.row.role === 'lead_assessor' ? '#7239EA' : '#1B84FF';
          const roleText = params.row.role === 'lead_assessor' ? 'Lead Assessor' : 'Co-Assessor';
          const bulletClass = params.row.role === 'lead_assessor' ? 'lead-assessor-bullet' : 'co-assessor-bullet';

          return (
            <div className="d-flex align-items-center">
              <div className={bulletClass}></div>
              <span className="role-lead-assessor" style={{ color: roleColor }}>
                {roleText}
              </span>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div>
      <div className="row">
        <div className="col-12">
          <div className="details-card">
            <div className="assessment-header-section">
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <div className="schedule-icon-wrapper margin-right-16">
                    <img src={Icons.calendarBlue} alt="Process Control" className="icon-24" />
                  </div>
                  <div>
                    <h1 className="fs-16 fw-500 text-1-color mb-0">
                      {assessment?.scheduledStartDate ? formatDate(assessment.scheduledStartDate) : '-'} - {assessment?.scheduledEndDate ? formatDate(assessment.scheduledEndDate) : '-'}
                    </h1>
                    <p className="fs-12 fw-500 text-3-color mb-0 margin-top-4">Assessment Date</p>
                  </div>
                </div>

                <div className="lh-normal-18">
                  <div className="d-flex align-items-center justify-content-end cursor-pointer" {...onActivate(() => ViewLocation(assessment?.application?.unitAddress))}>
                    <span className="fs-12 fw-500 mb-0 primary-color margin-right-2 mt-0">Get Direction</span>
                    <img src={Icons.sendArrow} alt="location" className="icon-16" />
                  </div>
                  <div className="d-flex align-items-center">
                    <img src={Icons.locationGrey} alt="location" className="icon-14" />

                    <div className="fs-14 fw-400 heading-color margin-left-4">{assessment?.application?.unitAddress || '-'}</div>
                  </div>
                </div>
              </div>
              {isService && (
                <div className="seperator-top">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center">
                      <div className="schedule-icon-wrapper margin-right-16">
                        <img src={Icons.meetingIcon} alt="Meeting Link" className="icon-24" />
                      </div>
                      <div>
                        <h1 className="fs-16 fw-500 text-1-color mb-0">Meeting Link</h1>
                        <p className="fs-12 fw-500 text-3-color mb-0 margin-top-4">{meetingLink ? 'Join the online assessment meeting with the applicant' : 'No meeting link added yet'}</p>
                      </div>
                    </div>
                    {meetingLink && (
                      <div className="d-flex align-items-center gap-2">
                        <AppButton variant="primary" size="small" title="Join Meeting" leftIcon={Icons.videoIcon} onClick={handleJoinMeeting} disabled={disabledJoinBtn} />
                        <AppButton variant="secondary" size="small" title="Copy Link" onClick={handleCopyLink} />
                        {copied && <span className="fs-12 primary-color">Copied</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {hasContact && (
                <div className="seperator-top">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center">
                      <div className="schedule-icon-wrapper margin-right-16">
                        <img src={Icons.blueUser} alt="Point of Contact" className="icon-24" />
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <h1 className="fs-16 fw-500 text-1-color mb-0">{contactName || '-'}</h1>
                          <span className="fs-12 fw-500 primary-color">Point of Contact</span>
                        </div>
                        <p className="fs-12 fw-500 text-3-color mb-0 margin-top-4 text-uppercase">{contactDesignation || '-'}</p>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      {contactMobile && (
                        <div className="d-flex align-items-center gap-2">
                          <img src={Icons.callGrey} alt="Mobile" className="icon-16" />
                          <span className="fs-14 fw-500 heading-color">{contactMobile}</span>
                          <AppIconButton icon={Icons.copy} label="Copy mobile number" iconClassName="icon-16" onClick={() => handleCopyContact(contactMobile, 'mobile')} />
                          {copiedField === 'mobile' && <span className="fs-12 primary-color">Copied</span>}
                        </div>
                      )}
                      {contactMobile && contactEmail && (
                        <span className="outline-color" style={{ margin: '0 12px' }}>
                          |
                        </span>
                      )}
                      {contactEmail && (
                        <div className="d-flex align-items-center gap-2">
                          <img src={Icons.smsGrey} alt="Email" className="icon-16" />
                          <span className="fs-14 fw-500 heading-color">{contactEmail}</span>
                          <AppIconButton icon={Icons.copy} label="Copy email" iconClassName="icon-16" onClick={() => handleCopyContact(contactEmail, 'email')} />
                          {copiedField === 'email' && <span className="fs-12 primary-color">Copied</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* {isService && (
            <div className="details-card margin-top-16">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex align-items-center">
                  <div className="schedule-icon-wrapper margin-right-16">
                    <img src={Icons.meetingIcon} alt="Meeting Link" className="icon-24" />
                  </div>
                  <div>
                    <h1 className="fs-16 fw-500 text-1-color mb-0">Meeting Link</h1>
                    <p className="fs-12 fw-500 text-3-color mb-0 margin-top-4">{meetingLink ? 'Join the online assessment meeting with the applicant' : 'No meeting link added yet'}</p>
                  </div>
                </div>
                {meetingLink && (
                  <div className="d-flex align-items-center gap-2">
                    <AppButton variant="secondary" size="small" title="Copy Link" onClick={handleCopyLink} />
                    {copied && <span className="fs-12 primary-color">Copied</span>}
                    <AppButton variant="primary" size="small" title="Join" leftIcon={Icons.videoIcon} onClick={handleJoinMeeting} />
                  </div>
                )}
              </div>
            </div>
          )} */}

          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Assessors</h1>
              </div>
            </div>

            <div className="table-wrapper">
              <AppDataGrid
                rows={rows}
                columns={columns}
                server={false}
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
  );
};

export default ScheduleTab;
