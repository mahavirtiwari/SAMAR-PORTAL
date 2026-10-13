import { AvatarGroup, Tooltip } from '@mui/material';
import AppAvatar from './AppAvatar';

/**
 * AvatarTooltip
 * Modular tooltip for displaying assessors with avatar group and details popup.
 * @param {Object[]} assessors - Array of assessor objects
 * @param {number} maxAvatars - Max avatars to show in group (default: 4)
 * @param {Object} avatarGroupSx - Custom sx for AvatarGroup
 * @param {Object} tooltipSx - Custom sx for Tooltip
 * @param {string} placement - Tooltip placement (default: 'bottom')
 * @returns React component
 */
const AppAvatarTooltip = ({
  assessors = [],
  maxAvatars = 4,
  avatarGroupSx = {
    display: 'flex !important',
    flexDirection: 'row-reverse !important',
    '& .MuiAvatarGroup-avatar': {
      marginLeft: '0px !important',
      marginRight: '-8px !important',
    },
    '& .MuiAvatar-root': {
      width: 24,
      height: 24,
      fontSize: '10px',
      fontWeight: 600,
      backgroundColor: '#7239EA',
      color: 'var(--white)',
      border: '1px solid var(--white)',
      position: 'static !important',
    },
  },
  tooltipSx = {
    '& .MuiTooltip-tooltip': {
      backgroundColor: 'var(--white)',
      color: 'var(--text-1)',
      boxShadow: 'none',
    },
    '& .MuiTooltip-arrow': {
      color: 'var(--white)',
    },
  },
  placement = 'bottom',
}) => {
  return (
    <Tooltip
      title={
        <div style={{ minWidth: '280px', padding: 'var(--space-12)', background: 'var(--white)', marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)', borderRadius: 'var(--radius-4)' }}>
          {assessors.map((assessor, index) => {
            const isLead = index === 0;
            // Split location if available
            let _city = '',
              _state = '';

            if (assessor.location && assessor.location.includes('·')) {
              [_city, _state] = assessor.location.split('·').map(s => s.trim());
            }
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: index === assessors.length - 1 ? 0 : '12px',
                  borderBottom: index === assessors.length - 1 ? 0 : '1px solid #F3F4F6',
                  paddingBottom: '12px',
                }}>
                <AppAvatar size="40" role={isLead ? 'LeadAssessor' : 'Participant'} className="">
                  {assessor.initials}
                </AppAvatar>
                <div className="flex margin-left-10">
                  <div className="fs-14 fw-500 heading-color">{assessor.name}</div>
                </div>
              </div>
            );
          })}
        </div>
      }
      placement={placement}
      sx={tooltipSx}
      arrow>
      <div style={{ cursor: 'pointer' }}>
        <AvatarGroup max={maxAvatars} sx={avatarGroupSx}>
          {assessors
            .slice()
            .reverse()
            .map((assessor, reversedIndex) => {
              const originalIndex = assessors.length - 1 - reversedIndex;
              const index = originalIndex;
              const isLeadSmall = index === assessors.length - 1;
              return (
                <AppAvatar key={index} size="24" role={isLeadSmall ? 'LeadAssessor' : 'Participant'} className="">
                  {assessor.initials}
                </AppAvatar>
              );
            })}
        </AvatarGroup>
      </div>
    </Tooltip>
  );
};

export default AppAvatarTooltip;
