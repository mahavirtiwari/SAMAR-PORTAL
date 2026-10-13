import Meeting from './Meeting';

/**
 * Closing Meeting component (Step 7)
 * Wrapper around the shared Meeting component
 */
const ClosingMeeting = ({ onEditComment, onSaved }) => {
  return <Meeting type="closing" onEditComment={onEditComment} onSaved={onSaved} />;
};

export default ClosingMeeting;
