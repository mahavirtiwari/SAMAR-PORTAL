import { memo, useEffect, useState } from 'react';
import { Dropdown, Nav, Navbar } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import Icons from '../../constants/Icons';
import { logoutUserAction } from '../../redux/action/common/AccountAction';
import { getLoggedInUserDetailsAction } from '../../redux/action/common/UnitAdminAction';
import { Logger } from '../../utils/logger';
import { hasRole } from '../../utils/roleUtils';
import { AppBadge, AppModal } from '../base';

const Header = ({ onToggleSidebar, isSidebarOpen = false }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.Account);
  const { loggedInUserDetails, loggedInUserDetailsLoading } = useSelector(state => state.UnitAdmin);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // Local, not the shared Redux logoutLoading: that flag also flips for idle-timeout,
  // token-refresh-failure, and concurrent-session logouts happening in the background, which
  // made this button show a spinner the user never triggered (BUG-09751).
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // Only fetch user details if we don't already have them cached
    if (user?.id && !loggedInUserDetails && !loggedInUserDetailsLoading) {
      dispatch(getLoggedInUserDetailsAction(user.id));
    }
  }, [dispatch, user?.id, loggedInUserDetails, loggedInUserDetailsLoading]);

  // Use loggedInUserDetails when available, fall back to localStorage user data
  const isSystemAdmin = hasRole(loggedInUserDetails, 'system_admin');
  const isEnterpriseAdmin = hasRole(loggedInUserDetails, 'enterprise_admin');
  const isAssessor = hasRole(loggedInUserDetails, 'assessor');

  const userName = loggedInUserDetails
    ? isSystemAdmin
      ? 'System Admin'
      : `${loggedInUserDetails.firstName} ${loggedInUserDetails.lastName}`
    : user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : '';

  const enterpriseName = loggedInUserDetails?.organizationName || loggedInUserDetails?.enterpriseName || user?.organizationName || user?.enterpriseName || '';

  const displayName = isEnterpriseAdmin ? (enterpriseName || userName || '').toUpperCase() : userName;
  const profileUserName = isEnterpriseAdmin ? (userName || '').toUpperCase() : userName;
  const profileEnterpriseName = isEnterpriseAdmin ? enterpriseName.toUpperCase() : '';
  const displaySamarId = loggedInUserDetails?.samarId || user?.samarId || '';
  const roleName = isSystemAdmin ? '' : loggedInUserDetails?.roles?.[0]?.name || '';

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await dispatch(logoutUserAction());
      navigate('/');
    } catch (error) {
      Logger.error('Logout failed:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
  };
  return (
    <Navbar className="custom-header" expand="lg" fixed="top">
      <div className="header-content">
        <div className="header-left">
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? 'Collapse navigation menu' : 'Expand navigation menu'}
            aria-expanded={isSidebarOpen}
            title={isSidebarOpen ? 'Collapse menu' : 'Expand menu'}>
            <span />
            <span />
            <span />
          </button>
          <Navbar.Brand className="brand-title">
            {/* <img src={Images.defaultProfile} alt="SAMAR Logo" className="brand-logo" />
            <span className="brand-text">SAMAR</span> */}
          </Navbar.Brand>
        </div>

        <div className="header-right">
          <Nav className="header-nav">
            <Dropdown align="end">
              <Dropdown.Toggle variant="link" className="user-dropdown-toggle" id="user-dropdown">
                <div className="user-info">
                  <div className="user-name-role-wrapper">
                    <span className="user-name">{displayName}</span>
                    {roleName ? <span className="cusTags cusTags-header">{roleName}</span> : null}
                  </div>
                  <span className="user-id">{displaySamarId}</span>
                </div>
                <img src={Icons.defaultProfile} alt="" className="icon-40" />
              </Dropdown.Toggle>

              <Dropdown.Menu className="user-dropdown-menu">
                <div className="top-user-dropdown-menu">
                  <img src={Icons.defaultProfile} alt="" className="icon-60" />
                  <div>
                    <h4 className="fs-16 fw-600 heading-color mb-0">{profileUserName}</h4>
                    {isEnterpriseAdmin && profileEnterpriseName ? <p className="fs-12 fw-500 heading-color margin-top-2 mb-0">{profileEnterpriseName}</p> : null}
                    <p className="fs-12 fw-400 text-2-color text-uppercase margin-top-2 mb-0">{displaySamarId}</p>
                    {!isSystemAdmin && <AppBadge label={loggedInUserDetails?.roles?.[0]?.name} variant="grey" className="margin-top-6" />}
                  </div>
                </div>
                <div className="bottom-user-dropdown-menu">
                  <ul>
                    <li>
                      <Link to="/edit-profile">
                        <div>
                          <img src={Icons.userProfile} alt="" className="icon-18 margin-right-10" />
                          <span className="fs-14 fw-500 text-2-color">View Profile</span>
                        </div>
                        <img src={Icons.rightArrow} alt="" className="icon-16" />
                      </Link>
                    </li>

                    {isAssessor && (
                      <li>
                        <Link to="/set-unavailability">
                          <div>
                            <img src={Icons.calendar} alt="" className="icon-18 margin-right-10" />
                            <span className="fs-14 fw-500 text-2-color">Set Unavailability</span>
                          </div>
                          <img src={Icons.rightArrow} alt="" className="icon-16" />
                        </Link>
                      </li>
                    )}

                    <li>
                      <Link to="/change-password">
                        <div>
                          <img src={Icons.key} alt="" className="icon-18 margin-right-10" />
                          <span className="fs-14 fw-500 text-2-color">Change Password</span>
                        </div>
                        <img src={Icons.rightArrow} alt="" className="icon-16" />
                      </Link>
                    </li>
                    <li>
                      <Link to="#" onClick={handleLogoutClick}>
                        <div>
                          <img src={Icons.logoutRed} alt="" className="icon-18 margin-right-10" />
                          <span className="fs-14 fw-500 danger-primary-color">Logout</span>
                        </div>
                        {/* <img src={Icons.rightArrow} alt="" className="icon-16" /> */}
                      </Link>
                    </li>
                  </ul>
                </div>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </div>
      </div>

      <AppModal
        modalHeaderStyle={{ backgroundColor: 'var(--danger-light)' }}
        image={Icons.logoutCircle}
        show={showLogoutModal}
        handleClose={handleCancelLogout}
        header={'Log out'}
        subHeader={'You will need to sign in again to return.'}
        twoButtons={true}
        leftButton="Cancel"
        leftButtonClassName={'w-100 tertiary'}
        leftButtonOnClick={handleCancelLogout}
        rightButton="Logout"
        rightButtonClassName={'w-100 danger-primary'}
        rightButtonOnClick={handleLogout}
        rightButtonLoading={loggingOut}
      />
    </Navbar>
  );
};

export default memo(Header);
