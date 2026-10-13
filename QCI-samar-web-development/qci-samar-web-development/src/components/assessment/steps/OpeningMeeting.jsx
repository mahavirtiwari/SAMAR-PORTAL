import Meeting from './Meeting';

/**
 * Opening Meeting component (Step 3)
 * Wrapper around the shared Meeting component
 */
const OpeningMeeting = ({ onEditComment, onSaved }) => {
  return <Meeting type="opening" onEditComment={onEditComment} onSaved={onSaved} />;
};

export default OpeningMeeting;
