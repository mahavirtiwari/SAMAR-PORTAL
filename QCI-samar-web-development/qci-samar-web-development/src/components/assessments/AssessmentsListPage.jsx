import { Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { classificationOptions, sectorOptions } from '../../constants/filterData';
import Icons from '../../constants/Icons';
import { useListFilters } from '../../hooks';
import { exportAssessmentsAction, getAssessmentsAction, getAssessorsAction } from '../../redux/action/common/AssessmentAction';
import { listVendorCategoriesAction } from '../../redux/action/master/MasterAction';
import { formatDate, formatDateISO } from '../../utils/formatters';
import { AppButton, AppDataGrid, AppDatePicker, AppDropdown, AppInput, RenewalTag } from '../base';
import { Layout } from '../layout';

// Generic, role-agnostic assessment stage list. Owns the shell (search, filters, server-side
// paginated DataGrid, row mapping, empty state); everything that varies between stages arrives
// as props. Every stage screen of every role (assessor, operations admin, operations manager,
// DRDO admin) renders through this component — see `assessmentStages.jsx` for the per-stage
// prop bundles.
//
// Props:
//   heading             – page heading text
//   status              – assessment status(es) sent to the API (comma-separated for multi)
//   detailsPath         – (id) => route the row's View action navigates to
//   filters             – ordered list of FILTER_KEYS to render in the filter panel
//   extraColumns        – stage columns appended after the shared Actions/Application/Unit head
//   emptyTitle          – DataGrid empty-state title
//   emptySubtitle       – DataGrid empty-state subtitle
//   searchPlaceholder   – search input placeholder
//   selector            – (state) => the slice holding assessments/pagination/loading/assessors
//   fetchAction         – (params) => redux action that loads the list

export const FILTER_KEYS = {
  enterpriseSize: 'enterpriseSize',
  vendorCategory: 'vendorCategory',
  sector: 'sector',
  assessmentStartDate: 'assessmentStartDate',
  assessmentEndDate: 'assessmentEndDate',
  leadAssessor: 'leadAssessor',
  coAssessor: 'coAssessor',
};

const DATE_FILTER_KEYS = [FILTER_KEYS.assessmentStartDate, FILTER_KEYS.assessmentEndDate];
const ASSESSOR_FILTER_KEYS = [FILTER_KEYS.leadAssessor, FILTER_KEYS.coAssessor];

const buildEmptyFilters = keys => Object.fromEntries(keys.map(key => [key, DATE_FILTER_KEYS.includes(key) ? null : '']));

const defaultSelector = state => state.Assessment;

// The export endpoint is restricted to these roles server-side, so the button is hidden
// from everyone else — an assessor reaching this same component would only get a 403.
const EXPORT_ROLES = ['operations_admin', 'operations_manager', 'system_admin', 'drdo_admin', 'drdo_lab'];

const AssessmentsListPage = ({
  heading,
  status,
  detailsPath,
  filters: filterKeys = [],
  extraColumns = [],
  emptyTitle = 'No Assessments',
  emptySubtitle = 'There are no assessments to display.',
  searchPlaceholder = 'Search name or application number',
  selector = defaultSelector,
  fetchAction = getAssessmentsAction,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { assessments, assessmentsPagination, assessmentsLoading, assessors } = useSelector(selector);
  const { drdoVendorCategories } = useSelector(state => state.Master);
  const { user } = useSelector(state => state.Account);

  const roleSlug = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0].slug : '';
  const canExport = EXPORT_ROLES.includes(roleSlug);
  // Rating is a committee/ops-facing outcome field — assessors don't get to see it.
  const isAssessor = roleSlug === 'assessor';
  const [exporting, setExporting] = useState(false);

  const needsVendorCategories = filterKeys.includes(FILTER_KEYS.vendorCategory);
  const needsAssessors = filterKeys.some(key => ASSESSOR_FILTER_KEYS.includes(key));

  const [showFilters, setShowFilters] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [dropdownResetKey, setDropdownResetKey] = useState(0);

  // Committed filters, the search box and the pagination live in the URL, so opening an
  // assessment and pressing Back returns to the list the user had narrowed down rather
  // than to an empty one. The fetch effect keys on `appliedFilters`, not the live
  // `filters`, so the API is called when Search is clicked and not on every dropdown change.
  const listDefaults = useMemo(() => ({ ...buildEmptyFilters(filterKeys), search: '' }), [filterKeys]);
  const { filters, setFilters, appliedFilters, setAppliedFilters, page, setPage, pageSize, setPageSize, resetFilters } = useListFilters(listDefaults);

  const searchQuery = filters.search ?? '';
  const setSearchQuery = useCallback(
    value => {
      setFilters(prev => ({ ...prev, search: typeof value === 'function' ? value(prev.search ?? '') : value }));
    },
    [setFilters],
  );

  // The search box applies as the user types; the dropdown filters wait for Search.
  useEffect(() => {
    if ((appliedFilters.search ?? '') === searchQuery) {
      return undefined;
    }
    const id = setTimeout(() => setAppliedFilters(prev => ({ ...prev, search: searchQuery })), 300);
    return () => clearTimeout(id);
  }, [searchQuery, appliedFilters.search, setAppliedFilters]);

  useEffect(() => {
    if (needsVendorCategories) {
      dispatch(listVendorCategoriesAction({ all: true, isActive: true }));
    }
    if (needsAssessors) {
      dispatch(getAssessorsAction({ role: 'assessor', status: 'active' }));
    }
  }, [dispatch, needsVendorCategories, needsAssessors]);

  // Empty values are dropped rather than sent as empty strings, which the API treats
  // as a real filter value. The export sends the same params, minus pagination, so the
  // file matches the rows on screen.
  const appliedParams = useMemo(() => {
    const applied = { status };
    for (const [key, value] of Object.entries(appliedFilters)) {
      if (value !== '' && value !== null && value !== undefined) {
        applied[key] = value;
      }
    }
    return applied;
  }, [status, appliedFilters]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch(fetchAction({ ...appliedParams, page, perPage: pageSize }));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [dispatch, fetchAction, page, pageSize, appliedParams]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const result = await dispatch(exportAssessmentsAction(appliedParams));
      if (exportAssessmentsAction.fulfilled.match(result)) {
        const blob = new Blob([result.payload], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `assessments_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  }, [dispatch, appliedParams]);

  const handleFilterChange = useCallback((name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSearch = useCallback(() => {
    const applied = { search: filters.search ?? '' };
    for (const key of filterKeys) {
      const value = filters[key];
      if (DATE_FILTER_KEYS.includes(key)) {
        applied[key] = value ? formatDateISO(value) : '';
      } else {
        applied[key] = value || '';
      }
    }
    setAppliedFilters(applied);
    setPage(1);
  }, [filters, filterKeys, setAppliedFilters, setPage]);

  const handleReset = useCallback(() => {
    resetFilters();
    setDropdownResetKey(prev => prev + 1);
  }, [resetFilters]);

  const vendorCategoryOptions = useMemo(
    () => [{ value: '', label: 'All' }, ...(drdoVendorCategories?.data?.map(category => ({ value: category.categoryName, label: category.categoryName })) || [])],
    [drdoVendorCategories],
  );

  // Any active assessor can serve as a lead or co-assessor, so both filters list the full
  // roster. The roster only ever grows: deriving it from the (filtered) assessments alone would
  // collapse the options to the current result page, and the /users roster is not readable by
  // every role — so assessors seen on loaded assessments are merged in as a fallback.
  const [assessorRoster, setAssessorRoster] = useState({});

  useEffect(() => {
    if (!needsAssessors) {
      return;
    }
    setAssessorRoster(prev => {
      const next = { ...prev };
      let changed = false;
      (assessors || []).forEach(user => {
        const label = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.id;
        if (user.id && next[user.id] !== label) {
          next[user.id] = label;
          changed = true;
        }
      });
      (assessments || []).forEach(assessment =>
        (assessment.teamMembers || []).forEach(member => {
          const id = member?.userId ?? member?.id;
          if (id && !next[id]) {
            next[id] = member.name || id;
            changed = true;
          }
        }),
      );
      return changed ? next : prev;
    });
  }, [needsAssessors, assessors, assessments]);

  const assessorOptions = useMemo(() => {
    const options = Object.entries(assessorRoster)
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: '', label: 'All' }, ...options];
  }, [assessorRoster]);

  const rows = useMemo(
    () =>
      (assessments || []).map((assessment, index) => ({
        id: assessment.id || index + 1,
        applicationNo: assessment.application?.applicationNumber || '-',
        application: assessment.application || null,
        unit: assessment.application?.sector || '-',
        size: assessment.application?.enterpriseClassification || '-',
        enterprise: assessment.application?.unitName || '-',
        location: assessment.application?.unitAddress || '-',
        startDate: assessment.scheduledStartDate ? formatDate(assessment.scheduledStartDate) : '-',
        endDate: assessment.scheduledEndDate ? formatDate(assessment.scheduledEndDate) : '-',
        preferredAssessmentDate: assessment.application?.preferredAssessmentDate ? formatDate(assessment.application.preferredAssessmentDate) : '-',
        // The rejection timestamp lives on the application, not the assessment.
        rejectedOn: assessment.application?.rejectedAt ? formatDate(assessment.application.rejectedAt) : '-',
        certificateLevel: assessment.rating || '-',
        assessors:
          assessment.teamMembers?.map(member => ({
            initials:
              member.name
                ?.split(' ')
                .map(part => part[0])
                .join('') || 'NA',
            name: member.name || '-',
            department: member.department || '-',
            location: member.location || '-',
          })) || [],
      })),
    [assessments],
  );

  // Typeahead suggestions come from the already-fetched, server-filtered page — the debounced
  // fetch above re-queries as the user types, so no extra request or endpoint is needed.
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const seen = new Set();
    const items = [];
    for (const row of rows) {
      const name = row.enterprise !== '-' ? row.enterprise : row.applicationNo;
      const key = `${name}|${row.applicationNo}`;
      if (name === '-' || seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({ key, name, applicationNo: row.applicationNo });
      if (items.length >= 8) {
        break;
      }
    }
    return items;
  }, [rows, searchQuery]);

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 0.7,
        minWidth: 110,
        sortable: false,
        renderCell: params => <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => navigate(detailsPath(params.row.id))} />,
      },
      {
        field: 'applicationNo',
        headerName: 'Application Number',
        flex: 1.5,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.applicationNo}</h4>
            <RenewalTag application={params.row.application} />
            <div className="d-flex align-items-center">
              <span className={`text-capitalize ${params.row.unit === 'manufacturing' ? 'primary-color' : 'badge-purple-color'}`}>{params.row.unit}</span>
              <div className="dot-separator-small"></div>
              <span className="text-3-color text-capitalize">{params.row.size === 'startup' ? 'Start-Up' : params.row.size}</span>
            </div>
          </div>
        ),
      },
      {
        field: 'enterprise',
        headerName: 'Enterprise/Unit Name',
        flex: 2.4,
        minWidth: 260,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 title={params.row.enterprise} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {params.row.enterprise}
            </h4>
           
             <Typography variant="body2" className="text-3-color line-clamp fs-12" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {params.row.location}
            </Typography>
          </div>
        ),
      },
      ...(isAssessor ? extraColumns.filter(column => column.field !== 'certificateLevel') : extraColumns),
    ],
    [navigate, detailsPath, extraColumns, isAssessor],
  );

  const renderFilter = key => {
    switch (key) {
      case FILTER_KEYS.enterpriseSize:
        return (
          <AppDropdown
            name="enterpriseSize"
            value={filters.enterpriseSize}
            onChange={e => handleFilterChange(FILTER_KEYS.enterpriseSize, e.target.value)}
            options={classificationOptions}
            label="Enterprise Size"
            resetKey={dropdownResetKey}
          />
        );
      case FILTER_KEYS.vendorCategory:
        return (
          <AppDropdown
            name="vendorCategory"
            value={filters.vendorCategory}
            onChange={e => handleFilterChange(FILTER_KEYS.vendorCategory, e.target.value)}
            options={vendorCategoryOptions}
            label="Category"
            resetKey={dropdownResetKey}
          />
        );
      case FILTER_KEYS.sector:
        return (
          <AppDropdown name="sector" value={filters.sector} onChange={e => handleFilterChange(FILTER_KEYS.sector, e.target.value)} options={sectorOptions} label="Sector" resetKey={dropdownResetKey} />
        );
      case FILTER_KEYS.assessmentStartDate:
        return (
          <AppDatePicker
            label="Assessment Start Date"
            placeholder="Select date"
            value={filters.assessmentStartDate}
            onChange={d => handleFilterChange(FILTER_KEYS.assessmentStartDate, d)}
            maxDate={dayjs()}
          />
        );
      case FILTER_KEYS.assessmentEndDate:
        return (
          <AppDatePicker
            label="Assessment End Date"
            placeholder="Select date"
            value={filters.assessmentEndDate}
            onChange={d => handleFilterChange(FILTER_KEYS.assessmentEndDate, d)}
            minDate={filters.assessmentStartDate}
            maxDate={dayjs()}
          />
        );
      case FILTER_KEYS.leadAssessor:
        return (
          <AppDropdown
            name="leadAssessor"
            value={filters.leadAssessor}
            onChange={e => handleFilterChange(FILTER_KEYS.leadAssessor, e.target.value)}
            options={assessorOptions}
            label="Lead Assessor"
            resetKey={dropdownResetKey}
          />
        );
      case FILTER_KEYS.coAssessor:
        return (
          <AppDropdown
            name="coAssessor"
            value={filters.coAssessor}
            onChange={e => handleFilterChange(FILTER_KEYS.coAssessor, e.target.value)}
            options={assessorOptions}
            label="Co-Assessor"
            resetKey={dropdownResetKey}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">{heading}</h1>
                <div className="input-search-document" style={{ position: 'relative' }}>
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                      setSuggestionsOpen(true);
                    }}
                    onFocus={() => setSuggestionsOpen(true)}
                    onBlur={() => setSuggestionsOpen(false)}
                    placeholder={searchPlaceholder}
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
                  />
                  {suggestionsOpen && suggestions.length > 0 && (
                    <ul className="search-suggestions" role="listbox">
                      {suggestions.map(suggestion => (
                        <li
                          key={suggestion.key}
                          role="option"
                          // onMouseDown fires before the input's blur, so the click still registers.
                          onMouseDown={() => {
                            setSearchQuery(suggestion.name);
                            setPage(1);
                            setSuggestionsOpen(false);
                          }}>
                          <span className="suggestion-name">{suggestion.name}</span>
                          <span className="suggestion-sub">{suggestion.applicationNo}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="table-header-right">
                {canExport && (
                  <AppButton variant="secondary" size="small" title={'Export'} leftIcon={Icons.exportFile} leftIconStyle={'icon-14'} onClick={handleExport} disabled={exporting} loading={exporting} />
                )}
                <AppButton
                  variant={showFilters ? 'active-filter-btn' : 'filter-btn'}
                  size="small"
                  title={'Filters'}
                  leftIcon={showFilters ? Icons.activeFilter : Icons.filter}
                  leftIconStyle={'icon-14'}
                  onClick={() => setShowFilters(!showFilters)}
                />
              </div>
            </div>

            {showFilters && filterKeys.length > 0 && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  {filterKeys.map(key => (
                    <div key={key} className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                      {renderFilter(key)}
                    </div>
                  ))}
                </div>
                <div className="filter-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
                  <AppButton variant="primary" size="small" title="Apply Filters" leftIcon={Icons.searchWhite} leftIconStyle={'icon-14'} onClick={handleSearch} />
                  <AppButton variant="tertiary" size="small" title="Reset" onClick={handleReset} leftIcon={Icons.closeCircle} leftIconStyle={'icon-14'} />
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <AppDataGrid
                rows={rows}
                columns={columns}
                loading={assessmentsLoading}
                rowCount={assessmentsPagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                emptyTitle={emptyTitle}
                emptySubtitle={emptySubtitle}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AssessmentsListPage;
