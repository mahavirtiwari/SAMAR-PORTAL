import { useCallback, useEffect, useState } from 'react';
import './../../assets/theme/Layout.css';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout = ({ children, subHeader, isSubHeaderWithButton }) => {
  // On desktop (>992px), sidebar is always open. On mobile/tablet, it starts closed
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 992);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  // Handle sidebar state on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 992) {
        // Desktop: sidebar should be open
        setIsSidebarOpen(true);
      } else {
        // Mobile/Tablet: sidebar should be closed
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="layout">
      <Header onToggleSidebar={toggleSidebar} />
      {subHeader && <div className={`subHeader${isSidebarOpen ? ' sidebar-open' : ' sidebar-closed'}`}>{subHeader}</div>}
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />}
      <main className={`main-content ${isSubHeaderWithButton ? 'subHeaderWithButton' : ''} ${!subHeader ? 'withoutSubHeader' : ''} ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
