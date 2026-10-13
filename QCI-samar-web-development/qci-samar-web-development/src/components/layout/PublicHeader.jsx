import { useEffect, useState } from 'react';
import { Dropdown, Nav, Navbar } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import Icons from '../../constants/Icons';
import Images from '../../constants/Images';
import { logoutUserAction } from '../../redux/action/common/AccountAction';
import { getLoggedInUserDetailsAction } from '../../redux/action/common/UnitAdminAction';
import { Logger } from '../../utils/logger';
import { hasRole } from '../../utils/roleUtils';
import { AppBadge, AppModal } from '../base';

const PublicHeader = () => {
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.Account);
  const { loggedInUserDetails, loggedInUserDetailsLoading } = useSelector(state => state.UnitAdmin);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // Local, not the shared Redux logoutLoading: that flag also flips for idle-timeout,
  // token-refresh-failure, and concurrent-session logouts happening in the background, which
  // made this button show a spinner the user never triggered (BUG-09751).
  const [loggingOut, setLoggingOut] = useState(false);
  const isSystemAdmin = hasRole(loggedInUserDetails, 'system_admin');
  const isEnterpriseAdmin = hasRole(loggedInUserDetails, 'enterprise_admin');

  const userName = loggedInUserDetails
    ? isSystemAdmin
      ? 'System Admin'
      : `${loggedInUserDetails.firstName} ${loggedInUserDetails.lastName}`
    : user
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
      : '';

  const enterpriseName = loggedInUserDetails?.organizationName || loggedInUserDetails?.enterpriseName || user?.organizationName || user?.enterpriseName || '';

  const displayName = isEnterpriseAdmin ? (enterpriseName || userName || '').toUpperCase() : userName;
  const profileUserName = isEnterpriseAdmin ? (userName || '').toUpperCase() : userName;
  const profileEnterpriseName = isEnterpriseAdmin ? enterpriseName.toUpperCase() : '';
  const displaySamarId = loggedInUserDetails?.samarId || user?.samar_id || '';

  useEffect(() => {
    // Only fetch user details if we don't already have them cached
    if (user?.id && !loggedInUserDetails && !loggedInUserDetailsLoading) {
      dispatch(getLoggedInUserDetailsAction(user.id));
    }
  }, [dispatch, user?.id, loggedInUserDetails, loggedInUserDetailsLoading]);

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
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
  return (
    // <header className="publicHeader">
    //   <Container fluid>
    //     <Row>
    //       <Col>
    //         {/* <div className="publicHeaderLogo">
    //           <img src={Images.samarLogo} alt="Logo" className="logo" />
    //           <p className="fs-20 fw-600 text-1-color mb-0">SAMAR</p>
    //         </div> */}
    //         {/* <div className="header-content"> */}
    //         <div className="header-left">
    //           <div className="publicHeaderLogo">
    //             <img src={Images.samarLogo} alt="Logo" className="logo" />
    //             <p className="fs-20 fw-600 text-1-color mb-0">SAMAR</p>
    //           </div>
    //         </div>

    //         <div className="header-right">
    //           <Nav className="header-nav">
    //             <Dropdown align="end">
    //               <Dropdown.Toggle variant="link" className="user-dropdown-toggle" id="user-dropdown">
    //                 <div className="user-info">
    //                   <span className="user-name">{displayName}</span>
    //                   <span className="user-id">{displaySamarId}</span>
    //                 </div>
    //                 <img src={Icons.defaultProfile} alt="SAMAR Logo" className="icon-40" />
    //               </Dropdown.Toggle>

    //               <Dropdown.Menu className="user-dropdown-menu">
    //                 <div className="top-user-dropdown-menu">
    //                   <img src={Icons.defaultProfile} alt="SAMAR Logo" className="icon-60" />
    //                   <div>
    //                     <h4 className="fs-16 fw-600 heading-color mb-0">{displayName}</h4>
    //                     <p className="fs-12 fw-400 text-2-color text-uppercase margin-top-2 mb-0">{displaySamarId}</p>
    //                     {!(loggedInUserDetails?.roles?.[0]?.name === 'System Admin') && <AppBadge label={loggedInUserDetails?.roles?.[0]?.name} variant="grey" className="margin-top-6" />}
    //                   </div>
    //                 </div>
    //                 <div className="bottom-user-dropdown-menu">
    //                   <ul>
    //                     <li>
    //                       <Link to="/edit-profile">
    //                         <div>
    //                           <img src={Icons.userProfile} alt="profile" className="icon-18 margin-right-10" />
    //                           <span className="fs-14 fw-500 text-2-color">View Profile</span>
    //                         </div>
    //                         <img src={Icons.rightArrow} alt="arrow" className="icon-16" />
    //                       </Link>
    //                     </li>

    //                     <li>
    //                       <Link to="/change-password">
    //                         <div>
    //                           <img src={Icons.key} alt="profile" className="icon-18 margin-right-10" />
    //                           <span className="fs-14 fw-500 text-2-color">Change Password</span>
    //                         </div>
    //                         <img src={Icons.rightArrow} alt="arrow" className="icon-16" />
    //                       </Link>
    //                     </li>
    //                     <li>
    //                       <Link to="#" onClick={handleLogoutClick}>
    //                         <div>
    //                           <img src={Icons.logoutRed} alt="profile" className="icon-18 margin-right-10" />
    //                           <span className="fs-14 fw-500 danger-primary-color">Logout</span>
    //                         </div>
    //                         {/* <img src={Icons.rightArrow} alt="arrow" className="icon-16" /> */}
    //                       </Link>
    //                     </li>
    //                   </ul>
    //                 </div>
    //               </Dropdown.Menu>
    //             </Dropdown>
    //           </Nav>
    //         </div>
    //         {/* </div> */}
    //       </Col>
    //     </Row>
    //   </Container>
    // </header>
    <Navbar className="publicHeader">
      <div className="publicheader-content">
        <div className="header-left">
          <Navbar.Brand className="publicHeaderLogo">
            <img src={Images.samarLogo} alt="Logo" className="logo" />
            <p className="fs-20 fw-600 text-1-color mb-0">SAMAR</p>
          </Navbar.Brand>
        </div>

        <div className="header-right">
          <Nav className="header-nav">
            <Dropdown align="end">
              <Dropdown.Toggle variant="link" className="user-dropdown-toggle" id="user-dropdown">
                <div className="user-info">
                  <span className="user-name">{displayName}</span>
                  <span className="user-id">{displaySamarId}</span>
                </div>
                <img src={Icons.defaultProfile} alt="SAMAR Logo" className="icon-40" />
              </Dropdown.Toggle>

              <Dropdown.Menu className="user-dropdown-menu">
                <div className="top-user-dropdown-menu">
                  <img src={Icons.defaultProfile} alt="SAMAR Logo" className="icon-60" />
                  <div>
                    <h4 className="fs-16 fw-600 heading-color mb-0">{profileUserName}</h4>
                    {isEnterpriseAdmin && profileEnterpriseName ? <p className="fs-12 fw-500 heading-color margin-top-2 mb-0">{profileEnterpriseName}</p> : null}
                    <p className="fs-12 fw-400 text-2-color text-uppercase margin-top-2 mb-0">{displaySamarId}</p>
                    {!isSystemAdmin && <AppBadge label={loggedInUserDetails?.roles?.[0]?.name} variant="grey" className="margin-top-6" />}
                  </div>
                </div>
                <div className="bottom-user-dropdown-menu">
                  <ul>
                    {/* <li>
                      <Link to="/edit-profile">
                        <div>
                          <img src={Icons.userProfile} alt="profile" className="icon-18 margin-right-10" />
                          <span className="fs-14 fw-500 text-2-color">View Profile</span>
                        </div>
                        <img src={Icons.rightArrow} alt="arrow" className="icon-16" />
                      </Link>
                    </li> */}
                    <li>
                      <Link to="#" onClick={handleLogoutClick}>
                        <div>
                          <img src={Icons.logoutRed} alt="profile" className="icon-18 margin-right-10" />
                          <span className="fs-14 fw-500 danger-primary-color">Logout</span>
                        </div>
                        {/* <img src={Icons.rightArrow} alt="arrow" className="icon-16" /> */}
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

export default PublicHeader;
