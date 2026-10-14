import { useRef } from 'react';

/**
 * HTML editor for admin-authored content (Settings → Email Templates and
 * Content & Disclaimers): a source textarea with a small formatting toolbar
 * and one-click {{placeholder}} insertion.
 *
 * A source editor is used rather than a WYSIWYG one because email bodies are
 * table-based with inline styles, which WYSIWYG editors rewrite or drop. The
 * rendered result is shown next to it by HtmlPreviewFrame.
 */
const TOOLS = [
  { label: 'B', title: 'Bold', open: '<strong>', close: '</strong>', style: { fontWeight: 700 } },
  { label: 'I', title: 'Italic', open: '<em>', close: '</em>', style: { fontStyle: 'italic' } },
  { label: 'U', title: 'Underline', open: '<u>', close: '</u>', style: { textDecoration: 'underline' } },
  { label: '¶', title: 'Paragraph', open: '<p>', close: '</p>' },
  { label: '• List', title: 'Bulleted list', open: '<ul>\n  <li>', close: '</li>\n</ul>' },
  { label: '1. List', title: 'Numbered list', open: '<ol>\n  <li>', close: '</li>\n</ol>' },
  { label: 'Link', title: 'Link', open: '<a href="https://">', close: '</a>' },
];

const HtmlTemplateEditor = ({ label, value, onChange, placeholders = [], rows = 18, error, disabled = false }) => {
  const textareaRef = useRef(null);

  const insert = (open, close = '') => {
    const el = textareaRef.current;
    const text = value ?? '';
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const next = text.slice(0, start) + open + text.slice(start, end) + close + text.slice(end);
    onChange(next);
    // Restore the caret after React re-renders the textarea.
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const caret = start + open.length + (end - start);
        el.setSelectionRange(caret, caret);
      }
    });
  };

  return (
    <div className="html-template-editor">
      {label && <div className="fs-14 fw-500 text-1-color margin-bottom-8">{label}</div>}
      <div className="d-flex flex-wrap align-items-center gap-2 margin-bottom-8">
        {TOOLS.map(tool => (
          <button key={tool.title} type="button" className="html-editor-tool" title={tool.title} style={tool.style} disabled={disabled} onClick={() => insert(tool.open, tool.close)}>
            {tool.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className={`html-editor-textarea${error ? ' has-error' : ''}`}
        value={value ?? ''}
        rows={rows}
        spellCheck={false}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
      />
      {error && <div className="fs-12 text-danger margin-top-4">{error}</div>}
      {placeholders.length > 0 && (
        <div className="margin-top-12">
          <div className="fs-12 fw-500 text-3-color margin-bottom-4">Placeholders — click to insert at the cursor:</div>
          <div className="d-flex flex-wrap gap-2">
            {placeholders.map(name => (
              <button key={name} type="button" className="html-editor-placeholder" disabled={disabled} onClick={() => insert(`{{${name}}}`)}>
                {`{{${name}}}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Shows HTML in a sandboxed iframe: no scripts run and the page's styles do
 * not leak in, so the admin sees what recipients will see.
 */
export const HtmlPreviewFrame = ({ html, height = 520, title = 'Preview' }) => <iframe title={title} sandbox="" srcDoc={html || ''} className="html-preview-frame" style={{ height }} />;

/** Wraps a content-block body in a minimal document for HtmlPreviewFrame. */
export const contentPreviewDocument = (body, format) => {
  const inner = format === 'html' ? body || '' : (body || '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Inter, Arial, sans-serif; font-size: 14px; color: #252F4A; line-height: 1.55; margin: 16px; }
    h2 { font-size: 20px; font-weight: 600; margin: 20px 0 10px; } h3 { font-size: 16px; font-weight: 600; margin: 14px 0 6px; }
    p { margin: 0 0 12px; } ol, ul { padding-left: 20px; } li { margin-bottom: 8px; } a { color: #1B84FF; }
  </style></head><body>${inner}</body></html>`;
};

export default HtmlTemplateEditor;
