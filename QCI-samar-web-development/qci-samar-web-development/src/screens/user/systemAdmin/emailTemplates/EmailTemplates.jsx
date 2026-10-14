import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBadge, AppButton, AppDataGrid, AppDropdown, AppInput } from '../../../../components/base';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import Api from '../../../../services/api';
import { formatDate } from '../../../../utils/formatters';

// Settings → Email Templates: every transactional email the portal sends.
const titleCase = value => (value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());

const EmailTemplates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates((await Api.EmailTemplates.list()) || []);
    } catch (error) {
      toastError(error?.response?.data?.message || 'Could not load email templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categoryOptions = useMemo(() => [{ label: 'All categories', value: '' }, ...[...new Set(templates.map(t => t.category))].sort().map(c => ({ label: titleCase(c), value: c }))], [templates]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter(t => (!category || t.category === category) && (!term || [t.name, t.subject, t.event, t.slug].some(v => (v || '').toLowerCase().includes(term))));
  }, [templates, search, category]);

  const pageRows = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        minWidth: 110,
        flex: 0.6,
        sortable: false,
        renderCell: params => <AppButton variant="secondary" title="Edit" size="extraSmall" onClick={() => navigate(`/email-templates/${params.row.id}`)} />,
      },
      {
        field: 'name',
        headerName: 'Template',
        minWidth: 220,
        flex: 1.4,
        sortable: false,
        renderCell: params => (
          <div>
            <div className="fs-14 fw-500 text-1-color line-clamp">{params.row.name}</div>
            <div className="fs-12 text-3-color">{params.row.event}</div>
          </div>
        ),
      },
      {
        field: 'category',
        headerName: 'Category',
        minWidth: 130,
        flex: 0.8,
        sortable: false,
        renderCell: params => <AppBadge label={titleCase(params.row.category)} variant="lightBlue" />,
      },
      {
        field: 'subject',
        headerName: 'Subject',
        minWidth: 260,
        flex: 1.8,
        sortable: false,
        renderCell: params => <div className="fs-14 text-2-color line-clamp">{params.row.subject}</div>,
      },
      {
        field: 'isCustomized',
        headerName: 'Content',
        minWidth: 120,
        flex: 0.7,
        sortable: false,
        renderCell: params => (params.row.isCustomized ? <AppBadge label="Customised" variant="purple" /> : <AppBadge label="Default" variant="grey" />),
      },
      {
        field: 'isActive',
        headerName: 'Status',
        minWidth: 110,
        flex: 0.6,
        sortable: false,
        renderCell: params => (params.row.isActive ? <AppBadge label="Active" variant="green" /> : <AppBadge label="Inactive" variant="red" />),
      },
      {
        field: 'updatedAt',
        headerName: 'Last Updated',
        minWidth: 130,
        flex: 0.7,
        sortable: false,
        renderCell: params => <span className="fs-14 text-2-color">{params.row.updatedAt ? formatDate(params.row.updatedAt) : '—'}</span>,
      },
    ],
    [navigate],
  );

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="table-container">
                <div className="table-header">
                  <div className="table-header-left">
                    <h1 className="page-heading">Email Templates</h1>
                    <div className="fs-14 text-3-color">Transactional emails sent by the portal. Edit the wording, recipients and status of each.</div>
                  </div>
                </div>
                <div className="row margin-bottom-16">
                  <div className="col-md-6 col-12">
                    <AppInput
                      name="search"
                      label="Search"
                      placeholder="Search by name, subject or event"
                      value={search}
                      inputType="search"
                      onChange={e => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="col-md-3 col-12">
                    <AppDropdown
                      name="category"
                      label="Category"
                      options={categoryOptions}
                      value={category}
                      searchable={false}
                      onChange={e => {
                        setCategory(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>
                <div className="table-wrapper">
                  <AppDataGrid
                    rows={pageRows}
                    columns={columns}
                    rowCount={filtered.length}
                    page={page}
                    pageSize={pageSize}
                    onPaginationChange={model => {
                      setPage(model.page);
                      setPageSize(model.pageSize);
                    }}
                    getRowId={row => row.id}
                    loading={loading}
                    emptyTitle="No Email Templates"
                    emptySubtitle="No email templates match your filters."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EmailTemplates;
