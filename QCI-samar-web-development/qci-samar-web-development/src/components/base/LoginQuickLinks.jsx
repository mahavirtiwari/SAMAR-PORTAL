import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import Icons from '../../constants/Icons';
import { DEFAULT_QUICK_LINKS, getQuickLinks } from '../../services/api/utils/QuickLinkService';

/**
 * The quick links under the login page picture (Settings → Quick Links): each
 * opens a web address or downloads a PDF in a new tab. `compact` is the small
 * version shown under the form where the picture column is hidden.
 */
const LoginQuickLinks = ({ compact = false, className = '' }) => {
  const [links, setLinks] = useState(DEFAULT_QUICK_LINKS);

  useEffect(() => {
    let active = true;
    getQuickLinks().then(list => active && setLinks(list));
    return () => {
      active = false;
    };
  }, []);

  if (links.length === 0) {
    return null;
  }

  return (
    <nav className={`${compact ? 'login-quick-links-compact' : 'quickLinksContainer'} ${className}`.trim()} aria-label="Quick links">
      {compact ? null : <p className="fs-18 fw-600 primary-color mb-0">{links.length > 1 ? 'Quick Links' : 'Quick Link'}</p>}
      <ul className="login-quick-links">
        {links.map(link => (
          <li key={link.id}>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="d-flex align-items-center gap-6 text-decoration-none">
              <img src={Icons.fourDot} alt="" className="icon-12" />
              <span className={`${compact ? 'fs-14' : 'fs-16'} fw-500 text-1-color`}>{link.label}</span>
              {link.isFile || /\.pdf($|\?)/i.test(link.href) ? <img src={Icons.arrowDown} alt="" className="icon-12" /> : null}
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

LoginQuickLinks.propTypes = {
  compact: PropTypes.bool,
  className: PropTypes.string,
};

export default LoginQuickLinks;
