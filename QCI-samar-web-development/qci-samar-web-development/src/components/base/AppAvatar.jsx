import { useState } from 'react';
import '../../assets/theme/avatar.css';

export const getInitials = (name = '') => {
  if (!name || typeof name !== 'string') {
    return '';
  }

  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

/**
 * AppAvatar
 *
 * Props:
 *  - src: string (optional) - image URL. If provided and loads, the image is shown.
 *  - alt: string (optional) - alt/title text for the avatar image.
 *  - size: numeric string one of '24','28','36','40','46' (defaults to '40').
 *          The component will apply a class `avatar--<size>` (for example `avatar--28`).
 *  - role: string (optional) - user role used to pick a color combo. Defaults to 'Participant'.
 *          Role string is normalized by lowercasing and removing spaces/hyphens before matching.
 *          Mapping rules (current):
 *            - If the role indicates a Lead Assessor -> use class `lead-assessor`.
 *            - If the role indicates an Active Assessor -> use class `active-assessor`.
 *            - For all other values (CoAssessor, Participant or any unknown role) ->
 *              use class `co-assessor`.
 *          Note: the `participant` CSS class is no longer emitted by this component.
 *  - className: string (optional) - additional classname(s) to apply
 *  - children: fallback content (typically initials returned by getInitials(name))
 *
 * Supported sizes (pixels): 24, 28, 36, 40, 46
 * Note: avatars have a 1px border included via box-sizing.
 *
 * Usage examples:
 *  // Image avatar for a lead assessor (keeps distinct lead styling)
 *  <AppAvatar src={user.avatar} alt={user.name} size="36" role="LeadAssessor" />
 *
 *  // Initials avatar for a co-assessor
 *  <AppAvatar alt={user.name} size="28" role="CoAssessor">{getInitials(user.name)}</AppAvatar>
 *
 *  // Any other role (including Participant) will use the co-assessor styling
 *  <AppAvatar alt={user.name} size="24" role="Participant">{getInitials(user.name)}</AppAvatar>
 */

const AppAvatar = ({ src, alt = '', size = '40', role = 'Participant', className = '', children, style = {}, onClick }) => {
  const sizeClass = `avatar--${size}`;

  // normalize role into a css class token
  const mapRoleToClass = r => {
    if (!r) {
      return '';
    }

    // normalize by lowercasing and removing spaces and hyphens so
    // 'Lead Assessor', 'Lead-Assessor' and 'LeadAssessor' all match
    const rr = r.toLowerCase().replace(/[-\s]+/g, '');
    // If explicitly a lead assessor, keep that distinctive class.
    if (rr.includes('leadassessor')) {
      return 'lead-assessor';
    }

    if (rr.includes('activeassessor')) {
      return 'active-assessor';
    }

    // For any other role (including coassessor, participant, or unknown),
    // use the co-assessor styling per new requirement.
    return 'co-assessor';
  };
  const roleClass = mapRoleToClass(role);
  const [imgError, setImgError] = useState(false);

  // derive initials to display when image is not available
  // priority: if children is a short initials string (<=2 letters), use it as-is;
  // otherwise attempt to compute initials from children (if string) or from alt.
  const computeDisplayInitials = () => {
    if (children && typeof children === 'string') {
      const trimmed = children.trim();
      // if children already looks like initials (1-2 letters), use directly
      if (/^[A-Za-z]{1,2}$/.test(trimmed)) {
        return trimmed.toUpperCase();
      }
      // otherwise try to compute initials from the provided children string
      const fromChildren = getInitials(trimmed);
      if (fromChildren) {
        return fromChildren;
      }
    }

    // fallback to alt (name)
    return getInitials(alt || '');
  };

  const displayInitials = computeDisplayInitials();

  if (src && !imgError) {
    return (
      <div className={`avatar ${sizeClass} ${roleClass} avatar--image ${className}`.trim()} title={alt} style={{ ...style }} onClick={onClick}>
        <img src={src} alt={alt} className="avatar-img" loading="lazy" onError={() => setImgError(true)} />
      </div>
    );
  }

  return (
    <div className={`avatar ${sizeClass} ${roleClass} ${className}`.trim()} title={alt} aria-label={alt} style={{ ...style }} onClick={onClick}>
      <span className="avatar-initials">{displayInitials}</span>
    </div>
  );
};

export default AppAvatar;
