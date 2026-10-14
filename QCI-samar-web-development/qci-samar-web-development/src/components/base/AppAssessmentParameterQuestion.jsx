import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Icons from '../../constants/Icons';
import { getResponsesAction, updateResponseByQuestionAction } from '../../redux/action/common/ApplicationAssessmentAction';
import { isServiceSector } from '../../utils/assessmentExecution';
import { formatQuestionScore, resolveDisplayedSelectedOption } from '../../utils/assessmentScoreUtils';
import { formatDateTime } from '../../utils/formatters';
import EditCommentModal from '../modals/EditCommentModal';
import AppAssessmentEvidenceImage from './AppAssessmentEvidenceImage';
import AppButton from './AppButton';
import AppIconButton from './AppIconButton';

const AppAssessmentParameterQuestion = ({
  onClick,
  sendBackBtn,
  score,
  editComment = false,
  propParameterId,
  propParameter,
  assessmentId,
  isScoreVisible = true,
  InProgress,
  rcScoreApplicable = false,
}) => {
  const { responses, updateResponseByQuestionResult } = useSelector(state => state.ApplicationAssessment);
  const { assessment } = useSelector(state => state.Assessment || {});
  const serviceSector = isServiceSector(assessment?.data?.assessment || assessment?.assessment || assessment);
  // Choose parameter to display: `propParameter` > `propParameterId` from props > fallback null
  const parameter = propParameter ? propParameter : propParameterId ? responses?.parameters?.find(p => String(p.id) === String(propParameterId)) : null;
  const questionsSource = parameter?.questions ?? responses?.questions;
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
          return { id: o.id ?? String(i), text: o.text ?? '', ...o };
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
            return { id: k ?? String(i), text: String(v) };
          }
          return { id: v.id ?? k ?? String(i), text: v.text ?? '', ...v };
        })
        .filter(Boolean);
    }
    return [];
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
      const options = normalizeOptions(q?.options);
      defaults[q.id] = options[2]?.id; // default to 3rd option like screenshot
    });
    return defaults;
  };

  const [selectedAnswers, setSelectedAnswers] = useState(getDefaultAnswers());
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const dispatch = useDispatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [comment, setComment] = useState('');
  const handleSaveComment = async newComment => {
    setComment(newComment);
    // derive assessmentId from responses where possible

    const questionId = currentQuestion?.id;

    if (assessmentId && questionId) {
      await dispatch(updateResponseByQuestionAction({ assessmentId, questionId, data: { assessorRemarks: newComment, selectedOption: selectedAnswers[questionId] } }));
      await dispatch(getResponsesAction(assessmentId));
    }
  };

  useEffect(() => {
    if (updateResponseByQuestionResult) {
      setModalOpen(false);
    }
  }, [updateResponseByQuestionResult]);
  const handleEditClick = () => {
    setModalOpen(true);
  };
  const handleCloseModal = () => {
    setModalOpen(false);
  };
  const questionsList = Array.isArray(questionsSource)
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

  const currentQuestion = questionsList[currentQIndex] || { id: null, questionText: '', options: [], response: {} };
  const optionsDisabled = Boolean(currentQuestion?.response?.selectedOption);

  useEffect(() => {
    setComment(currentQuestion?.response?.assessorRemarks ?? '');
  }, [currentQuestion?.id, currentQuestion?.response?.assessorRemarks]);

  // currentQuestion normalized above
  const handleOptionSelect = (questionId, optionId) => {
    if (optionsDisabled) {
      return;
    }
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const goNext = () => {
    const total = questionsList.length;
    if (currentQIndex < total - 1) {
      setCurrentQIndex(currentQIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentQIndex > 0) {
      setCurrentQIndex(currentQIndex - 1);
    }
  };

  return (
    <div className="details-card">
      <div className="row">
        <div className="d-flex align-items-center justify-content-between margin-bottom-40">
          <AppButton variant="secondary" size="medium" leftIconStyle={'icon-24 me-0'} leftIcon={Icons.leftBlueArrow} buttonPaddingX="0" minWidth={45} onClick={goPrev} disabled={currentQIndex === 0} />

          <div className="d-flex align-items-end">
            <span className="fs-24 fw-600 heading-color MuiBox-root">Question {currentQIndex + 1}</span>
            <span className="fs-16 fw-600 text-2-color margin-left-2">/{questionsList.length}</span>
          </div>

          <AppButton
            variant="secondary"
            size="medium"
            leftIconStyle={'icon-24 me-0'}
            leftIcon={Icons.blueRightArrow}
            buttonPaddingX="0"
            minWidth={45}
            onClick={goNext}
            disabled={currentQIndex === questionsList.length - 1}
          />
        </div>
        {/* LEFT SIDE QUESTION */}
        <div className="col-12 col-md-8 support-form-section parameter-question-container">
          <div>
            <div className="d-flex align-items-start gap-2 mb-3">
              <h3 className="fs-16 fw-600 heading-color mb-0">
                <span>Q. </span>
                {currentQuestion.questionText}
              </h3>
            </div>
            <FormControl fullWidth>
              <RadioGroup
                value={selectedAnswers[currentQuestion.id] ?? resolveDisplayedSelectedOption(currentQuestion?.response, rcScoreApplicable)}
                onChange={e => handleOptionSelect(currentQuestion.id, e.target.value)}>
                {normalizeOptions(currentQuestion?.options)?.map(opt => (
                  <FormControlLabel
                    disabled={optionsDisabled}
                    key={opt.id}
                    value={opt.id}
                    control={
                      <Radio
                        icon={<img alt="" src={optionsDisabled ? Icons.disabledRadio : Icons.uncheck} className="icon-20" />}
                        checkedIcon={<img alt="" src={optionsDisabled ? Icons.disabledRadio : Icons.radioBtn} className="icon-20" />}
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
            {isScoreVisible && !score && (
              <>
                <div className="d-flex gap-3">
                  <div className="score-box">
                    <span className="score-value text-primary fw-500 fs-20 margin-right-4">{formatQuestionScore(currentQuestion?.response?.score)}</span>
                    <span className="score-label fs-16 fw-500 text-2-color">{serviceSector ? 'RA Score' : 'SA Score'}</span>
                  </div>
                  <div className="score-box">
                    <span className="score-value text-primary fw-500 fs-20 margin-right-4">
                      {rcScoreApplicable ? formatQuestionScore(currentQuestion?.response?.rcScore ?? currentQuestion?.rcScore) : '-'}
                    </span>
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
                <img alt="" src={Icons.calendarFill} className="icon-16" />
                <div className="margin-left-2 fs-12 fw-500 text-1-color">{formatDateTime(currentQuestion?.response?.assessedAt)}</div>
              </div>
              {editComment && InProgress && <AppIconButton icon={Icons.edit} label="Edit" iconClassName="icon-16" className="margin-left-4" onClick={handleEditClick} />}
            </div>

            <p className="fs-14 fw-400 text-2-color horizontal-seperator-20 margin-top-8">{comment || currentQuestion?.response?.assessorRemarks}</p>

            {/* Evidence */}
            <h4 className="fs-16 fw-600 heading-color margin-bottom-16">Evidence</h4>

            <div className="row g-2">
              {(() => {
                const evidences = Array.isArray(currentQuestion?.response?.evidences) ? currentQuestion.response.evidences : Array.isArray(currentQuestion?.evidence) ? currentQuestion.evidence : [];
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
      <EditCommentModal show={modalOpen} handleClose={handleCloseModal} comment={comment} data={currentQuestion?.response} onSave={handleSaveComment} />
    </div>
  );
};

export default AppAssessmentParameterQuestion;
