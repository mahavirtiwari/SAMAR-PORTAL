import { useCallback, useEffect, useState } from 'react';
import { Nav } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import AssessorMenuItem from '../../utils/sidebarMenu/AssessorMenuItem';
import DRDOAdminMenuItem from '../../utils/sidebarMenu/DRDOAdminMenuItem';
import DRDOLabMenuItem from '../../utils/sidebarMenu/DRDOLabMenuItem';
import EnterpriseAdminMenuItem from '../../utils/sidebarMenu/EnterpriseAdminMenuItem';
import OperationsAdminMenuItem from '../../utils/sidebarMenu/OperationsAdminMenuItem';
import OperationsManagerMenuItem from '../../utils/sidebarMenu/OperationsManagerMenuItem';
import SystemAdminMenuItem from '../../utils/sidebarMenu/SystemAdminMenuItem';
import UnitAdminMenuItem from '../../utils/sidebarMenu/UnitAdminMenuItem';
import { AppToolTip } from '../base';
import './../../assets/theme/Sidebar.css';
import SidebarSubMenu from './SidebarSubMenu';

const Sidebar = ({ isOpen, onClose, toggleSidebar }) => {
  const { user } = useSelector(state => state.Account);
  const role = user?.roles?.[0]?.slug;
  // Logger.info('User role in Sidebar:', role); // Uncomment for logging if needed
  const location = useLocation();
  const navigate = useNavigate();

  // Get menu items based on user role
  const getMenuItems = () => {
    switch (role) {
      case 'unit_admin':
        return UnitAdminMenuItem;
      case 'drdo_admin':
        return DRDOAdminMenuItem;
      case 'enterprise_admin':
        return EnterpriseAdminMenuItem;
      case 'operations_admin':
        return OperationsAdminMenuItem;
      case 'operations_manager':
        return OperationsManagerMenuItem;
      case 'assessor':
        return AssessorMenuItem;
      case 'system_admin':
        return SystemAdminMenuItem;
      case 'drdo_lab':
        return DRDOLabMenuItem;
      default:
        return EnterpriseAdminMenuItem;
    }
  };

  const menuItems = getMenuItems();

  const isActivePath = useCallback(
    path => {
      if (path === '/') {
        // Only active if exactly on root
        return location.pathname === '/';
      }
      // For other paths, active if path matches or is a prefix
      return location.pathname === path || location.pathname.startsWith(path + '/');
    },
    [location.pathname],
  );

  const [expandedMenuKey, setExpandedMenuKey] = useState(() => {
    // Initial expansion based on current route
    const activeSubMenu = menuItems.find(item => item.submenu && item.submenu.some(sub => isActivePath(sub.path)));
    return activeSubMenu ? activeSubMenu.key : null;
  });

  useEffect(() => {
    // Find active submenu on route change
    const activeSubMenu = menuItems.find(item => item.submenu && item.submenu.some(sub => isActivePath(sub.path)));
    if (activeSubMenu && expandedMenuKey !== activeSubMenu.key) {
      setExpandedMenuKey(activeSubMenu.key);
    }
  }, [location.pathname, role]); // role dependency since menuItems depends on it

  useEffect(() => {
    const header = document.querySelector('.custom-header');
    if (header) {
      if (isOpen) {
        header.classList.add('sidebar-open-header');
      } else {
        header.classList.remove('sidebar-open-header');
      }
    }
  }, [isOpen]);

  const handleNavigation = useCallback(
    path => {
      if (path) {
        navigate(path);
        // Matches the breakpoint where the sidebar is an overlay, not a rail.
        if (window.innerWidth <= 992) {
          onClose();
        }
      }
    },
    [navigate, onClose],
  );

  const handleToggle = useCallback(key => {
    setExpandedMenuKey(prev => (prev === key ? null : key));
  }, []);

  return (
    <>
      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* <div className="sidebar-toggle-bx">
          <button className="sidebar-toggle-btn" onClick={toggleSidebar} aria-label="Toggle sidebar">
            <img src={Icons.sideBarArrow} alt="Toggle Sidebar" className={`sideBarArrow ${!isOpen ? 'rotated' : ''}`} />
          </button>
        </div> */}
        <div className="sidebar-content">
          <div className="sidebar-logo">
            {isOpen ? (
              <img src={Images.logo} alt="Logo" className="sidebarLogo" />
            ) : (
              <img src={Images.samarLogo} alt="Logo" className="sidebar-closed-logo" />
            )}
          </div>
          <Nav className="sidebar-nav custom-sidebar-nav">
            {menuItems.map(item =>
              item.submenu ? (
                <SidebarSubMenu
                  key={item.key}
                  itemKey={item.key}
                  label={item.label}
                  icon={item.icon}
                  activeIcon={item.activeIcon}
                  submenu={item.submenu}
                  isActive={item.submenu.some(sub => isActivePath(sub.path))}
                  onNavigate={handleNavigation}
                  isOpen={expandedMenuKey === item.key}
                  onToggle={handleToggle}
                  locationPathname={location.pathname}
                  toolTipTitle={item.toolTipTitle}
                  isSidebarOpen={isOpen}
                  onOpenSidebar={toggleSidebar}
                />
              ) : (
                <Nav.Item key={item.key} className="sidebar-nav-item">
                  <Nav.Link className={`sidebar-nav-link ${isActivePath(item.path) ? 'active' : ''}`} onClick={() => handleNavigation(item.path)}>
                    <div className="nav-link-content">
                      <AppToolTip title={!isOpen ? item.toolTipTitle : ''} placement="right">
                        <div className="sidebar-icon">
                          <img src={isActivePath(item.path) && item.activeIcon ? item.activeIcon : item.icon} alt={item.label} className="nav-icon" />
                        </div>
                      </AppToolTip>
                      <span className="nav-text">{item.label}</span>
                    </div>
                  </Nav.Link>
                </Nav.Item>
              ),
            )}
          </Nav>

          <Nav className="sidebar-nav nav logout-nav">
            <Nav.Item className="sidebar-nav-item">
              <Nav.Link className={`sidebar-nav-link highlight-bg`}>
                <div className="nav-link-content" onClick={toggleSidebar} aria-label="Toggle sidebar">
                  <div className="sidebar-icon">
                    <img src={Icons.sideBarArrow} alt="Toggle Sidebar" className={`sideBarArrow ${!isOpen ? 'rotated' : ''} nav-icon`} />
                  </div>
                  <span className="nav-text">Collapse Menu</span>
                </div>
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
