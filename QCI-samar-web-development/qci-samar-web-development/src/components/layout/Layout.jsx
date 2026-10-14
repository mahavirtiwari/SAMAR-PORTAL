import { useCallback, useEffect, useState } from 'react';
import './../../assets/theme/Layout.css';
import Header from './Header';
import Sidebar from './Sidebar';

// At and below this width the sidebar is an overlay drawer instead of a rail.
const OVERLAY_QUERY = '(max-width: 992px)';

const Layout = ({ children, subHeader, isSubHeaderWithButton }) => {
  const [isOverlay, setIsOverlay] = useState(() => window.matchMedia(OVERLAY_QUERY).matches);
  // On desktop the sidebar starts open; as an overlay it starts closed.
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !window.matchMedia(OVERLAY_QUERY).matches);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  // Reset the sidebar only when the layout actually crosses the breakpoint. A plain
  // resize listener also fired when a phone's address bar hid or its keyboard
  // opened (closing an open drawer), and on any desktop resize (reopening a rail
  // the user had collapsed).
  useEffect(() => {
    const query = window.matchMedia(OVERLAY_QUERY);
    let wasOverlay = query.matches;
    const handleChange = () => {
      if (query.matches === wasOverlay) {
        return;
      }
      wasOverlay = query.matches;
      setIsOverlay(query.matches);
      setIsSidebarOpen(!query.matches);
    };
    // Some environments (embedded webviews, device emulators) resize without
    // firing the media-query change event, so resize is checked too; both only
    // act when the breakpoint is actually crossed.
    query.addEventListener('change', handleChange);
    window.addEventListener('resize', handleChange);
    return () => {
      query.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleChange);
    };
  }, []);

  // Escape closes the drawer.
  useEffect(() => {
    if (!isOverlay || !isSidebarOpen) {
      return undefined;
    }
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOverlay, isSidebarOpen]);

  return (
    <div className="layout">
      <Header onToggleSidebar={toggleSidebar} />
      {subHeader && <div className={`subHeader${isSidebarOpen ? ' sidebar-open' : ' sidebar-closed'}`}>{subHeader}</div>}
      <Sidebar isOpen={isSidebarOpen} isOverlay={isOverlay} onClose={closeSidebar} toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />}
      <main className={`main-content ${isSubHeaderWithButton ? 'subHeaderWithButton' : ''} ${!subHeader ? 'withoutSubHeader' : ''} ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
