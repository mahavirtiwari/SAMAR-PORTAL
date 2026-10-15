import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'react-bootstrap';
import { AppBadge, AppButton, AppDataGrid, AppInput, AppToolTip } from '../../../../components/base';
import { toastError, toastSuccess } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import { AppModal } from '../../../../components/modals';
import Icons from '../../../../constants/Icons';
import Api from '../../../../services/api';
import { formatDate } from '../../../../utils/formatters';

// Settings → Quick Links: the links under the login page picture. Each opens a
// web address (or a path on this site) or downloads an uploaded PDF.
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const EMPTY_FORM = { id: null, label: '', target: 'url', url: '', file: null, fileName: '', sortOrder: '', isActive: true };

const errorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const fieldErrors = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  return fieldErrors[0] || data?.message || fallback;
};

const QuickLinks = () => {
  const [links, setLinks] = useState([]);
  const [maxActive, setMaxActive] = useState(6);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    Api.QuickLinkAdmin.list()
      .then(data => {
        setLinks(Array.isArray(data?.links) ? data.links : []);
        setMaxActive(data?.maxActive || 6);
      })
      .catch(error => toastError(errorMessage(error, 'Could not load the quick links.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = useCallback(link => {
    setForm({
      id: link.id,
      label: link.label,
      target: link.isFile ? 'file' : 'url',
      url: link.url || '',
      file: null,
      fileName: link.fileName || '',
      sortOrder: String(link.sortOrder ?? ''),
      isActive: link.isActive,
    });
    setShowForm(true);
  }, []);

  const pickFile = event => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) {
      return;
    }
    if (chosen.type !== 'application/pdf') {
      toastError('Please choose a PDF file.');
      return;
    }
    if (chosen.size > MAX_PDF_BYTES) {
      toastError('The PDF must be 10 MB or smaller.');
      return;
    }
    setForm(prev => ({ ...prev, file: chosen, fileName: chosen.name }));
  };

  const valid = form.label.trim() !== '' && (form.target === 'url' ? form.url.trim() !== '' : !!(form.file || (form.id && form.fileName)));

  const save = async () => {
    setSaving(true);
    const payload = {
      label: form.label.trim(),
      sortOrder: form.sortOrder,
      isActive: form.isActive,
      ...(form.target === 'url' ? { url: form.url.trim() } : form.file ? { file: form.file } : {}),
    };
    try {
      if (form.id) {
        await Api.QuickLinkAdmin.update(form.id, payload);
        toastSuccess('Quick link updated.');
      } else {
        await Api.QuickLinkAdmin.create(payload);
        toastSuccess('Quick link added.');
      }
      setShowForm(false);
      load();
    } catch (error) {
      toastError(errorMessage(error, 'Could not save the quick link.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = useCallback(
    async link => {
      try {
        await Api.QuickLinkAdmin.update(link.id, { label: link.label, isActive: !link.isActive });
        toastSuccess(link.isActive ? 'Quick link hidden from the login page.' : 'Quick link shown on the login page.');
        load();
      } catch (error) {
        toastError(errorMessage(error, 'Could not change the quick link.'));
      }
    },
    [load],
  );

  const confirmDelete = async () => {
    const link = deleting;
    setDeleting(null);
    try {
      await Api.QuickLinkAdmin.remove(link.id);
      toastSuccess('Quick link removed.');
      load();
    } catch (error) {
      toastError(errorMessage(error, 'Could not remove the quick link.'));
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        minWidth: 170,
        flex: 0.9,
        sortable: false,
        renderCell: params => (
          <div className="gap-8 d-flex align-items-center">
            <AppButton variant="secondary" size="extraSmall" title="Edit" onClick={() => openEdit(params.row)} />
            <div className="toggle-btns d-flex">
              <AppToolTip title={params.row.isActive ? 'Hide from login page' : 'Show on login page'}>
                <Image src={params.row.isActive ? Icons.active : Icons.inactive} className="icon-28" style={{ cursor: 'pointer' }} onClick={() => toggleActive(params.row)} />
              </AppToolTip>
            </div>
            <AppButton variant="tertiary" size="extraSmall" title="Remove" onClick={() => setDeleting(params.row)} />
          </div>
        ),
      },
      { field: 'sortOrder', headerName: 'Order', minWidth: 80, flex: 0.4, sortable: false },
      { field: 'label', headerName: 'Name', minWidth: 180, flex: 1.2, sortable: false },
      {
        field: 'target',
        headerName: 'Opens',
        minWidth: 240,
        flex: 1.6,
        sortable: false,
        renderCell: params => (params.row.isFile ? <span>PDF: {params.row.fileName || 'document.pdf'}</span> : <span style={{ overflowWrap: 'anywhere' }}>{params.row.url}</span>),
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 110,
        flex: 0.6,
        sortable: false,
        renderCell: params => <AppBadge variant={params.row.isActive ? 'green' : 'grey'} label={params.row.isActive ? 'Shown' : 'Hidden'} />,
      },
      {
        field: 'updated',
        headerName: 'Last changed',
        minWidth: 150,
        flex: 0.9,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{formatDate(params.row.updatedAt)}</h4>
            {params.row.updatedByName ? <span>{params.row.updatedByName}</span> : null}
          </div>
        ),
      },
    ],
    [openEdit, toggleActive],
  );

  const shownCount = links.filter(l => l.isActive).length;

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Quick Links</h1>
                <span className="fs-13 text-3-color">
                  Shown under the login page picture · {shownCount} of {maxActive} shown
                </span>
              </div>
              <div className="table-header-right">
                <AppButton variant="primary" size="small" title="Add Quick Link" onClick={openNew} />
              </div>
            </div>

            {showForm && (
              <div className="filter-section">
                <div className="row">
                  <div className="col-lg-4 col-md-6 col-12 mb-3">
                    <AppInput name="label" label="Name shown on the login page" isRequired value={form.label} maxLength={100} onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))} />
                  </div>
                  <div className="col-lg-2 col-md-6 col-12 mb-3">
                    <AppInput name="sortOrder" label="Order" type="number" value={form.sortOrder} placeholder="Last" onChange={e => setForm(prev => ({ ...prev, sortOrder: e.target.value }))} />
                  </div>
                  <div className="col-lg-6 col-12 mb-3">
                    <div className="d-flex gap-3 align-items-center flex-wrap" role="radiogroup" aria-label="Link opens">
                      <label className="d-flex align-items-center gap-2 mb-0 fs-14">
                        <input type="radio" name="target" checked={form.target === 'url'} onChange={() => setForm(prev => ({ ...prev, target: 'url' }))} /> Web address
                      </label>
                      <label className="d-flex align-items-center gap-2 mb-0 fs-14">
                        <input type="radio" name="target" checked={form.target === 'file'} onChange={() => setForm(prev => ({ ...prev, target: 'file' }))} /> Upload a PDF
                      </label>
                      <label className="d-flex align-items-center gap-2 mb-0 fs-14 ms-auto">
                        <input type="checkbox" checked={form.isActive} onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} /> Show on login page
                      </label>
                    </div>
                    <div className="margin-top-12">
                      {form.target === 'url' ? (
                        <AppInput
                          name="url"
                          label="Web address"
                          isRequired
                          placeholder="https://… or /assets/document/file.pdf"
                          value={form.url}
                          onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
                        />
                      ) : (
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                          <input ref={fileRef} type="file" accept="application/pdf" className="d-none" onChange={pickFile} />
                          <AppButton variant="secondary" size="small" title={form.fileName ? 'Choose a different PDF' : 'Choose PDF'} onClick={() => fileRef.current?.click()} />
                          <span className="fs-13 text-2-color">{form.fileName || 'No file chosen'} · PDF up to 10 MB</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="d-flex gap-2 mb-3">
                  <AppButton variant="primary" size="small" title={form.id ? 'Save changes' : 'Add link'} loading={saving} disabled={saving || !valid} onClick={save} />
                  <AppButton variant="tertiary" size="small" title="Cancel" onClick={() => setShowForm(false)} />
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <AppDataGrid
                rows={links}
                columns={columns}
                loading={loading}
                server={false}
                rowCount={links.length}
                page={1}
                pageSize={25}
                emptyTitle="No Quick Links"
                emptySubtitle="Add a link to show it under the login page picture."
              />
            </div>
          </div>
        </div>
      </div>

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.deleteModal}
        show={!!deleting}
        header="Remove quick link?"
        subHeader={deleting ? `"${deleting.label}" will no longer appear on the login page.${deleting.isFile ? ' Its uploaded PDF is deleted.' : ''}` : ''}
        twoButtons
        leftButton="Cancel"
        leftButtonClassName="w-100 tertiary"
        leftButtonOnClick={() => setDeleting(null)}
        rightButton="Remove"
        rightButtonClassName="w-100 danger-primary"
        rightButtonOnClick={confirmDelete}
      />
    </Layout>
  );
};

export default QuickLinks;
