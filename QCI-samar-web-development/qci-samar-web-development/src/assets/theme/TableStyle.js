import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0D6EFD',
    },
    background: {
      default: '#FFFFFF',
      paper: '#FFFFFF',
      tableHeader: '#F7F8FA',
      tableFooter: '#FFFFFF',
      tableHover: '#FBFCFD',
      tableSelected: '#F2F8FF',
    },
    divider: '#F0F0F0',
    text: {
      primary: '#4B5675',
      secondary: '#6B7280',
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          color: '#6B7280',
          fontSize: 14,
        },
        toolbar: {
          paddingLeft: 16,
          paddingRight: 16,
        },
        displayedRows: {
          // styles for the element that shows "1-10 of 100"
          color: '#6B7280',
          fontSize: '14px',
          lineHeight: '20px',
          padding: '6px 0',
        },
        actions: {
          paddingLeft: 8,
        },
      },
    },
  },
  typography: {
    fontFamily: 'Inter-Medium',
    body2: {
      fontSize: 14,
    },
    h6: {
      fontSize: 15,
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: 'none',
          // fontFamily: 'Inter-SemiBold',
          // prevent browser default focus outline of inner cells
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within, & .MuiDataGrid-cell.Mui-focusVisible': {
            outline: 'none',
            boxShadow: 'none',
          },
        },
        columnHeaders: {
          background: '#F7F8FA',
          fontWeight: 200,
          fontSize: 12,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          color: '#111827',
          borderBottom: '1px solid var(--outline)',
        },
        columnHeaderTitle: {
          fontFamily: 'Inter-SemiBold',
          fontWeight: 600,
          fontSize: 12,
          color: '#99A1B7',
        },
        row: {
          fontSize: 14,
          minHeight: 56,
          '&:hover': {
            backgroundColor: '#FBFCFD',
          },
        },
        footerContainer: {
          background: '#FFFFFF',
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          borderTop: '1px solid transparent',
        },
        cell: {
          borderBottom: '1px solid #F0F0F0',
          padding: '12px 12px',
          color: '#111827',
          // keep interactive focus subtle (accessible) or remove if you prefer
          '&:focus': {
            outline: 'none',
            boxShadow: 'none',
          },
          '&.Mui-selected': {
            backgroundColor: '#F2F8FF',
          },
          '&.Mui-focusVisible': {
            outline: 'none',
            boxShadow: 'none',
          },
          '&:focus-within': {
            outline: 'none',
            boxShadow: 'none',
          },
        },
        columnSeparator: {
          display: 'none',
        },
        columnIconButton: {
          color: '#6B7280',
        },
        // pagination styles when using componentsProps.pagination.sx may override these
        toolbar: {
          '& .MuiButton-root': {
            textTransform: 'none',
          },
        },
      },
    },
  },
});

export default theme;
