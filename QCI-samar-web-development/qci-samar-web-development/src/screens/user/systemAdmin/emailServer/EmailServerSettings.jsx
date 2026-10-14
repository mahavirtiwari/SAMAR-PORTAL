import { useEffect, useState } from 'react';
import { AppBadge, AppButton, AppDropdown, AppInput, AppSwitch } from '../../../../components/base';
import { toastError, toastSuccess } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import Api from '../../../../services/api';
import { formatDate } from '../../../../utils/formatters';

// Settings → Email Server: the outgoing mail (SMTP) server for all
// transactional emails. While switched off, the server's configured
// defaults (environment) are used.
const ENCRYPTION_OPTIONS = [
  { label: 'TLS / STARTTLS (usually port 587)', value: 'tls' },
  { label: 'SSL (usually port 465)', value: 'ssl' },
  { label: 'None', value: 'none' },
];

const errorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const fieldErrors = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  return fieldErrors[0] || data?.message || fallback;
};

const toForm = data => ({
  enabled: !!data.enabled,
  host: data.host || '',
  port: data.port ? String(data.port) : '587',
  encryption: data.encryption || 'tls',
  username: data.username || '',
  password: '',
  fromAddress: data.fromAddress || '',
  fromName: data.fromName || '',
});

const EmailServerSettings = () => {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [testTo, setTestTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    Api.MailSettings.get()
      .then(data => {
        setSettings(data);
        setForm(toForm(data));
      })
      .catch(error => toastError(errorMessage(error, 'Could not load the email server settings.')));
  }, []);

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const payload = () => ({
    enabled: form.enabled,
    host: form.host.trim() || null,
    port: form.port ? Number(form.port) : null,
    encryption: form.encryption,
    username: form.username.trim() || null,
    password: form.password,
    fromAddress: form.fromAddress.trim() || null,
    fromName: form.fromName.trim() || null,
  });

  const save = async () => {
    setSaving(true);
    try {
      const data = await Api.MailSettings.update(payload());
      setSettings(data);
      setForm(toForm(data));
      toastSuccess(data.enabled ? 'Email server settings saved. All emails now go through this server.' : 'Saved. The default email server is in use.');
    } catch (error) {
      toastError(errorMessage(error, 'Could not save the email server settings.'));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const result = await Api.MailSettings.sendTest({ ...payload(), to: testTo.trim() || undefined });
      toastSuccess(`Test email sent to ${result?.sentTo}. Check that inbox (and junk folder).`);
    } catch (error) {
      toastError(errorMessage(error, 'The test email could not be sent.'));
    } finally {
      setTesting(false);
    }
  };

  const env = settings?.environmentDefaults || {};

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="margin-bottom-20">
            <h1 className="page-heading mb-1">Email Server</h1>
            <div className="fs-14 text-3-color">The outgoing (SMTP) mail server used for all transactional emails.</div>
          </div>
          {!form ? (
            <div className="fs-14 text-3-color">Loading…</div>
          ) : (
            <div className="row g-4">
              <div className="col-xl-8 col-12">
                <div className="settings-editor-panel">
                  <div className="d-flex justify-content-between align-items-start gap-3 margin-bottom-16">
                    <div>
                      <div className="fs-16 fw-600 text-1-color">Use these SMTP settings</div>
                      <div className="fs-13 text-3-color">When off, the server's default mail configuration is used (see the right-hand panel).</div>
                    </div>
                    <AppSwitch checked={form.enabled} ariaLabel="Use custom SMTP settings" onChange={() => setField('enabled', !form.enabled)} />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-8 col-12">
                      <AppInput name="host" label="SMTP host" isRequired={form.enabled} placeholder="smtp.example.org" value={form.host} onChange={e => setField('host', e.target.value)} />
                    </div>
                    <div className="col-md-4 col-12">
                      <AppInput name="port" label="Port" isRequired={form.enabled} value={form.port} onChange={e => setField('port', e.target.value.replace(/\D/g, ''))} />
                    </div>
                    <div className="col-md-6 col-12">
                      <AppDropdown
                        name="encryption"
                        label="Encryption"
                        options={ENCRYPTION_OPTIONS}
                        value={form.encryption}
                        searchable={false}
                        onChange={e => {
                          const encryption = e.target.value;
                          setForm(prev => ({
                            ...prev,
                            encryption,
                            port: prev.port === '465' || prev.port === '587' || !prev.port ? (encryption === 'ssl' ? '465' : '587') : prev.port,
                          }));
                        }}
                      />
                    </div>
                    <div className="col-md-6 col-12">
                      <AppInput name="username" label="Username" value={form.username} onChange={e => setField('username', e.target.value)} />
                    </div>
                    <div className="col-md-6 col-12">
                      <AppInput
                        name="password"
                        label={settings.hasPassword ? 'Password (leave blank to keep the saved one)' : 'Password'}
                        type="password"
                        value={form.password}
                        onChange={e => setField('password', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6 col-12 d-flex align-items-center">
                      {settings.hasPassword ? <AppBadge label="Password saved" variant="green" /> : <AppBadge label="No password saved" variant="grey" />}
                    </div>
                    <div className="col-md-6 col-12">
                      <AppInput
                        name="fromAddress"
                        label="From address"
                        isRequired={form.enabled}
                        placeholder="noreply@example.org"
                        value={form.fromAddress}
                        onChange={e => setField('fromAddress', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6 col-12">
                      <AppInput name="fromName" label="From name" placeholder="SAMAR Portal" value={form.fromName} onChange={e => setField('fromName', e.target.value)} />
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2 margin-top-20">
                    <AppButton title="Save" loading={saving} disabled={saving} onClick={save} />
                  </div>
                  {settings.updatedAt && <div className="fs-12 text-3-color margin-top-12">Last updated {formatDate(settings.updatedAt)}</div>}
                </div>
              </div>
              <div className="col-xl-4 col-12">
                <div className="settings-editor-panel margin-bottom-16">
                  <div className="fs-16 fw-600 text-1-color margin-bottom-8">Send a test email</div>
                  <div className="fs-13 text-3-color margin-bottom-12">Uses the values in the form, even before saving. Leave the address blank to send it to yourself.</div>
                  <AppInput name="testTo" label="Send to" placeholder="you@example.org" value={testTo} onChange={e => setTestTo(e.target.value)} />
                  <div className="margin-top-12">
                    <AppButton title="Send test email" variant="secondary" loading={testing} disabled={testing} onClick={sendTest} />
                  </div>
                </div>
                <div className="settings-editor-panel">
                  <div className="fs-16 fw-600 text-1-color margin-bottom-8">Server default</div>
                  <div className="fs-13 text-3-color margin-bottom-8">Used while the switch is off.</div>
                  <div className="fs-14 text-2-color">Mailer: {env.mailer || '—'}</div>
                  <div className="fs-14 text-2-color">Host: {env.host || '—'}</div>
                  <div className="fs-14 text-2-color">Port: {env.port || '—'}</div>
                  <div className="fs-14 text-2-color">From: {env.fromName ? `${env.fromName} <${env.fromAddress || ''}>` : env.fromAddress || '—'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default EmailServerSettings;
