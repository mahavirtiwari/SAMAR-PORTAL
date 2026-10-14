import Icons from '../../constants/Icons';
import { onActivate } from '../../utils/a11y';
import AppAvatar from './AppAvatar';

const AppAssessmentParameter = ({
  documentIcon,
  title,
  questionCount,
  assignee,
  status = 'pending',
  statusIcon,
  questionNumbers,
  navigate,
  completedNumbers,
  completedCount,
  totalCount,
  assigneeRole,
  onClick,

  mandatory,
}) => {
  return (
    <div className={`payment-allocation-container rowBetween margin-bottom-16 ${onClick ? 'cursor-pointer' : ''}`} {...onActivate(onClick)}>
      <div>
        <div className="d-flex align-items-center">
          {documentIcon && <img src={Icons.twoNotesGrey} alt="" className="icon-32 margin-right-12" />}
          {statusIcon && (
            <div>
              <img src={status === 'completed' ? Icons.greenTickCircle : Icons.yellowClock} alt={status === 'completed' ? 'completed' : 'pending'} className="icon-24 margin-right-10" />
            </div>
          )}
          <div className="lh-normal-18">
            <h4 className="fs-16 fw-500 heading-color margin-bottom-2">{title}</h4>
            <div className="d-flex align-items-center">
              {questionNumbers && (
                <span className="fs-12 fw-500 text-3-color">
                  {questionCount} Question{questionCount !== 1 ? 's' : ''}
                </span>
              )}
              <div className="dot-separator" />
              <span className="fs-12 fw-500 text-3-color">{mandatory ? 'Mandatory' : 'Optional'}</span>
            </div>

            {completedNumbers && (
              <span className="fs-12 fw-500 text-3-color">
                <span className="primary-color">{completedCount}</span>/{totalCount} completed
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="d-flex align-items-center">
        <div className="d-flex user-profile-container">
          <AppAvatar alt={assignee} size="24" role={assigneeRole}>
            {assignee}
          </AppAvatar>
          <div className="lh-normal-18 margin-left-8">
            <h3 className="fs-14 fw-500 text-1-color mb-0">{assignee}</h3>
            <span className="fs-12 fw-400 text-2-color">{assigneeRole}</span>
          </div>
        </div>
        {navigate && (
          <div className="arrow-container margin-left-20">
            <img src={Icons.blueRightArrow} alt="" className="icon-18" />
          </div>
        )}
      </div>
    </div>
  );
};
export default AppAssessmentParameter;
