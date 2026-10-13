import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Icons from '../../constants/Icons';
import { getResponsesAction } from '../../redux/action/common/ApplicationAssessmentAction';
import { isServiceSector } from '../../utils/assessmentExecution';
import { formatQuestionScore } from '../../utils/assessmentScoreUtils';
import { formatDateTime } from '../../utils/formatters';
import { Logger } from '../../utils/logger';
import AppAssessmentEvidenceImage from './AppAssessmentEvidenceImage';

const AppViewAssessmentQuestions = ({ score, editComment = false, propParameterId, questions, currentQIndex, assessmentId, data, validationError, onActionChange, rcScoreApplicable = false }) => {
  const { responses } = useSelector(state => state.ApplicationAssessment);
  const { pendingQcActions = [], assessment } = useSelector(state => state.Assessment || {});
  const serviceSector = isServiceSector(assessment?.data?.assessment || assessment?.assessment || assessment);

  // Choose parameter to display: propParameter > parameterId from props > fallback null
  const parameter = propParameterId ? responses?.parameters?.find(p => String(p.id) === String(propParameterId)) : null;
  // Use questions prop if provided, otherwise fallback to previous logic
  const questionsSource = questions && Array.isArray(questions) && questions.length > 0 ? questions : (parameter?.questions ?? responses?.questions);
  // responses may be an array or object; normalized where needed
  const normalizeOptions = opts => {
    // If array, normalize each entry to { id, text }
    if (Array.isArray(opts)) {
      return opts
        ?.map((o, i) => {
          if (o == null) {
            return null;
          }
          if (typeof o === 'string' || typeof o === 'number') {
            return { id: String(i), text: String(o) };
          }
          return { id: String(o.id ?? i), text: o.text ?? o.optionText ?? o.label ?? '', ...o };
        })
        .filter(Boolean);
    }

    // If object, keys may be numeric strings ('1','2') or arbitrary keys. Convert to ordered array.
    if (opts && typeof opts === 'object') {
      const keys = Object.keys(opts).filter(k => opts[k] != null);
      const numericKeys = keys.every(k => !Number.isNaN(Number(k)));
      const orderedKeys = numericKeys
        ? keys
            ?.map(k => Number(k))
            .sort((a, b) => a - b)
            ?.map(String)
        : keys;
      return orderedKeys
        ?.map((k, i) => {
          const v = opts[k];
          if (v == null) {
            return null;
          }
          if (typeof v === 'string' || typeof v === 'number') {
            return { id: String(k ?? i), text: String(v) };
          }
          return { id: String(v.id ?? k ?? i), text: v.text ?? v.optionText ?? v.label ?? '', ...v };
        })
        .filter(Boolean);
    }
    return [];
  };

  const resolveDisplayedSelectedOption = q => {
    if (!q) {
      return '';
    }

    const options = normalizeOptions(q?.options);
    const rawRcScore = q?.response?.rcScore;
    const parsedRcScore = rawRcScore !== null && rawRcScore !== undefined && String(rawRcScore) !== '' ? parseFloat(rawRcScore) : NaN;

    if (!Number.isNaN(parsedRcScore)) {
      const matched = options.find(opt => {
        const rawOptionScore = opt?.score ?? opt?.optionScore ?? opt?.weight ?? opt?.value;
        const parsedOptionScore = rawOptionScore !== null && rawOptionScore !== undefined && String(rawOptionScore) !== '' ? parseFloat(rawOptionScore) : NaN;
        return !Number.isNaN(parsedOptionScore) && parsedOptionScore === parsedRcScore;
      });

      if (matched?.id !== undefined && matched?.id !== null) {
        return String(matched.id);
      }
    }

    const serverSelected = q?.response?.selectedOption;
    const defaultOpt = serverSelected ?? options[2]?.id;
    return typeof defaultOpt !== 'undefined' && defaultOpt !== null ? String(defaultOpt) : '';
  };

  const getDefaultAnswers = () => {
    const defaults = {};

    const questions = Array.isArray(questionsSource)
      ? questionsSource
      : questionsSource && typeof questionsSource === 'object'
        ? Object.keys(questionsSource)
            ?.map(k => ({ key: k, ...questionsSource[k] }))
            .sort((a, b) => {
              const ak = Number(a.key);
              const bk = Number(b.key);
              if (!Number.isNaN(ak) && !Number.isNaN(bk)) {
                return ak - bk;
              }
              return 0;
            })
            ?.map(q => ({ id: q.id ?? q.key, questionText: q.questionText ?? q.title ?? '', options: q.options, response: q.response ?? {} }))
        : [];

    questions.forEach(q => {
      defaults[q.id] = resolveDisplayedSelectedOption(q);
    });
    return defaults;
  };

  const [selectedAnswers, setSelectedAnswers] = useState(getDefaultAnswers());
  const [internalQIndex, _setInternalQIndex] = useState(0);
  const [_modalOpen, setModalOpen] = useState(false);

  const [_sendBackComment, setSendBackComment] = useState('');

  // State for selected action in Action group
  const [_selectedAction, setSelectedAction] = useState('');
  const dispatch = useDispatch();
  const activeQIndex = typeof currentQIndex === 'number' ? currentQIndex : internalQIndex;

  const handleEditClick = () => {
    setModalOpen(true);
  };

  // Ensure each question has assessedAt and assessorRemarks (for dummy data)
  const addDefaultsToQuestions = arr =>
    arr.map(q => ({
      ...q,
      assessedAt: q.assessedAt || (q.response && q.response.assessedAt) || new Date().toISOString(),
      assessorRemarks: q.assessorRemarks || (q.response && q.response.assessorRemarks) || 'No comment provided.',
    }));

  const questionsList = Array.isArray(questionsSource)
    ? addDefaultsToQuestions(questionsSource)
    : questionsSource && typeof questionsSource === 'object'
      ? addDefaultsToQuestions(
          Object.keys(questionsSource)
            ?.map(k => ({ key: k, ...questionsSource[k] }))
            .sort((a, b) => {
              const ak = Number(a.key);
              const bk = Number(b.key);
              if (!Number.isNaN(ak) && !Number.isNaN(bk)) {
                return ak - bk;
              }
              return 0;
            })
            ?.map(q => ({ id: q.id ?? q.key, questionText: q.questionText ?? q.title ?? '', options: q.options, response: q.response ?? {} })),
        )
      : [];

  // Use prop currentQIndex if provided, else use internal state
  const currentQuestion = questionsList[activeQIndex] || { id: null, questionText: '', options: [], response: {} };

  const questionStatus = String((currentQuestion && (currentQuestion.reviewStatus || currentQuestion.response?.reviewStatus)) || '').toLowerCase();
  const _showAction = questionStatus === 'pending';

  // This is the read-only committee View screen (decided / certified assessments). The RC score is
  // never editable here, so lock every question regardless of its per-review status — otherwise a
  // question still marked 'pending' (e.g. the last one, never stamped on certify) stays editable.
  const optionsDisabled = true;

  // Set selectedAction based on server-provided reviewStatus for the active question
  useEffect(() => {
    try {
      // Prefer any pending redux action for this question first
      const pending = Array.isArray(pendingQcActions) ? pendingQcActions.find(p => String(p.assessmentId) === String(assessmentId) && String(p.questionId) === String(currentQuestion.id)) : undefined;
      Logger.info('Determining selected action for question with reviewStatus:', currentQuestion.reviewStatus, 'and pending item:', pending);
      if (pending?.type === 'markSendBack') {
        setSelectedAction('markSendBack');
      } else {
        const status = String((currentQuestion && (currentQuestion.reviewStatus || currentQuestion.response?.reviewStatus)) || '').toLowerCase();
        if (status === 'approved') {
          setSelectedAction('approve');
        } else if (status === 'flagged') {
          setSelectedAction('markSendBack');
        } else {
          setSelectedAction('');
        }
      }
      setSendBackComment('');
    } catch (err) {
      setSelectedAction('');
      setSendBackComment('');
      Logger.error('Error setting selected action', err);
    }
  }, [activeQIndex, currentQuestion?.id, currentQuestion?.reviewStatus, currentQuestion?.response?.reviewStatus, pendingQcActions, assessmentId]);
  // currentQuestion normalized above
  const handleOptionSelect = async (questionId, optionId) => {
    if (optionsDisabled) {
      return;
    }
    const optionStr = optionId == null ? '' : String(optionId);
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionStr,
    }));

    try {
      if (assessmentId && questionId) {
        // await dispatch(submitResponseAction({ assessmentId, questionId, data: { selectedOption: optionId } })).unwrap();
        // Refresh responses so UI binds to latest server state
        dispatch(getResponsesAction(assessmentId));
      }
    } catch (err) {
      Logger.error('Failed to submit response:', err);
    }
  };

  return (
    <div className="details-card">
      <div className="row">
        <div className="d-flex justify-content-center margin-bottom-40">
          <span className="fs-24 fw-600 heading-color MuiBox-root">Question {questionsList.findIndex(q => q.id === currentQuestion.id) + 1}</span>
          <span className="fs-16 fw-600 text-2-color margin-left-2 d-flex align-items-end">/{questionsList.length}</span>
        </div>
        {/* LEFT SIDE QUESTION */}
        <div className="col-12 col-md-8 support-form-section parameter-question-container">
          <div>
            {(() => {
              // prefer redux pending item for this question
              const pendingItem = Array.isArray(pendingQcActions)
                ? pendingQcActions.find(p => String(p.assessmentId) === String(assessmentId) && String(p.questionId) === String(currentQuestion.id))
                : undefined;
              const statusKey = String(questionStatus || '').toLowerCase();
              const isPendingSendBack = pendingItem?.type === 'markSendBack';
              const showClarification = isPendingSendBack || ['flagged', 'send_back', 'clarification_required'].includes(statusKey);
              if (!showClarification) {
                return null;
              }

              const statusConfig = { bg: 'var(--danger-light)', color: 'var(--danger-active)', label: 'Clarification Required', icon: Icons.redFlag };

              return (
                <div className="d-flex juatify-content-start">
                  <div className="response-container d-inline-flex align-items-center margin-bottom-8" style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}>
                    <div className="response-icon-container margin-right-4">
                      <img src={statusConfig.icon} alt="response icon" className="icon-14" />
                    </div>
                    <span className="fs-12 fw-500">{statusConfig.label}</span>
                  </div>
                </div>
              );
            })()}
            <div className="d-flex align-items-start gap-2 mb-3">
              <h3 className="fs-16 fw-600 heading-color mb-0">
                <span>Q. </span>
                {currentQuestion.questionText || currentQuestion.question || currentQuestion.title || ''}
              </h3>
            </div>
            <FormControl fullWidth>
              <RadioGroup value={selectedAnswers[currentQuestion.id] ?? resolveDisplayedSelectedOption(currentQuestion)} onChange={e => handleOptionSelect(currentQuestion.id, e.target.value)}>
                {normalizeOptions(currentQuestion?.options)?.map(opt => (
                  <FormControlLabel
                    key={opt.id}
                    value={opt.id}
                    disabled={optionsDisabled}
                    control={
                      <Radio
                        icon={<img src={optionsDisabled ? Icons.disabledUncheck : Icons.defaultUncheck} className="icon-20" />}
                        checkedIcon={<img src={optionsDisabled ? Icons.disabledRadio : Icons.radioBtn} className="icon-20" />}
                      />
                    }
                    label={opt.text}
                    sx={{
                      '& .MuiFormControlLabel-label': {
                        fontSize: 'var(--fs-sm)',
                        fontFamily: 'Inter-Medium',
                        color: 'var(--text-2)',
                      },
                      '&.Mui-disabled .MuiFormControlLabel-label': {
                        color: '#949494 !important',
                      },
                    }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </div>
        </div>

        {/* RIGHT SIDE COMMENT + EVIDENCE */}
        <div className="col-12 col-md-4 ps-0">
          <div className="padding-left-24">
            {!score && (
              <>
                <div className="d-flex gap-3">
                  <div className="score-box">
                    <span className="score-value text-primary fw-500 fs-20 margin-right-4">{formatQuestionScore(currentQuestion.response?.score ?? currentQuestion.score)}</span>
                    <span className="score-label fs-16 fw-500 text-2-color">{serviceSector ? 'RA Score' : 'SA Score'}</span>
                  </div>
                  <div className="score-box">
                    <span className="score-value text-primary fw-500 fs-20 margin-right-4">{rcScoreApplicable ? formatQuestionScore(currentQuestion.response?.rcScore) : '-'}</span>
                    <span className="score-label fs-16 fw-500 text-2-color">{'RC Score'}</span>
                  </div>
                </div>
                <p className="horizontal-seperator-20"></p>
              </>
            )}
            {/* Comment */}
            <h3 className="fs-16 fw-600 heading-color margin-bottom-16">Comment</h3>
            <div className="rowBetween">
              <div className="d-flex align-items-center">
                <img src={Icons.calendarFill} className="icon-16" />
                <div className="margin-left-2 fs-12 fw-500 text-3-color">
                  {currentQuestion.response && currentQuestion.response.assessedAt
                    ? formatDateTime(currentQuestion.response.assessedAt)
                    : currentQuestion.assessedAt
                      ? formatDateTime(currentQuestion.assessedAt)
                      : ''}
                </div>
              </div>
              {editComment && <img src={Icons.edit} alt="edit" className="cursor-pointer icon-16 margin-left-4" onClick={handleEditClick} />}
            </div>

            <p className="fs-14 fw-400 text-2-color horizontal-seperator-20 margin-top-8">
              {currentQuestion.response && typeof currentQuestion.response.assessorRemarks !== 'undefined'
                ? currentQuestion.response.assessorRemarks
                : typeof currentQuestion.assessorRemarks !== 'undefined'
                  ? currentQuestion.assessorRemarks
                  : ''}
            </p>

            {/* Evidence */}
            <h4 className="fs-16 fw-600 heading-color margin-bottom-16">Evidence</h4>

            <div className="row g-2">
              {(() => {
                const evidences =
                  currentQuestion.response && Array.isArray(currentQuestion.response.evidences)
                    ? currentQuestion.response.evidences
                    : Array.isArray(currentQuestion.evidence)
                      ? currentQuestion.evidence
                      : [];
                if (!evidences || evidences.length === 0) {
                  return <p className="text-muted">No Evidence</p>;
                }
                return evidences.map((evidence, idx) => (
                  <div className="col-12 col-md-6" key={idx}>
                    <AppAssessmentEvidenceImage evidence={evidence} />
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppViewAssessmentQuestions;
