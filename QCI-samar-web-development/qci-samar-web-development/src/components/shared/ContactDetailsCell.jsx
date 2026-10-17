import PropTypes from 'prop-types';
import Icons from '../../constants/Icons';

/**
 * Email and mobile number stacked in one list cell ("Contact Details"), so the
 * user lists fit on one screen. Long emails wrap rather than being cut off.
 */
// A long email wraps after the "@" first rather than in the middle of a word.
const BreakAfterAt = ({ text }) => {
  const at = text.indexOf('@');
  if (at < 0) {
    return text;
  }
  return (
    <>
      {text.slice(0, at + 1)}
      <wbr />
      {text.slice(at + 1)}
    </>
  );
};

BreakAfterAt.propTypes = { text: PropTypes.string.isRequired };

const ContactDetailsCell = ({ email, mobile }) => (
  <div className="contact-details-cell">
    <span className="contact-details-line">
      <img src={Icons.email} alt="" />
      <span>{email ? <BreakAfterAt text={email} /> : '-'}</span>
    </span>
    <span className="contact-details-line">
      <img src={Icons.receiver} alt="" />
      <span>{mobile || '-'}</span>
    </span>
  </div>
);

ContactDetailsCell.propTypes = {
  email: PropTypes.string,
  mobile: PropTypes.string,
};

export default ContactDetailsCell;
