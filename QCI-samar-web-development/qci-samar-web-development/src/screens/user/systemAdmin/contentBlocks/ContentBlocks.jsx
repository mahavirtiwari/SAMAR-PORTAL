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
  const [filter, setFilter] = useState('');

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
    const term = filter.trim().toLowerCase();
    const map = {};
    for (const block of blocks) {
      if (term && !`${block.title} ${GROUP_LABELS[block.group] || block.group}`.toLowerCase().includes(term)) {
        continue;
      }
      (map[block.group] ||= []).push(block);
    }
    return Object.entries(map);
  }, [blocks, filter]);

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
            <div className="content-blocks-layout">
              <aside className="content-blocks-nav" aria-label="Content items">
                <div className="content-blocks-nav__search">
                  <img src={Icons.search} alt="" />
                  <input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Find content" aria-label="Find content" />
                </div>
                <div className="content-blocks-nav__list">
                  {grouped.length === 0 && <div className="fs-13 text-3-color px-2 py-3">No content matches “{filter}”.</div>}
                  {grouped.map(([group, items]) => (
                    <div key={group} className="content-blocks-nav__group">
                      <div className="content-blocks-nav__group-title">
                        <span>{GROUP_LABELS[group] || group}</span>
                        <span className="content-blocks-nav__count">{items.length}</span>
                      </div>
                      {items.map(block => (
                        <button
                          key={block.key}
                          type="button"
                          onClick={() => select(block)}
                          aria-current={block.key === selectedKey ? 'true' : undefined}
                          className={`content-blocks-nav__item${block.key === selectedKey ? ' is-active' : ''}`}>
                          <span className="content-blocks-nav__item-title">{block.title}</span>
                          <span className={`content-blocks-nav__dot${block.isDefault ? '' : ' is-edited'}`} title={block.isDefault ? 'Original text' : 'Edited'} />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="content-blocks-nav__legend">
                  <span>
                    <span className="content-blocks-nav__dot" /> Original
                  </span>
                  <span>
                    <span className="content-blocks-nav__dot is-edited" /> Edited
                  </span>
                </div>
              </aside>

              {selected && (
                <section className="content-blocks-editor">
                  <header className="content-blocks-editor__head">
                    <div className="min-w-0">
                      <div className="content-blocks-editor__group">{GROUP_LABELS[selected.group] || selected.group}</div>
                      <h2 className="content-blocks-editor__title">{selected.title}</h2>
                      {selected.updatedByName && (
                        <div className="fs-12 text-3-color">
                          Last edited by {selected.updatedByName} on {formatDate(selected.updatedAt)}
                        </div>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {selected.isDefault ? <AppBadge label="Original text" variant="grey" /> : <AppBadge label="Edited" variant="purple" />}
                      <AppBadge label={selected.format === 'html' ? 'Rich text' : 'Plain text'} variant="lightBlue" />
                    </div>
                  </header>

                  {selected.description && (
                    <div className="content-blocks-editor__where">
                      <img src={Icons.info} alt="" />
                      <span>
                        <strong>Where it appears: </strong>
                        {selected.description}
                      </span>
                    </div>
                  )}

                  <div className="content-blocks-editor__body">
                    <div className="content-blocks-editor__pane">
                      <div className="content-blocks-editor__pane-title">Edit</div>
                      <AppInput name="title" label="Title" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                      <div className="margin-top-16">
                        {selected.format === 'html' ? (
                          <HtmlTemplateEditor label="Content" value={draft.body} onChange={value => setDraft(d => ({ ...d, body: value }))} rows={16} />
                        ) : (
                          <>
                            <div className="fs-14 fw-500 text-1-color margin-bottom-8">Content</div>
                            <textarea className="html-editor-textarea" rows={6} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="content-blocks-editor__pane">
                      <div className="content-blocks-editor__pane-title">Preview</div>
                      <HtmlPreviewFrame html={contentPreviewDocument(draft.body, selected.format)} height={selected.format === 'html' ? 480 : 200} title="Content preview" />
                    </div>
                  </div>

                  <footer className={`content-blocks-editor__actions${dirty ? ' is-dirty' : ''}`}>
                    <span className="fs-13 text-3-color">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
                    <div className="d-flex flex-wrap gap-2">
                      <AppButton title="Reset to original" variant="tertiary" disabled={selected.isDefault} onClick={() => setShowReset(true)} />
                      <AppButton title="Discard changes" variant="secondary" disabled={!dirty} onClick={() => select(selected)} />
                      <AppButton title="Save" loading={saving} disabled={saving || !dirty} onClick={save} />
                    </div>
                  </footer>
                </section>
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
