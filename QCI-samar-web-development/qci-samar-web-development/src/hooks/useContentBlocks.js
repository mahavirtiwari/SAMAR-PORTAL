import { useEffect, useState } from 'react';
import { getContentBlocks } from '../services/api/utils/ContentBlockService';

/**
 * Loads admin-editable content blocks (Settings → Content & Disclaimers) by
 * key. Returns a map of key -> block; a key is absent until loaded or when it
 * could not be fetched, so callers render their built-in text in that case.
 */
const useContentBlocks = keys => {
  const keyList = keys.join(',');
  const [blocks, setBlocks] = useState({});

  useEffect(() => {
    let cancelled = false;
    getContentBlocks(keyList.split(',')).then(result => {
      if (!cancelled) {
        setBlocks(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [keyList]);

  return blocks;
};

export default useContentBlocks;
