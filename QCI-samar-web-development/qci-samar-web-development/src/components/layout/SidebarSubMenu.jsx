import PropTypes from 'prop-types';
import React from 'react';
import Icons from '../../constants/Icons';
import { AppToolTip } from '../base';

// Enter or Space on a focused menu entry acts like a click.
const activateOnKey = (event, action) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

const SidebarSubMenu = React.memo(({ label, icon, activeIcon, submenu, isActive, onNavigate, isOpen, onToggle, itemKey, locationPathname, toolTipTitle, isSidebarOpen, onOpenSidebar }) => {
  const handleSubClick = (e, sub) => {
    e.stopPropagation(); // Stop propagation to prevent triggering parent toggle if nested
    // No need to setOpen(true) here as navigation will trigger useEffect if matching,
    // or we are just navigating.
    // But typically we want it to stay open.
    onNavigate(sub.path);
  };

  const handleToggleClick = () => {
    // If sidebar is collapsed, open it first
    if (!isSidebarOpen && onOpenSidebar) {
      onOpenSidebar();
    }
    onToggle(itemKey);
  };

  // Memoize isActiveSub to prevent re-renders when other items are active
  const renderSubmenu = () => {
    return submenu.map((sub, idx) => {
      const key = sub.key || sub.path;
      const isActiveSub = locationPathname === sub.path || locationPathname.startsWith(sub.path + '/');
      return (
        <div
          key={key + '_' + idx}
          className={`sidebar-subitem ${isActiveSub ? 'sidebar-subitem-active' : ''}`}
          role="link"
          tabIndex={isOpen ? 0 : -1}
          aria-current={isActiveSub ? 'page' : undefined}
          onClick={e => handleSubClick(e, sub)}
          onKeyDown={e => activateOnKey(e, () => handleSubClick(e, sub))}>
          {sub.label}
        </div>
      );
    });
  };

  return (
    <div className="sidebar-nav-item sidebar-submenu-parent">
      <div
        className={`sidebar-nav-link${isActive ? ' active' : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={handleToggleClick}
        onKeyDown={e => activateOnKey(e, handleToggleClick)}>
        <div className="nav-link-content">
          <AppToolTip title={!isSidebarOpen ? toolTipTitle : ''} placement="right">
            <div className="sidebar-icon">{icon && <img src={isActive && activeIcon ? activeIcon : icon} alt="" className="nav-icon" />}</div>
          </AppToolTip>
          <span className="nav-text">{label}</span>
        </div>
        <span className="submenu-arrow" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(-181deg)' : 'rotate(-2deg)' }} aria-hidden="true">
          <img src={Icons.DownArrow} alt="" className="arrow-icon" />
        </span>
      </div>
      <div
        className={`sidebar-submenu${isOpen ? ' open' : ''}`}
        style={{
          maxHeight: isOpen ? submenu.length * 48 + 'px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.2s cubic-bezier(0.4,0,0.2,1), padding-left 0.2s, opacity 0.2s',
          paddingLeft: isOpen ? 50 : 0,
          opacity: isOpen ? 1 : 0,
        }}>
        {renderSubmenu()}
      </div>
    </div>
  );
});

SidebarSubMenu.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.string,
  activeIcon: PropTypes.string,
  submenu: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      path: PropTypes.string.isRequired,
      key: PropTypes.string,
    }),
  ).isRequired,
  isActive: PropTypes.bool,
  onNavigate: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  itemKey: PropTypes.string.isRequired,
  locationPathname: PropTypes.string.isRequired,
  isSidebarOpen: PropTypes.bool,
  onOpenSidebar: PropTypes.func,
};

export default SidebarSubMenu;
