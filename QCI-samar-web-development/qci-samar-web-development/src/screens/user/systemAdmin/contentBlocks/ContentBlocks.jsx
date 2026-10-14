import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppBadge, AppButton, AppInput } from '../../../../components/base';
import HtmlTemplateEditor, { contentPreviewDocument, HtmlPreviewFrame } from '../../../../components/base/HtmlTemplateEditor';
import { toastError, toastSuccess } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import Api from '../../../../services/api';
import { formatDate } from '../../../../utils/formatters';

// Settings → Content & Disclaimers: instructions, declarations and disclaimers
// shown across the portal and in the assessment report.
const GROUP_LABELS = {
  registration: 'Registration',
  payment: 'Payment',
  application: 'Application Form',
  assessment: 'Assessment',
  account: 'Account',
  policies: 'Policies & Reports',
  system: 'System',
};

const errorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const fieldErrors = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  return fieldErrors[0] || data?.message || fallback;
};

const ContentBlocks = () => {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);
  const [draft, setDraft] = useState({ title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const selected = useMemo(() => blocks.find(b => b.key === selectedKey) || null, [blocks, selectedKey]);

  const select = useCallback(block => {
    setSelectedKey(block.key);
    setDraft({ title: block.title, body: block.body });
  }, []);

  useEffect(() => {
    Api.ContentBlockAdmin.list()
      .then(list => {
        setBlocks(list || []);
        if (list?.length) {
          select(list[0]);
        }
      })
      .catch(error => toastError(errorMessage(error, 'Could not load content.')))
      .finally(() => setLoading(false));
  }, [select]);

  const replaceBlock = updated => {
    setBlocks(prev => prev.map(b => (b.key === updated.key ? updated : b)));
    select(updated);
  };

  const dirty = selected && (draft.title !== selected.title || draft.body !== selected.body);

  const save = async () => {
    if (!draft.body.trim()) {
      toastError('The content cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      replaceBlock(await Api.ContentBlockAdmin.update(selected.key, { title: draft.title, body: draft.body }));
      toastSuccess(`"${draft.title}" saved. It is live across the portal now.`);
    } catch (error) {
      toastError(errorMessage(error, 'Could not save the content.'));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setShowReset(false);
    try {
      replaceBlock(await Api.ContentBlockAdmin.reset(selected.key));
      toastSuccess('Restored to the original text.');
    } catch (error) {
      toastError(errorMessage(error, 'Could not reset the content.'));
    }
  };

  const grouped = useMemo(() => {
    const map = {};
    for (const block of blocks) {
      (map[block.group] ||= []).push(block);
    }
    return Object.entries(map);
  }, [blocks]);

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="margin-bottom-20">
            <h1 className="page-heading mb-1">Content &amp; Disclaimers</h1>
            <div className="fs-14 text-3-color">Instructions, declarations and disclaimers shown to users. Changes go live as soon as they are saved.</div>
          </div>
          {loading ? (
            <div className="fs-14 text-3-color">Loading…</div>
          ) : (
            <div className="row g-4">
              <div className="col-xl-3 col-lg-4 col-12">
                <div className="settings-editor-panel">
                  {grouped.map(([group, items]) => (
                    <div key={group} className="margin-bottom-16">
                      <div className="fs-12 fw-600 text-3-color text-uppercase margin-bottom-8">{GROUP_LABELS[group] || group}</div>
                      {items.map(block => (
                        <button
                          key={block.key}
                          type="button"
                          onClick={() => select(block)}
                          className={`d-block w-100 text-start border-0 rounded px-2 py-2 margin-bottom-4 fs-14 ${block.key === selectedKey ? 'primary-color fw-600' : 'text-2-color'}`}
                          style={{ background: block.key === selectedKey ? 'var(--primary-20, #eef4ff)' : 'transparent' }}>
                          {block.title}
                          {!block.isDefault && <span className="fs-11 text-3-color"> • edited</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {selected && (
                <div className="col-xl-9 col-lg-8 col-12">
                  <div className="settings-editor-panel">
                    <div className="d-flex flex-wrap justify-content-between gap-2 margin-bottom-12">
                      <div>
                        <div className="fs-18 fw-600 text-1-color">{selected.title}</div>
                        <div className="fs-13 text-3-color">{selected.description}</div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {selected.isDefault ? <AppBadge label="Original text" variant="grey" /> : <AppBadge label="Edited" variant="purple" />}
                        <AppBadge label={selected.format === 'html' ? 'Rich text (HTML)' : 'Plain text'} variant="lightBlue" />
                      </div>
                    </div>
                    {selected.updatedByName && (
                      <div className="fs-12 text-3-color margin-bottom-12">
                        Last edited by {selected.updatedByName} on {formatDate(selected.updatedAt)}
                      </div>
                    )}
                    <div className="row g-4">
                      <div className="col-xxl-6 col-12">
                        <AppInput name="title" label="Title" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                        <div className="margin-top-16">
                          {selected.format === 'html' ? (
                            <HtmlTemplateEditor label="Content (HTML)" value={draft.body} onChange={value => setDraft(d => ({ ...d, body: value }))} rows={18} />
                          ) : (
                            <>
                              <div className="fs-14 fw-500 text-1-color margin-bottom-8">Content (plain text)</div>
                              <textarea className="html-editor-textarea" rows={6} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
                            </>
                          )}
                        </div>
                        <div className="d-flex flex-wrap gap-2 margin-top-20">
                          <AppButton title="Save" loading={saving} disabled={saving || !dirty} onClick={save} />
                          <AppButton title="Discard changes" variant="secondary" disabled={!dirty} onClick={() => select(selected)} />
                          <AppButton title="Reset to original" variant="tertiary" disabled={selected.isDefault} onClick={() => setShowReset(true)} />
                        </div>
                      </div>
                      <div className="col-xxl-6 col-12">
                        <div className="fs-14 fw-500 text-1-color margin-bottom-8">Preview</div>
                        <HtmlPreviewFrame html={contentPreviewDocument(draft.body, selected.format)} height={selected.format === 'html' ? 520 : 200} title="Content preview" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.deleteModal}
        show={showReset}
        header="Reset to original text?"
        subHeader="Your edits to this content will be replaced by the original text."
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

export default ContentBlocks;
