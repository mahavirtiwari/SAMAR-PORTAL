/**
 * Renders an admin-editable content block (Settings → Content & Disclaimers),
 * or `children` — the built-in text — until it loads or if it is unavailable.
 *
 * HTML blocks are sanitised by the API before storage (HTMLPurifier), so they
 * are rendered as markup; text blocks are rendered as plain text.
 */
const ContentBlock = ({ block, className, as: Tag = 'div', children }) => {
  if (!block?.body) {
    return children ?? null;
  }
  if (block.format === 'html') {
    // Sanitised server-side on save (HTMLPurifier).
    return <Tag className={className} dangerouslySetInnerHTML={{ __html: block.body }} />;
  }
  return <Tag className={className}>{block.body}</Tag>;
};

export default ContentBlock;
