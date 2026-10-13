import { useEffect } from 'react';

function Page({ title, children }) {
  useEffect(() => {
    document.title = title ? `${title} | QCI SAMAR` : 'QCI SAMAR';
  }, [title]);
  return children;
}

export default Page;
