import AppAvatar, { getInitials } from './AppAvatar';

/**
 * ParticipantCard
 * A small reusable component showing an avatar, name and role.
 * Props:
 *  - participant: { name, role, avatar }
 */
const ParticipantCard = ({ participant = {} }) => {
  const { name = '', role = '' } = participant;

  return (
    <div className="d-flex align-items-center">
      <AppAvatar size={'28'} alt={name} role={role}>
        {getInitials(name)}
      </AppAvatar>
      <div className="margin-left-12 lh-normal-18">
        <h3 className="fs-14 fw-500 text-1-color mb-0">{name}</h3>
        <span className="fs-12 fw-400 text-3-color">{role}</span>
      </div>
    </div>
  );
};

export default ParticipantCard;
