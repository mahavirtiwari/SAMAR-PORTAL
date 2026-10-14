import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppBadge, AppButton, AppInput, AppSwitch } from '../../../../components/base';
import HtmlTemplateEditor, { HtmlPreviewFrame } from '../../../../components/base/HtmlTemplateEditor';
import { toastError, toastSuccess } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import Api from '../../../../services/api';

// Settings → Email Templates → edit one transactional email.
const titleCase = value => (value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
const toList = text =>
  (text || '')
    .split(/[,;\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
const errorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const fieldErrors = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  return fieldErrors[0] || data?.message || fallback;
};

const EmailTemplateEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [form, setForm] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const previewTimer = useRef(null);

  const applyTemplate = useCallback(data => {
    setTemplate(data);
    setForm({
      subject: data.subject || '',
      title: data.title || '',
      body: data.body || '',
      cc: (data.cc || []).join(', '),
      bcc: (data.bcc || []).join(', '),
      recipientRoles: data.recipientRoles || [],
      isActive: !!data.isActive,
    });
  }, []);

  useEffect(() => {
    Api.EmailTemplates.get(id)
      .then(applyTemplate)
      .catch(error => toastError(errorMessage(error, 'Could not load the email template.')));
  }, [id, applyTemplate]);

  // Refresh the server-rendered preview shortly after edits stop.
  useEffect(() => {
    if (!form) {
      return undefined;
    }
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const result = await Api.EmailTemplates.preview(id, { subject: form.subject, title: form.title, body: form.body });
        setPreviewHtml(result?.html || '');
        setPreviewSubject(result?.subject || '');
      } catch {
        // Keep the last good preview; save will surface real errors.
      }
    }, 600);
    return () => clearTimeout(previewTimer.current);
  }, [id, form?.subject, form?.title, form?.body]);

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleRole = role =>
    setForm(prev => ({
      ...prev,
      recipientRoles: prev.recipientRoles.includes(role) ? prev.recipientRoles.filter(r => r !== role) : [...prev.recipientRoles, role],
    }));

  const save = async () => {
    if (!form.subject.trim()) {
      toastError('The subject cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const updated = await Api.EmailTemplates.update(id, {
        subject: form.subject,
        title: form.title || null,
        body: form.body,
        cc: toList(form.cc),
        bcc: toList(form.bcc),
        recipientRoles: form.recipientRoles,
        isActive: form.isActive,
      });
      applyTemplate(updated);
      toastSuccess('Email template saved.');
    } catch (error) {
      toastError(errorMessage(error, 'Could not save the email template.'));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const result = await Api.EmailTemplates.sendTest(id, { subject: form.subject, title: form.title, body: form.body });
      toastSuccess(`Test email sent to ${result?.sentTo || 'your email address'}.`);
    } catch (error) {
      toastError(errorMessage(error, 'Could not send the test email.'));
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    setShowReset(false);
    try {
      applyTemplate(await Api.EmailTemplates.reset(id));
      toastSuccess('Email template restored to its original design.');
    } catch (error) {
      toastError(errorMessage(error, 'Could not reset the email template.'));
    }
  };

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          {!form ? (
            <div className="fs-14 text-3-color padding-24">Loading…</div>
          ) : (
            <>
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 margin-bottom-20">
                <div>
                  <button type="button" className="btn btn-link p-0 fs-14 margin-bottom-8" onClick={() => navigate('/email-templates')}>
                    ← Back to Email Templates
                  </button>
                  <h1 className="page-heading mb-1">{template.name}</h1>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <AppBadge label={titleCase(template.category)} variant="lightBlue" />
                    <span className="fs-13 text-3-color">{template.event}</span>
                    {template.isCustomized ? <AppBadge label="Customised" variant="purple" /> : <AppBadge label="Default design" variant="grey" />}
                    {template.hasAttachment && <AppBadge label="Has attachment" variant="yellow" />}
                  </div>
                  {template.description && <div className="fs-14 text-2-color margin-top-8">{template.description}</div>}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="fs-14 text-2-color">{form.isActive ? 'Active' : 'Inactive'}</span>
                  <AppSwitch checked={form.isActive} ariaLabel="Template active" onChange={() => setField('isActive', !form.isActive)} />
                </div>
              </div>

              <div className="row g-4">
                <div className="col-xl-6 col-12">
                  <div className="settings-editor-panel">
                    <AppInput name="subject" label="Subject" isRequired value={form.subject} onChange={e => setField('subject', e.target.value)} />
                    <div className="margin-top-16">
                      <AppInput name="title" label="Email title" value={form.title} onChange={e => setField('title', e.target.value)} />
                    </div>
                    <div className="row margin-top-16">
                      <div className="col-md-6 col-12">
                        <AppInput name="cc" label="CC (comma-separated)" value={form.cc} onChange={e => setField('cc', e.target.value)} />
                      </div>
                      <div className="col-md-6 col-12">
                        <AppInput name="bcc" label="BCC (comma-separated)" value={form.bcc} onChange={e => setField('bcc', e.target.value)} />
                      </div>
                    </div>
                    <div className="margin-top-16">
                      <div className="fs-14 fw-500 text-1-color margin-bottom-4">Recipient roles</div>
                      <div className="fs-12 text-3-color margin-bottom-8">Applies to event-triggered emails; emails addressed to a specific person ignore it.</div>
                      {(template.recipientRoleOptions || []).map(role => (
                        <label key={role} className="recipient-role-option">
                          <input type="checkbox" checked={form.recipientRoles.includes(role)} onChange={() => toggleRole(role)} />
                          {titleCase(role)}
                        </label>
                      ))}
                    </div>
                    <div className="margin-top-16">
                      <HtmlTemplateEditor label="Body (HTML)" value={form.body} onChange={value => setField('body', value)} placeholders={template.placeholders || []} rows={20} />
                    </div>
                    <div className="d-flex flex-wrap gap-2 margin-top-20">
                      <AppButton title="Save" loading={saving} disabled={saving} onClick={save} />
                      <AppButton title="Send test email to me" variant="secondary" loading={sending} disabled={sending} onClick={sendTest} />
                      <AppButton title="Reset to default" variant="tertiary" disabled={!template.isCustomized} onClick={() => setShowReset(true)} />
                    </div>
                  </div>
                </div>
                <div className="col-xl-6 col-12">
                  <div className="settings-editor-panel">
                    <div className="fs-14 fw-500 text-1-color">Preview</div>
                    <div className="fs-12 text-3-color margin-bottom-8">Placeholders are shown as [name]. Updates as you type.</div>
                    <div className="fs-14 text-2-color margin-bottom-12">
                      <span className="text-3-color">Subject: </span>
                      {previewSubject || form.subject}
                    </div>
                    <HtmlPreviewFrame html={previewHtml} height={760} title="Email preview" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.deleteModal}
        show={showReset}
        header="Reset to default?"
        subHeader="The customised title and body will be discarded and the email will use its original design again."
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={() => setShowReset(false)}
        rightButton="Reset"
        rightButtonClassName="w-100 danger-primary"
        rightButtonOnClick={reset}
      />
    </Layout>
  );
};

export default EmailTemplateEdit;
