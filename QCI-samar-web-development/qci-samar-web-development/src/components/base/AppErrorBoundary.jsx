import { Component } from 'react';
import { Container } from 'react-bootstrap';
import Images from '../../constants/Images';
import { Logger } from '../../utils/logger';
import AppButton from './AppButton';

// A failed dynamic import leaves the router with nothing to render, which looks to the user
// like navigation silently stopped working. The chunk is usually missing because a new build
// replaced it mid-session, so a one-shot reload fetches the current chunk manifest and recovers.
const CHUNK_ERROR_PATTERN = /loading chunk|loading css chunk|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i;

const RELOAD_GUARD_KEY = 'app-chunk-reload-attempted';

const isChunkLoadError = error => CHUNK_ERROR_PATTERN.test(`${error?.name} ${error?.message}`);

class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    // Only a clean render proves the reload worked; clearing it here would re-arm the guard
    // while still showing the fallback and allow an endless reload loop.
    if (!this.state.error) {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    }
  }

  componentDidUpdate(prevProps) {
    // Navigating away from the screen that failed should recover rather than strand the user
    // on the fallback for the rest of the session.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, errorInfo) {
    Logger.error('Unhandled render error:', error, errorInfo?.componentStack);

    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
      window.location.reload();
    }
  }

  handleReload = () => {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <section className="error-boundary">
        <Container fluid className="d-flex flex-column align-items-center justify-content-center min-vh-100">
          <div className="text-center">
            <img src={Images.samarLogo} alt="SAMAR Logo" className="samarLogo mb-4" />
            <h1 className="fs-32 fw-700 primary-color mb-3">Something went wrong</h1>
            <p className="fs-18 fw-500 text-1-color mb-4" style={{ maxWidth: '600px' }}>
              This page could not be displayed. Reloading usually fixes it. If it keeps happening, please contact support.
            </p>
            <AppButton title="Reload Page" size="medium" onClick={this.handleReload} />
          </div>
        </Container>
      </section>
    );
  }
}

export default AppErrorBoundary;
