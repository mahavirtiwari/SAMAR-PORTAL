import { useMemo, useState } from 'react';
import { AppButton, AppDatePicker, AppEmptyState, AppInput } from '../../components/base';
import BrandLogo from '../../components/base/BrandLogo';
import PublicHeader from '../../components/layout/PublicHeader';
import Images from '../../constants/Images';
import publicClient from '../../services/api/clients/publicClient';
import { formatDate } from '../../utils/formatters';
import { Logger } from '../../utils/logger';

const DETAIL_ROWS = [
  { label: 'Certificate Number', keys: ['certificate_number', 'certificateNumber', 'Certificate_number'] },
  { label: 'Name Of Enterprise', keys: ['enterprise_name', 'organization_name', 'Enterprise_name', 'nameOfEnterprise', 'unit_name'] },
  { label: 'Address', keys: ['registered_address', 'Registered_address', 'address', 'unit_addresss'] },
  { label: 'District', keys: ['registered_district', 'Registered_district', 'district'] },
  { label: 'State', keys: ['registered_state', 'Registered_state', 'state'] },
  { label: 'Pincode', keys: ['registered_pin', 'Registered_pin', 'pincode', 'pinCode'] },
  { label: 'Rating', keys: ['certificationLevel', 'certification_level', 'Certification_level', 'rating_label', 'ratingLabel'] },
  { label: 'Date Of Certification', keys: ['date_of_certification', 'Date_of_certification', 'valid_from', 'validFrom'] },
  { label: 'Validity', keys: ['validity', 'Validity', 'valid_until', 'validUntil'] },
];

const getValueByKeys = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') {
      return source[key];
    }
  }
  return '-';
};

const formatDetailValue = (label, value) => {
  if (!value || value === '-') {
    return '-';
  }

  if (label.includes('Date') || label === 'Validity') {
    const formattedDate = formatDate(value);
    return formattedDate === 'N/A' ? value : formattedDate;
  }

  return value;
};

const VerifyCertificate = () => {
  const [certificateNumber, setCertificateNumber] = useState('030125-11111');
  const [dateOfIssue, setDateOfIssue] = useState('2025-01-03');
  const [certificateDetails, setCertificateDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const detailRows = useMemo(
    () =>
      DETAIL_ROWS.map(row => ({
        label: row.label,
        value: formatDetailValue(row.label, getValueByKeys(certificateDetails, row.keys)),
      })),
    [certificateDetails],
  );

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');

    if (!certificateNumber.trim() || !dateOfIssue) {
      setError('Please enter certificate number and date of issue.');
      return;
    }

    setLoading(true);
    try {
      const response = await publicClient.get('/verify-certificate', {
        params: {
          certificateNumber: certificateNumber.trim(),
          dateOfIssue,
        },
      });
      const payload = response?.data?.data || response?.data || null;

      if (!payload) {
        setCertificateDetails(null);
        setError('Certificate details were not found.');
        return;
      }

      setCertificateDetails(payload);
    } catch (err) {
      Logger.error('Verify certificate failed:', err);
      setCertificateDetails(null);
      setError('Certificate details were not found. Please check the information and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="verify-certificate-page">
      <div className="verify-certificate-shell">
        <PublicHeader />
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="verify-certificate-card">
                <form className="verify-certificate-form" onSubmit={handleSubmit}>
                  <div>
                    <BrandLogo brandKey="samar_logo" fallback={Images.samarLogo} alt="SAMAR" className="verify-certificate-samar-logo" />
                  </div>
                  <h1 className="fs-32 fw-600 heading-color text-center mb-0">Verify Certificate</h1>

                  <div className="verify-certificate-fields">
                    <AppInput
                      label="Certificate Number"
                      name="certificateNumber"
                      value={certificateNumber}
                      onChange={event => setCertificateNumber(event.target.value)}
                      isRequired
                      customWidth="100%"
                      placeholder="Enter certificate number"
                    />

                    <AppDatePicker label="Date of Issue" name="dateOfIssue" value={dateOfIssue} onChange={setDateOfIssue} isRequired placeholder="Select date" customPlacement="bottom-end" />

                    {error ? <p className="fs-13 fw-500 danger-primary-color mb-0">{error}</p> : null}

                    <AppButton title="Search" type="submit" variant="primary" size="large" customClass="verify-certificate-search-btn" loading={loading} disabled={loading} />
                  </div>
                </form>

                <div className="verify-certificate-divider" />

                <section className="verify-certificate-details">
                  <h2 className="fs-20 fw-600 heading-color text-center mb-0">Certificate Details</h2>

                  <div className="verify-certificate-details-card">
                    {!certificateDetails ? (
                      <AppEmptyState
                        emptyStateImage={Images.noDocument}
                        emptyStateHeading="No certificate to display"
                        emptyStateSubHeading={`Enter a certificate number and date of\nissue above,then tap Search to view\ndetails.`}
                      />
                    ) : (
                      detailRows.map((row, index) => (
                        <div key={row.label}>
                          <div className="verify-certificate-detail-row">
                            <p className="fs-14 fw-600 text-1-color mb-0">{row.label}</p>
                            <p className="fs-14 fw-500 text-1-color mb-0">{row.value}</p>
                          </div>
                          {index < detailRows.length - 1 && <div className="verify-certificate-divider-row" />}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VerifyCertificate;
