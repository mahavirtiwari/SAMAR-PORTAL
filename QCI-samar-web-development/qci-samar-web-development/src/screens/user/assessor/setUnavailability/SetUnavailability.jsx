import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppButton, AppDataGrid, AppDateRangePicker, AppModal, AppToolTip } from '../../../../components/base';
import { toastError } from '../../../../components/base/toast';
import { Layout } from '../../../../components/layout';
import Icons from '../../../../constants/Icons';
import Api from '../../../../services/api';
import { formatDate, formatDateFull } from '../../../../utils/formatters';
import { Logger } from '../../../../utils/logger';

const getRecordId = row => row.id;

const mapOffTimeToRecord = offTime => ({
  id: offTime.id,
  startDate: offTime.fromDate,
  endDate: offTime.toDate,
  noOfDays: dayjs(offTime.toDate).diff(dayjs(offTime.fromDate), 'day') + 1,
});

const SetUnavailability = () => {
  const today = dayjs().format('YYYY-MM-DD');

  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const [rangeError, setRangeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOffTimes = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const response = await Api.AssessorOffTime.getMyOffTimes();
      const offTimes = response?.offTimes ?? [];
      setRecords(offTimes.map(mapOffTimeToRecord));
    } catch (error) {
      Logger.error('Error fetching off-time records:', error.message);
      toastError(error?.response?.data?.message || 'Failed to load off-time records');
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffTimes();
  }, [fetchOffTimes]);

  const handleSubmit = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setRangeError('Please select a date or range');
      return;
    }
    setRangeError('');

    const overlaps = records.some(r => dateRange.startDate <= r.endDate && dateRange.endDate >= r.startDate);
    if (overlaps) {
      toastError('Selected range overlaps an existing off-time record');
      return;
    }

    setSubmitting(true);
    try {
      await Api.AssessorOffTime.createOffTime({ fromDate: dateRange.startDate, toDate: dateRange.endDate });
      setDateRange({ startDate: null, endDate: null });
      await fetchOffTimes();
    } catch (error) {
      Logger.error('Error creating off-time entry:', error.message);
      setRangeError(error?.response?.data?.message || 'Failed to create off-time entry');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!recordToDelete) {
      return;
    }
    setDeleting(true);
    try {
      await Api.AssessorOffTime.deleteOffTime(recordToDelete.id);
      setRecordToDelete(null);
      await fetchOffTimes();
    } catch (error) {
      Logger.error('Error deleting off-time entry:', error.message);
      toastError(error?.response?.data?.message || 'Failed to delete off-time entry');
    } finally {
      setDeleting(false);
    }
  };

  const deleteDateLabel = recordToDelete
    ? recordToDelete.startDate === recordToDelete.endDate
      ? formatDateFull(recordToDelete.startDate)
      : `${formatDateFull(recordToDelete.startDate)} - ${formatDateFull(recordToDelete.endDate)}`
    : '';

  const columns = useMemo(
    () => [
      {
        field: 'action',
        headerName: 'Actions',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => (
          <AppToolTip title="Delete">
            <div className="table-icon-button danger" onClick={() => setRecordToDelete(params.row)}>
              <img className="icon-14" src={Icons.trash} alt="Delete" />
            </div>
          </AppToolTip>
        ),
      },
      {
        field: 'startDate',
        headerName: 'Start Date',
        flex: 1.5,
        minWidth: 150,
        sortable: false,
        renderCell: params => <span className="fs-14 fw-500 text-2-color">{formatDate(params.row.startDate)}</span>,
      },
      {
        field: 'endDate',
        headerName: 'End Date',
        flex: 1.5,
        minWidth: 150,
        sortable: false,
        renderCell: params => <span className="fs-14 fw-500 text-2-color">{formatDate(params.row.endDate)}</span>,
      },
      {
        field: 'noOfDays',
        headerName: 'No. of Days',
        flex: 1,
        minWidth: 120,
        sortable: false,
        renderCell: params => (
          <span className="fs-14 fw-500 text-2-color">
            {params.row.noOfDays} {params.row.noOfDays === 1 ? 'day' : 'days'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <Layout>
      <div className="main-content-inner">
        <div className="container">
          <div className="table-container margin-bottom-24">
            <div className="profile-header-section">
              <h1 className="fs-20 fw-600 heading-color">Set Off-Time Days</h1>
            </div>
            <div className="main-content-section" style={{ paddingTop: '24px' }}>
              <div className="d-flex align-items-start gap-8">
                <div style={{ maxWidth: '360px', width: '100%' }}>
                  <AppDateRangePicker
                    name="dateRange"
                    label="Off-Time Dates"
                    placeholder="Select a date or range"
                    subLabel="Select one day, or a second date to set a range"
                    isRequired={true}
                    minDate={today}
                    value={dateRange}
                    onChange={range => {
                      setDateRange(range);
                      if (range.startDate && range.endDate) {
                        setRangeError('');
                      }
                    }}
                    error={rangeError}
                  />
                </div>
                <div>
                  <AppButton title="Submit" type="button" onClick={handleSubmit} loading={submitting} disabled={submitting} />
                </div>
              </div>
            </div>
          </div>

          <div className="table-container">
            <div className="profile-header-section">
              <h1 className="fs-20 fw-600 heading-color">Off-Time Records</h1>
            </div>
            <div className="table-wrapper">
              <AppDataGrid
                rows={records}
                columns={columns}
                loading={recordsLoading}
                server={false}
                page={page}
                pageSize={pageSize}
                onPaginationChange={model => {
                  setPage(model.page);
                  setPageSize(model.pageSize);
                }}
                getRowId={getRecordId}
                emptyTitle="No Off-Time Records"
                emptySubtitle="You have not set any off-time days yet."
              />
            </div>
          </div>
        </div>
      </div>

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.deleteModal}
        show={!!recordToDelete}
        handleClose={() => setRecordToDelete(null)}
        header={'Remove this entry?'}
        subHeader={`This will remove ${deleteDateLabel} from your unavailable dates. You'll become available for scheduling on ${recordToDelete && recordToDelete.startDate === recordToDelete.endDate ? 'this day' : 'these days'}.`}
        twoButtons
        leftButton="Cancel"
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={() => setRecordToDelete(null)}
        rightButton="Remove"
        rightButtonClassName={'w-100 danger-primary'}
        rightButtonOnClick={confirmDelete}
        rightButtonLoading={deleting}
        rightButtonDisabled={deleting}
      />
    </Layout>
  );
};

export default SetUnavailability;
