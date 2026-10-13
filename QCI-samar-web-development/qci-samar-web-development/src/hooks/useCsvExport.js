import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';

/**
 * Download a list screen's CSV export, filtered exactly as it is on screen.
 *
 * Every export endpoint streams CSV and every export button behaves the same, so
 * the screens share this one hook rather than each carrying its own copy of the
 * blob-and-anchor dance.
 *
 * @param {Function} exportAction - The createAsyncThunk that fetches the CSV body
 * @param {Object} filters - The list's applied filters, passed to the thunk
 * @param {string} filenamePrefix - File name stem, e.g. 'payments_export'
 * @returns {{ exporting: boolean, handleExport: () => Promise<void> }}
 */
const useCsvExport = (exportAction, filters, filenamePrefix) => {
  const dispatch = useDispatch();
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const result = await dispatch(exportAction(filters));
      if (exportAction.fulfilled.match(result)) {
        const blob = new Blob([result.payload], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  }, [dispatch, exportAction, filters, filenamePrefix]);

  return { exporting, handleExport };
};

export default useCsvExport;
