import { useEffect, useRef, useState } from 'react';
import { AppBadge, AppButton, AppInput } from '../../../../components/base';
import { toastError, toastSuccess } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import Images from '../../../../constants/Images';
import Api from '../../../../services/api';
import { formatDate } from '../../../../utils/formatters';

// Settings → Branding & Logos: replace each logo and set the link it opens.
// The built-in images shown here are the web app's bundled copies.
const BUILT_IN = {
  samar_logo: Images.samarLogo,
  sidebar_logo: Images.logo,
  drdo_logo: Images.defenceResearch,
  qci_logo: Images.qualityCouncil,
  favicon: '/favicon.ico',
};
const MAX_BYTES = 1024 * 1024;

const errorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const fieldErrors = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  return fieldErrors[0] || data?.message || fallback;
};

const LogoCard = ({ asset, onSaved, onReset }) => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [linkUrl, setLinkUrl] = useState(asset.linkUrl || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => setLinkUrl(asset.linkUrl || ''), [asset.linkUrl]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const pick = event => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) {
      return;
    }
    if (!['image/png', 'image/jpeg'].includes(chosen.type)) {
      toastError('Please choose a PNG or JPG image.');
      return;
    }
    if (chosen.size > MAX_BYTES) {
      toastError('The image must be 1 MB or smaller.');
      return;
    }
    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  };

  const dirty = !!file || (linkUrl || '') !== (asset.linkUrl || '');

  const save = async () => {
    setSaving(true);
    try {
      const updated = await Api.BrandingAdmin.update(asset.key, { image: file, linkUrl: linkUrl.trim() });
      setFile(null);
      setPreviewUrl(null);
      onSaved(updated);
      toastSuccess(`${asset.title} updated.`);
    } catch (error) {
      toastError(errorMessage(error, `Could not update ${asset.title}.`));
    } finally {
      setSaving(false);
    }
  };

  const shown = previewUrl || asset.image || BUILT_IN[asset.key];
  const darkBackground = asset.key === 'sidebar_logo';

  return (
    <div className="settings-editor-panel h-100 d-flex flex-column">
      <div className="d-flex justify-content-between align-items-start gap-2 margin-bottom-8">
        <div className="fs-16 fw-600 text-1-color">{asset.title}</div>
        {previewUrl ? <AppBadge label="Not saved" variant="yellow" /> : asset.isCustom ? <AppBadge label="Custom" variant="purple" /> : <AppBadge label="Built-in" variant="grey" />}
      </div>
      <div className="fs-13 text-3-color margin-bottom-12">{asset.description}</div>
      <div
        className="d-flex align-items-center justify-content-center rounded margin-bottom-12"
        style={{ height: 120, background: darkBackground ? 'var(--primary-dark, #1b3a7a)' : '#f5f6fa', border: '1px solid var(--outline)' }}>
        <img src={shown} alt={asset.title} style={{ maxHeight: 96, maxWidth: '90%', objectFit: 'contain' }} />
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="d-none" onChange={pick} />
      <div className="d-flex flex-wrap gap-2 margin-bottom-12">
        <AppButton title={file ? 'Choose a different image' : 'Upload new image'} variant="secondary" size="small" onClick={() => inputRef.current?.click()} />
        {file && (
          <AppButton
            title="Discard"
            variant="tertiary"
            size="small"
            onClick={() => {
              setFile(null);
              setPreviewUrl(null);
            }}
          />
        )}
      </div>
      <div className="fs-12 text-3-color margin-bottom-12">PNG or JPG, up to 1 MB. A transparent PNG works best.</div>
      {asset.key !== 'favicon' && asset.key !== 'sidebar_logo' && (
        <AppInput
          name={`link-${asset.key}`}
          label="Link URL (opens when the logo is clicked)"
          placeholder={asset.defaultLinkUrl || 'https://'}
          value={linkUrl}
          onChange={e => setLinkUrl(e.target.value)}
        />
      )}
      <div className="d-flex flex-wrap gap-2 margin-top-16 mt-auto pt-3">
        <AppButton title="Save" size="small" loading={saving} disabled={saving || !dirty} onClick={save} />
        <AppButton title="Reset to default" variant="tertiary" size="small" disabled={!asset.isCustom && (asset.linkUrl || '') === (asset.defaultLinkUrl || '')} onClick={() => onReset(asset)} />
      </div>
      {asset.updatedByName && (
        <div className="fs-12 text-3-color margin-top-8">
          Last changed by {asset.updatedByName} on {formatDate(asset.updatedAt)}
        </div>
      )}
    </div>
  );
};

const BrandingLogos = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(null);

  useEffect(() => {
    Api.BrandingAdmin.list()
      .then(list => setAssets(list || []))
      .catch(error => toastError(errorMessage(error, 'Could not load the logos.')))
      .finally(() => setLoading(false));
  }, []);

  const replace = updated => setAssets(prev => prev.map(a => (a.key === updated.key ? updated : a)));

  const confirmReset = async () => {
    const asset = resetting;
    setResetting(null);
    try {
      replace(await Api.BrandingAdmin.reset(asset.key));
      toastSuccess(`${asset.title} restored to the built-in logo.`);
    } catch (error) {
      toastError(errorMessage(error, 'Could not reset the logo.'));
    }
  };

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="margin-bottom-20">
            <h1 className="page-heading mb-1">Branding &amp; Logos</h1>
            <div className="fs-14 text-3-color">Replace a logo once and it changes everywhere it appears: the portal, emails and committee PDFs.</div>
          </div>
          {loading ? (
            <div className="fs-14 text-3-color">Loading…</div>
          ) : (
            <div className="row g-4">
              {assets.map(asset => (
                <div key={asset.key} className="col-xl-4 col-md-6 col-12">
                  <LogoCard asset={asset} onSaved={replace} onReset={setResetting} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.deleteModal}
        show={!!resetting}
        header="Reset to default?"
        subHeader="The uploaded image is removed and the built-in logo and default link are used again."
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={() => setResetting(null)}
        rightButton="Reset"
        rightButtonClassName="w-100 danger-primary"
        rightButtonOnClick={confirmReset}
      />
    </Layout>
  );
};

export default BrandingLogos;
