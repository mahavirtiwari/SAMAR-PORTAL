import { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import AppSettings from '../../appsettings';
import BrandLogo from '../../components/base/BrandLogo';
import Images from '../../constants/Images';
import publicClient from '../../services/api/clients/publicClient';
import { Logger } from '../../utils/logger';

const DETAIL_ROWS = [
  { label: 'Certificate Number', keys: ['certificateNumber'] },
  { label: 'Name of Enterprise', keys: ['organizationName'] },
  { label: 'Name of Unit', keys: ['unitName'] },

  { label: 'Address', keys: ['address'] },
  { label: 'District', keys: ['district'] },
  { label: 'State', keys: ['state'] },
  { label: 'Pincode', keys: ['pincode'] },
  { label: 'Rating', keys: ['ratingLabel'] },
  { label: 'Date of certification', keys: ['validFrom'] },

  { label: 'Validity', keys: ['validUntil'] },
];

const SUMMARY_ROW_LABELS = ['Name of Enterprise', 'Name of Unit', 'Scope', 'Address', 'District', 'State', 'Pincode', 'Rating', 'Status', 'Date of certification', 'Validity'];

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

  if (label.includes('Valid') || label.includes('Date')) {
    const formatted = formatDate(value);
    return formatted === '-' ? value : formatted;
  }

  return value;
};

const STATUS_STYLES = {
  active: { bg: 'var(--success-primary)', color: '#fff', label: 'Active' },
  expired: { bg: 'var(--warning-active)', color: '#fff', label: 'Expired' },
  suspended: { bg: 'var(--warning-primary)', color: '#fff', label: 'Suspended' },
  revoked: { bg: 'var(--danger-primary)', color: '#fff', label: 'Revoked' },
  renewed: { bg: 'var(--info-primary)', color: '#fff', label: 'Renewed' },
};

const formatDate = value => {
  if (!value) {
    return '-';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const StatusBadge = ({ status }) => {
  const style = STATUS_STYLES[status] || { bg: 'var(--text-3-color, #6c757d)', color: '#fff', label: status || 'Unknown' };
  return (
    <span className="fs-14 fw-600" style={{ backgroundColor: style.bg, color: style.color, padding: '6px 14px', borderRadius: '999px', display: 'inline-block', letterSpacing: '0.3px' }}>
      {style.label}
    </span>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center py-3" style={{ borderBottom: '1px solid var(--border-color, #e9ecef)', gap: 6 }}>
    <p className="fs-14 fw-500 text-2-color mb-0">{label}</p>
    <p className="fs-16 fw-600 text-1-color mb-0 text-md-end">{value || '-'}</p>
  </div>
);

const StateWrapper = ({ children }) => (
  <section className="certified-enterprise">
    <Container fluid className="d-flex flex-column align-items-center justify-content-center min-vh-100 py-5">
      <div className="d-flex align-items-center gap-3 mb-4">
        <BrandLogo brandKey="drdo_logo" fallback={Images.defenceResearch} alt="Defence Research" className="logo50" />
        <BrandLogo brandKey="qci_logo" fallback={Images.qualityCouncil} alt="Quality Council" className="logo50" />
      </div>
      <BrandLogo brandKey="samar_logo" fallback={Images.samarLogo} alt="SAMAR Logo" className="samarLogo mb-3" />
      <h1 className="fs-24 fw-600 primary-color mb-4 text-center">Certificate Verification</h1>
      {children}
      <p className="fs-12 fw-500 text-3-color mt-5">Build Version - {AppSettings.VERSION}</p>
    </Container>
  </section>
);

const Card = ({ children }) => (
  <div className="w-100" style={{ maxWidth: 640, background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid var(--border-color, #e9ecef)', padding: '32px' }}>
    {children}
  </div>
);

const _NeutralIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6c757d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const Spinner = () => (
  <div
    style={{
      width: 48,
      height: 48,
      border: '4px solid var(--border-color, #e9ecef)',
      borderTopColor: 'var(--info-dark, #3278B9)',
      borderRadius: '50%',
      animation: 'spin 0.9s linear infinite',
    }}
  />
);

const CertifiedEnterprise = () => {
  const [searchParams] = useSearchParams();
  const certificateNumber = searchParams.get('certificateNumber');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const detailRows = DETAIL_ROWS.map(row => ({
    label: row.label,
    value: formatDetailValue(row.label, getValueByKeys(data, row.keys)),
  }));

  const summaryRows = detailRows.filter(row => SUMMARY_ROW_LABELS.includes(row.label));

  useEffect(() => {
    if (!certificateNumber) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await publicClient.get('/verify-certificate', {
          params: { certificateNumber },
        });
        if (cancelled) {
          return;
        }
        const payload = response?.data?.data || response?.data || null;
        if (!payload || !payload.organizationName) {
          setData(null);
        } else {
          setData(payload);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        Logger.error('Verify certificate failed:', err);
        setData(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [certificateNumber]);

  // Inline keyframes for spinner
  const keyframes = `@keyframes spin { to { transform: rotate(360deg); } }`;

  if (loading) {
    return (
      <StateWrapper>
        <style>{keyframes}</style>
        <Card>
          <div className="d-flex flex-column align-items-center py-4 gap-3">
            <Spinner />
            <p className="fs-16 fw-500 text-1-color mb-0">Verifying certificate...</p>
          </div>
        </Card>
      </StateWrapper>
    );
  }

  // if (error === 'missing') {
  //   return (
  //     <StateWrapper>
  //       <Card>
  //         <div className="d-flex flex-column align-items-center text-center py-3 gap-3">
  //           <NeutralIcon />
  //           <h2 className="fs-20 fw-600 text-1-color mb-1">No certificate number provided</h2>
  //           <p className="fs-14 fw-500 text-2-color mb-0">Please use a valid verification link containing a certificate number.</p>
  //         </div>
  //       </Card>
  //     </StateWrapper>
  //   );
  // }

  // if (error === 'not_found' || !data) {
  //   return (
  //     <StateWrapper>
  //       <Card>
  //         <div className="d-flex flex-column align-items-center text-center py-3 gap-3">
  //           <NeutralIcon />
  //           <h2 className="fs-20 fw-600 text-1-color mb-1">Certificate not found or invalid</h2>
  //           <p className="fs-14 fw-500 text-2-color mb-0">
  //             We could not verify a certificate with the number <span className="fw-600 text-1-color">{certificateNumber}</span>. Please check the link and try again.
  //           </p>
  //         </div>
  //       </Card>
  //     </StateWrapper>
  //   );
  // }

  return (
    <StateWrapper>
      <Card>
        <div className="d-flex justify-content-between align-items-start mb-3 gap-3 flex-wrap">
          <div>
            <p className="fs-12 fw-600 text-3-color mb-1" style={{ letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Certificate Number
            </p>
            <p className="fs-18 fw-700 text-1-color mb-0">{certificateNumber}</p>
          </div>
          <StatusBadge status={data?.status} />
        </div>

        <div className="mt-2">
          {summaryRows.map(row => (
            <InfoRow key={row.label} label={row.label} value={row.label.includes('Valid') ? formatDate(row.value) : row.value} />
          ))}
        </div>

        <p className="fs-12 fw-500 text-3-color mb-0 mt-4 text-center">This certificate has been issued and verified by SAMAR, Quality Council of India in partnership with DRDO.</p>
      </Card>
    </StateWrapper>
  );
};

export default CertifiedEnterprise;
