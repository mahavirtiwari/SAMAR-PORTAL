import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppBadge, AppButton, AppDataGrid, AppDatePicker, AppDropdown, AppInput } from '../../../../components/base';
import { Layout } from '../../../../components/layout';
import PaymentDetailModal from '../../../../components/modals/PaymentDetailModal';
import PaymentDocumentsCell from '../../../../components/shared/PaymentDocumentsCell';
import PaymentSummaryTiles from '../../../../components/shared/PaymentSummaryTiles';
import { classificationOptions, sectorOptions } from '../../../../constants/filterData';
import Icons from '../../../../constants/Icons';
import { useCsvExport, useListFilters } from '../../../../hooks';
import { exportPaymentsAction } from '../../../../redux/action/common/PaymentExportAction';
import { getPaymentHistoryAction } from '../../../../redux/action/operationsAdmin/payment/PaymentAction';
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import { getBadgeVariantByLabel, getStatusLabel } from '../../../../utils/getStatusColors';

// Transform API data to table rows
// Backend fields (camelCase after middleware conversion):
// - paymentNumber: Order/Payment number (e.g., "PAY-2025-000001")
// - applicationId: Application ID
// - application.applicationNumber: Application reference number
// - application.organization: Organization details
// - amount: Payment amount
// - status: Payment status (pending, success, failed)
// - paidAt: Payment completion timestamp
// - createdAt: Payment creation timestamp
const transformPaymentData = payments => {
  if (!Array.isArray(payments)) {
    return [];
  }

  return payments.map((payment, index) => ({
    id: payment.id || index + 1,
    applicationNo: payment?.applicationNumber || 'N/A',
    orderNo: payment.paymentNumber || payment.paymentId || 'N/A',
    paymentDate: formatDate(payment.paidAt || payment.createdAt),
    amount: formatCurrency(payment.amount),
    size: payment.enterpriseClassification || 'N/A',
    sector: payment.sector || 'N/A',
    status: payment?.status || 'pending',
    unitName: payment?.unitName || '-',
    location: payment?.unitAddress || '-',
    invoiceId: payment?.invoiceId ?? null,
    invoicePdfAvailable: !!payment?.invoicePdfAvailable,
    receiptPdfAvailable: !!payment?.receiptPdfAvailable,
    rawData: payment,
  }));
};

