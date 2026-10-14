import useContentBlocks from '../../hooks/useContentBlocks';
import ContentBlock from '../base/ContentBlock';

// The two final declarations of the application form (manufacturing and
// services, enterprise and unit admin). Editable in Settings → Content &
// Disclaimers; the JSX below is the built-in fallback.
const KEYS = ['application_declaration_accuracy', 'application_declaration_discretion'];

export const DeclarationAccuracyText = () => {
  const blocks = useContentBlocks(KEYS);
  return (
    <ContentBlock block={blocks.application_declaration_accuracy} as="span" className="content-block d-block">
      I declare that all information provided in this application is true and accurate to the best of my knowledge. I understand that if any information is found to be false or misleading:
      <ul>
        <li>My application may be rejected</li>
        <li>Any rating or certification granted may be cancelled</li>
        <li>Appropriate action may be taken by DRDO or QCI</li>
      </ul>
    </ContentBlock>
  );
};

export const DeclarationDiscretionText = () => {
  const blocks = useContentBlocks(KEYS);
  return blocks.application_declaration_discretion?.body || 'I understand that the acceptance of my application is at the sole discretion of DRDO and QCI.';
};
