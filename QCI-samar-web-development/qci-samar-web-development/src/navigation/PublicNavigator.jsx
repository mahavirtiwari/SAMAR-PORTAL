import { Route, Routes } from 'react-router-dom';
import Page from '../components/base/Page';
import { ForgotPassword, Login, Maintenance, NewPassword, PasswordResetLink, Register } from '../screens';

export default function PublicNavigator() {
  function getElementByRole(element, title) {
    return <Page title={title}>{element}</Page>;
  }
  return (
    <Routes>
      <Route path="/" element={getElementByRole(<Login />, 'Login')} />
      <Route path="/register" element={getElementByRole(<Register />, 'Register')} />
      <Route path="/new-password" element={getElementByRole(<NewPassword />, 'New Password')} />
      <Route path="/forgot-password" element={getElementByRole(<ForgotPassword />, 'Forgot Password')} />
      <Route path="/password-reset-link" element={getElementByRole(<PasswordResetLink />, 'Password Reset Link')} />
      <Route path="/maintenance" element={getElementByRole(<Maintenance />, 'System Maintenance')} />
      <Route path="*" element={getElementByRole(<Login />, 'Login')} />
    </Routes>
  );
}
