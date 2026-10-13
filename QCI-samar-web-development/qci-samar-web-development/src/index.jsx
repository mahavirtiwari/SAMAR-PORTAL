import { ThemeProvider } from '@mui/material/styles';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
// theme.scss owns the :root design tokens every other stylesheet consumes, so it
// is imported first rather than in alphabetical position. Ordering is otherwise
// alphabetical and Biome's organizeImports leaves side-effect imports alone.
import './assets/theme/theme.scss';
import './assets/theme/attendanceTab.css';
import './assets/theme/commonStyles.css';
import './assets/theme/custom.css';
import './assets/theme/responsive.css';
import theme from './assets/theme/TableStyle';
import './index.css';
import store from './redux/store';
import { setupChunkErrorHandler } from './utils/versionCheck';

setupChunkErrorHandler();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <Provider store={store}>
        <App />
      </Provider>
    </ThemeProvider>
  </React.StrictMode>,
);
