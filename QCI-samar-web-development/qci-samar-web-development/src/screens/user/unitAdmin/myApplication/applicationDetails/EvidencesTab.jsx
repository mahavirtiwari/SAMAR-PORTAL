import { useMemo } from 'react';
import { Accordion } from 'react-bootstrap';
import AppSiteTourCard from '../../../../../components/base/AppSiteTourCard';
import { formatDate, formatPersonNameWithDesignation } from '../../../../../utils/formatters';

const EvidencesTab = ({ evidences, loading }) => {
  // Group evidences by parameterName
  const groupedEvidences = useMemo(() => {
    if (!evidences?.length) {
      return {};
    }
    return evidences.reduce((acc, evidence) => {
      const key = evidence.parameterName || 'Other';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(evidence);
      return acc;
    }, {});
  }, [evidences]);

  if (loading) {
    return <div className="details-card text-center p-4">Loading...</div>;
  }

  if (!evidences?.length) {
    return <div className="details-card text-center p-4">No evidences available.</div>;
  }

  const parameterNames = Object.keys(groupedEvidences);

  return (
    <>
      {parameterNames.map((paramName, paramIdx) => (
        <Accordion key={paramIdx} defaultActiveKey="0" alwaysOpen>
          <Accordion.Item eventKey="0">
            <Accordion.Header>{paramName}</Accordion.Header>
            <Accordion.Body className="pt-0">
              <div className="subAccordionBx">
                <Accordion defaultActiveKey="0" alwaysOpen>
                  {groupedEvidences[paramName].map((evidence, evidenceIdx) => (
                    <Accordion.Item key={evidence.id || evidenceIdx} eventKey={String(evidenceIdx)}>
                      <Accordion.Header>
                        {evidence.questionCode ? `${evidence.questionCode} - ` : ''}
                        {evidence.questionText || 'Evidence'}
                      </Accordion.Header>
                      <Accordion.Body className="p-0 pb-4 accordion-body">
                        <div className="leadership-mindset-content">
                          <div className="leadership-mindset-item">
                            <AppSiteTourCard
                              picture={evidence}
                              lat={evidence.latitude}
                              long={evidence.longitude}
                              dateString={evidence.capturedAt ? formatDate(evidence.capturedAt) : '-'}
                              uploader={formatPersonNameWithDesignation(evidence.uploadedByUser)}
                            />
                            <div className="mt-2">
                              <span className="fs-12 fw-500 text-2-color">{evidence.fileName}</span>
                              <span className="fs-12 fw-400 text-3-color margin-left-8">{evidence.formattedSize}</span>
                              {evidence.uploadedByUser && <span className="fs-12 fw-400 text-3-color margin-left-8">Uploaded by: {formatPersonNameWithDesignation(evidence.uploadedByUser)}</span>}
                            </div>
                          </div>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      ))}
    </>
  );
};

export default EvidencesTab;
