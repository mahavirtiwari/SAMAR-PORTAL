import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter } from 'react-router-dom';
import AppSnackBar from './components/base/AppSnackBar';
import BrandFavicon from './components/base/BrandFavicon';
import AppNavigator from './navigation/ApplicationNavigator';

const AppContent = () => {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <BrowserRouter>
        <AppNavigator />
        <AppSnackBar />
        <BrandFavicon />
      </BrowserRouter>
    </LocalizationProvider>
  );
};
function App() {
  return <AppContent />;
}

export default App;
