import { DataGrid } from '@mui/x-data-grid';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import AppTableEmpty from './AppTableEmpty';

// Every one of these must keep a stable identity across renders. With auto row height the grid
// measures each row through a ResizeObserver and writes the result into its own state; if the
// props arrive as fresh references on that re-render it re-processes columns and styles, the
// content re-lays-out, the observer fires again on a sub-pixel difference, and the grid never
// settles — which is the continuous cell flicker in BUG-05967.
const AUTO_ROW_HEIGHT = () => 'auto';
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_SX = {
  '& .MuiDataGrid-columnHeaders': {
    borderBottom: '1px solid var(--outline)',
  },
};

const AppDataGrid = ({
  rows,
  columns,
  rowCount = 0,
  page = 1,
  pageSize = 10,
  onPaginationChange,
  loading = false,
  emptyTitle = 'No Data Available',
  emptySubtitle = 'No records to display.',
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  autoRowHeight = true,
  rowHeight,
  server = true,
  sx,
  getRowId,
  extraProps,
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  const slots = useMemo(() => ({ noRowsOverlay: () => <AppTableEmpty title={emptyTitle} subtitle={emptySubtitle} /> }), [emptyTitle, emptySubtitle]);

  const mergedSx = useMemo(() => (sx ? { ...DEFAULT_SX, ...sx } : DEFAULT_SX), [sx]);

  const paginationModel = useMemo(() => ({ page: Math.max(page - 1, 0), pageSize }), [page, pageSize]);

  // Callers usually pass an inline arrow, so hold the latest in a ref and hand the grid a
  // handler whose identity never changes.
  const onPaginationChangeRef = useRef(onPaginationChange);
  useEffect(() => {
    onPaginationChangeRef.current = onPaginationChange;
  }, [onPaginationChange]);

  const handlePaginationModelChange = useCallback(model => {
    onPaginationChangeRef.current?.({ page: model.page + 1, pageSize: model.pageSize });
  }, []);

  return (
    <DataGrid
      rows={safeRows}
      columns={columns}
      getRowId={getRowId}
      getRowHeight={autoRowHeight ? AUTO_ROW_HEIGHT : undefined}
      rowHeight={autoRowHeight ? undefined : rowHeight}
      pagination
      paginationMode={server ? 'server' : 'client'}
      rowCount={server ? rowCount : undefined}
      paginationModel={paginationModel}
      onPaginationModelChange={handlePaginationModelChange}
      pageSizeOptions={pageSizeOptions}
      loading={loading}
      slots={slots}
      sx={mergedSx}
      hideFooter={safeRows.length === 0}
      disableColumnMenu
      disableRowSelectionOnClick
      hideFooterSelectedRowCount
      hideFooterRowCount
      {...extraProps}
    />
  );
};

AppDataGrid.propTypes = {
  rows: PropTypes.array,
  columns: PropTypes.array.isRequired,
  rowCount: PropTypes.number,
  page: PropTypes.number,
  pageSize: PropTypes.number,
  onPaginationChange: PropTypes.func,
  loading: PropTypes.bool,
  emptyTitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  emptySubtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  pageSizeOptions: PropTypes.array,
  autoRowHeight: PropTypes.bool,
  rowHeight: PropTypes.number,
  server: PropTypes.bool,
  sx: PropTypes.object,
  getRowId: PropTypes.func,
  // Escape hatch for the few grids needing a prop this wrapper does not model.
  extraProps: PropTypes.object,
};

export default AppDataGrid;