const PaymentHistory = () => {
  const dispatch = useDispatch();

  // Get payment history from Redux store
  const { paymentHistory, paymentHistoryPagination, paymentHistorySummary, paymentHistoryLoading, paymentHistoryError } = useSelector(state => state.OperationsAdminPayment);

  // Modal and UI states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Filters and pagination are held in the URL so returning from a detail page
  // restores the list the user had filtered down to.
  // The search box commits on every keystroke; searchDebounceMs holds the fetch until typing pauses.
  const { filters, setFilters, appliedFilters, appliedQuery, setAppliedFilters, page, setPage, pageSize, setPageSize, resetFilters } = useListFilters(
    {
      search: '',
      sector: '',
      classification: '',
      fromDate: '',
      toDate: '',
    },
    { searchDebounceMs: 400 },
  );
  // Reopen the filter panel on return when a filter is active, so the restored list shows what it is filtered by.
  const [showFilters, setShowFilters] = useState(() => Object.entries(appliedFilters).some(([key, value]) => key !== 'search' && value !== '' && value != null));
  const [dropdownResetKey, setDropdownResetKey] = useState(0);

  // The export carries the same applied filters as the list, so the downloaded
  // rows are always the rows on screen rather than the whole table.
  const exportFilters = useMemo(
    () => ({
      search: appliedQuery.search || null,
      sector: appliedQuery.sector || null,
      classification: appliedQuery.classification || null,
      fromDate: appliedQuery.fromDate || null,
      toDate: appliedQuery.toDate || null,
    }),
    [appliedQuery],
  );
  const { exporting, handleExport } = useCsvExport(exportPaymentsAction, exportFilters, 'payments_export');

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = () => {
    // Spread the committed state so the live search term survives an Apply of the dropdowns.
    setAppliedFilters(prev => ({
      ...prev,
      sector: filters.sector,
      classification: filters.classification,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    }));
    setPage(1);
  };

  const handleReset = () => {
    resetFilters();
    setDropdownResetKey(prev => prev + 1);
  };

  // Fetch payment history on component mount
  useEffect(() => {
    const filtersPayload = {
      search: appliedQuery.search,
      page: page,
      perPage: pageSize,
      sector: appliedQuery.sector || null,
      classification: appliedQuery.classification || null,
      // The range narrows the totals as well as the list, since both come from the
      // same request. [TASK-08026]
      fromDate: appliedQuery.fromDate || null,
      toDate: appliedQuery.toDate || null,
    };
    // Abort on change so a slow earlier response cannot overwrite a newer one.
    const request = dispatch(getPaymentHistoryAction(filtersPayload));
    return () => request.abort();
  }, [dispatch, page, pageSize, appliedQuery]);

  const filteredData = useMemo(() => transformPaymentData(paymentHistory), [paymentHistory]);

  const handleViewPayment = useCallback(rowData => {
    // Use rawData directly which already contains the payment info from the list
    setSelectedPayment(rowData.rawData);
    setShowPaymentModal(true);
  }, []);

  const handleCloseModal = () => {
    setShowPaymentModal(false);
    setSelectedPayment(null);
  };

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 0.7,
        minWidth: 110,
        sortable: false,
        renderCell: params => (
          <AppButton variant="secondary" size="extraSmall" title={'View'} onClick={() => handleViewPayment(params.row)}>
            View
          </AppButton>
        ),
      },
      {
        field: 'applicationNo',
        headerName: 'Application Number',
        flex: 1.4,
        minWidth: 180,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4>{params.row.applicationNo}</h4>
            <div className="d-flex align-items-center">
              <span className={`text-capitalize ${params.row.sector === 'manufacturing' ? 'primary-color' : 'badge-purple-color'}`}>{params.row.sector}</span>
              <div className="dot-separator" />
              <span className="text-3-color text-capitalize">{params.row.size}</span>
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
            <h4>{params.row.unitName}</h4>
            <span className="text-3-color fs-12" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {params.row.location}
            </span>
          </div>
        ),
      },
      {
        field: 'orderNo',
        headerName: 'Order Number',
        flex: 1.6,
        minWidth: 190,
        sortable: false,
        renderCell: params => (
          <div className="double-content">
            <h4 style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{params.row.orderNo}</h4>
            <h4 className="text-3-color">{params.row.paymentDate}</h4>
          </div>
        ),
      },
      {
        field: 'amount',
        headerName: 'Amount (INR)',
        flex: 1,
        minWidth: 120,
        sortable: false,
      },
      {
        field: 'status',
        headerName: 'Payment Status',
        flex: 0.8,
        minWidth: 110,
        sortable: false,
        renderCell: params => <AppBadge variant={getBadgeVariantByLabel(params.row?.status) || '-'} label={getStatusLabel(params.row?.status)} />,
      },
      {
        field: 'documents',
        headerName: 'Invoice / Receipt',
        flex: 1.2,
        minWidth: 170,
        sortable: false,
        renderCell: params => <PaymentDocumentsCell invoiceId={params.row.invoiceId} invoicePdfAvailable={params.row.invoicePdfAvailable} receiptPdfAvailable={params.row.receiptPdfAvailable} />,
      },
    ],
    [handleViewPayment],
  );

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container">
            <div className="table-header">
              <div className="table-header-left">
                <h1 className="page-heading">Payment History</h1>
                <div className="input-search-document">
                  <AppInput
                    label={'Search'}
                    inputType="search"
                    name="search"
                    customInputClass={'search-input'}
                    value={appliedFilters.search}
                    onChange={e => {
                      const { value } = e.target;
                      setAppliedFilters(prev => ({ ...prev, search: value }));
                    }}
                    placeholder="Application / order number or name"
                    customWidth="100%"
                    leftIcon={Icons.search}
                    marginLeft="6px"
                  />
                </div>
              </div>
              <div className="table-header-right">
                <AppButton variant="secondary" size="small" title={'Export'} leftIcon={Icons.exportFile} leftIconStyle={'icon-14'} onClick={handleExport} disabled={exporting} loading={exporting} />
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

            {showFilters && (
              <div className="filter-section">
                <div className="row" style={{ marginBottom: '16px' }}>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown name="sector" value={filters.sector} onChange={e => handleFilterChange('sector', e.target.value)} options={sectorOptions} label="Sector" resetKey={dropdownResetKey} />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDropdown
                      name="classification"
                      value={filters.classification}
                      onChange={e => handleFilterChange('classification', e.target.value)}
                      options={classificationOptions}
                      label="Enterprise Size"
                      resetKey={dropdownResetKey}
                    />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDatePicker
                      name="fromDate"
                      label="From Date"
                      placeholder="Select date"
                      value={filters.fromDate}
                      maxDate={filters.toDate ? dayjs(filters.toDate) : dayjs()}
                      onChange={value => handleFilterChange('fromDate', value || '')}
                    />
                  </div>
                  <div className="col-lg-3 col-md-4 col-sm-6 col-12 mb-3">
                    <AppDatePicker
                      name="toDate"
                      label="To Date"
                      placeholder="Select date"
                      value={filters.toDate}
                      minDate={filters.fromDate ? dayjs(filters.fromDate) : undefined}
                      maxDate={dayjs()}
                      onChange={value => handleFilterChange('toDate', value || '')}
                    />
                  </div>
                </div>

                <div className="filter-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
                  <AppButton variant="primary" size="small" title="Apply Filters" leftIcon={Icons.searchWhite} leftIconStyle={'icon-14'} onClick={handleSearch} />
                  <AppButton variant="tertiary" size="small" title="Reset" onClick={handleReset} leftIcon={Icons.closeCircle} leftIconStyle={'icon-14'} />
                </div>
              </div>
            )}

            <PaymentSummaryTiles summary={paymentHistorySummary} loading={paymentHistoryLoading} />

            <div className="table-wrapper">
              <AppDataGrid
                rows={filteredData}
                columns={columns}
                loading={paymentHistoryLoading}
                rowCount={paymentHistoryPagination?.total || 0}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                emptyTitle="No Payment History"
                emptySubtitle={paymentHistoryError ? 'Failed to load payment history.' : 'No payment records found.'}
              />
            </div>
          </div>
        </div>

        <PaymentDetailModal open={showPaymentModal} handleClose={handleCloseModal} paymentData={selectedPayment} />
      </div>
    </Layout>
  );
};

export default PaymentHistory;
