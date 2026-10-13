import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppInput, AppTableEmpty } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import { downloadAssessmentReportAction, downloadCertificateAction } from '../../../../redux/action/common/AssessmentAction';
import { getApplicationAction } from '../../../../redux/action/unitAdmin/application/ApplicationAction';
import { getCertificatesAction } from '../../../../redux/action/unitAdmin/CertificateAction';
import { downloadPayloadAsPdf } from '../../../../utils/FileUtils';
import { formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel } from '../../../../utils/getStatusColors';
import { Logger } from '../../../../utils/logger';

// Main Documents component
const Documents = () => {
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');

  const { certificates } = useSelector(state => state.UnitAdminCertificate);
  const { applicationList } = useSelector(state => state.UnitAdminApplication);
  const { downloadLoading } = useSelector(state => state.Assessment);
  const { user } = useSelector(state => state.Account);
  const [downloadingId, setDownloadingId] = useState(null);

  const myUnitIds = useMemo(() => (user?.roles || []).filter(r => r.slug === 'unit_admin' && r.pivot?.unitId).map(r => r.pivot.unitId), [user]);

  useEffect(() => {
    const params = {
      perPage: 50,
      ...(searchQuery && { q: searchQuery }),
    };
    dispatch(getCertificatesAction(params));
  }, [dispatch, searchQuery]);

  // Load applications so we can resolve the unit name for each certificate — the
  // certificate list doesn't carry it, so match on the certificate's application id.
  useEffect(() => {
    dispatch(getApplicationAction({ perPage: 100, page: 1 }));
  }, [dispatch]);

  const unitNameByApplicationId = useMemo(() => {
    const apps = applicationList?.data || [];
    return new Map(apps.map(app => [String(app.id), app.unitName]));
  }, [applicationList]);

  const getUnitName = cert => cert?.application?.unitName || unitNameByApplicationId.get(String(cert?.application?.id)) || '-';

  // Handle search input change with debounce
  const handleSearchChange = e => {
    setSearchQuery(e.target.value);
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
  const handleReportDownload = async assessmentId => {
    if (!assessmentId) {
      return;
    }
    setDownloadingId(assessmentId);
    try {
      const result = await dispatch(downloadAssessmentReportAction(assessmentId));
      if (result?.type && result.type.endsWith('/fulfilled')) {
        const payload = result.payload ?? result;
        downloadPayloadAsPdf(payload, 'assessmentReport.pdf');
      } else {
        Logger.error('Assessment report download did not fulfill:', result);
      }
    } catch (error) {
      Logger.error('Assessment report download failed:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  const certificatesData = useMemo(() => {
    const all = certificates?.data || [];
    if (myUnitIds.length === 0) {
      return all;
    }
    return all.filter(cert => myUnitIds.includes(cert?.application?.unitId));
  }, [certificates, myUnitIds]);

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
                        placeholder="Search by application number"
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
                        <div className="col-sm-4" key={cert.id}>
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
                                  onClick={() => handleReportDownload(cert.application?.assessment?.id)}
                                  loading={downloadLoading && downloadingId === cert.application?.assessment?.id}
                                  disabled={!cert.application?.assessment?.id}
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
