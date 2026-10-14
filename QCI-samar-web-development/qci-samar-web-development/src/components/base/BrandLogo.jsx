import useBranding from '../../hooks/useBranding';

/**
 * A replaceable logo (Settings → Branding & Logos): the uploaded image, or
 * `fallback` (the bundled image) until it loads or when none is uploaded.
 * Wrapped in a link that opens in a new tab when the logo has a link URL;
 * pass `linked={false}` where the logo sits inside another control.
 */
const BrandLogo = ({ brandKey, fallback, alt, className, style, linked = true }) => {
  const branding = useBranding();
  const asset = branding[brandKey];
  const img = <img src={asset?.image || fallback} alt={alt || asset?.title || ''} className={className} style={style} />;

  if (linked && asset?.linkUrl) {
    return (
      <a href={asset.linkUrl} target="_blank" rel="noopener noreferrer" className="brand-logo-link" title={asset.title}>
        {img}
      </a>
    );
  }
  return img;
};

export default BrandLogo;
