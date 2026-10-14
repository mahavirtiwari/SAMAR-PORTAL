import { Pagination } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppInput, AppTableEmpty } from '../../../../components/base';
import { toastError, toastSuccess } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import useDebouncedValue from '../../../../hooks/useDebouncedValue';
import { downloadAssessmentReportAction, downloadCertificateAction } from '../../../../redux/action/common/AssessmentAction';
import { getRecertificationWindowSettingByKeyAction } from '../../../../redux/action/common/SystemSettingAction';
import { renewApplicationAction } from '../../../../redux/action/enterpriseAdmin/application/ApplicationAction';
import { getCertificatesAction } from '../../../../redux/action/enterpriseAdmin/CertificateAction';
import Api from '../../../../services/api';
import { fetchAllPages } from '../../../../services/api/utils/pagination';
import { downloadPayloadAsPdf } from '../../../../utils/FileUtils';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

// Cards per page: a multiple of the 3-column grid.
const CERTIFICATES_PER_PAGE = 12;

// Main Documents component
const Documents = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [page, setPage] = useState(1);
  const [applications, setApplications] = useState([]);
  const [_renewingId, setRenewingId] = useState(null);

  const { certificates } = useSelector(state => state.EnterpriseAdminCertificate);
  const { downloadLoading, downloadReportLoading } = useSelector(state => state.Assessment);
  const { recertWindowSetting } = useSelector(state => state.SystemSetting);
  const [downloadingId, setDownloadingId] = useState(null);

  const [assessmentId, setAssessmentId] = useState(null);

  useEffect(() => {
    const params = {
      perPage: CERTIFICATES_PER_PAGE,
      page,
      ...(debouncedSearch && { q: debouncedSearch }),
    };
    // Abort on change so a slow earlier response cannot overwrite a newer one.
    const request = dispatch(getCertificatesAction(params));
    return () => request.abort();
  }, [dispatch, page, debouncedSearch]);

  useEffect(() => {
    dispatch(getRecertificationWindowSettingByKeyAction('recertification_window_days'));
  }, [dispatch]);

  // Load applications so we can tell which certificates already have a renewal in progress.
  // Every page is walked: one capped page silently dropped renewal flags and unit names
  // for organisations with more than 100 applications.
  useEffect(() => {
    let active = true;
    fetchAllPages(params => Api.Application.getApplication(params))
      .then(rows => {
        if (active) {
          setApplications(rows);
        }
      })
      .catch(error => Logger.error('Failed to load applications for certificates:', error));
    return () => {
      active = false;
    };
  }, []);

  // A renewal application points back to the certificate's source application via previousApplicationId.
  // Collect the source ids of every submitted (non-draft) renewal to flag certificates whose renewal is already under way.
  const submittedRenewalSourceIds = useMemo(
    () => new Set(applications.filter(app => app?.previousApplicationId && app.status !== 'draft').map(app => String(app.previousApplicationId))),
    [applications],
  );

  const hasSubmittedRenewal = cert => submittedRenewalSourceIds.has(String(cert?.application?.id));

  // Certificate list doesn't carry the unit name yet, so resolve it by matching the
  // certificate's application id against the already-loaded applications list.
  const unitNameByApplicationId = useMemo(() => new Map(applications.map(app => [String(app.id), app.unitName])), [applications]);

  const getUnitName = cert => cert?.application?.unitName || unitNameByApplicationId.get(String(cert?.application?.id)) || '-';

  // The fetch is driven by the debounced value; a new search starts from the first page.
  const handleSearchChange = e => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  // Renewal window (in days) before expiry within which the banner is shown.
  // Sourced from the recertification_window_days system setting, with a sensible fallback.
  const DEFAULT_RENEWAL_WINDOW_DAYS = 60;
  const recertWindowValue = Number(recertWindowSetting?.value);
  const RENEWAL_WINDOW_DAYS = Number.isFinite(recertWindowValue) && recertWindowValue > 0 ? recertWindowValue : DEFAULT_RENEWAL_WINDOW_DAYS;

  // Days remaining until the certificate expires (null when no date)
  const getDaysToExpiry = validUntil => {
    if (!validUntil) {
      return null;
    }
    return dayjs(validUntil).startOf('day').diff(dayjs().startOf('day'), 'day');
  };

  // Whether to surface the renewal banner for a given certificate
  const shouldShowRenewal = cert => {
    if (!cert?.application?.id) {
      return false;
    }
    if (cert.status === 'expired') {
      return true;
    }
    if (cert.status === 'active') {
      const days = getDaysToExpiry(cert.validUntil);
      return days !== null && days <= RENEWAL_WINDOW_DAYS;
    }
    return false;
  };

  // Banner heading copy based on whether the certificate is still active
  const getRenewalHeading = status => (status === 'expired' ? 'Renew to get certified' : 'Renew to stay certified');

  // Human-readable expiry status for the renewal banner
  const getExpiryLabel = (validUntil, status) => {
    const days = getDaysToExpiry(validUntil);

    // Already expired: always show an "Expired" label regardless of the stored date
    if (status === 'expired') {
      if (days !== null && days < 0) {
        const overdue = Math.abs(days);
        return `Expired ${overdue} ${overdue === 1 ? 'day' : 'days'} ago`;
      }
      return 'Expired';
    }

    // Active: show the countdown to expiry
    if (days === null) {
      return null;
    }
    if (days > 0) {
      return `Expiring in ${days} ${days === 1 ? 'day' : 'days'}`;
    }
    if (days === 0) {
      return 'Expiring today';
    }
    const overdue = Math.abs(days);
    return `Expired ${overdue} ${overdue === 1 ? 'day' : 'days'} ago`;
  };

  // Get status label for display
  const getStatusLabel = status => {
    if (!status) {
      return '-';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleDownloadDocument = async id => {
    setDownloadingId(id);
    try {
      const result = await dispatch(downloadCertificateAction(id));

      if (result?.type && result.type.endsWith('/fulfilled')) {
        const payload = result.payload ?? result;

        const filename = `certificate.pdf`;

        downloadPayloadAsPdf(payload, filename);
      } else {
        Logger.error('Download action did not fulfill:', result);
      }
    } catch (error) {
      Logger.error('Export failed:', error);
    } finally {
      setDownloadingId(null);
    }
  };
  // Handle assessment report download - from the associated application/assessment
  const handleAssementReportDocument = async id => {
    setAssessmentId(id);
    try {
      const result = await dispatch(downloadAssessmentReportAction(id));

      if (result?.type && result.type.endsWith('/fulfilled')) {
        const payload = result.payload ?? result;

        const filename = `assessmentReport.pdf`;
        downloadPayloadAsPdf(payload, filename);
      } else {
        Logger.error('Download action did not fulfill:', result);
      }
    } catch (error) {
      Logger.error('Export failed:', error);
    }
  };

  const handleRenew = async cert => {
    const applicationId = cert?.application?.id;
    if (!applicationId) {
      toastError('Cannot renew: missing application reference.');
      return;
    }
    try {
      setRenewingId(cert.id);
      const newDraft = await dispatch(renewApplicationAction(applicationId)).unwrap();
      const draftId = newDraft?.id;
      if (!draftId) {
        toastError('Could not start renewal. Please try again.');
        return;
      }
      toastSuccess('Renewal draft created. Review and submit it to renew the certificate.');
      navigate(newDraft?.sector === 'service' ? `/draft-application/service-steps/${draftId}` : `/draft-application/manufacturing-steps/${draftId}`);
    } catch (error) {
      toastError(typeof error === 'string' ? error : error?.message || 'Failed to start renewal');
    } finally {
      setRenewingId(null);
    }
  };

  const certificatesData = certificates?.data || [];
  const certificatesLastPage = certificates?.pagination?.lastPage || 1;

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              {/* Certificates & Report Section */}
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading fw-600">Certificates & Reports</h1>
                    <div className="input-search-document">
                      <AppInput
                        label={'Search'}
                        inputType="search"
                        name="search"
                        customInputClass={'search-input'}
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Search by certificate number"
                        customWidth="100%"
                        leftIcon={Icons.search}
                        marginLeft="6px"
                      />
                    </div>
                  </div>
                </div>
                <div className="table-wrapper">
                  {certificatesData.length > 0 ? (
                    <div className="row document-card-row">
                      {certificatesData.map(cert => (
                        <div className="col-xl-4 col-lg-6 col-sm-6" key={cert.id}>
                          <div className="applicantCard">
                            <div className="certificateCard-top">
                              <div className="rowBetween">
                                <h4 className="fs-18 fw-600 heading-color mb-0">{cert.application.applicationNumber || '-'}</h4>
                                <AppBadge variant={getBadgeVariantByLabel(cert.status)} label={getStatusLabel(cert.status)} />
                              </div>
                              <div className="d-flex align-items-center margin-top-8">
                                <img src={Icons.calendarFill} alt="calendar" className="icon-18 margin-right-6" />
                                <p className="fs-12 fw-400 text-2-color mb-0">Issued Date:</p>
                                <p className="fs-14 fw-500 heading-color mb-0 margin-left-8">
                                  {formatDate(cert.validFrom)} - {formatDate(cert.validUntil)}
                                </p>
                              </div>
                              <div className="d-flex align-items-center margin-top-6">
                                <img src={Icons.buildings} alt="unit" className="icon-18 margin-right-6" style={{ filter: 'grayscale(100%)' }} />
                                <p className="fs-14 fw-500 heading-color mb-0">{getUnitName(cert)}</p>
                              </div>
                              {(hasSubmittedRenewal(cert) || shouldShowRenewal(cert)) && (
                                <div className="col-12 margin-top-12">
                                  <div className="certificate-renewalBanner">
                                    <div className="d-flex align-items-center gap-16">
                                      <div className="certificate-renewalBannerIcon">
                                        <img src={Icons.warningInfo} alt="Renewal alert" className="icon-20" />
                                      </div>
                                      <div>
                                        <div className="fs-14 fw-500 warning-active-color">{hasSubmittedRenewal(cert) ? 'Renew application has been submitted' : getRenewalHeading(cert.status)}</div>
                                        <div className="fs-12 fw-500 text-1-color">{getExpiryLabel(cert.validUntil, cert.status)}</div>
                                      </div>
                                    </div>
                                    {!hasSubmittedRenewal(cert) && <AppButton variant="primary" size="small" title={'Renew'} onClick={() => handleRenew(cert)} leftIcon={Icons.renew} />}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="certificateCard-bottom">
                              <div className="d-flex align-items-center justify-content-between gap-10">
                                <div className="d-flex align-items-center gap-8">
                                  <img src={Icons.medalStar} alt="star" className="icon-20" />
                                  <p className="fs-12 fw-400 text-3-color mb-0">Certificate:</p>
                                </div>

                                <AppButton
                                  variant="link"
                                  size="small"
                                  title="Download"
                                  leftIcon={Icons.download}
                                  onClick={() => handleDownloadDocument(cert.certificateNumber)}
                                  loading={downloadLoading && downloadingId === cert.certificateNumber}
                                />
                              </div>
                              <div className="d-flex align-items-center justify-content-between gap-10 margin-top-16">
                                <div className="d-flex align-items-center gap-8">
                                  <img src={Icons.documentText} alt="document" className="icon-20" />
                                  <p className="fs-12 fw-400 text-3-color mb-0">Assessment Report:</p>
                                </div>

                                <AppButton
                                  variant="link"
                                  size="small"
                                  title="Download"
                                  leftIcon={Icons.download}
                                  loading={downloadReportLoading && assessmentId === cert?.application?.assessment?.id}
                                  onClick={() => handleAssementReportDocument(cert?.application?.assessment?.id)}
                                  disabled={!cert?.application?.assessment?.id}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <AppTableEmpty title="No Certificates & Reports" subtitle="There are currently no certificates or reports to display." height="300px" />
                  )}
                  {certificatesLastPage > 1 && (
                    <div className="d-flex justify-content-end margin-top-16">
                      <Pagination count={certificatesLastPage} page={page} onChange={(_, value) => setPage(value)} shape="rounded" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Documents;
